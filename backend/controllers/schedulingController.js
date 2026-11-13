const fs   = require("fs");
const pool = require("../db");
const { BURST_MAP } = require("../config/constants");
const { parseSchedulerOutput, runScheduler, EXECUTABLE } = require("../services/schedulingService");

exports.status = (req, res) => {
    const exists = fs.existsSync(EXECUTABLE);
    res.json({
        executable: EXECUTABLE,
        built: exists,
        message: exists ? "Scheduler is ready." : "Build: cd integrated/c_modules && make",
    });
};

exports.logs = async (req, res, next) => {
    try {
        const [tables] = await pool.promise().query("SHOW TABLES LIKE 'SCHEDULING_LOG'");
        if (tables.length) {
            const { algorithm, emergency_id } = req.query;
            let sql = "SELECT * FROM SCHEDULING_LOG WHERE 1=1";
            const vals = [];
            if (algorithm)    { sql += " AND algorithm=?";    vals.push(algorithm); }
            if (emergency_id) { sql += " AND emergency_id=?"; vals.push(emergency_id); }
            sql += " ORDER BY run_at DESC LIMIT 200";
            const [rows] = await pool.promise().execute(sql, vals);
            return res.json(rows);
        }
        const [rows] = await pool.promise().query(
            "SELECT * FROM OPERATION_LOG ORDER BY log_id DESC LIMIT 200"
        );
        res.json(rows);
    } catch (err) { next(err); }
};

exports.run = async (req, res, next) => {
    try {
        let { emergency_ids, quantum = 5, algorithms } = req.body;
        if (!quantum || quantum < 1) quantum = 5;

        let sql = `SELECT emergency_id, severity, priority, request_time
                   FROM EMERGENCY WHERE status NOT IN ('discharged','cancelled')`;
        const vals = [];
        if (emergency_ids && emergency_ids.length) {
            sql += " AND emergency_id IN (" + emergency_ids.map(() => "?").join(",") + ")";
            vals.push(...emergency_ids);
        }
        sql += " ORDER BY priority ASC, request_time ASC";

        const [emergencies] = await pool.promise().execute(sql, vals);
        if (!emergencies.length)
            return res.status(400).json({ error: "No eligible emergencies found." });

        const sortedByTime = [...emergencies].sort(
            (a, b) => new Date(a.request_time) - new Date(b.request_time)
        );
        const baseTime = new Date(sortedByTime[0].request_time).getTime();
        const processes = emergencies.map(e => ({
            id:           "E" + e.emergency_id,
            arrival:      Math.round((new Date(e.request_time).getTime() - baseTime) / 60000),
            burst:        BURST_MAP[e.severity] || 20,
            priority:     e.priority,
            emergency_id: e.emergency_id,
        }));

        // Build stdin for the C binary: N, then per-process id/arrival/burst/priority, then quantum
        const lines = [String(processes.length)];
        for (const p of processes) {
            lines.push(p.id, String(p.arrival), String(p.burst), String(p.priority));
        }
        lines.push(String(quantum));
        const stdinData = lines.join("\n") + "\n";

        const stdout = await runScheduler(stdinData);
        if (!stdout.trim())
            return res.status(500).json({ error: "Scheduler produced no output." });

        const parsed  = parseSchedulerOutput(stdout);
        const results = {};
        for (const key of Object.keys(parsed)) {
            const k = key.toLowerCase();
            if (k === "fcfs")              results["FCFS"]        = parsed[key];
            else if (k.includes("prior")) results["Priority"]    = parsed[key];
            else if (k.includes("round")) results["Round Robin"] = parsed[key];
        }

        // Persist results to SCHEDULING_LOG
        const [tables] = await pool.promise().query("SHOW TABLES LIKE 'SCHEDULING_LOG'");
        if (tables.length) {
            const targetAlgos = algorithms || ["FCFS", "Priority", "Round Robin"];
            for (const algo of targetAlgos) {
                const section = results[algo];
                if (!section) continue;
                for (const proc of section.processes) {
                    const match = processes.find(p => p.id === proc.id);
                    if (!match) continue;
                    await pool.promise().execute(
                        `INSERT INTO SCHEDULING_LOG
                         (emergency_id, algorithm, arrival_time, burst_time, priority_val,
                          start_time, completion_time, waiting_time, turnaround_time, response_time, quantum)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                        [match.emergency_id, algo,
                         proc.arrival_time, proc.burst_time, match.priority,
                         proc.completion_time - proc.burst_time,
                         proc.completion_time, proc.waiting_time,
                         proc.turnaround_time, proc.response_time,
                         algo === "Round Robin" ? quantum : null]
                    ).catch(() => {});
                }
            }
        }

        res.json({
            message: "Scheduling complete.",
            quantum,
            processes_count: processes.length,
            results,
        });
    } catch (err) { next(err); }
};
