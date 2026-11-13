const jwt = require("jsonwebtoken");

// Verifies JWT Bearer token and attaches decoded payload as req.user
function authenticate(req, res, next) {
    const header = req.headers["authorization"];
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: no token" });
    }

    const token = header.slice(7);
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
        next();
    } catch {
        return res.status(401).json({ error: "Unauthorized: invalid token" });
    }
}

// Role guard — use after authenticate(). E.g. authorize("Admin", "HospitalStaff")
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden: insufficient role" });
        }
        next();
    };
}

module.exports = { authenticate, authorize };
