# Dreamer Swimming Foundation — website

Plain HTML/CSS/JS on GitHub Pages, with a student and staff portal on Google Firebase.

## Pages
| Page | Who | What |
|---|---|---|
| `index.html`, `admission.html`, `fees.html`, `notices.html`, `magazine.html`, `privacy.html` | Everyone | Public site |
| `student.html` | Students / parents | Google sign-in → apply → pay admission fee → (after approval) ID card, attendance, notices, certificates, fees, my data |
| `admin.html` | Staff | Administrators: applications, payments, students, attendance + check-in QR, certificates, trainers, notices, settings. Trainers: attendance + check-in QR, notices |
| `attend.html` | Students | Opened by scanning the check-in QR at the pool |
| `verify.html` | Everyone | Check a certificate number |

## Files you edit
- `config.js` — Firebase keys, UPI ID, `portalReady`, magazine photos.
- `firestore.rules` — paste into Firebase (step 5). Don't edit it unless you know Firestore rules.

---

## One-time Firebase setup (about 20 minutes, free Spark plan)

> **Use a separate Firebase project for the swimming foundation.** Don't use the BDSF project:
> the rules below replace the whole ruleset and would break the BDSF app. A separate project
> also keeps swimmers' personal data apart from another organisation's data.

1. **Create the project** at https://console.firebase.google.com → **Add project** (for example `dreamer-swimming`). Google Analytics is not needed.
2. **Turn on Google sign-in**: Build → **Authentication** → Get started → Sign-in method → **Google** → Enable → Save.
   Don't enable Email/Password.
3. **Allow the website address**: Authentication → **Settings** → **Authorized domains** → Add domain → `raja2025-tech.github.io`.
4. **Create the database**: Build → **Firestore Database** → Create database → **production mode** → location `asia-south1 (Mumbai)`.
5. **Publish the rules**: Firestore → **Rules** tab → delete everything there → paste the whole of `firestore.rules` → **Publish**.
6. **Make yourself the first administrator**: Firestore → **Data** → Start collection `staff` →
   Document ID = **your Gmail address in lowercase** (e.g. `yourname@gmail.com`) → fields:
   - `name` (string): your name
   - `role` (string): `admin`
   - `active` (boolean): `true`
7. **Get the web keys**: Project settings (gear) → General → Your apps → **Web** (`</>`) → register app (no hosting) →
   copy `apiKey` and `projectId`.
8. **Edit `config.js`** and upload it:
   ```js
   firebase: { apiKey: "AIza…", projectId: "dreamer-swimming" },
   portalReady: true,
   ```
   Until `portalReady` is `true`, the portal pages only say "Online accounts are opening soon"
   and collect no data.
9. **Sign in** at `admin.html` with that Gmail. Then:
   - **Settings**: enter the admission and monthly fees.
   - **Trainers**: add each trainer's Gmail address.
10. **Restrict the API key** (recommended): Google Cloud Console → APIs & Services → Credentials →
    "Browser key (auto created by Firebase)" → Application restrictions → **Websites** →
    add `https://raja2025-tech.github.io/*` → Save.

### Quick test after setup
- Open `student.html` in a private window, sign in with a different Gmail, apply, and submit a test fee.
- In `admin.html` → Applications, approve it. The student now sees the ID card.
- Attendance → **Open check-in QR**, scan it with the student's phone at the pool → "You're checked in".
- In the Firebase console **Rules Playground** (Firestore → Rules → Rules Playground), confirm these are **denied**:
  - `get /students/<another uid>` signed in as a different user
  - `get /students/<uid>` signed in as a trainer
  - `create /attendance/<uid>_<date>` with a wrong `code`
- Then delete the test student from admin.html → Students → open → Delete all data.

## How privacy is protected
- Students see only their own record. Administrators see student records. Trainers see only a
  roster (name, ID, program, batch) and attendance, never addresses, birthdays, phones, photos or payments.
- Location is checked only at check-in, stored rounded to ~100 m, and must be within ~440 m of the pool.
- The check-in QR changes every 30 s and expires after 90 s. The database itself rejects old codes and far-away locations.
- Public certificate verification shows only name, certificate type, date and status.
- Students can download all their data or request deletion. Administrators see deletion requests on the Overview tab.
- Privacy policy: `privacy.html`.

## Limits
- Payments are verified by staff against your bank or UPI app; the site doesn't confirm UPI payments automatically
  (that needs a payment gateway and a server).
- A determined person can fake their phone's location. The rotating QR, which has to be on screen at the pool, is the main protection.
- Photos are stored as small compressed images (~25 KB) inside Firestore, so no paid Storage plan is needed.
