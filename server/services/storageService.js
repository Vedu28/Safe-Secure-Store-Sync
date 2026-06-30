const File = require("../models/File");
const StorageStat = require("../models/StorageStat");

const calculateStorage = async (user) => {
  const [summary] = await File.aggregate([
    { $match: { user: user._id } },
    {
      $group: {
        _id: "$user",
        totalFiles: { $sum: 1 },
        activeFiles: { $sum: { $cond: ["$isDeleted", 0, 1] } },
        deletedFiles: { $sum: { $cond: ["$isDeleted", 1, 0] } },
        storageUsedBytes: { $sum: { $cond: ["$isDeleted", 0, "$size"] } }
      }
    }
  ]);

  const stats = {
    totalFiles: summary?.totalFiles || 0,
    activeFiles: summary?.activeFiles || 0,
    deletedFiles: summary?.deletedFiles || 0,
    storageUsedBytes: summary?.storageUsedBytes || 0,
    lastCalculatedAt: new Date()
  };

  await StorageStat.findOneAndUpdate(
    { user: user._id },
    { ...stats, user: user._id, firebaseUid: user.firebaseUid },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    ...stats,
    quotaBytes: user.storageQuotaBytes,
    remainingBytes: Math.max(user.storageQuotaBytes - stats.storageUsedBytes, 0),
    usagePercent: user.storageQuotaBytes ? Math.round((stats.storageUsedBytes / user.storageQuotaBytes) * 100) : 0
  };
};

module.exports = { calculateStorage };
