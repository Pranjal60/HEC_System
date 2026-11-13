// Centralized Express error handler — must be last app.use() in server.js
function errorHandler(err, req, res, _next) {
    console.error("[ERROR]", err.message || err);

    if (err.code === "ER_DUP_ENTRY")
        return res.status(409).json({ error: "Duplicate entry: " + err.message });

    if (err.code === "ER_NO_REFERENCED_ROW_2")
        return res.status(400).json({ error: "Referenced record does not exist." });

    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal server error" });
}

module.exports = errorHandler;
