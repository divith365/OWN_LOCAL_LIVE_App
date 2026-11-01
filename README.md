# OWNLOCAL LIVE – Production Hyperlocal Marketplace (Ilkal Launch Pilot)

Production monorepo implementation of **OWNLOCAL LIVE**, a local multi-role marketplace connecting Customers, Merchants, and Delivery Partners with Admin oversight.

---

## Architecture Overview

```text
OWN_LOCAL_LIVE/
├── apps/
│   ├── mobile/         # React Native + Expo SDK 52 + Expo Router (Android & iOS)
│   └── static-poc/     # Static HTML/CSS/JS pilot prototype archive
├── packages/
│   ├── types/          # Shared TypeScript interfaces (Users, Merchants, Riders, Orders)
│   ├── ui/             # Design tokens (Colors, Typography, Spacing, Status Badges)
│   ├── validation/     # Zod runtime schemas (Auth, Orders, Location)
│   └── api-client/     # Typed API client connecting to Cloudflare Worker
└── backend/
    └── workers/        # Cloudflare Workers + D1 SQLite + R2 Storage (Hono framework)
```

---

## Live Cloudflare Deployments

- **API Worker URL**: `https://ownlocal-live-api.mahati-mamatha.workers.dev`
- **D1 Database**: `ownlocal-live-db` (ID: `437ca4b7-08c2-4409-85a6-644f07ea0b44`)
- **R2 Storage Bucket**: `ownlocal-live-assets`

### Key Endpoints
- `GET  /api/health` — API status and pilot town parameters
- `GET  /api/merchants` — Nearby store discovery via Haversine algorithm
- `GET  /api/merchants/:id/products` — Store menu & catalog
- `POST /api/orders` — Order placement & totals calculation
- `POST /api/orders/:id/status` — State machine status transitions

---

## Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Backend (Cloudflare Worker & Local D1)
Run the backend with local D1 SQLite emulation:
```bash
npm run worker:dev
```
Run D1 migrations and seeds locally:
```bash
npm run d1:migrate:local
npm run d1:seed:local
```

Deploy Worker and D1 to Cloudflare Cloud:
```bash
npm run worker:deploy
npm run d1:migrate:remote
npm run d1:seed:remote
```

### 3. Mobile App (Expo Router)
Start the Expo development server:
```bash
npm start
```
- **Android**: Press `a` or run `npm run mobile:android` (launches in Android emulator or device).
- **iOS**: Scan the QR code using the **Expo Go** app on an iPhone.
- **Web**: Press `w` or run `npm run mobile:web`.

---

## Persona Navigation
The application features a quick role switcher at launch:
- 🛍️ **Customer Marketplace**: Explore Ilkal stores (Ayodhya Hotel, Sarees, Kirana), view menus, place orders.
- 🏪 **Merchant Dashboard**: Accept/reject orders, transition status, toggle store hours.
- 🛵 **Rider Console**: Toggle duty, check KA-29 bike details, GPS coordinates, pickup & verify customer delivery OTP.
- 🛡️ **Admin Operations**: Control tower with platform metrics and KYC approvals.
