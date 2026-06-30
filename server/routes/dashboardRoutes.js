const express = require("express");
const { activity, dashboard, recent, storage } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/dashboard", dashboard);
router.get("/storage", storage);
router.get("/recent", recent);
router.get("/activity", activity);

module.exports = router;
