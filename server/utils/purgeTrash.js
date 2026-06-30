require("dotenv").config();

const connectDB = require("../config/db");
const File = require("../models/File");
const User = require("../models/User");
const { deleteObject } = require("../services/storageProvider");
const { calculateStorage } = require("../services/storageService");

const purgeTrash = async () => {
  await connectDB();
  const retentionDays = Number(process.env.TRASH_RETENTION_DAYS || 30);
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const expiredFiles = await File.find({ isDeleted: true, deletedAt: { $lte: cutoff } });
  const touchedUsers = new Set();

  for (const file of expiredFiles) {
    await deleteObject(file.storageKey);
    touchedUsers.add(file.user.toString());
    await file.deleteOne();
  }

  const users = await User.find({ _id: { $in: [...touchedUsers] } });
  await Promise.all(users.map((user) => calculateStorage(user)));

  console.log(`Purged ${expiredFiles.length} expired trash item(s)`);
  process.exit(0);
};

purgeTrash().catch((error) => {
  console.error(error);
  process.exit(1);
});
