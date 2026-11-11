<<<<<<< HEAD
# BOSSGUDO A.R.C. AQUA FARM

**AI-Assisted Customer Inquiry, Service Booking, and Customer Management System**

A web-based system designed to improve customer communication, streamline service and visitation bookings, and organize customer records for BOSSGUDO A.R.C. AQUA FARM, a business specializing in Australian Red Claw (A.R.C.) crayfish supply, pond construction, installation, and related services.

---

## Project Overview

The BOSSGUDO A.R.C. AQUA FARM System aims to provide customers with a convenient platform for accessing business information, submitting inquiries, and booking available services or farm visitations.

The system integrates an AI-assisted chatbot to respond to frequently asked customer inquiries, a booking management module for handling service and visitation requests, and a customer management module that allows the administrator to maintain organized customer records.

It also provides an administrative dashboard where the owner can monitor bookings, manage customer information, verify payments, and oversee customer transactions.

---

## Key Features

### Customer Website

* Customer registration and login.
* Browse available crayfish products and pond service packages.
* View business information, services, and contact details.
* Submit service and visitation bookings.
* Track booking status and payment information.
* Access personal booking records.

### AI-Assisted Customer Inquiry

* Responds to frequently asked questions.
* Provides information about crayfish products, prices, services, and pond packages.
* Shares relevant business information and contact details.
* Assists customers in finding answers without requiring immediate owner assistance.

### Booking Management

The system provides two booking options:

* **Book a Service** – Allows customers to select available pond service packages, such as pond construction, installation, and custom pond design.
* **Book a Visitation** – Allows customers to schedule a visit to the aqua farm.

Submitted bookings are automatically accepted based on the owner's commitment to accommodate the scheduled requests. Customers can monitor their booking information and corresponding status.

### Payment Management

* Supports manual GCash payments.
* Requires a 50% down payment for applicable service bookings.
* Allows customers to upload payment receipts.
* Enables the administrator to verify submitted payments.
* Records payment progress and outstanding balances.
* Allows the owner to provide applicable delivery fees after reviewing the booking details.

### Customer Management

* Maintains organized customer records.
* Stores customer contact and account information.
* Provides access to customer booking histories.
* Helps the owner monitor customer transactions and interactions.

### Administrative Dashboard

* View and monitor incoming bookings.
* Manage customer records.
* Review booking details and schedules.
* Verify customer payments.
* Update payment and booking statuses.
* Monitor system activities.

---

## Booking Workflow

### Service Booking

1. Customer selects a pond service package.
2. Customer provides the required booking information.
3. Customer reviews and submits the booking.
4. The system automatically accepts the booking.
5. Customer proceeds with the required down payment.
6. Owner verifies the submitted payment and provides applicable additional charges.
7. Booking and payment records are updated accordingly.

### Visitation Booking

1. Customer selects the visitation option.
2. Customer provides the preferred visitation schedule and required details.
3. Customer reviews and submits the booking.
4. The system automatically accepts the booking.
5. Customer can view the booking information and schedule.

---

## User Roles

### Customer

* Browse available services and packages.
* Submit inquiries through the AI-assisted chatbot.
* Book services and farm visitations.
* Upload payment receipts when applicable.
* View booking records and payment status.

### Administrator / Owner

* Monitor incoming bookings.
* Manage customer records.
* Review booking details and schedules.
* Verify customer payments.
* Update payment and booking statuses.
* Monitor system activities.

---

## Project Objectives

* Improve the accessibility of business information through an AI-assisted inquiry chatbot.
* Simplify the process of booking pond services and farm visitations.
* Provide an organized platform for managing customer information and booking records.
* Improve payment monitoring and verification.
* Support the owner's daily business operations through an integrated management system.

---

## Development Methodology

The project follows the Agile Methodology using the Scrum Framework. Development activities are organized into iterative phases, including:

1. **Planning and Requirement Gathering**
Identification and documentation of system requirements based on the client's needs and business operations.
2. **System Designing**
Preparation of the system architecture, user interface, database structure, and system diagrams.
3. **Development and Coding**
Implementation of the frontend, backend, database, and AI-assisted chatbot functionalities.
4. **Testing and Deployment**
Evaluation of system functionality, usability, reliability, and performance, followed by system deployment.
5. **Finalization and Maintenance**
Completion of project documentation, final system improvements, and maintenance preparations.

---

## Project Information

| Details | Description |
| --- | --- |
| **Project Name** | BOSSGUDO A.R.C. AQUA FARM System |
| **Project Type** | Capstone Project |
| **Institution** | St. Dominic College of Asia |
| **Program** | Bachelor of Science in Information Technology |
| **Methodology** | Agile Scrum |
| **Business** | BOSSGUDO A.R.C. AQUA FARM |
| **Location** | Bacao II, General Trias, Cavite |

---

## Project Status

**Under Development**

This project is being developed as an academic mini capstone project for BOSSGUDO A.R.C. AQUA FARM.

---

## Development Team

**Bachelor of Science in Information Technology**

St. Dominic College of Asia

Developed by the BSIT researchers of St. Dominic College of Asia.
=======
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
>>>>>>> feature/customer-login
