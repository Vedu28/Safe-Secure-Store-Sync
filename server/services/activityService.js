const ActivityLog = require("../models/ActivityLog");

const logActivity = async ({ req, user, action, file, message }) => {
  if (!user) return null;

  return ActivityLog.create({
    user: user._id,
    firebaseUid: user.firebaseUid,
    action,
    file: file?._id,
    message,
    ip: req?.ip,
    userAgent: req?.get?.("user-agent")
  });
};

module.exports = { logActivity };
