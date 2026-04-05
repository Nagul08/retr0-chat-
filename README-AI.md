#retr0-chat-

Its vibe-coded


Primitive global chat room with retro neon styling, name/password login, and serverless APIs for Vercel.

## Overview

- One shared room for everyone
- Primitive auth: name + password
- Auto-register on first login
- Last 100 messages shown in chat
- Vercel-friendly serverless backend
- Redis persistence on Vercel via Upstash

## Tech Stack

### Frontend

- HTML/CSS/Vanilla JavaScript
- Files:
	- public/login.html
	- public/chat.html
	- public/style.css
	- public/client.js

### Backend (Serverless)

- Vercel serverless functions using Node.js CommonJS modules
- API routes:
	- api/auth.js
	- api/logout.js
	- api/me.js
	- api/messages.js
- Shared helpers:
	- api/_lib/auth.js
	- api/_lib/store.js
	- api/_lib/body.js
	- api/_lib/config.js
	- api/_lib/response.js

### Data Storage

- Primary persistence: Upstash Redis via @upstash/redis
- Redis keys:
	- retr0:users
	- retr0:messages
- Fallback (if Redis env vars are missing): in-memory store inside api/_lib/store.js

### Hosting and Routing

- Vercel for hosting and serverless execution
- vercel.json rewrites:
	- / -> /login.html
	- /login -> /login.html
	- /chat -> /chat.html

## How the App Works

### 1) Login and Registration Flow

1. User opens /login and submits name + password.
2. Browser POSTs form data to /api/auth.
3. Server validates length rules:
	 - name: 2 to 24 chars
	 - password: 2 to 64 chars
4. If user does not exist:
	 - password is SHA-256 hashed
	 - user is created and saved
5. If user exists:
	 - input password is hashed
	 - hash must match stored hash
6. On success:
	 - signed auth cookie is created and set
	 - user is redirected to /chat

### 2) Authentication Model

- Auth uses a signed cookie token, not server sessions.
- Token contains user payload and HMAC signature.
- Signature secret comes from AUTH_SECRET.
- Every protected API route verifies the cookie and rejects unauthorized access.

### 3) Chat Message Flow

1. Chat page loads and calls /api/me to confirm identity.
2. Chat page loads message history from /api/messages (GET).
3. User sends message via /api/messages (POST).
4. Server validates message:
	 - trimmed text must be non-empty
	 - max length from MAX_TEXT_LENGTH (300)
5. Server appends message to store with:
	 - user
	 - text
	 - ISO timestamp
6. Frontend refreshes the list and also polls every 2 seconds to stay updated.

Note: The current Vercel implementation uses polling (not WebSocket broadcast) for compatibility and simplicity in serverless runtime.

### 4) History and Limits

- Chat returns latest HISTORY_LIMIT messages (default 100).
- Store keeps at most MAX_STORED_MESSAGES (default 2000), removing oldest first.

## Environment Variables

Set these in Vercel Project Settings -> Environment Variables.

- AUTH_SECRET
	- Any strong random string (32+ characters recommended)
	- Used to sign auth cookie tokens

- UPSTASH_REDIS_REST_URL
	- Provided by Upstash Redis

- UPSTASH_REDIS_REST_TOKEN
	- Provided by Upstash Redis

- KV_REST_API_URL
	- Vercel KV alias for REST URL (also supported)

- KV_REST_API_TOKEN
	- Vercel KV alias for REST token (also supported, required for write operations)

If Redis variables are missing, the app still runs but data will be non-persistent in serverless environments.

The app accepts either variable set:

- Preferred: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
- Also supported: KV_REST_API_URL + KV_REST_API_TOKEN

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

This starts Vercel local dev server via npx vercel dev.

### Optional local env file

Create .env.local and add:

```env
AUTH_SECRET=replace-with-random-secret
UPSTASH_REDIS_REST_URL=replace-with-url
UPSTASH_REDIS_REST_TOKEN=replace-with-token
```

## Deploy to Vercel (GitHub)

1. Push repo to GitHub.
2. Import repo in Vercel.
3. Create and attach Upstash Redis in Vercel Storage.
4. Add environment variables:
	 - AUTH_SECRET
	 - UPSTASH_REDIS_REST_URL
	 - UPSTASH_REDIS_REST_TOKEN
5. Deploy.

## Project Structure

```text
.
|- api/
|  |- _lib/
|  |  |- auth.js
|  |  |- body.js
|  |  |- config.js
|  |  |- response.js
|  |  |- store.js
|  |- auth.js
|  |- logout.js
|  |- me.js
|  |- messages.js
|- public/
|  |- chat.html
|  |- client.js
|  |- login.html
|  |- retr0-f.png
|  |- retr0.svg
|  |- style.css
|- vercel.json
|- package.json
```

## Security Notes

- Passwords are stored as SHA-256 hashes.
- Cookie is HttpOnly and SameSite=Lax.
- In production, cookie adds Secure flag.
- This is intentionally primitive and not enterprise-grade auth.

## Known Limits

- Single global room only
- No private rooms
- No moderation/admin controls
- Polling every 2 seconds instead of push realtime sockets

## Credits

- Visual identity based on retr0-f.png and retr0.svg assets in this project.
