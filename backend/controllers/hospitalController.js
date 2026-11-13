const pool = require("../db");

exports.getAll = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().query(
            `SELECT h.*, l.location_name
             FROM HOSPITAL h
             LEFT JOIN LOCATION l ON h.location_id = l.location_id
             ORDER BY h.hospital_id`
        );
        res.json(rows);
    } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            `SELECT h.*, l.location_name
             FROM HOSPITAL h
             LEFT JOIN LOCATION l ON h.location_id = l.location_id
             WHERE h.hospital_id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Hospital not found." });
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
    try {
        const { hospital_name, location_id, total_beds, available_beds, emergency_capacity, status } = req.body;
        if (!hospital_name) return res.status(400).json({ error: "hospital_name is required." });
        const [result] = await pool.promise().execute(
            `INSERT INTO HOSPITAL (hospital_name, location_id, total_beds, available_beds, emergency_capacity, status)
             VALUES (?,?,?,?,?,?)`,
            [
                hospital_name,
                location_id ? Number(location_id) : null,
                total_beds         || 0,
                available_beds     || 0,
                emergency_capacity || 0,
                status             || "Active"
            ]
        );
        res.status(201).json({ message: "Hospital added.", hospital_id: result.insertId });
    } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
    try {
        const { hospital_name, location_id, total_beds, available_beds, emergency_capacity, status } = req.body;
        const fields = [], vals = [];
        if (hospital_name      !== undefined) { fields.push("hospital_name=?");      vals.push(hospital_name); }
        if (location_id        !== undefined) { fields.push("location_id=?");        vals.push(location_id ? Number(location_id) : null); }
        if (total_beds         !== undefined) { fields.push("total_beds=?");         vals.push(total_beds); }
        if (available_beds     !== undefined) { fields.push("available_beds=?");     vals.push(available_beds); }
        if (emergency_capacity !== undefined) { fields.push("emergency_capacity=?"); vals.push(emergency_capacity); }
        if (status             !== undefined) { fields.push("status=?");             vals.push(status); }
        if (!fields.length) return res.status(400).json({ error: "No fields to update." });
        vals.push(req.params.id);
        const [result] = await pool.promise().execute(
            `UPDATE HOSPITAL SET ${fields.join(",")} WHERE hospital_id=?`, vals
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Hospital not found." });
        res.json({ message: "Hospital updated." });
    } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
    try {
        const [result] = await pool.promise().execute(
            "DELETE FROM HOSPITAL WHERE hospital_id=?", [req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Hospital not found." });
        res.json({ message: "Hospital deleted." });
    } catch (err) { next(err); }
};
