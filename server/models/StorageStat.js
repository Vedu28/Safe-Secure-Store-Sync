const mongoose = require("mongoose");

const storageStatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    firebaseUid: { type: String, required: true, unique: true },
    totalFiles: { type: Number, default: 0 },
    activeFiles: { type: Number, default: 0 },
    deletedFiles: { type: Number, default: 0 },
    storageUsedBytes: { type: Number, default: 0 },
    lastCalculatedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("StorageStat", storageStatSchema);
