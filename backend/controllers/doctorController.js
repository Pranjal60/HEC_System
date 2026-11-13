const pool = require("../db");

exports.getAll = async (req, res, next) => {
    try {
        const { hospital_id, availability } = req.query;
        let sql = `SELECT d.*, h.hospital_name FROM DOCTOR d
                   JOIN HOSPITAL h ON d.hospital_id = h.hospital_id WHERE 1=1`;
        const vals = [];
        if (hospital_id)  { sql += " AND d.hospital_id=?";  vals.push(hospital_id); }
        if (availability) { sql += " AND d.availability=?"; vals.push(availability); }
        sql += " ORDER BY d.hospital_id, d.doctor_id";
        const [rows] = await pool.promise().execute(sql, vals);
        res.json(rows);
    } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            `SELECT d.*, h.hospital_name FROM DOCTOR d
             JOIN HOSPITAL h ON d.hospital_id = h.hospital_id
             WHERE d.doctor_id=?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Doctor not found." });
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
    const conn = await pool.promise().getConnection();
    try {
        await conn.beginTransaction();
        const { hospital_id, name, availability = "available" } = req.body;
        let { user_id } = req.body;
        if (!hospital_id || !name)
            return res.status(400).json({ error: "hospital_id and name are required." });

        // Auto-create a system user if no user_id supplied
        if (!user_id) {
            const username = "dr_" + name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
            const [uRes] = await conn.execute(
                "INSERT INTO USER (username, password_hash, role) VALUES (?, ?, 'Doctor')",
                [username, "system_nologin"]
            );
            user_id = uRes.insertId;
        }

        const [result] = await conn.execute(
            "INSERT INTO DOCTOR (user_id, hospital_id, name, availability) VALUES (?,?,?,?)",
            [user_id, hospital_id, name, availability]
        );
        await conn.commit();
        res.status(201).json({ message: "Doctor added.", doctor_id: result.insertId });
    } catch (err) { await conn.rollback(); next(err); }
    finally { conn.release(); }
};

exports.assign = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            "SELECT availability FROM DOCTOR WHERE doctor_id=?", [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Doctor not found." });
        if (rows[0].availability !== "available")
            return res.status(409).json({ error: "Doctor is not available." });
        await pool.promise().execute(
            "UPDATE DOCTOR SET availability='busy' WHERE doctor_id=?", [req.params.id]
        );
        res.json({ message: "Doctor assigned." });
    } catch (err) { next(err); }
};

exports.release = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            "SELECT availability FROM DOCTOR WHERE doctor_id=?", [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Doctor not found." });
        await pool.promise().execute(
            "UPDATE DOCTOR SET availability='available' WHERE doctor_id=?", [req.params.id]
        );
        res.json({ message: "Doctor released." });
    } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
    try {
        const { hospital_id, name, availability } = req.body;
        const fields = [], vals = [];
        if (hospital_id  !== undefined) { fields.push("hospital_id=?");  vals.push(hospital_id); }
        if (name         !== undefined) { fields.push("name=?");         vals.push(name); }
        if (availability !== undefined) { fields.push("availability=?"); vals.push(availability); }
        if (!fields.length) return res.status(400).json({ error: "No fields to update." });
        vals.push(req.params.id);
        const [result] = await pool.promise().execute(
            `UPDATE DOCTOR SET ${fields.join(",")} WHERE doctor_id=?`, vals
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Doctor not found." });
        res.json({ message: "Doctor updated." });
    } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
    try {
        const [result] = await pool.promise().execute(
            "DELETE FROM DOCTOR WHERE doctor_id=?", [req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Doctor not found." });
        res.json({ message: "Doctor deleted." });
    } catch (err) { next(err); }
};
