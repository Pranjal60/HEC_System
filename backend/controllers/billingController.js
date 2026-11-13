const pool = require("../db");

exports.getBills = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().query(
            `SELECT b.*, p.name AS patient_name, e.severity
             FROM BILL b
             JOIN EMERGENCY e ON b.emergency_id = e.emergency_id
             JOIN PATIENT   p ON b.patient_id   = p.patient_id
             ORDER BY b.bill_date DESC`
        );
        res.json(rows);
    } catch (err) { next(err); }
};

exports.getBillById = async (req, res, next) => {
    try {
        const [rows] = await pool.promise().execute(
            `SELECT b.*, p.name AS patient_name FROM BILL b
             JOIN PATIENT p ON b.patient_id = p.patient_id
             WHERE b.bill_id=?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "Bill not found." });
        res.json(rows[0]);
    } catch (err) { next(err); }
};

exports.createBill = async (req, res, next) => {
    try {
        const { emergency_id, patient_id, amount, bill_date, payment_status = "pending" } = req.body;
        if (!emergency_id || !patient_id || amount === undefined || !bill_date)
            return res.status(400).json({ error: "emergency_id, patient_id, amount and bill_date are required." });
        const [result] = await pool.promise().execute(
            "INSERT INTO BILL (emergency_id, patient_id, amount, bill_date, payment_status) VALUES (?,?,?,?,?)",
            [emergency_id, patient_id, amount, bill_date, payment_status]
        );
        res.status(201).json({ message: "Bill created.", bill_id: result.insertId });
    } catch (err) { next(err); }
};

exports.updateBill = async (req, res, next) => {
    try {
        const { amount, bill_date, payment_status } = req.body;
        const fields = [], vals = [];
        if (amount         !== undefined) { fields.push("amount=?");         vals.push(amount); }
        if (bill_date      !== undefined) { fields.push("bill_date=?");      vals.push(bill_date); }
        if (payment_status !== undefined) { fields.push("payment_status=?"); vals.push(payment_status); }
        if (!fields.length) return res.status(400).json({ error: "No fields to update." });
        vals.push(req.params.id);
        const [result] = await pool.promise().execute(
            `UPDATE BILL SET ${fields.join(",")} WHERE bill_id=?`, vals
        );
        if (!result.affectedRows) return res.status(404).json({ error: "Bill not found." });
        res.json({ message: "Bill updated." });
    } catch (err) { next(err); }
};

exports.getPayments = async (req, res, next) => {
    try {
        const { bill_id } = req.query;
        let sql = "SELECT * FROM PAYMENT WHERE 1=1";
        const vals = [];
        if (bill_id) { sql += " AND bill_id=?"; vals.push(bill_id); }
        sql += " ORDER BY payment_date DESC";
        const [rows] = await pool.promise().execute(sql, vals);
        res.json(rows);
    } catch (err) { next(err); }
};

exports.createPayment = async (req, res, next) => {
    try {
        const { bill_id, amount, payment_date, payment_mode } = req.body;
        if (!bill_id || !amount || !payment_date || !payment_mode)
            return res.status(400).json({ error: "bill_id, amount, payment_date and payment_mode are required." });
        const [result] = await pool.promise().execute(
            "INSERT INTO PAYMENT (bill_id, amount, payment_date, payment_mode) VALUES (?,?,?,?)",
            [bill_id, amount, payment_date, payment_mode]
        );

        // Auto-recalculate bill payment_status based on sum of payments
        const [[bill]] = await pool.promise().execute("SELECT * FROM BILL WHERE bill_id=?", [bill_id]);
        if (bill) {
            const [[paid]] = await pool.promise().execute(
                "SELECT SUM(amount) AS total FROM PAYMENT WHERE bill_id=?", [bill_id]
            );
            const total = paid.total || 0;
            const newStatus = total >= bill.amount ? "paid"
                            : total > 0            ? "partial"
                                                   : "pending";
            await pool.promise().execute(
                "UPDATE BILL SET payment_status=? WHERE bill_id=?", [newStatus, bill_id]
            );
        }
        res.status(201).json({ message: "Payment recorded.", payment_id: result.insertId });
    } catch (err) { next(err); }
};
