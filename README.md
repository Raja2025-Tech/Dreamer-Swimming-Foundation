# Dreamer Swimming Foundation — website

Plain HTML/CSS/JS. No build step. Works on GitHub Pages.

## Pages
| File | Purpose |
|---|---|
| `index.html` | Home: programs, why us, approach, schedule, rating, FAQ, visit |
| `admission.html` | Admission form -> opens a ready WhatsApp message to staff; UPI payment info |
| `notices.html` | Notice board (edit `notices-data.js`) |
| `magazine.html` | Photo gallery (edit `magazine-data.js`, put photos in `gallery/`) |
| `idcard.html` | Staff-only ID card generator (PNG download / print) |

## Things you edit
- `config.js` — **set `upiId`** (e.g. `name@bank`) to switch on the "Pay via UPI" button.
- `notices-data.js` — add a notice: copy a block, newest first.
- `magazine-data.js` — add a photo: upload to `gallery/`, add one line.

## Publish / update
1. GitHub repo -> **Add file -> Upload files**. Drag in everything in this folder
   (keep the `assets/` and `gallery/` folders), then **Commit changes**.
2. **Settings -> Pages -> Deploy from a branch -> main / (root)**.
3. Live at `https://raja2025-tech.github.io/Dreamer-Swimming-Foundation/` in ~1 minute.

## Limits of a static site (by design)
No server or database, so there is no student login, no stored admissions and no payment
verification. Admissions arrive on WhatsApp; staff confirm payments manually. `idcard.html`
is hidden from search but is **not password-protected**.
