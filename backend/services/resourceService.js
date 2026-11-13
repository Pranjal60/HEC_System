// Resource Service — loads DB state and spawns the C++ Banker's Algorithm binary (Member 5)

const pool = require("../db");
const { spawn } = require("child_process");
const path = require("path");

const EXECUTABLE = path.join(__dirname, "../../c_modules/resource_server");

// Load full resource state from DB for the C++ resource manager
async function loadState() {
    const [[rawAmbulances], [rawBeds], [rawDoctors], [rawEmergencies]] = await Promise.all([
        pool.promise().query(
            `SELECT a.ambulance_id, a.type, a.status,
                    COALESCE(l.location_name, '') AS current_location
             FROM AMBULANCE a
             LEFT JOIN LOCATION l ON a.current_location_id = l.location_id`
        ),
        pool.promise().query(
            "SELECT bed_id, hospital_id, bed_type, status FROM BED"
        ),
        pool.promise().query(
            "SELECT doctor_id, hospital_id, availability FROM DOCTOR"
        ),
        pool.promise().query(
            `SELECT emergency_id, COALESCE(hospital_id,-1) AS hospital_id, priority, status
             FROM EMERGENCY WHERE status NOT IN ('discharged','cancelled')`
        ),
    ]);

    const ambulances = rawAmbulances.map(a => ({
        ambulance_id: a.ambulance_id,
        type: a.type || "Basic",
        status: (a.status || "").toLowerCase() === "available" ? "Available" : "Dispatched",
        current_location: a.current_location || ""
    }));

    const beds = rawBeds.map(b => ({
        bed_id: b.bed_id,
        hospital_id: b.hospital_id,
        bed_type: b.bed_type,
        status: (b.status || "").toLowerCase() === "available" ? "Available" : "Occupied"
    }));

    const doctors = rawDoctors.map(d => ({
        doctor_id: d.doctor_id,
        hospital_id: d.hospital_id,
        specialization: "",
        availability: (d.availability || "").toLowerCase() === "available" ? "Available" : "Not_Available"
    }));

    const emergencies = rawEmergencies.map(e => ({
        emergency_id: e.emergency_id,
        hospital_id: e.hospital_id || -1,
        priority: e.priority || 1,
        status: (e.status || "").toLowerCase() === "pending" ? "Requested" :
                ((e.status || "").toLowerCase() === "admitted" ? "Admitted" : "Treatment")
    }));

    return { ambulances, beds, doctors, emergencies };
}

// Spawn the C++ resource_server binary, send state+command as JSON, return parsed result
function callCpp(state, command) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ state, command });
        const child = spawn(EXECUTABLE, [], { timeout: 15000 });
        let stdout = "", stderr = "";
        child.stdout.on("data", d => { stdout += d.toString(); });
        child.stderr.on("data", d => { stderr += d.toString(); });
        child.stdin.write(payload);
        child.stdin.end();
        child.on("close", () => {
            try { resolve(JSON.parse(stdout)); }
            catch { reject(new Error("C++ output parse error: " + stdout.slice(0, 200))); }
        });
        child.on("error", err => {
            if (err.code === "ENOENT")
                reject(Object.assign(
                    new Error("Resource manager not built. Run: cd c_modules && make"),
                    { status: 503 }
                ));
            else reject(err);
        });
    });
}

module.exports = { loadState, callCpp, EXECUTABLE };
