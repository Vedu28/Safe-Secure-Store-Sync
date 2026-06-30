const path = require("path");
const File = require("../models/File");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { buildStorageKey, sanitizeName, sha256 } = require("../utils/fileHelpers");
const {
  deleteObject,
  getSignedFileUrl,
  providerName,
  signedUrlTtl,
  storageBucket,
  uploadObject
} = require("../services/storageProvider");
const { logActivity } = require("../services/activityService");
const { calculateStorage } = require("../services/storageService");

const classifyFile = (mimeType = "", filename = "") => {
  const ext = path.extname(filename).toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  if ([".doc", ".docx"].includes(ext)) return "word";
  if ([".xls", ".xlsx", ".csv"].includes(ext)) return "excel";
  if ([".zip", ".rar", ".7z"].includes(ext)) return "archive";
  if (mimeType.startsWith("text/") || [".txt", ".md", ".json"].includes(ext)) return "text";
  return "other";
};

const findOwnedFile = async (req, includeDeleted = true) => {
  const query = { _id: req.params.id, user: req.user._id };
  if (!includeDeleted) query.isDeleted = false;
  const file = await File.findOne(query);
  if (!file) throw new ApiError(404, "File not found");
  return file;
};

const buildListQuery = (req, force = {}) => {
  const query = { user: req.user._id, ...force };
  if (force.isDeleted === undefined) query.isDeleted = req.query.trash === "true";
  if (req.query.type) query.fileType = req.query.type;
  if (req.query.favorite === "true") query.isFavorite = true;
  if (req.query.search) query.$text = { $search: req.query.search };
  return query;
};

const parseSort = (sort = "createdAt:desc") => {
  const [field, direction] = sort.split(":");
  const allowed = new Set(["filename", "size", "fileType", "createdAt", "updatedAt", "downloadCount"]);
  return { [allowed.has(field) ? field : "createdAt"]: direction === "asc" ? 1 : -1 };
};

