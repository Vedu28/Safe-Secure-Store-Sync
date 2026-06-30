const path = require("path");
const crypto = require("crypto");

const sanitizeName = (name) =>
  path
    .basename(name)
    .replace(/[^\w.\-()\s]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

const buildStorageKey = (uid, originalName) => {
  const safeName = sanitizeName(originalName) || "file";
  const date = new Date().toISOString().slice(0, 10);
  return `users/${uid}/${date}/${crypto.randomUUID()}-${safeName}`;
};

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const bytesToGB = (bytes) => bytes / 1024 / 1024 / 1024;

module.exports = {
  buildStorageKey,
  bytesToGB,
  sanitizeName,
  sha256
};
