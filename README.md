
# bossgudo-arc-system
AI-assisted customer inquiry, service booking, and customer management system for BOSSGUDO A.R.C. AQUA FARM.

## Run the application

Install dependencies with `npm install`, copy `.env.example` to `.env`, and set
`MONGODB_URI` to your Atlas connection string. `MONGODB_DATABASE` defaults to
`gudonavarro_db_user`; set it explicitly only when deploying to a different
database. Keep `.env` private. Run `npm run dev` to start the Nuxt
application and Nitro API on the same origin. For a production build, run
`npm run build` and then `npm start`. In production, terminate TLS at the server
or trusted reverse proxy and set `NODE_ENV=production` so session cookies are
marked `Secure`.

The server-side MongoDB connection is shared by Nitro routes. Check Atlas
connectivity with `GET /api/health`; it returns `{"status":"ok"}` when the
database responds to a ping, or HTTP 503 with `{"status":"database_unavailable"}`
otherwise. The API response does not include connection details. Frontend pages
should access server data through HTTP API requests, never by importing
MongoDB utilities.

The My Bookings document and `GET /api/auth/me` require a valid session.
`GET /api/auth/session` returns the signed-in user or `null` for navigation
state. The current booking and visitation data still lives in the browser-side
application; it is not yet persisted as account-owned MongoDB records.
Passwords are limited to 72 UTF-8 bytes because bcrypt truncates longer inputs.

## Frontend authentication routes

Nuxt creates these routes from the page files in `app/pages`:

- `/customer-login` is the customer sign-in page. Its `guest` middleware sends
  users with an existing session to the safe `next` destination or home. The
  page submits to the existing `POST /api/auth/login` endpoint.
- `/register` also uses the `guest` middleware and submits to the existing
  `POST /api/auth/register` endpoint.
- `/forgot-password` requests and verifies a six-digit reset code before
  navigating to `/reset-password`. The reset form requires the short-lived
  HTTP-only authorization cookie issued by the verification API.
- `/mybookings` uses the `auth` middleware, which checks
  `GET /api/auth/session` and redirects signed-out users to
  `/customer-login`, preserving their requested destination.
- `/admin` uses the `admin` middleware. It checks the session and redirects
  signed-out users to `/customer-login`; a signed-in user without the admin
  role is redirected home.
- `/admin-login` is a separate frontend-only interface. It does not submit or
  verify credentials, call an admin sign-in endpoint, or provide registration.
  The app-wide session restoration may still call `GET /api/auth/session`. The
  page does not grant access to `/admin`.

## Customer registration API

`POST /api/auth/register` accepts `firstName`, `lastName`, `email`,
`phoneNumber`, `password`, and `confirmPassword`. Names are limited to 80
characters, email is normalized to lowercase, and Philippine mobile numbers
are normalized to `+63` format. Passwords must be at least eight characters,
include uppercase and lowercase letters, a number, and a symbol, and fit
bcrypt's 72-byte limit.

A successful request returns HTTP 201 with a minimal customer profile and does
not create a login session. The response never includes credentials. Validation
errors return HTTP 400 with `error` and `fieldErrors`; duplicate email or phone
details return HTTP 409; unavailable MongoDB returns HTTP 503. New customer
records are saved in the `users` collection through the shared Mongoose
connection, with passwords hashed before persistence.

The `auth` and `admin` middleware provide frontend navigation behavior only;
they are not a security boundary. Server-side endpoints and resources must
enforce authorization independently. The application currently includes
server-side auth and MongoDB integrations for its existing customer flows; the
admin-login placeholder does not add or change those integrations.

## Server-side Gmail email service

The reusable server-side email utility sends plain-text, HTML, or multipart
messages through Gmail SMTP. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, and `SMTP_FROM` in the private `.env` file. Gmail uses
`smtp.gmail.com` on port `587` with STARTTLS; use a Google app password rather
than your regular account password. These values are kept in Nuxt's private
runtime configuration and are not exposed to browser code.

In a non-production environment, a signed-in administrator can verify SMTP
submission with `POST /api/auth/admin/email-test` and a JSON body such as
`{"to":"recipient@example.com"}`. The route sends a fixed test message, allows
at most three requests per 15 minutes, and returns a generic error if SMTP
delivery fails. It is unavailable when `NODE_ENV=production` and is not part
of the password-recovery flow. A successful response means Gmail accepted the
message for sending; check the recipient mailbox to confirm final delivery.

## Password recovery

Password recovery uses the same private Gmail SMTP settings and reusable
email utility described above. It additionally requires `PASSWORD_RESET_SECRET`
as a separate, random secret of at least 32 bytes; generate one with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the generated value private and set it in `.env` or the deployment's
server-side environment. Do not expose it through `runtimeConfig.public`.

The recovery API has three steps:

1. `POST /api/auth/forgot-password` accepts `{"email":"..."}` and returns the
   same generic HTTP 202 response for active and unknown accounts. An active
   account receives a six-digit code by email.
2. `POST /api/auth/verify-reset-code` accepts `{"email":"...","code":"123456"}`.
   A valid code is single-use and sets a short-lived, HTTP-only
   `bossgudo_password_reset` cookie scoped to the reset endpoint.
3. `POST /api/auth/reset-password` accepts `password` and `confirmPassword`.
   It requires the authorization cookie, replaces the password, clears reset
   fields, expires the cookie, and revokes existing sessions.

Codes expire after 10 minutes, are HMAC-hashed with `PASSWORD_RESET_SECRET`
and account-specific context, and allow at most five failed guesses. Request
and verification endpoints are also rate-limited per client. Requesting a new
code replaces the previous code. Expired and consumed reset fields are cleared
during recovery operations; no separate token collection or database
connection is required. If no code arrives, check server-side configuration
and logs without exposing SMTP or reset-secret values.

## Verification

Run the automated backend and auth-flow tests with `npm test`; run
`npm audit` to check dependency advisories.

