# Dreamer Swimming Foundation — website

Plain HTML/CSS/JS. No build step. Works on GitHub Pages.

## IMPORTANT: upload ALL of these files
The pages do nothing without the three `.js` files.

    index.html  admission.html  fees.html  notices.html  magazine.html  idcard.html  admin.html
    style.css   script.js       config.js  qrcode.js
    assets/dsf-logo.png         gallery/ (your photos)

GitHub: **Add file -> Upload files**, drag everything in, **Commit changes**. Live in ~1 minute.

## Settings: edit `config.js` only
| Setting | What it does |
|---|---|
| `upiId` | Switches on the QR code and "Open UPI app" button on the Pay Fees page |
| `firebase.apiKey`, `firebase.projectId` | Switches on Admin login and the live Notice Board |
| `MAGAZINE` | List of gallery photos |

## Admin login setup (one time, about 10 minutes, free plan)
1. https://console.firebase.google.com -> **Add project**.
2. **Build -> Authentication -> Get started -> Email/Password -> Enable**.
   Then **Users -> Add user**: the admin's email and a strong password.
3. **Build -> Firestore Database -> Create database** (production mode).
4. Firestore **Rules** tab: paste this, put the admin's email in it, **Publish**.

        rules_version = '2';
        service cloud.firestore {
          match /databases/{database}/documents {
            match /notices/{id} {
              allow read: if true;
              allow write: if request.auth != null
                && request.auth.token.email in ['ADMIN-EMAIL-HERE'];
            }
          }
        }

5. **Project settings (gear icon) -> General**: copy **Project ID** and **Web API key**
   into `config.js`, upload `config.js`.
6. Open `/admin.html` (footer -> "Admin login"), sign in, post a notice.

The email list in the rules is what keeps strangers out, so do not skip step 4.

## Limits
- Payments are not verified automatically. The payer sends the UPI transaction ID on WhatsApp and staff check it.
- Admissions arrive on WhatsApp and are not stored on the site.
- `idcard.html` is hidden from search engines but has no password.
