
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
- `/forgot-password` and `/reset-password` use the existing password recovery
  API routes.
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

