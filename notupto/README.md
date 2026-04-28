# NotUpto — Setup Guide

## Project Structure

```
notupto/
├── server.js              # Express entry point
├── package.json
├── .env.example           # Copy to .env and fill in values
├── .gitignore
│
├── config/
│   └── db.js              # MongoDB connection
│
├── models/
│   └── User.js            # User schema (username + passwordHash)
│
├── middleware/
│   └── auth.js            # JWT verification middleware
│
├── routes/
│   └── auth.js            # /api/signup  /api/login  /api/logout  /api/me
│
└── public/
    ├── index.html         # Main NotUpto frontend (unchanged)
    ├── login.html         # Login page
    └── signup.html        # Signup page
```

---

## Prerequisites

- **Node.js** v18 or higher
- **MongoDB** — either:
  - Local: [Install MongoDB Community](https://www.mongodb.com/try/download/community)
  - Cloud: [MongoDB Atlas (free tier)](https://www.mongodb.com/atlas) — recommended for deployment

---

## Setup (Step by Step)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
MONGO_URI=mongodb://127.0.0.1:27017/notupto
JWT_SECRET=generate_a_long_random_string_here
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

**Generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start MongoDB (if running locally)

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Or just run directly:
mongod --dbpath /your/data/path
```

### 4. Start the server

```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm start
```

Open **http://localhost:3000**

---

## API Reference

| Method | Endpoint     | Auth required | Description              |
|--------|-------------|---------------|--------------------------|
| POST   | /api/signup | No            | Create a new account     |
| POST   | /api/login  | No            | Log in, receive JWT      |
| POST   | /api/logout | No            | Clear auth cookie        |
| GET    | /api/me     | Yes (cookie)  | Get current user profile |

### POST /api/signup

```json
// Request body
{ "username": "alice", "password": "mypassword123" }

// Success 200
{ "success": true, "user": { "id": "...", "username": "alice" }, "token": "..." }

// Error 400 — validation failed
{ "error": "Password must be at least 8 characters." }

// Error 409 — username taken
{ "error": "Username is already taken. Please choose another." }
```

### POST /api/login

```json
// Request body
{ "username": "alice", "password": "mypassword123" }

// Success 200
{ "success": true, "user": { "id": "...", "username": "alice" }, "token": "..." }

// Error 401 — wrong credentials
{ "error": "Incorrect username or password." }
```

### POST /api/logout

```json
// Success 200 (clears HttpOnly cookie)
{ "success": true, "message": "Logged out." }
```

### GET /api/me

```json
// Success 200
{ "user": { "_id": "...", "username": "alice", "createdAt": "..." } }

// Error 401 — not authenticated
{ "error": "Not authenticated. Please log in." }
```

---

## Security Notes

| Feature | Implementation |
|---------|---------------|
| Password storage | bcrypt (12 salt rounds) — plain text never stored |
| JWT storage | HttpOnly cookie — inaccessible to JavaScript, XSS-safe |
| Brute-force protection | Rate limiter: 10 attempts / 15 min per IP |
| Username uniqueness | Enforced at both route level AND MongoDB index level |
| Error messages | Login errors are deliberately vague ("Incorrect username or password") — never reveals whether a username exists |
| Token expiry | 7 days default (configurable in .env) |

---

## Username Rules

- 3–30 characters
- Letters, numbers, underscores (`_`), and hyphens (`-`) only
- Stored and matched in lowercase (case-insensitive)

## Password Rules

- Minimum 8 characters
- Maximum 128 characters (prevents bcrypt DoS)
- No complexity requirements enforced server-side (strength indicator on signup page only)

---

## Adding Protected Routes

Use the `requireAuth` middleware in any route file:

```js
const { requireAuth } = require('./middleware/auth');

// This route only works if the user is logged in
router.get('/api/my-reviews', requireAuth, async (req, res) => {
  // req.user = { id: '...', username: 'alice' }
  res.json({ message: `Hello ${req.user.username}` });
});
```
