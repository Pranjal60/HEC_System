const VALID_EMERGENCY_STATUS = ["pending", "admitted", "in_treatment", "discharged", "cancelled"];
const VALID_SEVERITY = ["critical", "serious", "moderate", "minor"];
const SEVERITY_PRIORITY_MAP = { critical: 1, serious: 2, moderate: 3, minor: 4 };
const VALID_AMBULANCE_STATUSES = ["available", "in_transit"];
// Burst time (minutes) passed to the C scheduling binary
const BURST_MAP = { critical: 10, serious: 15, moderate: 20, minor: 30 };

module.exports = { VALID_EMERGENCY_STATUS, VALID_SEVERITY, SEVERITY_PRIORITY_MAP, VALID_AMBULANCE_STATUSES, BURST_MAP };
