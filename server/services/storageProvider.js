const fs = require("fs");
const fsp = require("fs/promises");
const jwt = require("jsonwebtoken");
const path = require("path");

const storageRoot = path.resolve(process.env.LOCAL_STORAGE_PATH || path.join(__dirname, "..", "storage", "private"));
const publicBaseUrl = () => process.env.PUBLIC_BASE_URL || process.env.CLIENT_ORIGIN || `http://localhost:${process.env.PORT || 5000}`;
const signedUrlTtl = () => Number(process.env.SIGNED_URL_EXPIRES_SECONDS || 900);

const providerName = () => process.env.STORAGE_PROVIDER || "local";

const safePathForKey = (key) => {
  const resolved = path.resolve(storageRoot, key);
  if (!resolved.startsWith(storageRoot)) {
    throw new Error("Invalid storage key");
  }
  return resolved;
};

const storageBucket = () => {
  if (providerName() === "local") return "local-private-storage";
  return process.env.STORAGE_BUCKET || providerName();
};

const uploadObject = async ({ key, buffer }) => {
  if (providerName() !== "local") {
    throw new Error(`Unsupported storage provider: ${providerName()}`);
  }

  const target = safePathForKey(key);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, buffer);
};

const deleteObject = async (key) => {
  if (providerName() !== "local") {
    throw new Error(`Unsupported storage provider: ${providerName()}`);
  }

  await fsp.rm(safePathForKey(key), { force: true });
};

const getSignedFileUrl = async ({ key, filename, mimeType, disposition = "attachment" }) => {
  const token = jwt.sign({ key, filename, mimeType, disposition }, process.env.JWT_SECRET, {
    expiresIn: signedUrlTtl()
  });

  return `${publicBaseUrl()}/api/storage/${encodeURIComponent(token)}`;
};

const createReadStreamForKey = async (key) => {
  const target = safePathForKey(key);
  await fsp.access(target);
  return fs.createReadStream(target);
};

module.exports = {
  createReadStreamForKey,
  deleteObject,
  getSignedFileUrl,
  providerName,
  signedUrlTtl,
  storageBucket,
  uploadObject
};
