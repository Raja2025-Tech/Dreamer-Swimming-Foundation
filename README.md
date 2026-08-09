# Dreamer Swimming Foundation — Website

A single-page site for Dreamer Swimming Foundation (Barasat, Kolkata), built with
plain HTML/CSS/JS — no build step, no dependencies. Ready to publish on GitHub Pages.

## Files
- `index.html` — page structure and content
- `style.css` — all styling (colors, type, layout, animation)
- `script.js` — nav scroll state, mobile menu, scroll-reveal animation

## Publish it on GitHub Pages (5 minutes)

1. **Create a repository**
   Go to [github.com/new](https://github.com/new), name it anything
   (e.g. `dreamer-swimming`), keep it **Public**, and click *Create repository*.

2. **Upload the files**
   On the new repo's page, click *uploading an existing file*, drag in
   `index.html`, `style.css`, and `script.js`, then click *Commit changes*.

   (Or, from a terminal:)
   ```bash
   git init
   git add index.html style.css script.js
   git commit -m "Add Dreamer Swimming Foundation site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/dreamer-swimming.git
   git push -u origin main
   ```

3. **Turn on Pages**
   In the repo, go to **Settings → Pages**. Under *Build and deployment →
   Source*, choose **Deploy from a branch**, set branch to **main** and
   folder to **/ (root)**, then click **Save**.

4. **Visit the site**
   GitHub will publish it at:
   `https://YOUR-USERNAME.github.io/dreamer-swimming/`
   (takes 1–2 minutes to go live after the first deploy).

## Things you'll likely want to personalize
- Swap in real photos of the pool/coaches (there are none in this build —
  everything visual is drawn in CSS/SVG so nothing here needs sourcing or credit).
- Double-check the phone number, address, and hours against the current
  Google Business listing before publishing, in case they've changed.
- The three testimonials are written to reflect common themes in the
  foundation's Google reviews, not verbatim quotes — swap in real ones if
  you'd like to attribute them to name.
- Add a custom domain later via *Settings → Pages → Custom domain* if wanted.
