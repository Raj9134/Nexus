# NEXUS

An enterprise collaboration platform: projects, tasks, channels, direct
messages, files, calendar, and voice calling, on a realtime backend.

- `backend/` — Express 5 + Mongoose + Socket.IO. 79 endpoints.
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

`MONGO_URI` in `backend/.env` points at the local MongoDB service on port 27017. Keep it that way for development.

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

### Frontend

```sh
cd frontend
npm test              # or: bun run test
npm run test:watch
npm run test:coverage
```

70 tests across six files. They focus on the failures that a type check
cannot catch, because those were the ones that reached a browser:

- `nexus-context.test.tsx` — hydration must never present the seed dataset as
  real. A workspace holding one project once rendered "5 projects, 72 tasks,
  6 teammates" with a "Live" badge, because one unreachable endpoint rejected
  a single `Promise.all` and the catch kept every placeholder number.
- `api.test.ts` — token storage, the refresh-then-retry path, and that a 304 is
  a failed read rather than an empty result.
- `no-placeholder-data.test.ts` — scans the sources for text and expressions
  that stand in for state, e.g. a permanent "Raj is typing..." or a count
  hardcoded as `item === "backend" ? 3 : 1`. It also covers the workspace
  switcher, the signed-in user's name and role, any toast that claims an action
  happened with no request behind it, and every file-picking control.
- `call-context.test.tsx` — the signalling payloads. `server.js` validates them
  with `readText`, which rejects anything that is not a string, so sending
  WebRTC objects instead of raw SDP is what previously made every call fail
  with "Invalid WebRTC offer".
- `callManager.test.ts` — peer connection and microphone lifecycle, including
  that teardown stops every track.
- `voice.test.tsx` — the recorder strips the codec suffix the backend's audio
  filter rejects, reports a whole number of seconds, releases the microphone,
  and the player fetches with the access token and revokes its object URL.

The frontend is also checked by `tsc --noEmit` and `eslint .`. CI runs all
four.

## A note on roles

Admin means **owning a workspace**, recorded as `Organization.createdBy`.
There is no global super-admin role. An earlier `User.role` field was read as
one in six places but never written, which made `GET /auth/users` answer 403
for everyone and left five other permission checks dead; that field is no
longer consulted for authorization.

Because that field is never written, `GET /auth/me` used to report every user as
"Member" while `GET /team` called the same owner "Organization Admin". Both now
derive the label from workspace ownership through
`serializeUserWithRole`, so a user's own profile and the team list cannot
disagree.

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

## Trying a call

Calling needs two people in the same workspace, and a member cannot call
themselves, so a single-account workspace will always show the button as
"This is you". To test it, register a second account and send an invitation
from the app: **Invite Member** in the sidebar, or `nexus.pushToast` reports
how many went out. When the backend has no mail transport configured, the
invitation response includes the tokens directly, so the acceptance step works
without a mail server.

The workspace switcher is hidden when a user has only one workspace, since a
menu with a single entry cannot do anything.

## Files and attachments

There are four ways to get a file in, and all four are real requests:

| Where                    | Route                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Files page, Upload       | `POST /files/upload`, with an optional `folder`              |
| A project or task drawer | `POST /files/attach`, with `projectId` or `taskId`           |
| A channel composer       | `POST /files/channel`, posts a `messageType: "file"` message |
| A direct thread          | `POST /files/message`, returns the message                   |

Folders are derived from the files that exist, so there is no "create folder"
action: a folder is made by uploading a file into it, and the sidebar lists
whatever folders the current files fall into. A folder name must be letters,
numbers, spaces, dots, dashes and underscores.

`GET /files/folders` lists them. Downloads go through
`GET /files/download/:fileId`, which needs the access token, so the client
fetches the bytes and plays or saves them from an object URL.

## Support requests

"Help & Support" in the sidebar opens a form that records the request through
`POST /api/support`, along with the route the user was on. `GET
/api/support/mine` returns the caller's own requests, newest first, and nothing
belongs to another user. Nothing is emailed: the backend has no mail transport
by default, so a request that was only ever mailed would be lost silently. The
control previously showed a "Support team has been notified" toast and sent
nothing at all.

## Layout notes

The original Vite scaffold that NEXUS replaced has been deleted. It held an
earlier copy of the calling UI, which is now written in TypeScript under
`frontend/src/services/callManager.ts` and `frontend/src/context/CallContext.tsx`.
