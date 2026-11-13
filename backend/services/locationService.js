// Location Service (Member 2) — nearest-ambulance selection using the
// Dehradun distance matrix stored in LOCATION_DISTANCE.
// Distance pairs are normalised: from_id < to_id; queries use LEAST/GREATEST.

const pool = require("../db");
const { loadState, callCpp } = require("./resourceService");

async function getAllLocations() {
    const [rows] = await pool.promise().query(
        "SELECT location_id, location_name FROM LOCATION WHERE is_active = 1 ORDER BY location_id"
    );
    return rows;
}

// Look up road distance (km) between two locations. Returns null if no entry — never treats missing as 0.
async function getDistance(locA, locB) {
    const idA = Number(locA);
    const idB = Number(locB);

    if (!idA || !idB || isNaN(idA) || isNaN(idB)) return null;
    if (idA === idB) return 0;

    const [rows] = await pool.promise().execute(
        `SELECT distance_km FROM LOCATION_DISTANCE
         WHERE from_location_id = LEAST(?, ?)
           AND to_location_id   = GREATEST(?, ?)`,
        [idA, idB, idA, idB]
    );

    return rows.length ? parseFloat(rows[0].distance_km) : null;
}

// Rank all available ambulances by road distance to a pickup location.
// Ambulances without a valid location or distance entry are excluded.
// Sort: distance ASC, ambulance_id ASC for ties.
async function rankAmbulancesByDistance(pickupLocationId, requiredType = null) {
    const locId = Number(pickupLocationId);
    if (!locId || isNaN(locId)) {
        const err = new Error("Invalid pickup location ID.");
        err.status = 400;
        throw err;
    }

    const [locRows] = await pool.promise().execute(
        "SELECT location_id, location_name FROM LOCATION WHERE location_id = ? AND is_active = 1",
        [locId]
    );
    if (!locRows.length) {
        const err = new Error("Invalid or inactive pickup location ID.");
        err.status = 400;
        throw err;
    }

    let sql = `SELECT a.ambulance_id, a.vehicle_number, a.type,
                      a.driver_name, a.status, a.current_location_id,
                      l.location_name AS current_location_name,
                      h.hospital_name
               FROM AMBULANCE a
               LEFT JOIN LOCATION l ON a.current_location_id = l.location_id AND l.is_active = 1
               LEFT JOIN HOSPITAL h ON a.hospital_id = h.hospital_id
               WHERE LOWER(a.status) = 'available'`;
    const vals = [];
    if (requiredType && requiredType.trim() && requiredType.toLowerCase() !== "any") {
        sql += " AND LOWER(a.type) = LOWER(?)";
        vals.push(requiredType.trim());
    }
    sql += " ORDER BY a.ambulance_id";

    const [ambulances] = await pool.promise().execute(sql, vals);

    let excludedNoLocation = 0;
    let excludedNoDistance = 0;
    const ranked = [];

    for (const amb of ambulances) {
        if (!amb.current_location_id || !amb.current_location_name) {
            excludedNoLocation++;
            continue;
        }
        const dist = await getDistance(amb.current_location_id, locId);
        if (dist === null) {
            excludedNoDistance++;
            continue;
        }
        ranked.push({ ...amb, distance_km: dist });
    }

    ranked.sort((a, b) => a.distance_km - b.distance_km || a.ambulance_id - b.ambulance_id);

    return { pickup_location: locRows[0], ranked, excluded_no_location: excludedNoLocation, excluded_no_distance: excludedNoDistance };
}

