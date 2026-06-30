const multer = require("multer");
const ApiError = require("../utils/ApiError");

const maxFileSize = Number(process.env.MAX_FILE_SIZE_MB || 250) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname) return cb(new ApiError(400, "Invalid file"));
    cb(null, true);
  }
});

module.exports = upload;
