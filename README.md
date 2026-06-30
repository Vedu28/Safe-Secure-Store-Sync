# Safe Secure Store Sync

Safe Secure Store Sync is a production-ready Online File Backup System built with vanilla HTML/CSS/JavaScript, Node.js, Express, MongoDB, Firebase Authentication, and private local storage. It gives each authenticated user a private workspace for uploading, organizing, previewing, downloading, restoring, and deleting files without requiring a paid cloud storage account.

## Features

- Firebase email/password signup, login, logout, Google login, password reset, email verification, and session persistence
- Protected REST APIs with Firebase ID token verification and app JWT fallback
- Private server-side file storage with signed download and preview URLs
- Drag-and-drop multi-file upload with progress UI, quota validation, file size validation, and duplicate detection
- My Files, Favorites, Trash, Search, Sort, Filter, Rename, Preview, Download, Delete, Restore, and Permanent Delete
- Dashboard cards for total files, used storage, remaining storage, trash count, recent uploads, and recent activity
- Storage analytics for file types and upload trends
- Activity logs for login, logout, upload, download, delete, restore, rename, favorite, share, and permanent delete
- Responsive Google Drive-inspired dashboard with sidebar navigation, top search, modals, toasts, and light/dark mode
- MongoDB collections for users, files, activity logs, and storage statistics
- MVC-style backend with controllers, routes, middleware, services, models, utils, and environment-based config

## Tech Stack

- Frontend: HTML5, CSS3, vanilla JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Authentication: Firebase Authentication and Firebase Admin SDK
- Storage: Private local filesystem storage with a provider abstraction
- Security: Helmet, CORS, rate limiting, token verification, input validation, private storage, signed URLs

## Architecture

```text
client/
  css/
  js/
  images/
  pages/
server/
  config/
  controllers/
  middleware/
  models/
  routes/
  services/
  uploads/
  utils/
```

The client is a static vanilla JavaScript app served by Express. Firebase handles the browser authentication flow, then the client sends the Firebase ID token to the backend. The backend verifies the token with Firebase Admin, upserts the user in MongoDB, issues an app JWT, and protects all file/dashboard APIs. File binaries are uploaded from memory to private server-side storage, while metadata, storage stats, and activity logs are stored in MongoDB.

## Installation

```bash
npm install
cp .env.example .env
npm run seed:indexes
npm run dev
```

Open `http://localhost:5000`.

Node.js 22 or newer is required.

## Environment Variables

Create `.env` from `.env.example` and fill in:

- `MONGODB_URI`
- `JWT_SECRET`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `STORAGE_PROVIDER`
- `LOCAL_STORAGE_PATH`
- `PUBLIC_BASE_URL`
- `SIGNED_URL_EXPIRES_SECONDS`
- `MAX_FILE_SIZE_MB`
- `USER_STORAGE_QUOTA_GB`
- `TRASH_RETENTION_DAYS`

Update `client/js/config.js` with your Firebase Web App config.

## Firebase Setup

1. Create a Firebase project.
2. Enable Authentication providers: Email/Password and Google.
3. Add your local/deployed domain to authorized domains.
4. Create a Web App and copy the client config into `client/js/config.js`.
5. Create a service account key in Project Settings > Service accounts.
6. Place `project_id`, `client_email`, and `private_key` values in `.env`.

The frontend sends Firebase ID tokens to `POST /api/auth/login` and `POST /api/auth/signup`. The backend verifies those tokens and creates/updates the user profile.

## Storage Setup

This project now defaults to private local storage so it can run without AWS or a paid cloud storage plan.

Use these `.env` values:

```env
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=server/storage/private
PUBLIC_BASE_URL=http://localhost:5000
SIGNED_URL_EXPIRES_SECONDS=900
```

Uploaded files are stored under `server/storage/private/`, which is ignored by Git. The app never exposes this folder publicly. Downloads and previews go through short-lived signed URLs at `/api/storage/:token`.

Stored files are organized as:

```text
users/{firebaseUid}/{yyyy-mm-dd}/{uuid}-{filename}
```

## MongoDB Setup

Use a local MongoDB server or MongoDB Atlas. Run:

```bash
npm run seed:indexes
```

Collections:

- `users`
- `files`
- `activitylogs`
- `storagestats`

## API Documentation

All protected endpoints require:

```text
Authorization: Bearer <Firebase ID token or app JWT>
```

Auth:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`

Compatibility auth routes are also available at:

- `POST /api/signup`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/profile`

Files:

- `POST /api/upload` multipart form field: `files`
- `GET /api/files?search=&type=&favorite=&trash=&sort=createdAt:desc&page=1&limit=20`
- `GET /api/files/:id`
- `PUT /api/files/:id`
- `DELETE /api/files/:id`
- `POST /api/restore/:id`
- `DELETE /api/permanent/:id`
- `GET /api/download/:id`
- `GET /api/preview/:id`
- `GET /api/search?q=term`
- `GET /api/favorites`
- `POST /api/favorite/:id`
- `POST /api/share/:id`

Dashboard:

- `GET /api/dashboard`
- `GET /api/storage`
- `GET /api/recent`
- `GET /api/activity`

## Trash Retention

Deleted files are soft-deleted in MongoDB and remain in private storage. Restore clears the deleted flag. Permanent delete removes the stored file and metadata.

To purge trash older than `TRASH_RETENTION_DAYS`, schedule:

```bash
npm run purge:trash
```

Use cron, GitHub Actions, Render Cron Jobs, Railway cron, or a server scheduler in production.

## Deployment Guide

Frontend:

- The frontend is static under `client/`.
- It can be served by Express, Netlify, Vercel, GitHub Pages, or any static host.
- If hosted separately, set `CLIENT_ORIGIN` and `apiBaseUrl` accordingly.

Backend:

- Deploy the Express app to Render, Railway, Fly.io, a VPS, or similar.
- Set all environment variables in the host secret manager.
- Use HTTPS in production.
- Run behind a reverse proxy with `trust proxy` enabled.

Database:

- Use MongoDB Atlas for production.
- Restrict network access to backend hosts.
- Run `npm run seed:indexes` after deployment.

Storage:

- Keep `server/storage/private` outside public static hosting.
- Use persistent disk storage on your host if deploying the local provider.
- For production scale, add another provider behind `server/services/storageProvider.js`, such as Supabase Storage, Cloudinary raw assets, Backblaze B2, or another free/low-cost object store.

## Code Quality Notes

- Controllers are async/await with centralized error handling.
- Routes use `express-validator` for input validation.
- File storage access is isolated in `server/services/storageProvider.js`.
- Storage calculations are isolated in `server/services/storageService.js`.
- Activity logging is isolated in `server/services/activityService.js`.
- User ownership is checked on every file operation.

## Future Enhancements

- Folder hierarchy and breadcrumbs
- Team/shared workspaces
- Background virus scanning
- Multipart upload for very large files
- Object versioning and point-in-time restore
- WebSocket upload notifications
- Admin dashboard
- Automated tests with Jest/Supertest and Playwright
