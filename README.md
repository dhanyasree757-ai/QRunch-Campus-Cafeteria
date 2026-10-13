# QRunch — Combined Student + Vendor + Backend Project

This folder combines the QRunch student portal, vendor dashboard, and Express/SQLite backend. The student portal places orders through the API; the vendor dashboard reads the same SQLite orders and updates statuses. Student confirmation shows a pickup code and QR code (QR display requires internet access for the QRCode.js CDN).

## Requirements
- Node.js 18+
- npm

## Run in VS Code (Windows)
1. Extract this folder and open `QRunch_Complete` in VS Code.
2. Open Terminal → New Terminal.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

Pages (open these directly if needed):
- Home page: http://localhost:3000/
- Customer dashboard: http://localhost:3000/student/
- Vendor dashboard: http://localhost:3000/vendor/
- Customer login: http://localhost:3000/auth.html?role=student&action=login
- Customer register: http://localhost:3000/auth.html?role=student&action=register
- Vendor login: http://localhost:3000/auth.html?role=vendor&action=login
- Vendor register: http://localhost:3000/auth.html?role=vendor&action=register
- API health check: http://localhost:3000/api/health

The logo file is `public/qrunch-logo.png`; the landing page and account page use `/qrunch-logo.png`.

## Demo login
The first time a portal opens, choose OK in the sign-in prompt to use its demo account.
- Student: `student@qrunch.local` / `Student123!`
- Vendor: `vendor@qrunch.local` / `Vendor123!`

Or choose Cancel to enter another account's credentials. Student registration endpoint exists at `POST /api/auth/register`; this UI currently uses the demo sign-in prompt.

## Workflow
1. Open the Student Portal, sign in, add food to cart, and place an order.
2. The backend stores the order and pickup code in `qrunch.sqlite`.
3. Open Vendor Dashboard (same browser is fine), sign in as vendor, and see the same order.
4. Vendor can move orders New → Preparing → Ready.
5. Pickup verification only marks an order Collected when it is Ready and the correct pickup code is supplied.

## Notes
- Orders persist in SQLite across server restarts.
- The pages share the backend API; this is no longer just in-memory demo orders.
- QR currently encodes the pickup code. Vendor verifies by entering the code into Pickup verification. Camera scanning is not implemented.
- The pickup code is a short demo code, so do not use this prototype for real payments or sensitive personal data.
- Before deployment, set a strong `JWT_SECRET` environment variable, remove/change demo accounts, add rate limiting/HTTPS, and conduct a security review.


### Account flows and cancellation
- Landing page Login/Create Account opens a role-specific customer or vendor sign-in/register page.
- Customer accounts can cancel an order only while its status is `New` and within 10 minutes of creation. The server enforces both checks.
- Customer portal: `/student/`; vendor portal: `/vendor/`.
- Demo customer: `student@qrunch.local` / `Student123!`; demo vendor: `vendor@qrunch.local` / `Vendor123!`.
