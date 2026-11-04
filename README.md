# Financily – Full Stack Loan Website

Frontend (static, your design) → Vercel · Backend (Node/Express) → Render · Database → MongoDB Atlas · Code → GitHub

## Structure
- `frontend/` index.html (site), admin.html (admin panel), config.js (API URL + OTP login), vercel.json
- `backend/` server.js (API), models.js (database), .env.example
- `render.yaml` Render blueprint

## API
- POST /api/applications  save loan application (quick + full form)
- POST /api/contact       callback request
- POST /api/auth/send-otp, /api/auth/verify-otp
- POST /api/admin/login · GET /api/admin/applications · PATCH /api/admin/applications/:id
- GET /api/health

## Run locally
1. `cd backend && npm install && cp .env.example .env` (fill MONGODB_URI, JWT_SECRET, ADMIN_*)
2. `npm run dev` (API on :3000)
3. In `frontend/` run `npx serve -l 5500` and open http://localhost:5500

## Deploy
1. MongoDB Atlas: create a free M0 cluster, a database user, Network Access 0.0.0.0/0, copy the connection string.
2. GitHub: create a repo, then `git init && git add . && git commit -m "Financily" && git branch -M main && git remote add origin <repo-url> && git push -u origin main`.
3. Render: New > Web Service > pick repo. Root Directory `backend`, Build `npm install`, Start `npm start`. Add env vars from `.env.example` (NODE_ENV=production, CLIENT_ORIGIN = your Vercel URL). Copy the Render URL.
4. Put the Render URL in `frontend/config.js`, commit and push.
5. Vercel: Add New Project > pick repo. Root Directory `frontend`, Framework "Other". Deploy. Copy the Vercel URL into Render's CLIENT_ORIGIN and redeploy the API.
6. Test: submit a form, then open /admin on your Vercel site.

## Before going live (important)
- Use a strong ADMIN_PASS; keep .env out of GitHub.
- Set FAST2SMS_KEY (or SMTP_*) or OTP login will not work in production.
- Render free plan sleeps after inactivity; the first request can take ~50s. Ping /api/health with UptimeRobot or use a paid plan.
- The form collects PAN and personal data: get the legal text reviewed, and confirm your lender-partner / DSA / RBI-related compliance with a professional.

## Firebase security (web app)

The Firebase `apiKey` in `frontend/firebase.js` / `frontend/src/firebase.js` is **public by design** — it ships in every client build and only identifies the project. It is not a secret, so committing it is safe. Security is enforced by the controls below, not by hiding the key.

**Required before production (Firebase Console):**
- **Enable App Check** for Authentication (Project Settings → App Check → use reCAPTCHA v3 or Play Integrity for the web app). This blocks requests from non-Firebase clients. This app accesses Auth only — mint a provider token and call `initializeAppCheck()` in `src/firebase.js` once your reCAPTCHA v3 site key exists.
- **Restrict Authorized domains** (Authentication → Settings) to just your live frontend domain and `localhost`.
- **Set restrictive Security Rules if you ever add Firestore/Storage.** The app does not currently use Firestore or Storage, so rules there are not yet applicable. If they are added, deny-all-by-default and grant only authenticated, per-user access.
- Consider rotating the `apiKey` (Project Settings → API keys) after enabling App Check — optional, since the key is public; it mainly invalidates any pre-existing misuse.
- Monitor Auth usage/quota for anomalies (Billing → Usage).
