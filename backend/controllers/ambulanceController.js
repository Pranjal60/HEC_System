const pool = require("../db");
const { VALID_AMBULANCE_STATUSES } = require("../config/constants");
const { rankAmbulancesByDistance, assignNearestAmbulance } = require("../services/locationService");

exports.getAll = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().query(
            `SELECT a.*, h.hospital_name,
                    l.location_name AS current_location_name
             FROM AMBULANCE a
             LEFT JOIN HOSPITAL h ON a.hospital_id = h.hospital_id
             LEFT JOIN LOCATION l ON a.current_location_id = l.location_id
             ORDER BY a.ambulance_id`
        );
        res.json(rows);
    } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            `SELECT a.*, h.hospital_name,
                    l.location_name AS current_location_name
             FROM AMBULANCE a
             LEFT JOIN HOSPITAL h ON a.hospital_id = h.hospital_id
             LEFT JOIN LOCATION l ON a.current_location_id = l.location_id
             WHERE a.ambulance_id=?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Ambulance not found." });
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
    try {
        const { hospital_id, vehicle_number, type, driver_name, driver_license,
                current_location_id, status = "available" } = req.body;
        if (!hospital_id || !vehicle_number || !driver_name)
            return res.status(400).json({ error: "hospital_id, vehicle_number and driver_name are required." });
        if (!VALID_AMBULANCE_STATUSES.includes(status))
            return res.status(400).json({ error: "Invalid status. Use: " + VALID_AMBULANCE_STATUSES.join(", ") });

        let validLocationId = null;
        if (current_location_id) {
            const [locRows] = await pool.promise().execute(
                "SELECT location_id FROM LOCATION WHERE location_id=? AND is_active=1",
                [Number(current_location_id)]
            );
            if (!locRows.length)
                return res.status(400).json({ error: "Invalid or inactive location ID." });
            validLocationId = Number(current_location_id);
        }

        const [result] = await pool.promise().execute(
            `INSERT INTO AMBULANCE
             (hospital_id, vehicle_number, type, driver_name, driver_license,
              current_location_id, status)
             VALUES (?,?,?,?,?,?,?)`,
            [hospital_id, vehicle_number, type || null, driver_name,
             driver_license || null, validLocationId, status]
        );
        const [rows] = await pool.promise().execute(
            `SELECT a.*, h.hospital_name, l.location_name AS current_location_name
             FROM AMBULANCE a
             LEFT JOIN HOSPITAL h ON a.hospital_id = h.hospital_id
             LEFT JOIN LOCATION l ON a.current_location_id = l.location_id
             WHERE a.ambulance_id=?`,
            [result.insertId]
        );
        res.status(201).json(rows[0]);
    } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
    try {
        const { hospital_id, vehicle_number, type, driver_name, driver_license,
                current_location_id, status, dispatched_to } = req.body;
        const fields = [], vals = [];
        if (hospital_id         !== undefined) { fields.push("hospital_id=?");          vals.push(hospital_id); }
        if (vehicle_number      !== undefined) { fields.push("vehicle_number=?");       vals.push(vehicle_number); }
        if (type                !== undefined) { fields.push("type=?");                 vals.push(type); }
        if (driver_name         !== undefined) { fields.push("driver_name=?");          vals.push(driver_name); }
        if (driver_license      !== undefined) { fields.push("driver_license=?");       vals.push(driver_license); }
        if (current_location_id !== undefined) {
            if (current_location_id) {
                const [locRows] = await pool.promise().execute(
                    "SELECT location_id FROM LOCATION WHERE location_id=? AND is_active=1",
                    [Number(current_location_id)]
                );
                if (!locRows.length)
                    return res.status(400).json({ error: "Invalid or inactive location ID." });
                fields.push("current_location_id=?");
                vals.push(Number(current_location_id));
            } else {
                fields.push("current_location_id=NULL");
            }
        }
        if (dispatched_to       !== undefined) { fields.push("dispatched_to=?");        vals.push(dispatched_to); }
        if (status !== undefined) {
            if (!VALID_AMBULANCE_STATUSES.includes(status))
                return res.status(400).json({ error: "Invalid status." });
            fields.push("status=?"); vals.push(status);
        }
        if (!fields.length) return res.status(400).json({ error: "No fields to update." });
        vals.push(req.params.id);
        const [result] = await pool.promise().execute(
            `UPDATE AMBULANCE SET ${fields.join(",")} WHERE ambulance_id=?`, vals
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Ambulance not found." });
        const [rows] = await pool.promise().execute(
            `SELECT a.*, h.hospital_name, l.location_name AS current_location_name
             FROM AMBULANCE a
             LEFT JOIN HOSPITAL h ON a.hospital_id = h.hospital_id
             LEFT JOIN LOCATION l ON a.current_location_id = l.location_id
             WHERE a.ambulance_id=?`,
            [req.params.id]
        );
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!VALID_AMBULANCE_STATUSES.includes(status))
            return res.status(400).json({ error: "Invalid status. Use: " + VALID_AMBULANCE_STATUSES.join(", ") });
        const [result] = await pool.promise().execute(
            "UPDATE AMBULANCE SET status=? WHERE ambulance_id=?", [status, req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Ambulance not found." });
        const [rows] = await pool.promise().execute(
            `SELECT a.*, h.hospital_name, l.location_name AS current_location_name
             FROM AMBULANCE a
             LEFT JOIN HOSPITAL h ON a.hospital_id = h.hospital_id
             LEFT JOIN LOCATION l ON a.current_location_id = l.location_id
             WHERE a.ambulance_id=?`,
            [req.params.id]
        );
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
    try {
        const [result] = await pool.promise().execute(
            "DELETE FROM AMBULANCE WHERE ambulance_id=?", [req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Ambulance not found." });
        res.json({ message: "Ambulance deleted." });
    } catch (err) { next(err); }
};

// Member 2: rank available ambulances by distance to a pickup location
exports.findSuitable = async (req, res, next) => {
    try {
        let { pickup_location_id, emergency_id, required_type } = req.body;

        // If only emergency_id passed, look up its pickup location
        if (!pickup_location_id && emergency_id) {
            const [emgRows] = await pool.promise().execute(
                "SELECT pickup_location_id FROM EMERGENCY WHERE emergency_id=?",
                [Number(emergency_id)]
            );
            if (!emgRows.length) {
                return res.status(404).json({ error: "Emergency E" + emergency_id + " not found." });
            }
            pickup_location_id = emgRows[0].pickup_location_id;
            if (!pickup_location_id) {
                return res.status(400).json({ error: "Emergency has no pickup location assigned." });
            }
        }

        if (!pickup_location_id)
            return res.status(400).json({ error: "pickup_location_id is required." });

        const { pickup_location, ranked, excluded_no_location, excluded_no_distance } =
            await rankAmbulancesByDistance(Number(pickup_location_id), required_type || null);

        res.json({
            pickup_location,
            required_type:           required_type || "any",
            available_count:         ranked.length,
            excluded_no_location,
            excluded_no_distance,
            best_ambulance:          ranked[0] || null,
            ranked_ambulances:       ranked,
            distance_note:           "Distances are illustrative demo estimates only, not verified road distances."
        });
    } catch (err) { next(err); }
};

// Member 2 + Member 5: full 11-step nearest-ambulance assignment with Banker's Algorithm
exports.assignNearest = async (req, res, next) => {
    try {
        const { emergency_id, pickup_location_id, required_type } = req.body;
        if (!emergency_id) {
            return res.status(400).json({ error: "emergency_id is required." });
        }
        const result = await assignNearestAmbulance({
            emergency_id: Number(emergency_id),
            pickup_location_id: pickup_location_id ? Number(pickup_location_id) : undefined,
            required_type: required_type || null
        });
        res.json(result);
    } catch (err) { next(err); }
};

exports.release = async (req, res, next) => {
    const conn = await pool.promise().getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.execute(
            "SELECT * FROM AMBULANCE WHERE ambulance_id=? FOR UPDATE", [req.params.id]
        );
        if (!rows.length) {
            await conn.rollback();
            return res.status(404).json({ error: "Ambulance not found." });
        }
        await conn.execute(
            "UPDATE AMBULANCE SET status='available', dispatched_to=NULL WHERE ambulance_id=?",
            [req.params.id]
        );
        await conn.commit();
        res.json({ message: "Ambulance released.", status: "available" });
    } catch (err) { await conn.rollback(); next(err); }
    finally { conn.release(); }
};
