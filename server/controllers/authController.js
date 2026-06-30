const initFirebase = require("../config/firebase");
const User = require("../models/User");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");
const { logActivity } = require("../services/activityService");
const { calculateStorage } = require("../services/storageService");
const { signJwt, upsertFirebaseUser } = require("../middleware/authMiddleware");

const authenticateWithFirebase = catchAsync(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) throw new ApiError(400, "Firebase ID token is required");

  const decodedToken = await initFirebase().auth().verifyIdToken(idToken);
  const user = await upsertFirebaseUser(decodedToken);
  const token = signJwt(user);

  await logActivity({
    req,
    user,
    action: req.path.includes("signup") ? "login" : "login",
    message: "User authenticated"
  });

  res.status(200).json({ success: true, token, user });
});

const logout = catchAsync(async (req, res) => {
  await logActivity({ req, user: req.user, action: "logout", message: "User logged out" });
  res.json({ success: true, message: "Logged out" });
});

const profile = catchAsync(async (req, res) => {
  const storage = await calculateStorage(req.user);
  res.json({ success: true, user: req.user, storage });
});

const updateProfile = catchAsync(async (req, res) => {
  const { displayName, photoURL } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { displayName, photoURL },
    { new: true, runValidators: true }
  );
  res.json({ success: true, user });
});

module.exports = {
  authenticateWithFirebase,
  logout,
  profile,
  updateProfile
};
