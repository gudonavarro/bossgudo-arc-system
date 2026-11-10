# bossgudo-arc-system
AI-assisted customer inquiry, service booking, and customer management system for BOSSGUDO A.R.C. AQUA FARM.

## Run the application

Install dependencies with `npm install`, copy `.env.example` to `.env`, configure
`MONGODB_URI`, and run `npm run dev`. The Nuxt application serves the pages and
Nitro API from the same origin. For a production build, run `npm run build` and
then `npm start`. In production, terminate TLS at the server or trusted reverse
proxy and set `NODE_ENV=production` so session cookies are marked `Secure`.

The My Bookings document and `GET /api/auth/me` require a valid session.
`GET /api/auth/session` returns the signed-in user or `null` for navigation
state. The current booking and visitation data still lives in the browser-side
application; it is not yet persisted as account-owned MongoDB records.
Passwords are limited to 72 UTF-8 bytes because bcrypt truncates longer inputs.

## Password recovery email

Password recovery requires a real SMTP account. Configure `SMTP_HOST`,
`SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, and
`APP_BASE_URL` in the private `.env` file. Use a verified sender/domain and a
production HTTPS `APP_BASE_URL`. Port 587 normally uses `SMTP_SECURE=false`
(STARTTLS); implicit TLS commonly uses port 465 with `SMTP_SECURE=true`.

Any SMTP-compatible provider can be used, for example Amazon SES, Postmark,
Resend SMTP, or a managed mailbox provider. No reset email is sent when these
settings are absent or invalid; the API explicitly reports that recovery is
unavailable. The reset token is single-use, expires after 30 minutes, and only
its SHA-256 hash is stored in MongoDB.

## Verification

Run the automated backend and auth-flow tests with `npm test`; run
`npm audit` to check dependency advisories.
