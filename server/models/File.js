const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    firebaseUid: { type: String, required: true, index: true },
    filename: { type: String, required: true, trim: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, default: "application/octet-stream" },
    fileType: { type: String, default: "other", index: true },
    size: { type: Number, required: true },
    checksum: { type: String, required: true },
    storageKey: { type: String, required: true, unique: true },
    storageProvider: { type: String, default: "local" },
    storageContainer: { type: String, required: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    isFavorite: { type: Boolean, default: false, index: true },
    downloadCount: { type: Number, default: 0 },
    metadata: {
      extension: String,
      lastModifiedClient: Date
    }
  },
  { timestamps: true }
);

fileSchema.index({ user: 1, checksum: 1, isDeleted: 1 });
fileSchema.index({ filename: "text", originalName: "text", mimeType: "text" });

module.exports = mongoose.model("File", fileSchema);
