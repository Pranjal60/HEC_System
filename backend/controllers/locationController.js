const { getAllLocations } = require("../services/locationService");

// GET /api/locations
exports.getAll = async (req, res, next) => {
    try {
        const locations = await getAllLocations();
        res.json(locations);
    } catch (err) { next(err); }
};
