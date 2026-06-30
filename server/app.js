const path = require("path");
const compression = require("compression");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const compatAuthRoutes = require("./routes/compatAuthRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const fileRoutes = require("./routes/fileRoutes");
const storageRoutes = require("./routes/storageRoutes");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");

const app = express();
const clientRoot = path.join(__dirname, "..", "client");

app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://www.gstatic.com"],
        connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://*.firebaseapp.com"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://ui-avatars.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"]
      }
    }
  })
);
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(express.static(clientRoot));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "safe-secure-store-sync" });
});

app.use("/api/auth", authRoutes);
app.use("/api", compatAuthRoutes);
app.use("/api", storageRoutes);
app.use("/api", fileRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", notFound);

app.get("*", (_req, res) => {
  res.sendFile(path.join(clientRoot, "index.html"));
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
