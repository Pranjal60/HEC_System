require("dotenv").config();
const mysql = require("mysql2");

const pool = mysql.createPool({
    host:             process.env.DB_HOST     || "localhost",
    user:             process.env.DB_USER     || "root",
    password:         process.env.DB_PASSWORD || "",
    database:         process.env.DB_NAME     || "hospital_emergency_system",
    port:             parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit:  10,
    queueLimit:       0
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error("❌ MySQL connection failed:", err.message);
    } else {
        console.log("✅ MySQL connected to", process.env.DB_NAME || "hospital_emergency_system");
        connection.release();
    }
});

module.exports = pool;
