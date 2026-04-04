# vibe-coding

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
