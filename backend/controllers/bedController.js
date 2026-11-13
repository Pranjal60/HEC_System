const pool = require("../db");

exports.getAll = async (req, res, next) => {
    try {
        const { hospital_id, bed_type, status } = req.query;
        let sql = `SELECT b.*, h.hospital_name
                   FROM BED b JOIN HOSPITAL h ON b.hospital_id = h.hospital_id
                   WHERE 1=1`;
        const vals = [];
        if (hospital_id) { sql += " AND b.hospital_id=?"; vals.push(hospital_id); }
        if (bed_type)    { sql += " AND b.bed_type=?";    vals.push(bed_type); }
        if (status)      { sql += " AND b.status=?";      vals.push(status); }
        sql += " ORDER BY b.hospital_id, b.bed_id";
        const [rows] = await pool.promise().execute(sql, vals);
        res.json(rows);
    } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            `SELECT b.*, h.hospital_name FROM BED b
             JOIN HOSPITAL h ON b.hospital_id = h.hospital_id
             WHERE b.bed_id=?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Bed not found." });
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
    try {
        const { hospital_id, bed_number, bed_type, status = "available" } = req.body;
        if (!hospital_id || !bed_number || !bed_type)
            return res.status(400).json({ error: "hospital_id, bed_number and bed_type are required." });
        const [result] = await pool.promise().execute(
            "INSERT INTO BED (hospital_id, bed_number, bed_type, status) VALUES (?,?,?,?)",
            [hospital_id, bed_number, bed_type, status]
        );
        res.status(201).json({ message: "Bed added.", bed_id: result.insertId });
    } catch (err) { next(err); }
};

// Uses transaction + FOR UPDATE to safely decrement hospital available_beds
exports.allocate = async (req, res, next) => {
    const conn = await pool.promise().getConnection();
    try {
        await conn.beginTransaction();
        const [beds] = await conn.execute("SELECT * FROM BED WHERE bed_id=? FOR UPDATE", [req.params.id]);
        if (!beds.length) { await conn.rollback(); return res.status(404).json({ error: "Bed not found." }); }
        if (beds[0].status !== "available") { await conn.rollback(); return res.status(409).json({ error: "Bed is not available." }); }
        await conn.execute("UPDATE BED SET status='occupied' WHERE bed_id=?", [req.params.id]);
        await conn.execute(
            "UPDATE HOSPITAL SET available_beds=GREATEST(available_beds-1,0) WHERE hospital_id=?",
            [beds[0].hospital_id]
        );
        await conn.commit();
        res.json({ message: "Bed allocated." });
    } catch (err) { await conn.rollback(); next(err); }
    finally { conn.release(); }
};

exports.release = async (req, res, next) => {
    const conn = await pool.promise().getConnection();
    try {
        await conn.beginTransaction();
        const [beds] = await conn.execute("SELECT * FROM BED WHERE bed_id=? FOR UPDATE", [req.params.id]);
        if (!beds.length) { await conn.rollback(); return res.status(404).json({ error: "Bed not found." }); }
        if (beds[0].status === "available") { await conn.rollback(); return res.status(409).json({ error: "Bed is already available." }); }
        await conn.execute("UPDATE BED SET status='available' WHERE bed_id=?", [req.params.id]);
        await conn.execute(
            "UPDATE HOSPITAL SET available_beds=available_beds+1 WHERE hospital_id=?",
            [beds[0].hospital_id]
        );
        await conn.commit();
        res.json({ message: "Bed released." });
    } catch (err) { await conn.rollback(); next(err); }
    finally { conn.release(); }
};

exports.update = async (req, res, next) => {
    try {
        const { bed_number, bed_type, status } = req.body;
        const fields = [], vals = [];
        if (bed_number !== undefined) { fields.push("bed_number=?"); vals.push(bed_number); }
        if (bed_type   !== undefined) { fields.push("bed_type=?");   vals.push(bed_type); }
        if (status     !== undefined) { fields.push("status=?");     vals.push(status); }
        if (!fields.length) return res.status(400).json({ error: "No fields to update." });
        vals.push(req.params.id);
        const [result] = await pool.promise().execute(
            `UPDATE BED SET ${fields.join(",")} WHERE bed_id=?`, vals
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Bed not found." });
        res.json({ message: "Bed updated." });
    } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
    try {
        const [result] = await pool.promise().execute("DELETE FROM BED WHERE bed_id=?", [req.params.id]);
        if (!result.affectedRows) return res.status(404).json({ error: "Bed not found." });
        res.json({ message: "Bed deleted." });
    } catch (err) { next(err); }
};
