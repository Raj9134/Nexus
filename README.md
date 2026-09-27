# NEXUS

An enterprise collaboration platform: projects, tasks, channels, direct
messages, files, calendar, and voice calling, on a realtime backend.

- `backend/` — Express 5 + Mongoose + Socket.IO. 76 endpoints.
- `frontend/` — TanStack Start + React 19 + TypeScript + Tailwind 4.

## Requirements

- Node.js 22
- MongoDB. Either a local instance or an Atlas cluster. The backend reads
  `MONGO_URI` from `backend/.env`.
- bun 1.4.2, for the frontend. It ships a `bun.lock` and a `bunfig.toml` with
  a 24-hour `minimumReleaseAge` supply-chain guard, so `npm install` in
  `frontend/` resolves versions independently of the lockfile and can drift.
  Keep the bun version pinned to match the lockfile: `bun install
  --frozen-lockfile` fails if the resolver wants to rewrite it.

## Database

`MONGO_URI` in `backend/.env` points at the local MongoDB service on port
27017. Keep it that way for development.

The Atlas connection that was configured earlier had a real problem: it
resolves its hosts through a DNS SRV lookup, and on this machine that lookup
failed every few minutes (`querySrv ETIMEOUT`, `getaddrinfo ENOTFOUND
...shard-00-02`). The backend retries at startup, but a lookup that fails
mid-request still surfaces as a 500, and it was the cause of a bug where one
unreachable endpoint made the whole dashboard fall back to placeholder data.

The Atlas connection is preserved in `backend/.env.atlas-backup` if you need
it. The accounts that were worth keeping have been copied across.

To reset a password on a local account:

```sh
cd backend
node set-local-password.cjs you@example.com "new-password"
```

That script refuses to run against a remote host.



## Getting started

```sh
# API on :5000
cd backend
cp .env.example .env      # then set MONGO_URI and a long random JWT_SECRET
npm install
npm run dev               # nodemon

# App on :3000
cd frontend
bun install --frozen-lockfile
bun run dev -- --port 3000
```

The app is then on http://localhost:3000 and the API on http://localhost:5000.

`backend/.env.example` documents every variable. Outgoing mail is optional:
with no SMTP settings the server logs each message and returns the token in
the API response outside production, so local development and the test suite
work with no mail provider.

## Tests

The suites drive a live server over HTTP rather than importing it, so start
the backend first.

```sh
cd backend
npm run test:all          # contract, realtime, and invitation suites
```

Individually: `npm test`, `npm run test:realtime`, `npm run test:invites`.
`npm run test:e2e` drives a real browser and needs a running frontend too.

There is no frontend test suite yet. The frontend is checked by
`tsc --noEmit` and `eslint .`, which is what CI runs.

## A note on roles

Admin means **owning a workspace**, recorded as `Organization.createdBy`.
There is no global super-admin role. An earlier `User.role` field was read as
one in six places but never written, which made `GET /auth/users` answer 403
for everyone and left five other permission checks dead; that field is no
longer consulted for authorization.

## Realtime

The socket authenticates with the same access token as the REST API
(`auth: { token }`). Identity comes from the authenticated socket, so
identity fields in an outgoing payload are ignored and the peer is resolved
from the database record.

## Calls

Voice calling uses WebRTC with a STUN-only configuration, which is enough for
same-network and localhost calls. Two peers behind separate NATs need a TURN
relay: set `VITE_TURN_URL`, and optionally `VITE_TURN_USERNAME` and
`VITE_TURN_CREDENTIAL`, in `frontend/.env`.

## Layout notes

`legacy-vite-frontend/` is the abandoned Vite scaffold that NEXUS replaced. It
is kept only because it held the sole implementation of the calling UI, which
has since been rewritten in TypeScript. Nothing depends on it and it can be
deleted.
