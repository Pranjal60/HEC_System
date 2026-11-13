const pool = require("../db");

exports.getAll = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().query(
            `SELECT p.*, u.username, u.role
             FROM PATIENT p JOIN USER u ON p.user_id = u.user_id
             ORDER BY p.patient_id`
        );
        res.json(rows);
    } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            `SELECT p.*, u.username FROM PATIENT p
             JOIN USER u ON p.user_id = u.user_id
             WHERE p.patient_id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Patient not found." });
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
    try {
        const { user_id, name, age, gender, blood_group, contact, medical_history } = req.body;
        if (!user_id || !name)
            return res.status(400).json({ error: "user_id and name are required." });
        const [result] = await pool.promise().execute(
            `INSERT INTO PATIENT (user_id, name, age, gender, blood_group, contact, medical_history)
             VALUES (?,?,?,?,?,?,?)`,
            [user_id, name, age || null, gender || null, blood_group || null,
             contact || null, medical_history || null]
        );
        res.status(201).json({ message: "Patient created.", patient_id: result.insertId });
    } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
    try {
        const { name, age, gender, blood_group, contact, medical_history } = req.body;
        const [result] = await pool.promise().execute(
            `UPDATE PATIENT SET name=?, age=?, gender=?, blood_group=?, contact=?, medical_history=?
             WHERE patient_id=?`,
            [name, age || null, gender || null, blood_group || null,
             contact || null, medical_history || null, req.params.id]
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Patient not found." });
        res.json({ message: "Patient updated." });
    } catch (err) { next(err); }
};
