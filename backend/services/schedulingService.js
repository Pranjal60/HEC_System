// Scheduling Service — helpers for the C scheduling binary (Member 4)

const { execFile } = require("child_process");
const path = require("path");

const EXECUTABLE = path.join(__dirname, "../../c_modules/member4_simple");

// Parse tab-separated output from member4_simple into structured sections
function parseSchedulerOutput(output) {
    const sections = {};
    let current = null;
    const lines = output.replace(/\r/g, "").split("\n");

    for (const line of lines) {
        const t = line.trim();
        if (!t) continue;

        const headerMatch = t.match(/^---\s+(.+?)\s+---$/);
        if (headerMatch) {
            current = headerMatch[1].trim();
            sections[current] = { processes: [], averages: {} };
            continue;
        }
        if (!current) continue;
        if (t.startsWith("ID\t")) continue;

        if (t.startsWith("Average waiting")) {
            sections[current].averages.avg_waiting_time = parseFloat(t.split(":")[1]) || 0;
        } else if (t.startsWith("Average turnaround")) {
            sections[current].averages.avg_turnaround_time = parseFloat(t.split(":")[1]) || 0;
        } else if (t.startsWith("Average response")) {
            sections[current].averages.avg_response_time = parseFloat(t.split(":")[1]) || 0;
        } else {
            const parts = t.split("\t");
            if (parts.length >= 7) {
                sections[current].processes.push({
                    id:              parts[0],
                    arrival_time:    parseInt(parts[1]),
                    burst_time:      parseInt(parts[2]),
                    completion_time: parseInt(parts[3]),
                    waiting_time:    parseInt(parts[4]),
                    turnaround_time: parseInt(parts[5]),
                    response_time:   parseInt(parts[6]),
                });
            }
        }
    }
    return sections;
}

// Run the C binary and return stdout
function runScheduler(stdinData) {
    return new Promise((resolve, reject) => {
        const child = execFile(EXECUTABLE, [], { timeout: 10000 }, (err, out) => {
            if (err && !out) reject(new Error("Scheduler failed: " + err.message));
            else resolve(out || "");
        });
        child.stdin.write(stdinData);
        child.stdin.end();
    });
}

module.exports = { parseSchedulerOutput, runScheduler, EXECUTABLE };
