# Deploying NEXUS

Two services and one database. The backend is an Express server with Socket.IO;
the frontend is a TanStack Start Node server. They are deployed separately and
talk over HTTPS.

```
                    ┌─────────────────┐
   browser ────────▶│  frontend       │  Railway service "nexus-frontend"
                    │  (TanStack SSR) │
                    └────────┬────────┘
                             │  https://…up.railway.app/api
                             ▼
                    ┌─────────────────┐
                    │  backend        │  Railway service "nexus-api"
                    │  Express+Socket │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  MongoDB Atlas  │
                    └─────────────────┘
```

**Deploy the API first.** The frontend bakes the API address into its bundle at
build time, so it cannot be built before the API has a URL.

## 1. Database

MongoDB Atlas, free M0 tier is enough to start.

1. Create a free cluster.
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → *Allow access from anywhere* (`0.0.0.0/0`). A hosted
   service has no fixed outbound address, so an IP allow-list will block it.
4. Copy the connection string. Replace `<password>` and add the database name:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/NEXUS?retryWrites=true&w=majority
   ```

## 2. The API

New project → **Deploy from GitHub repo** → pick this repository.

**Settings → Root Directory:** `backend`

Variables:

| Variable | Value |
|---|---|
| `MONGO_URI` | the Atlas string from step 1 |
| `JWT_SECRET` | a long random string — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_ORIGIN` | the frontend URL, e.g. `https://nexus-frontend.up.railway.app` |
| `APP_URL` | same as the frontend URL; it is what the reset links point at |
| `UPLOAD_DIR` | `/data/uploads` if you attach a volume, otherwise leave unset |
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `resend` |
| `SMTP_PASSWORD` | your Resend API key |
| `MAIL_FROM` | `NEXUS <onboarding@resend.dev>`, or your verified domain |
| `NODE_ENV` | `production` |

**`CLIENT_ORIGIN` matters.** With no mail settings or with a wrong origin the
reset token is returned in the API response instead of being emailed, and a
browser on a different origin is refused by CORS. The server prints its mail
mode on boot — check the logs after the first deploy.

**Uploads need a volume.** Attachments and voice notes are written to disk. The
container filesystem is ephemeral, so without a volume they disappear on the
next deploy.

*Settings → Volumes* → mount at `/data`, then set `UPLOAD_DIR=/data/uploads`.

Without a volume the app still runs; files just do not survive a restart.

Deploy. When it is healthy, note the domain, e.g.
`https://nexus-api.up.railway.app`, and check it:

```
GET https://nexus-api.up.railway.app/health
→ {"status":"ok","database":"up",...}
```

`database: "down"` means the connection string or the network access is wrong.

## 3. The frontend

Add a second service from the same repository.

**Root Directory:** `frontend`

Variables:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://nexus-api.up.railway.app/api` |

If you rename the API service, Railway can resolve it for you:

```
VITE_API_URL=https://${{nexus-api.RAILWAY_PUBLIC_DOMAIN}}/api
```

That re-resolves on every build, so renaming the service does not silently break
the frontend.

Deploy. `NODE_ENV` is **not** set for the frontend: Vite needs `PROD` unset at
config time to behave, and the framework sets `import.meta.env.PROD` itself.

The build prints an error if `VITE_API_URL` is still `localhost` in a production
bundle. If you see that, the variable did not reach the build.

## 4. Calling

WebRTC needs a secure context, so calling only works over HTTPS. Railway serves
HTTPS by default, so this is already satisfied.

Two people behind different networks still cannot connect: a STUN-only
configuration finds local addresses, not a public one. That needs a TURN relay —
see the Calls section of the main README.

## 5. After deploying

1. Open the frontend URL and register. The first account creates its own
   workspace, which makes it the owner and therefore the admin.
2. Turn on email. `GET /health` on the API, then use **Forgot password** — the
   message should appear in the inbox rather than on screen.
3. Check the API logs for `Mail: SMTP via …`. Anything else means the reset
   token is being returned to the browser instead of sent.

## What is not covered here

- **A custom domain.** Railway generates a working HTTPS domain on its own.
  Pointing your own at it is a DNS change in the Railway dashboard.
- **Scaling beyond one instance.** Socket.IO holds connections in memory, so a
  second instance would not see the first one's sockets. One instance is fine
  for this; more needs a socket adapter such as Redis.
- **Backups.** Atlas free tier has no automatic restore.
