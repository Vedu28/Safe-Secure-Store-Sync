const express = require("express");
const { body, param, query } = require("express-validator");
const {
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
} = require("../controllers/fileController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const validate = require("../middleware/validate");

const router = express.Router();
const idParam = [param("id").isMongoId().withMessage("Invalid file id"), validate];

router.use(protect);

router.post("/upload", upload.array("files", 20), uploadFiles);
router.get(
  "/files",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("sort").optional().isString(),
    query("type").optional().isString(),
    query("search").optional().isString(),
    validate
  ],
  listFiles
);
router.get("/files/:id", idParam, getFile);
router.put(
  "/files/:id",
  [
    param("id").isMongoId().withMessage("Invalid file id"),
    body("filename").isString().trim().isLength({ min: 1, max: 255 }),
    validate
  ],
  renameFile
);
router.delete("/files/:id", idParam, softDeleteFile);
router.post("/restore/:id", idParam, restoreFile);
router.delete("/permanent/:id", idParam, permanentlyDeleteFile);
router.get("/download/:id", idParam, downloadFile);
router.get("/preview/:id", idParam, previewFile);
router.get("/search", [query("q").optional().isString(), validate], searchFiles);
router.get("/favorites", favorites);
router.post(
  "/favorite/:id",
  [
    param("id").isMongoId().withMessage("Invalid file id"),
    body("isFavorite").optional().isBoolean(),
    validate
  ],
  toggleFavorite
);
router.post("/share/:id", idParam, shareLink);

module.exports = router;
