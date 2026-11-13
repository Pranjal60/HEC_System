const pool = require("../db");

exports.getAll = async (req, res, next) => {
    try {
        const { emergency_id } = req.query;
        let sql = `SELECT t.*, d.name AS doctor_name, p.name AS patient_name
                   FROM TREATMENT t
                   JOIN DOCTOR    d ON t.doctor_id    = d.doctor_id
                   JOIN EMERGENCY e ON t.emergency_id = e.emergency_id
                   JOIN PATIENT   p ON e.patient_id   = p.patient_id
                   WHERE 1=1`;
        const vals = [];
        if (emergency_id) { sql += " AND t.emergency_id=?"; vals.push(emergency_id); }
        sql += " ORDER BY t.treatment_id DESC";
        const [rows] = await pool.promise().execute(sql, vals);
        res.json(rows);
    } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            `SELECT t.*, d.name AS doctor_name FROM TREATMENT t
             JOIN DOCTOR d ON t.doctor_id = d.doctor_id
             WHERE t.treatment_id=?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Treatment not found." });
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
    try {
        const { emergency_id, doctor_id, diagnosis, treatment,
                start_time, end_time, status = "pending" } = req.body;
        if (!emergency_id || !doctor_id)
            return res.status(400).json({ error: "emergency_id and doctor_id are required." });
        const [result] = await pool.promise().execute(
            `INSERT INTO TREATMENT (emergency_id, doctor_id, diagnosis, treatment, start_time, end_time, status)
             VALUES (?,?,?,?,?,?,?)`,
            [emergency_id, doctor_id, diagnosis || null, treatment || null,
             start_time || null, end_time || null, status]
        );
        res.status(201).json({ message: "Treatment recorded.", treatment_id: result.insertId });
    } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
    try {
        const { doctor_id, diagnosis, treatment, start_time, end_time, status } = req.body;
        const fields = [], vals = [];
        if (doctor_id  !== undefined) { fields.push("doctor_id=?");  vals.push(doctor_id); }
        if (diagnosis  !== undefined) { fields.push("diagnosis=?");  vals.push(diagnosis); }
        if (treatment  !== undefined) { fields.push("treatment=?");  vals.push(treatment); }
        if (start_time !== undefined) { fields.push("start_time=?"); vals.push(start_time); }
        if (end_time   !== undefined) { fields.push("end_time=?");   vals.push(end_time); }
        if (status     !== undefined) { fields.push("status=?");     vals.push(status); }
        if (!fields.length) return res.status(400).json({ error: "No fields to update." });
        vals.push(req.params.id);
        const [result] = await pool.promise().execute(
            `UPDATE TREATMENT SET ${fields.join(",")} WHERE treatment_id=?`, vals
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Treatment not found." });
        res.json({ message: "Treatment updated." });
    } catch (err) { next(err); }
};
