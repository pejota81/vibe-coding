# vibe-coding

<<<<<<< HEAD
User management app built with Express and SQLite.

## Run locally

1. Install dependencies: `npm install`
2. Start server: `npm start`
3. Open `http://localhost:3000`

Default login: `admin` / `admin123`

## Apple account connection

This app supports linking a logged-in user to an Apple account from the dashboard.

Set these environment variables before starting the app:

- `APPLE_TEAM_ID` - Apple Developer Team ID
- `APPLE_CLIENT_ID` - Services ID (or App ID) configured for Sign in with Apple
- `APPLE_KEY_ID` - Key ID for your Sign in with Apple key
- `APPLE_PRIVATE_KEY` - Private key contents (PEM). For `.env`, use escaped newlines (`\\n`).
- `APPLE_REDIRECT_URI` - Callback URL (defaults to `http://localhost:3000/auth/apple/callback`)

Important Apple Developer setup:

- Enable Sign in with Apple on your identifier.
- Configure and allow the same redirect URI (`/auth/apple/callback`).
- Make sure the configured domain and redirect URI match this app exactly.
=======
User management web application built with Node.js and Express.

## Prerequisites

- **Node.js** >= 18 — [download](https://nodejs.org/)
- **npm** (included with Node.js)

## Running locally

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```

Then open **http://localhost:3000** in your browser.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `SESSION_SECRET` | *(random)* | Session signing secret. **Required** when `NODE_ENV=production`. |

### Examples

```bash
# Use a different port
PORT=4000 npm start

# Production mode (SESSION_SECRET is required)
NODE_ENV=production SESSION_SECRET=your-secret npm start
```
>>>>>>> 1eed26d7274cfa34fa22b8458a4e2b9ff2191527
