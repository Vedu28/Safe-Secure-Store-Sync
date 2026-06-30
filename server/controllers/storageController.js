const jwt = require("jsonwebtoken");
const path = require("path");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { createReadStreamForKey } = require("../services/storageProvider");

const sanitizeDownloadName = (filename = "download") => path.basename(filename).replace(/["\r\n]/g, "_");

const streamSignedFile = catchAsync(async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.params.token, process.env.JWT_SECRET);
  } catch (_error) {
    throw new ApiError(401, "File link is invalid or expired");
  }

  const filename = sanitizeDownloadName(payload.filename);
  const disposition = payload.disposition === "inline" ? "inline" : "attachment";
  const stream = await createReadStreamForKey(payload.key);

  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  if (payload.mimeType) res.setHeader("Content-Type", payload.mimeType);
  stream.pipe(res);
});

module.exports = { streamSignedFile };
