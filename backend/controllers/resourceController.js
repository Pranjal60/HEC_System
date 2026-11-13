const fs   = require("fs");
const pool = require("../db");
const { loadState, callCpp, EXECUTABLE } = require("../services/resourceService");

exports.status = (req, res) => {
    const exists = fs.existsSync(EXECUTABLE);
    res.json({
        executable: EXECUTABLE,
        built: exists,
        message: exists ? "Resource manager ready." : "Build: cd integrated/c_modules && make",
    });
};

exports.logs = async (req, res, next) => {
    try {
        const { emergency_id, resource_type, state } = req.query;
        let sql = "SELECT * FROM RESOURCE_ALLOCATION_LOG WHERE 1=1";
        const vals = [];
        if (emergency_id)  { sql += " AND emergency_id=?";  vals.push(emergency_id); }
        if (resource_type) { sql += " AND resource_type=?"; vals.push(resource_type.toUpperCase()); }
        if (state)         { sql += " AND state=?";         vals.push(state); }
        sql += " ORDER BY datetime DESC LIMIT 200";
        const [rows] = await pool.promise().execute(sql, vals);
        res.json(rows);
    } catch (err) { next(err); }
};

exports.request = async (req, res, next) => {
    try {
        const { emergency_id, resource_type, resource_id, hospital_id = -1 } = req.body;
        if (!emergency_id || !resource_type || !resource_id)
            return res.status(400).json({ error: "emergency_id, resource_type and resource_id are required." });

        const state  = await loadState();
        const result = await callCpp(state, {
            action:        "processRequest",
            emergency_id:  Number(emergency_id),
            resource_type: resource_type.toUpperCase(),
            resource_id:   Number(resource_id),
            hospital_id:   Number(hospital_id),
        });

        const stateMap = { APPROVED: "allocated", WAITING: "waiting", REJECTED: "denied" };

        // decision_reason column may not exist on older DB migrations
        const [cols] = await pool.promise().query(
            "SHOW COLUMNS FROM RESOURCE_ALLOCATION_LOG LIKE 'decision_reason'"
        );
        if (cols.length) {
            await pool.promise().execute(
                `INSERT INTO RESOURCE_ALLOCATION_LOG
                 (emergency_id, resource_type, resource_id, state, decision_reason)
                 VALUES (?,?,?,?,?)`,
                [emergency_id, resource_type.toUpperCase(), resource_id,
                 stateMap[result.decision] || "denied", result.reason || null]
            ).catch(() => {});
        } else {
            await pool.promise().execute(
                `INSERT INTO RESOURCE_ALLOCATION_LOG
                 (emergency_id, resource_type, resource_id, state)
                 VALUES (?,?,?,?)`,
                [emergency_id, resource_type.toUpperCase(), resource_id,
                 stateMap[result.decision] || "denied"]
            ).catch(() => {});
        }
        res.json(result);
    } catch (err) { next(err); }
};

exports.release = async (req, res, next) => {
    try {
        const { emergency_id, resource_type, resource_id } = req.body;
        if (!resource_type || !resource_id)
            return res.status(400).json({ error: "resource_type and resource_id are required." });

        const state  = await loadState();
        const result = await callCpp(state, {
            action:        "releaseResource",
            emergency_id:  emergency_id ? Number(emergency_id) : -1,
            resource_type: resource_type.toUpperCase(),
            resource_id:   Number(resource_id),
        });

        await pool.promise().execute(
            `INSERT INTO RESOURCE_ALLOCATION_LOG (emergency_id, resource_type, resource_id, state)
             VALUES (?,?,?,'released')`,
            [emergency_id || 0, resource_type.toUpperCase(), resource_id]
        ).catch(() => {});
        res.json(result);
    } catch (err) { next(err); }
};

exports.cancel = async (req, res, next) => {
    try {
        const { emergency_id } = req.body;
        if (!emergency_id) return res.status(400).json({ error: "emergency_id is required." });
        const state  = await loadState();
        const result = await callCpp(state, {
            action:       "cancelEmergency",
            emergency_id: Number(emergency_id),
        });
        res.json(result);
    } catch (err) { next(err); }
};

exports.deadlock = async (req, res, next) => {
    try {
        const { allocationEdges = [], requestEdges = [] } = req.body;
        const emptyState = { ambulances: [], beds: [], doctors: [], emergencies: [] };
        const result = await callCpp(emptyState, {
            action: "detectDeadlock",
            allocationEdges,
            requestEdges,
        });
        res.json(result);
    } catch (err) { next(err); }
};

exports.starvationTick = async (req, res, next) => {
    try {
        const { waitingRequests = [], ticks = 1 } = req.body;
        const emptyState = { ambulances: [], beds: [], doctors: [], emergencies: [] };
        const result = await callCpp(emptyState, {
            action: "starvationTick",
            waitingRequests,
            ticks: Number(ticks),
        });
        res.json(result);
    } catch (err) { next(err); }
};

exports.semaphoreDemo = async (req, res, next) => {
    try {
        const { permits = 3, numThreads = 8 } = req.body;
        const emptyState = { ambulances: [], beds: [], doctors: [], emergencies: [] };
        const result = await callCpp(emptyState, {
            action: "semaphoreDemo",
            permits:    Number(permits),
            numThreads: Number(numThreads),
        });
        res.json(result);
    } catch (err) { next(err); }
};