const listFiles = catchAsync(async (req, res) => {
  const page = Math.max(Number(req.query.page || 1), 1);
  const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
  const query = buildListQuery(req);
  const [files, total] = await Promise.all([
    File.find(query).sort(parseSort(req.query.sort)).skip((page - 1) * limit).limit(limit),
    File.countDocuments(query)
  ]);

  res.json({ success: true, files, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

const uploadFiles = catchAsync(async (req, res) => {
  if (!req.files?.length) throw new ApiError(400, "At least one file is required");

  const storage = await calculateStorage(req.user);
  const totalIncoming = req.files.reduce((sum, file) => sum + file.size, 0);
  if (storage.storageUsedBytes + totalIncoming > req.user.storageQuotaBytes) {
    throw new ApiError(413, "Upload exceeds storage quota");
  }

  const uploaded = [];
  const duplicates = [];

  for (const file of req.files) {
    const checksum = sha256(file.buffer);
    const duplicate = await File.findOne({ user: req.user._id, checksum, isDeleted: false });
    if (duplicate) {
      duplicates.push({ originalName: file.originalname, existingFileId: duplicate._id });
      continue;
    }

    const storageKey = buildStorageKey(req.user.firebaseUid, file.originalname);
    const filename = sanitizeName(file.originalname) || file.originalname;

    await uploadObject({
      key: storageKey,
      buffer: file.buffer,
      mimeType: file.mimetype,
      metadata: {
        userId: req.user._id.toString(),
        checksum,
        originalName: encodeURIComponent(file.originalname)
      }
    });

    const document = await File.create({
      user: req.user._id,
      firebaseUid: req.user.firebaseUid,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileType: classifyFile(file.mimetype, file.originalname),
      size: file.size,
      checksum,
      storageKey,
      storageProvider: providerName(),
      storageContainer: storageBucket(),
      metadata: { extension: path.extname(file.originalname).toLowerCase() }
    });

    uploaded.push(document);
    await logActivity({ req, user: req.user, action: "upload", file: document, message: `Uploaded ${filename}` });
  }

  await calculateStorage(req.user);
  res.status(201).json({ success: true, uploaded, duplicates });
});

const getFile = catchAsync(async (req, res) => {
  const file = await findOwnedFile(req);
  res.json({ success: true, file });
});

const renameFile = catchAsync(async (req, res) => {
  const file = await findOwnedFile(req, false);
  file.filename = sanitizeName(req.body.filename);
  await file.save();
  await logActivity({ req, user: req.user, action: "rename", file, message: `Renamed file to ${file.filename}` });
  res.json({ success: true, file });
});

const softDeleteFile = catchAsync(async (req, res) => {
  const file = await findOwnedFile(req, false);
  file.isDeleted = true;
  file.deletedAt = new Date();
  await file.save();
  await calculateStorage(req.user);
  await logActivity({ req, user: req.user, action: "delete", file, message: `Moved ${file.filename} to trash` });
  res.json({ success: true, file });
});

const restoreFile = catchAsync(async (req, res) => {
  const file = await findOwnedFile(req);
  file.isDeleted = false;
  file.deletedAt = undefined;
  await file.save();
  await calculateStorage(req.user);
  await logActivity({ req, user: req.user, action: "restore", file, message: `Restored ${file.filename}` });
  res.json({ success: true, file });
});

const permanentlyDeleteFile = catchAsync(async (req, res) => {
  const file = await findOwnedFile(req);
  await deleteObject(file.storageKey);
  await file.deleteOne();
  await calculateStorage(req.user);
  await logActivity({
    req,
    user: req.user,
    action: "permanent_delete",
    message: `Permanently deleted ${file.filename}`
  });
  res.json({ success: true, message: "File permanently deleted" });
});

const downloadFile = catchAsync(async (req, res) => {
  const file = await findOwnedFile(req, false);
  const url = await getSignedFileUrl({ key: file.storageKey, filename: file.filename, mimeType: file.mimeType });
  file.downloadCount += 1;
  await file.save();
  await logActivity({ req, user: req.user, action: "download", file, message: `Downloaded ${file.filename}` });
  res.json({ success: true, url, expiresIn: signedUrlTtl() });
});

const previewFile = catchAsync(async (req, res) => {
  const file = await findOwnedFile(req, false);
  if (!["image", "pdf", "text", "video"].includes(file.fileType)) {
    throw new ApiError(415, "Preview is not available for this file type");
  }
  const url = await getSignedFileUrl({
    key: file.storageKey,
    filename: file.filename,
    mimeType: file.mimeType,
    disposition: "inline"
  });
  res.json({ success: true, url, file });
});

const toggleFavorite = catchAsync(async (req, res) => {
  const file = await findOwnedFile(req, false);
  file.isFavorite = typeof req.body.isFavorite === "boolean" ? req.body.isFavorite : !file.isFavorite;
  await file.save();
  await logActivity({ req, user: req.user, action: "favorite", file, message: `Updated favorite for ${file.filename}` });
  res.json({ success: true, file });
});

const favorites = catchAsync(async (req, res) => {
  req.query.favorite = "true";
  return listFiles(req, res);
});

const searchFiles = catchAsync(async (req, res) => {
  req.query.search = req.query.q || req.query.search;
  return listFiles(req, res);
});

const shareLink = catchAsync(async (req, res) => {
  const file = await findOwnedFile(req, false);
  const url = await getSignedFileUrl({
    key: file.storageKey,
    filename: file.filename,
    mimeType: file.mimeType,
    disposition: "inline"
  });
  await logActivity({ req, user: req.user, action: "share", file, message: `Generated share link for ${file.filename}` });
  res.json({ success: true, url, expiresIn: signedUrlTtl() });
});

module.exports = {
  downloadFile,
  favorites,
  getFile,
  listFiles,
  permanentlyDeleteFile,
  previewFile,
  renameFile,
  restoreFile,
  searchFiles,
  shareLink,
  softDeleteFile,
  toggleFavorite,
  uploadFiles
};
