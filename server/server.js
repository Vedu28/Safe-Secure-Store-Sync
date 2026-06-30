require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const port = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = app.listen(port, () => {
    console.log(`Safe Secure Store Sync API running on port ${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received. Closing HTTP server.`);
    server.close(() => process.exit(0));
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
