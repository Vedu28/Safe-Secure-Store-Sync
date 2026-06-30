const jwt = require("jsonwebtoken");
const initFirebase = require("../config/firebase");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");

const readBearer = (header = "") => {
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : null;
};

const signJwt = (user) =>
  jwt.sign({ uid: user.firebaseUid, sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

const upsertFirebaseUser = async (decodedToken) => {
  const firebaseUid = decodedToken.uid;
  const provider = decodedToken.firebase?.sign_in_provider || "password";

  return User.findOneAndUpdate(
    { firebaseUid },
    {
      firebaseUid,
      email: decodedToken.email,
      displayName: decodedToken.name || decodedToken.email?.split("@")[0] || "",
      photoURL: decodedToken.picture || "",
      emailVerified: Boolean(decodedToken.email_verified),
      provider,
      lastLoginAt: new Date()
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const protect = catchAsync(async (req, _res, next) => {
  const token = readBearer(req.get("authorization"));
  if (!token) throw new ApiError(401, "Authentication token is required");

  let firebaseUid;
  try {
    const decodedFirebaseToken = await initFirebase().auth().verifyIdToken(token);
    req.firebaseToken = decodedFirebaseToken;
    req.user = await upsertFirebaseUser(decodedFirebaseToken);
    return next();
  } catch (_firebaseError) {
    try {
      const decodedJwt = jwt.verify(token, process.env.JWT_SECRET);
      firebaseUid = decodedJwt.uid;
    } catch (_jwtError) {
      throw new ApiError(401, "Invalid or expired authentication token");
    }
  }

  const user = await User.findOne({ firebaseUid });
  if (!user) throw new ApiError(401, "User no longer exists");
  req.user = user;
  next();
});

module.exports = {
  protect,
  signJwt,
  upsertFirebaseUser
};