// 11-step nearest-ambulance assignment:
// 1-2. Fetch emergency + pickup location.
// 3-7. Rank available ambulances by distance (exclude no-location, no-distance).
// 8.   Pick closest candidate.
// 9-10. Run Banker's Algorithm (Member 5); if rejected, try next candidate safely.
// 11.  Update ambulance status to in_transit and emergency assignment atomically.
// Uses FOR UPDATE locking to prevent double-booking.
async function assignNearestAmbulance({ emergency_id, pickup_location_id, required_type }) {
    if (!emergency_id) {
        const err = new Error("emergency_id is required to assign nearest ambulance.");
        err.status = 400;
        throw err;
    }

    const [emgRows] = await pool.promise().execute(
        `SELECT e.*, p.name AS patient_name, l.location_name AS pickup_location_name
         FROM EMERGENCY e
         LEFT JOIN PATIENT p ON e.patient_id = p.patient_id
         LEFT JOIN LOCATION l ON e.pickup_location_id = l.location_id
         WHERE e.emergency_id = ?`,
        [Number(emergency_id)]
    );

    if (!emgRows.length) {
        const err = new Error("Emergency E" + emergency_id + " not found.");
        err.status = 404;
        throw err;
    }

    const emergency = emgRows[0];
    const locId = pickup_location_id ? Number(pickup_location_id) : emergency.pickup_location_id;

    if (!locId) {
        const err = new Error("Emergency E" + emergency_id + " has no pickup location assigned.");
        err.status = 400;
        throw err;
    }

    if (pickup_location_id && Number(pickup_location_id) !== emergency.pickup_location_id) {
        await pool.promise().execute(
            "UPDATE EMERGENCY SET pickup_location_id = ? WHERE emergency_id = ?",
            [locId, emergency.emergency_id]
        );
    }

    const { pickup_location, ranked, excluded_no_location, excluded_no_distance } =
        await rankAmbulancesByDistance(locId, required_type || null);

    if (!ranked.length) {
        const [[totalAvail]] = await pool.promise().query(
            "SELECT COUNT(*) AS cnt FROM AMBULANCE WHERE LOWER(status) = 'available'"
        );
        let msg = "No suitable available ambulance found for " + pickup_location.location_name + ".";
        if (totalAvail.cnt === 0)
            msg = "No ambulances are currently available in the system.";
        else if (excluded_no_location > 0 && excluded_no_distance === 0)
            msg = "Ambulances are available but none are assigned to a valid registered location.";
        else if (excluded_no_distance > 0)
            msg = "Ambulances are available but no distance entry exists for their locations.";
        const err = new Error(msg);
        err.status = 503;
        err.details = { total_available: totalAvail.cnt, excluded_no_location, excluded_no_distance };
        throw err;
    }

    const conn = await pool.promise().getConnection();
    try {
        let assignedCandidate = null;
        let bankerApproval = null;

        for (const candidate of ranked) {
            await conn.beginTransaction();

            // Lock row to prevent concurrent double-booking
            const [lockedRows] = await conn.execute(
                "SELECT ambulance_id, vehicle_number, type, driver_name, status, hospital_id FROM AMBULANCE WHERE ambulance_id = ? AND LOWER(status) = 'available' FOR UPDATE",
                [candidate.ambulance_id]
            );

            if (!lockedRows.length) {
                await conn.rollback();
                continue;
            }

            const state = await loadState();
            let bankerRes;
            try {
                bankerRes = await callCpp(state, {
                    action: "processRequest",
                    emergency_id: Number(emergency.emergency_id),
                    resource_type: "AMBULANCE",
                    resource_id: Number(candidate.ambulance_id),
                    hospital_id: -1
                });
            } catch (cppErr) {
                await conn.rollback();
                conn.release();
                throw cppErr;
            }

            if (bankerRes && bankerRes.decision === "APPROVED") {
                await conn.execute(
                    "UPDATE AMBULANCE SET status = 'in_transit', dispatched_to = ? WHERE ambulance_id = ?",
                    [emergency.emergency_id, candidate.ambulance_id]
                );
                await conn.execute(
                    "UPDATE EMERGENCY SET ambulance_id = ?, dispatch_time = NOW() WHERE emergency_id = ?",
                    [candidate.ambulance_id, emergency.emergency_id]
                );

                // Log to RESOURCE_ALLOCATION_LOG
                const [cols] = await conn.query(
                    "SHOW COLUMNS FROM RESOURCE_ALLOCATION_LOG LIKE 'decision_reason'"
                );
                if (cols.length) {
                    await conn.execute(
                        `INSERT INTO RESOURCE_ALLOCATION_LOG (emergency_id, resource_type, resource_id, state, decision_reason) VALUES (?, 'AMBULANCE', ?, 'allocated', ?)`,
                        [emergency.emergency_id, candidate.ambulance_id, bankerRes.reason || "Approved by Banker's Algorithm"]
                    ).catch(() => {});
                } else {
                    await conn.execute(
                        `INSERT INTO RESOURCE_ALLOCATION_LOG (emergency_id, resource_type, resource_id, state) VALUES (?, 'AMBULANCE', ?, 'allocated')`,
                        [emergency.emergency_id, candidate.ambulance_id]
                    ).catch(() => {});
                }

                await conn.commit();
                assignedCandidate = candidate;
                bankerApproval = bankerRes;
                break;
            } else {
                // Banker rejected — log denial and try next candidate
                const [cols] = await conn.query(
                    "SHOW COLUMNS FROM RESOURCE_ALLOCATION_LOG LIKE 'decision_reason'"
                );
                if (cols.length) {
                    await conn.execute(
                        `INSERT INTO RESOURCE_ALLOCATION_LOG (emergency_id, resource_type, resource_id, state, decision_reason) VALUES (?, 'AMBULANCE', ?, 'denied', ?)`,
                        [emergency.emergency_id, candidate.ambulance_id, bankerRes ? bankerRes.reason : "Rejected by Banker's Algorithm"]
                    ).catch(() => {});
                } else {
                    await conn.execute(
                        `INSERT INTO RESOURCE_ALLOCATION_LOG (emergency_id, resource_type, resource_id, state) VALUES (?, 'AMBULANCE', ?, 'denied')`,
                        [emergency.emergency_id, candidate.ambulance_id]
                    ).catch(() => {});
                }
                await conn.rollback();
            }
        }

        conn.release();

        if (!assignedCandidate) {
            const err = new Error("Could not allocate nearest ambulance: All candidate ambulances were either concurrently booked or rejected by the Banker's Algorithm safety check.");
            err.status = 409;
            throw err;
        }

        return {
            success: true,
            message: "Nearest ambulance successfully assigned.",
            emergency_id: emergency.emergency_id,
            pickup_location,
            assigned_ambulance: {
                ambulance_id: assignedCandidate.ambulance_id,
                vehicle_number: assignedCandidate.vehicle_number,
                type: assignedCandidate.type,
                driver_name: assignedCandidate.driver_name,
                current_location_id: assignedCandidate.current_location_id,
                current_location_name: assignedCandidate.current_location_name,
                distance_km: assignedCandidate.distance_km
            },
            banker_decision: bankerApproval.decision,
            banker_reason: bankerApproval.reason,
            distance_note: "Distances are illustrative demo estimates only, not verified road distances."
        };

    } catch (err) {
        conn.release();
        throw err;
    }
}

module.exports = {
    getAllLocations,
    getDistance,
    rankAmbulancesByDistance,
    assignNearestAmbulance
};
