const File = require("../models/File");
const ActivityLog = require("../models/ActivityLog");
const catchAsync = require("../utils/catchAsync");
const { calculateStorage } = require("../services/storageService");

const dashboard = catchAsync(async (req, res) => {
  const [storage, recentUploads, recentActivity, largestFiles, mostDownloaded] = await Promise.all([
    calculateStorage(req.user),
    File.find({ user: req.user._id, isDeleted: false }).sort({ createdAt: -1 }).limit(5),
    ActivityLog.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10).populate("file", "filename fileType"),
    File.find({ user: req.user._id, isDeleted: false }).sort({ size: -1 }).limit(5),
    File.find({ user: req.user._id, isDeleted: false }).sort({ downloadCount: -1 }).limit(5)
  ]);

  res.json({ success: true, user: req.user, storage, recentUploads, recentActivity, largestFiles, mostDownloaded });
});

const storage = catchAsync(async (req, res) => {
  const [summary, byType, uploadsByMonth] = await Promise.all([
    calculateStorage(req.user),
    File.aggregate([
      { $match: { user: req.user._id, isDeleted: false } },
      { $group: { _id: "$fileType", count: { $sum: 1 }, bytes: { $sum: "$size" } } },
      { $sort: { bytes: -1 } }
    ]),
    File.aggregate([
      { $match: { user: req.user._id, isDeleted: false } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
          bytes: { $sum: "$size" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ])
  ]);

  res.json({ success: true, summary, byType, uploadsByMonth });
});

const recent = catchAsync(async (req, res) => {
  const files = await File.find({ user: req.user._id, isDeleted: false }).sort({ updatedAt: -1 }).limit(20);
  res.json({ success: true, files });
});

const activity = catchAsync(async (req, res) => {
  const logs = await ActivityLog.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100).populate("file", "filename");
  res.json({ success: true, logs });
});

module.exports = {
  activity,
  dashboard,
  recent,
  storage
};
