require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

require("./db");

app.use("/api/locations",   require("./routes/locationRoutes"));
app.use("/api/auth",        require("./routes/authRoutes"));
app.use("/api/patients",    require("./routes/patientRoutes"));
app.use("/api/ambulances",  require("./routes/ambulanceRoutes"));
app.use("/api/hospitals",   require("./routes/hospitalRoutes"));
app.use("/api/beds",        require("./routes/bedRoutes"));
app.use("/api/doctors",     require("./routes/doctorRoutes"));
app.use("/api/emergencies", require("./routes/emergencyRoutes"));
app.use("/api/scheduling",  require("./routes/schedulingRoutes"));
app.use("/api/resources",   require("./routes/resourceRoutes"));
app.use("/api/treatments",  require("./routes/treatmentRoutes"));
app.use("/api/billing",     require("./routes/billingRoutes"));

app.get("/api/health", (req, res) =>
    res.json({ status: "ok", timestamp: new Date().toISOString() })
);

// SPA fallback — serve index.html for all non-API routes
app.get("*", (req, res) => {
    if (!req.path.startsWith("/api"))
        res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.use(require("./middleware/errorHandler")); // must be last

const PORT = parseInt(process.env.PORT) || 5000;
app.listen(PORT, () => {
    console.log(`\n🏥 Hospital Emergency System running on http://localhost:${PORT}`);
    console.log(`   API base: http://localhost:${PORT}/api`);
    console.log(`   Frontend: http://localhost:${PORT}`);
});
