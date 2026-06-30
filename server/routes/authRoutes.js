const express = require("express");
const { body } = require("express-validator");
const {
  authenticateWithFirebase,
  logout,
  profile,
  updateProfile
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();

const tokenValidator = [body("idToken").isString().notEmpty().withMessage("idToken is required"), validate];

router.post("/signup", tokenValidator, authenticateWithFirebase);
router.post("/login", tokenValidator, authenticateWithFirebase);
router.post("/logout", protect, logout);
router.get("/profile", protect, profile);
router.put(
  "/profile",
  protect,
  [
    body("displayName").optional().isString().trim().isLength({ max: 80 }),
    body("photoURL").optional().isURL().withMessage("photoURL must be a URL"),
    validate
  ],
  updateProfile
);

module.exports = router;
