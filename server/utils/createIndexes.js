require("dotenv").config();

const connectDB = require("../config/db");
const User = require("../models/User");
const File = require("../models/File");
const ActivityLog = require("../models/ActivityLog");
const StorageStat = require("../models/StorageStat");

const createIndexes = async () => {
  await connectDB();
  await Promise.all([User.syncIndexes(), File.syncIndexes(), ActivityLog.syncIndexes(), StorageStat.syncIndexes()]);
  console.log("MongoDB indexes synchronized");
  process.exit(0);
};

createIndexes().catch((error) => {
  console.error(error);
  process.exit(1);
});
