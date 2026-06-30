const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String, default: "" },
    photoURL: { type: String, default: "" },
    emailVerified: { type: Boolean, default: false },
    provider: { type: String, default: "password" },
    storageQuotaBytes: {
      type: Number,
      default: () => Number(process.env.USER_STORAGE_QUOTA_GB || 10) * 1024 * 1024 * 1024
    },
    lastLoginAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
