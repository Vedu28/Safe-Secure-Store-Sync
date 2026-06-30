const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    firebaseUid: { type: String, required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: ["login", "logout", "upload", "download", "delete", "restore", "rename", "favorite", "share", "permanent_delete"]
    },
    file: { type: mongoose.Schema.Types.ObjectId, ref: "File" },
    message: { type: String, required: true },
    ip: String,
    userAgent: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);
