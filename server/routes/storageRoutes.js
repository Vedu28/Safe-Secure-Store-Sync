const express = require("express");
const { streamSignedFile } = require("../controllers/storageController");

const router = express.Router();

router.get("/storage/:token", streamSignedFile);

module.exports = router;
