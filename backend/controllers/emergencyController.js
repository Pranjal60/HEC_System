const pool = require("../db");
const { VALID_EMERGENCY_STATUS, VALID_SEVERITY, SEVERITY_PRIORITY_MAP } = require("../config/constants");
const { rankAmbulancesByDistance, assignNearestAmbulance } = require("../services/locationService");

exports.dashboardStats = async (req, res, next) => {
    try {
        const [[total]]     = await pool.promise().query("SELECT COUNT(*) AS total FROM EMERGENCY");
        const [[active]]    = await pool.promise().query(
            "SELECT COUNT(*) AS active FROM EMERGENCY WHERE status NOT IN ('discharged','cancelled')"
        );
        const [[availAmb]]  = await pool.promise().query(
            "SELECT COUNT(*) AS cnt FROM AMBULANCE WHERE status='available'"
        );
        const [[availBeds]] = await pool.promise().query(
            "SELECT SUM(available_beds) AS cnt FROM HOSPITAL"
        );
        const [[availDocs]] = await pool.promise().query(
            "SELECT COUNT(*) AS cnt FROM DOCTOR WHERE availability='available'"
        );
        const [recent] = await pool.promise().query(
            `SELECT e.emergency_id, p.name AS patient_name, e.severity, e.status, e.request_time
             FROM EMERGENCY e JOIN PATIENT p ON e.patient_id = p.patient_id
             ORDER BY e.request_time DESC LIMIT 10`
        );
        res.json({
            total_emergencies:    total.total,
            active_emergencies:   active.active,
            available_ambulances: availAmb.cnt,
            available_beds:       availBeds.cnt || 0,
            available_doctors:    availDocs.cnt,
            recent_emergencies:   recent,
        });
    } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
    try {
        const { status, severity } = req.query;
        let sql = `
            SELECT e.*,
                   p.name            AS patient_name,
                   a.vehicle_number  AS ambulance_reg,
                   h.hospital_name,
                   b.bed_number,
                   d.name            AS doctor_name,
                   l.location_name   AS pickup_location_name
            FROM EMERGENCY e
            JOIN  PATIENT   p ON e.patient_id   = p.patient_id
            LEFT JOIN AMBULANCE a ON e.ambulance_id = a.ambulance_id
            LEFT JOIN HOSPITAL  h ON e.hospital_id  = h.hospital_id
            LEFT JOIN BED       b ON e.bed_id        = b.bed_id
            LEFT JOIN DOCTOR    d ON e.doctor_id     = d.doctor_id
            LEFT JOIN LOCATION  l ON e.pickup_location_id = l.location_id
            WHERE 1=1`;
        const vals = [];
        if (status)   { sql += " AND e.status=?";   vals.push(status); }
        if (severity) { sql += " AND e.severity=?"; vals.push(severity); }
        sql += " ORDER BY e.priority ASC, e.request_time ASC";
        const [rows] = await pool.promise().execute(sql, vals);
        res.json(rows);
    } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            `SELECT e.*,
                    p.name            AS patient_name,
                    a.vehicle_number  AS ambulance_reg,
                    h.hospital_name,
                    b.bed_number,
                    d.name            AS doctor_name,
                    l.location_name   AS pickup_location_name
             FROM EMERGENCY e
             JOIN  PATIENT   p ON e.patient_id   = p.patient_id
             LEFT JOIN AMBULANCE a ON e.ambulance_id = a.ambulance_id
             LEFT JOIN HOSPITAL  h ON e.hospital_id  = h.hospital_id
             LEFT JOIN BED       b ON e.bed_id        = b.bed_id
             LEFT JOIN DOCTOR    d ON e.doctor_id     = d.doctor_id
             LEFT JOIN LOCATION  l ON e.pickup_location_id = l.location_id
             WHERE e.emergency_id=?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Emergency not found." });
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
    try {
        const { patient_id, hospital_id, pickup_location_id, severity, priority } = req.body;
        if (!patient_id || !hospital_id || !severity)
            return res.status(400).json({ error: "patient_id, hospital_id and severity are required." });
        if (!VALID_SEVERITY.includes(severity.toLowerCase()))
            return res.status(400).json({ error: "Invalid severity. Use: " + VALID_SEVERITY.join(", ") });

        // Validate pickup location if provided
        if (pickup_location_id) {
            const [locRows] = await pool.promise().execute(
                "SELECT location_id FROM LOCATION WHERE location_id=? AND is_active=1",
                [pickup_location_id]
            );
            if (!locRows.length)
                return res.status(400).json({ error: "Invalid or inactive pickup_location_id." });
        }

        const finalPriority = priority || SEVERITY_PRIORITY_MAP[severity.toLowerCase()] || 5;
        const [result] = await pool.promise().execute(
            `INSERT INTO EMERGENCY
             (patient_id, hospital_id, pickup_location_id, severity, priority, request_time, status)
             VALUES (?,?,?,?,?,NOW(),'pending')`,
            [patient_id, hospital_id,
             pickup_location_id ? Number(pickup_location_id) : null,
             severity.toLowerCase(), finalPriority]
        );
        const [rows] = await pool.promise().execute(
            `SELECT e.*, l.location_name AS pickup_location_name
             FROM EMERGENCY e
             LEFT JOIN LOCATION l ON e.pickup_location_id = l.location_id
             WHERE e.emergency_id=?`,
            [result.insertId]
        );
        res.status(201).json(rows[0]);
    } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
    const conn = await pool.promise().getConnection();
    try {
        await conn.beginTransaction();
        const { ambulance_id, hospital_id, bed_id, doctor_id, status,
                dispatch_time, pickup_time, admission_time, discharge_time } = req.body;

        const [existing] = await conn.execute(
            "SELECT * FROM EMERGENCY WHERE emergency_id=? FOR UPDATE", [req.params.id]
        );
        if (!existing.length) { await conn.rollback(); return res.status(404).json({ error: "Emergency not found." }); }
        if (status && !VALID_EMERGENCY_STATUS.includes(status)) {
            await conn.rollback();
            return res.status(400).json({ error: "Invalid status. Use: " + VALID_EMERGENCY_STATUS.join(", ") });
        }

        const fields = [], vals = [];
        if (ambulance_id   !== undefined) { fields.push("ambulance_id=?");   vals.push(ambulance_id); }
        if (hospital_id    !== undefined) { fields.push("hospital_id=?");    vals.push(hospital_id); }
        if (bed_id         !== undefined) { fields.push("bed_id=?");         vals.push(bed_id); }
        if (doctor_id      !== undefined) { fields.push("doctor_id=?");      vals.push(doctor_id); }
        if (status         !== undefined) { fields.push("status=?");         vals.push(status); }
        if (dispatch_time  !== undefined) { fields.push("dispatch_time=?");  vals.push(dispatch_time); }
        if (pickup_time    !== undefined) { fields.push("pickup_time=?");    vals.push(pickup_time); }
        if (admission_time !== undefined) { fields.push("admission_time=?"); vals.push(admission_time); }
        if (discharge_time !== undefined) { fields.push("discharge_time=?"); vals.push(discharge_time); }

        if (!fields.length) { await conn.rollback(); return res.status(400).json({ error: "No fields to update." }); }
        vals.push(req.params.id);
        await conn.execute(`UPDATE EMERGENCY SET ${fields.join(",")} WHERE emergency_id=?`, vals);

        // Ambulance → in_transit when admitted
        if (ambulance_id && status === "admitted") {
            await conn.execute(
                "UPDATE AMBULANCE SET status='in_transit', dispatched_to=? WHERE ambulance_id=?",
                [req.params.id, ambulance_id]
            );
        }

        // Admitted → mark bed occupied, doctor not_available, decrement hospital counter
        if (status === "admitted") {
            const emg = existing[0];
            const useBed = bed_id !== undefined ? bed_id : emg.bed_id;
            const useDoc = doctor_id !== undefined ? doctor_id : emg.doctor_id;
            if (useBed) {
                const [beds] = await conn.execute("SELECT hospital_id FROM BED WHERE bed_id=?", [useBed]);
                await conn.execute("UPDATE BED SET status='occupied' WHERE bed_id=?", [useBed]);
                if (beds.length)
                    await conn.execute(
                        "UPDATE HOSPITAL SET available_beds=GREATEST(available_beds-1,0) WHERE hospital_id=?",
                        [beds[0].hospital_id]
                    );
            }
            if (useDoc)
                await conn.execute("UPDATE DOCTOR SET availability='busy' WHERE doctor_id=?", [useDoc]);
        }

        // Discharged / Cancelled → release all resources
        if (status === "discharged" || status === "cancelled") {
            const emg = existing[0];
            if (emg.ambulance_id)
                await conn.execute(
                    "UPDATE AMBULANCE SET status='available', dispatched_to=NULL WHERE ambulance_id=?",
                    [emg.ambulance_id]
                );
            if (emg.bed_id) {
                const [beds] = await conn.execute("SELECT hospital_id FROM BED WHERE bed_id=?", [emg.bed_id]);
                await conn.execute("UPDATE BED SET status='available' WHERE bed_id=?", [emg.bed_id]);
                if (beds.length)
                    await conn.execute(
                        "UPDATE HOSPITAL SET available_beds=available_beds+1 WHERE hospital_id=?",
                        [beds[0].hospital_id]
                    );
            }
            if (emg.doctor_id)
                await conn.execute(
                    "UPDATE DOCTOR SET availability='available' WHERE doctor_id=?", [emg.doctor_id]
                );
        }

        await conn.commit();
        const [updated] = await conn.execute(
            "SELECT * FROM EMERGENCY WHERE emergency_id=?", [req.params.id]
        );
        res.json(updated[0]);
    } catch (err) { await conn.rollback(); next(err); }
    finally { conn.release(); }
};

// Retries up to 3 times on InnoDB deadlock (ER_LOCK_DEADLOCK / errno 1213)
exports.quickDispatch = async (req, res, next) => {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const conn = await pool.promise().getConnection();
    try {
        await conn.beginTransaction();
        const { patient_name, severity, pickup_location_id } = req.body;
        if (!patient_name || !severity)
            return res.status(400).json({ error: "patient_name and severity are required." });
        if (!VALID_SEVERITY.includes(severity.toLowerCase()))
            return res.status(400).json({ error: "Invalid severity. Use: " + VALID_SEVERITY.join(", ") });

        const sev = severity.toLowerCase();
        const priority = SEVERITY_PRIORITY_MAP[sev] || 4;

        // 1. Find or create patient
        let [patients] = await conn.execute(
            "SELECT patient_id FROM PATIENT WHERE name = ? LIMIT 1", [patient_name.trim()]
        );
        let patient_id;
        if (patients.length) {
            patient_id = patients[0].patient_id;
        } else {
            const guestUsername = "guest_" + Date.now();
            const [uRes] = await conn.execute(
                "INSERT INTO USER (username, password_hash, role) VALUES (?, ?, 'Patient')",
                [guestUsername, "guest_nologin"]
            );
            const [pRes] = await conn.execute(
                "INSERT INTO PATIENT (user_id, name) VALUES (?, ?)",
                [uRes.insertId, patient_name.trim()]
            );
            patient_id = pRes.insertId;
        }

        // 2. Select ambulance (nearest if pickup location provided, otherwise first available)
        let ambulance = null;
        if (pickup_location_id) {
            const { ranked } = await rankAmbulancesByDistance(Number(pickup_location_id)).catch(() => ({ ranked: [] }));
            if (ranked.length) {
                ambulance = ranked[0];
            }
        }
        if (!ambulance) {
            const [ambulances] = await conn.execute(
                "SELECT ambulance_id, vehicle_number FROM AMBULANCE WHERE status = 'available' LIMIT 1"
            );
            if (!ambulances.length) { await conn.rollback(); return res.status(503).json({ error: "No ambulances available right now." }); }
            ambulance = ambulances[0];
        }

        // 3. Hospital with free bed
        const [hospitals] = await conn.execute(
            "SELECT hospital_id, hospital_name FROM HOSPITAL WHERE available_beds >= 1 AND status = 'active' ORDER BY hospital_id LIMIT 1"
        );
        if (!hospitals.length) { await conn.rollback(); return res.status(503).json({ error: "No hospitals with available beds right now." }); }
        const hospital = hospitals[0];

        // 4. Available bed in that hospital
        const [beds] = await conn.execute(
            "SELECT bed_id, bed_number, bed_type FROM BED WHERE hospital_id = ? AND status = 'available' LIMIT 1",
            [hospital.hospital_id]
        );
        if (!beds.length) { await conn.rollback(); return res.status(503).json({ error: "No available beds in the selected hospital." }); }
        const bed = beds[0];

        // 5. Available doctor (prefer same hospital, fallback to any)
        const [doctors] = await conn.execute(
            "SELECT doctor_id, name AS doctor_name FROM DOCTOR WHERE availability = 'available' AND hospital_id = ? LIMIT 1",
            [hospital.hospital_id]
        );
        let doctor = doctors[0];
        if (!doctor) {
            const [anyDocs] = await conn.execute(
                "SELECT doctor_id, name AS doctor_name FROM DOCTOR WHERE availability = 'available' LIMIT 1"
            );
            doctor = anyDocs[0] || null;
        }

        // 6. Create emergency
        const [emgRes] = await conn.execute(
            `INSERT INTO EMERGENCY
             (patient_id, ambulance_id, hospital_id, bed_id, doctor_id,
              pickup_location_id, severity, priority, request_time, admission_time, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 'admitted')`,
            [patient_id, ambulance.ambulance_id, hospital.hospital_id,
             bed.bed_id, doctor ? doctor.doctor_id : null,
             pickup_location_id ? Number(pickup_location_id) : null, sev, priority]
        );
        const emergency_id = emgRes.insertId;

        // 7. Mark resources
        await conn.execute(
            "UPDATE AMBULANCE SET status='in_transit', dispatched_to=? WHERE ambulance_id=?",
            [emergency_id, ambulance.ambulance_id]
        );
        await conn.execute("UPDATE BED SET status='occupied' WHERE bed_id=?", [bed.bed_id]);
        await conn.execute(
            "UPDATE HOSPITAL SET available_beds=GREATEST(available_beds-1,0) WHERE hospital_id=?",
            [hospital.hospital_id]
        );
        if (doctor)
            await conn.execute(
                "UPDATE DOCTOR SET availability='busy' WHERE doctor_id=?", [doctor.doctor_id]
            );

        await conn.commit();
        return res.status(201).json({
            message:    "Emergency created and resources assigned.",
            emergency_id,
            patient:   { patient_id, name: patient_name.trim() },
            severity:  sev,
            priority,
            ambulance: { ambulance_id: ambulance.ambulance_id, vehicle_number: ambulance.vehicle_number },
            hospital:  { hospital_id: hospital.hospital_id, hospital_name: hospital.hospital_name },
            bed:       { bed_id: bed.bed_id, bed_number: bed.bed_number, bed_type: bed.bed_type },
            doctor:    doctor ? { doctor_id: doctor.doctor_id, name: doctor.doctor_name } : null,
        });
    } catch (err) {
        await conn.rollback();
        // ER_LOCK_DEADLOCK (errno 1213) — safe to retry, transaction was fully rolled back
        if (err.errno === 1213 && attempt < MAX_RETRIES) {
            conn.release();
            const delay = attempt * 150; // 150ms, 300ms back-off
            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // retry the outer loop
        }
        next(err);
        return;
    } finally { conn.release(); }
    } // end retry loop
};

// Deletes all demo emergencies (guest_ patient accounts) and releases their resources
exports.demoCleanup = async (req, res, next) => {
    const conn = await pool.promise().getConnection();
    try {
        await conn.beginTransaction();

        const [guestPatients] = await conn.execute(
            `SELECT p.patient_id FROM PATIENT p
             JOIN USER u ON p.user_id = u.user_id
             WHERE u.username LIKE 'guest_%'`
        );
        if (!guestPatients.length) {
            await conn.rollback();
            return res.json({ message: "No demo data found.", removed: 0 });
        }
        const pids = guestPatients.map(r => r.patient_id);
        const pidPlaceholders = pids.map(() => '?').join(',');

        const [activeEmgs] = await conn.execute(
            `SELECT emergency_id, ambulance_id, bed_id, doctor_id, hospital_id
             FROM EMERGENCY
             WHERE patient_id IN (${pidPlaceholders})
               AND status NOT IN ('discharged','cancelled')`,
            pids
        );

        for (const e of activeEmgs) {
            if (e.ambulance_id)
                await conn.execute(
                    "UPDATE AMBULANCE SET status='available', dispatched_to=NULL WHERE ambulance_id=?",
                    [e.ambulance_id]
                );
            if (e.bed_id) {
                await conn.execute("UPDATE BED SET status='available' WHERE bed_id=?", [e.bed_id]);
                if (e.hospital_id)
                    await conn.execute(
                        "UPDATE HOSPITAL SET available_beds=available_beds+1 WHERE hospital_id=?",
                        [e.hospital_id]
                    );
            }
            if (e.doctor_id)
                await conn.execute(
                    "UPDATE DOCTOR SET availability='available' WHERE doctor_id=?", [e.doctor_id]
                );
        }

        const [allEmgs] = await conn.execute(
            `SELECT emergency_id FROM EMERGENCY WHERE patient_id IN (${pidPlaceholders})`, pids
        );
        const eids = allEmgs.map(r => r.emergency_id);

        if (eids.length) {
            const ePlaceholders = eids.map(() => '?').join(',');
            await conn.execute(`DELETE FROM RESOURCE_ALLOCATION_LOG WHERE emergency_id IN (${ePlaceholders})`, eids);
            await conn.execute(`DELETE FROM SCHEDULING_LOG WHERE emergency_id IN (${ePlaceholders})`, eids);
            // payments → bills → treatments → emergencies
            const [bills] = await conn.execute(
                `SELECT bill_id FROM BILL WHERE emergency_id IN (${ePlaceholders})`, eids
            );
            if (bills.length) {
                const bids = bills.map(b => b.bill_id);
                await conn.execute(
                    `DELETE FROM PAYMENT WHERE bill_id IN (${bids.map(() => '?').join(',')})`, bids
                );
                await conn.execute(
                    `DELETE FROM BILL WHERE bill_id IN (${bids.map(() => '?').join(',')})`, bids
                );
            }
            await conn.execute(`DELETE FROM TREATMENT WHERE emergency_id IN (${ePlaceholders})`, eids);
            await conn.execute(`DELETE FROM EMERGENCY WHERE emergency_id IN (${ePlaceholders})`, eids);
        }

        await conn.execute(`DELETE FROM PATIENT WHERE patient_id IN (${pidPlaceholders})`, pids);
        await conn.execute(
            `DELETE FROM USER WHERE username LIKE 'guest_%'`
        );

        await conn.commit();
        res.json({
            message: `Demo cleanup complete. Removed ${eids.length} emergency${eids.length !== 1 ? 'ies' : 'y'} and ${pids.length} demo patient${pids.length !== 1 ? 's' : ''}.`,
            removed_emergencies: eids.length,
            removed_patients:    pids.length,
        });
    } catch (err) { await conn.rollback(); next(err); }
    finally { conn.release(); }
};

exports.assignNearestAmbulance = async (req, res, next) => {
    try {
        const emergency_id = req.params.id;
        const { pickup_location_id, required_type } = req.body;
        const result = await assignNearestAmbulance({
            emergency_id: Number(emergency_id),
            pickup_location_id: pickup_location_id ? Number(pickup_location_id) : undefined,
            required_type: required_type || null
        });
        res.json(result);
    } catch (err) { next(err); }
};
