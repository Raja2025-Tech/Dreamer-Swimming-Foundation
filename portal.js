// =====================================================================
//  Dreamer Swimming Foundation — Student & Staff portal (Firebase)
//  Pages: student.html, admin.html, attend.html, verify.html
//  Data access is enforced by firestore.rules; this file is only the UI.
// =====================================================================
const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
const CFG = window.DSF || {};
const FBC = CFG.firebase || {};
const root = document.getElementById("app");
const KIND = root ? root.dataset.portal : "";

const POOL = { lat: 22.7258249, lng: 88.476228 };      // keep in sync with firestore.rules
const MAX_DISTANCE_M = 350;
const PROGRAMS = ["Novice Training", "Semi-Advance Training", "Advance Training", "Competitive Swimmer Training",
  "First Aid Training", "Lifesaving & Lifeguard Training"];
const LEVELS = PROGRAMS.slice(0, 4);
const BATCHES = ["Morning 6:00 AM", "Morning 6:40 AM", "Morning 7:20 AM", "Evening 4:00 PM", "Evening 4:40 PM",
  "Evening 5:20 PM", "Night 8:00 PM"];
const BLOOD = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"];
const CERT_KINDS = {
  level: { label: "Level completion", heading: "Certificate of Completion" },
  firstaid: { label: "First Aid Training", heading: "Certificate of Completion", title: "First Aid Training" },
  lifeguard: { label: "Lifesaving & Lifeguard Training", heading: "Certificate of Completion", title: "Lifesaving & Lifeguard Training" },
  achievement: { label: "Competition / achievement", heading: "Certificate of Achievement" },
  participation: { label: "Participation", heading: "Certificate of Participation" },
};

let F = {};          // Firebase functions
let auth, db, user;

// ------------------------------------------------------------------ helpers
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const opts = (list, sel, blank) => (blank ? `<option value="">${esc(blank)}</option>` : "") +
  list.map((o) => `<option${o === sel ? " selected" : ""}>${esc(o)}</option>`).join("");
const pad = (n, w = 4) => String(n).padStart(w, "0");
const istDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const plusYear = (iso) => (parseInt(iso.slice(0, 4), 10) + 1) + iso.slice(4);
function toDate(v) {
  if (!v) return null;
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v === "string") return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00+05:30") : new Date(v);
  return v instanceof Date ? v : null;
}
const fmtDate = (v) => { const d = toDate(v); return d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—"; };
const fmtTime = (v) => { const d = toDate(v); return d ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—"; };
// Only a JPEG data URL produced by compressPhoto() is ever put into the page
const PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const safePhoto = (v) => (typeof v === "string" && PHOTO_RE.test(v) ? v : "");
const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
function ageOn(dob) {
  if (!dob) return NaN;
  const t = istDay(), y = +t.slice(0, 4) - +dob.slice(0, 4);
  return t.slice(5) >= dob.slice(5) ? y : y - 1;
}
const normPhone = (v) => String(v || "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
function distanceM(a, b) {
  const R = 6371000, r = (x) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function qrSvg(text) {
  try { const q = window.qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
  catch (e) { return ""; }
}
function upiLink(amount, note) {
  if (!CFG.upiId) return "";
  return "upi://pay?pa=" + encodeURIComponent(CFG.upiId) + "&pn=" + encodeURIComponent(CFG.upiName || "") +
    (amount ? "&am=" + Number(amount).toFixed(2) : "") + "&cu=INR&tn=" + encodeURIComponent(String(note || "").slice(0, 60));
}
function loadImage(src) {
  return new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
}
async function compressPhoto(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error("Please choose a photo (JPG or PNG).");
  if (file.size > 15 * 1024 * 1024) throw new Error("That photo is too large. Please choose one under 15 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const W = 300, H = 375, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"), k = Math.max(W / img.width, H / img.height);
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    g.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
    for (let q = 0.8; q >= 0.4; q -= 0.1) { const d = c.toDataURL("image/jpeg", q); if (d.length <= 70000) return d; }
    return c.toDataURL("image/jpeg", 0.35);
  } finally { URL.revokeObjectURL(url); }
}
function download(name, blobOrUrl) {
  const a = document.createElement("a");
  a.href = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}
function printImage(dataUrl, title, size) {
  const w = window.open("", "_blank");
  if (!w) return toast("Allow pop-ups for this site to print.", "error");
  w.document.write(`<title>${esc(title)}</title><style>@page{size:${size};margin:0}body{margin:0}img{width:100%;display:block}</style><img src="${dataUrl}" onload="print()">`);
  w.document.close();
}
function toast(msg, kind = "ok") {
  let t = $("#toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.className = "toast " + kind; t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 4200);
}
function errText(e) {
  const c = (e && e.code) || "";
  if (c === "permission-denied" || c === "firestore/permission-denied") return "You don't have permission to do that. If this keeps happening, contact the office.";
  if (c.includes("unavailable") || c.includes("network")) return "No connection. Check your internet and try again.";
  if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "Sign-in was cancelled.";
  if (c === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
  if (c === "auth/unauthorized-domain") return "This website address is not yet allowed to sign in. The site admin must add it in Firebase: Authentication → Settings → Authorized domains.";
  if (c === "auth/operation-not-allowed") return "Google sign-in is not switched on yet. The site admin must enable it in Firebase: Authentication → Sign-in method.";
  if (c === "auth/network-request-failed") return "No connection. Check your internet and try again.";
  return (e && e.message) || "Something went wrong. Please try again.";
}
async function busy(btn, label, fn) {
  const old = btn.textContent; btn.disabled = true; btn.textContent = label;
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; }
}
function formError(form, msg) {
  if (!form.__clearOnInput) { form.__clearOnInput = true; form.addEventListener("input", () => { const e = $(".form-error", form); if (e) e.hidden = true; }); }
  let p = $(".form-error", form);
  if (!p) { p = document.createElement("p"); p.className = "form-error"; p.setAttribute("role", "alert"); form.appendChild(p); }
  p.textContent = msg || ""; p.hidden = !msg;
  if (msg) p.scrollIntoView({ block: "center", behavior: "smooth" });
}
const badge = (status) => {
  const map = { applied: ["Application received", "info"], fee_submitted: ["Fee submitted", "info"], active: ["Active", "ok"],
    inactive: ["Inactive", "muted"], rejected: ["Not approved", "bad"], not_verified: ["Not verified", "bad"], pending: ["Awaiting check", "warn"],
    verified: ["Verified", "ok"], valid: ["Valid", "ok"], revoked: ["Revoked", "bad"], qr: ["QR", "info"], manual: ["Manual", "muted"] };
  const [t, k] = map[status] || [status, "muted"];
  return `<span class="badge ${k}">${esc(t)}</span>`;
};

// ------------------------------------------------------------------ boot
async function boot() {
  if (!root) return;
  // The portal stays closed until the admin has published firestore.rules and set portalReady: true in config.js,
  // so no personal data is collected before the privacy rules are in place.
  if (!FBC.apiKey || !FBC.projectId || CFG.portalReady !== true) {
    root.innerHTML = `<div class="form-card"><h3>Online accounts are opening soon</h3><p class="form-note">Meanwhile, to apply, pay fees or ask anything, please call or WhatsApp us on <a href="tel:+918777292030">+91 87772 92030</a>.</p></div>`;
    return;
  }
  try {
    const [a, b, c] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")]);
    F = Object.assign({}, a, b, c);
  } catch (e) {
    root.innerHTML = `<div class="form-card"><h3>Could not load</h3><p class="form-note">Check your internet connection and reload the page.</p></div>`;
    return;
  }
  const app = F.initializeApp({ apiKey: FBC.apiKey, projectId: FBC.projectId, authDomain: FBC.authDomain || FBC.projectId + ".firebaseapp.com" });
  db = F.getFirestore(app);
  if (KIND === "verify") return verifyPage();
  auth = F.getAuth(app);
  F.onAuthStateChanged(auth, async (u) => {
    user = u;
    try {
      if (!u) return signInView();
      if (KIND === "student") await studentPortal();
      else if (KIND === "admin") await staffPortal();
      else if (KIND === "attend") await attendPage();
    } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="form-card"><h3>Something went wrong</h3><p class="form-note">${esc(errText(e))}</p><div class="cta-row"><button class="btn btn-outline" type="button" id="retry">Reload</button></div></div>`;
      $("#retry").onclick = () => location.reload();
    }
  });
}

const G_LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-10l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>`;

function signInView() {
  const t = {
    student: ["Sign in to the Student portal", "New students can apply after signing in. Existing students can download their ID card, see attendance and pay fees."],
    admin: ["Staff sign in", "Use the Google account your administrator added as staff."],
    attend: ["Sign in to check in", "Sign in with the Google account you applied with. After signing in, your attendance is marked automatically."],
  }[KIND];
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)|GSA\//i.test(navigator.userAgent);
  root.innerHTML = `
    <div class="form-card signin-card">
      <h3>${esc(t[0])}</h3>
      <p class="form-note">${esc(t[1])}</p>
      ${inApp ? `<p class="callout warn">You seem to be inside an app's built-in browser. Google sign-in may not work here. Open this page in Chrome or Safari.</p>` : ""}
      <button type="button" class="gbtn" id="gSignIn">${G_LOGO}<span>Continue with Google</span></button>
      <p class="form-note small">We only use your Google name and email to sign you in. See our <a href="privacy.html">Privacy policy</a>.</p>
    </div>`;
  $("#gSignIn").onclick = async (ev) => {
    const p = new F.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
    try { await busy(ev.currentTarget, "Opening Google…", () => F.signInWithPopup(auth, p)); }
    catch (e) { formError($(".signin-card"), errText(e)); }
  };
}

function accountBar(extra = "") {
  return `<div class="account-bar"><span class="acc-who">${user.photoURL ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : ""}<span><b>${esc(user.displayName || "Signed in")}</b><small>${esc(user.email || "")}</small></span></span>
    <span class="acc-actions">${extra}<button type="button" class="btn btn-outline btn-sm" data-signout>Sign out</button></span></div>`;
}
function wireSignOut() {
  $$("[data-signout]").forEach((b) => (b.onclick = async () => { await F.signOut(auth); if (location.search.includes("from=staff")) history.replaceState(null, "", location.pathname); }));
}

async function getStaff() {
  if (!user || !user.email) return null;
  try {
    const s = await F.getDoc(F.doc(db, "staff", user.email.toLowerCase()));
    return s.exists() && s.data().active === true ? s.data() : null;
  } catch (e) { return null; }
}
async function getFees() {
  try { const s = await F.getDoc(F.doc(db, "settings", "fees")); return s.exists() ? s.data() : {}; } catch (e) { return {}; }
}
async function myList(col) {
  const s = await F.getDocs(F.query(F.collection(db, col), F.where("uid", "==", user.uid)));
  return s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
}
async function noticesList(n = 5) {
  try {
    const s = await F.getDocs(F.query(F.collection(db, "notices"), F.orderBy("createdAt", "desc"), F.limit(n)));
    return s.docs.map((d) => d.data());
  } catch (e) { return []; }
}

// =====================================================================
//  STUDENT PORTAL
// =====================================================================
const S = { me: null, fees: {}, staff: null };

async function studentPortal() {
  root.innerHTML = `<p class="form-note">Loading your account…</p>`;
  // One login, two dashboards: staff accounts always go to the staff dashboard
  const staff = await getStaff();
  if (staff) { root.innerHTML = `<p class="form-note">Signed in as staff. Opening the Staff portal…</p>`; location.replace("admin.html"); return; }
  const [snap, fees] = await Promise.all([F.getDoc(F.doc(db, "students", user.uid)), getFees()]);
  S.me = snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : null;
  S.fees = fees; S.staff = staff;
  renderStudent();
}

function timeline(status) {
  const steps = ["Applied", "Fee submitted", "Admission confirmed"];
  const at = { applied: 0, fee_submitted: 1, active: 2 }[status] ?? 0;
  return `<ol class="timeline">${steps.map((t, i) => `<li class="${i < at ? "done" : i === at ? "current" : ""}"><span>${i < at ? "✓" : i + 1}</span>${esc(t)}</li>`).join("")}</ol>`;
}

function renderStudent(view) {
  const me = S.me, staffLink = "";
  const fromStaff = new URLSearchParams(location.search).get("from") === "staff";
  const notStaffNote = fromStaff ? `<p class="callout warn">${esc(user.email)} is not on the staff list, so you're in the Student portal. Staff: ask an administrator to add this Gmail under Trainers, or sign out and use your staff Google account.</p>` : "";
  let body = "";
  if (view === "edit" || !me) body = applicationForm(me);
  else if (me.status === "applied") body = feeStep();
  else if (me.status === "fee_submitted") body = waitingStep();
  else if (me.status === "rejected") body = rejectedStep();
  else body = dashboard();
  root.innerHTML = accountBar(staffLink) + notStaffNote + body;
  wireSignOut();
  if (view === "edit" || !me) wireApplication();
  else if (me.status === "applied") wireFeeForm("Admission fee", true);
  else if (me.status === "rejected") $("#reapply").onclick = () => renderStudent("edit");
  else if (me.status === "fee_submitted") {
    $("#editApp").onclick = () => renderStudent("edit");
    loadMyPayments().then((list) => {
      const adm = list.filter((p) => p.purpose === "Admission fee");
      if (adm.length && adm.every((p) => p.status === "rejected")) {
        const r = $("#repay"); r.hidden = false; r.open = true;
        r.insertAdjacentHTML("beforebegin", `<p class="callout bad">Your admission fee payment could not be verified. Please check the details and submit it again, or contact us on WhatsApp.</p>`);
      }
    });
    wirePayForm("adm2", "Admission fee", async (pay) => { await F.addDoc(F.collection(db, "payments"), pay); toast("Payment details submitted."); await studentPortal(); });
  }
  else wireDashboard();
}

// ---------- application
function applicationForm(me) {
  const d = me || {};
  const q = new URLSearchParams(location.search);
  const prog = d.program || (PROGRAMS.includes(q.get("program")) ? q.get("program") : "");
  const today = istDay(), maxDob = (+today.slice(0, 4) - 3) + today.slice(4);
  return `
    ${me ? "" : `<div class="portal-intro"><h2>Apply for admission</h2><p>Fill in the swimmer's details. After you submit, you'll pay the admission fee, and our team will confirm your admission.</p></div>`}
    ${me && me.status === "rejected" && me.rejectReason ? `<p class="callout bad"><b>Previous application was not approved:</b> ${esc(me.rejectReason)}</p>` : ""}
    <form class="form-card wide" id="appForm" novalidate>
      <h3>${me ? "Edit application" : "Swimmer's details"}</h3>
      <div class="form-grid">
        <div class="field full"><label for="a_name">Swimmer's full name *</label><input id="a_name" maxlength="80" autocomplete="name" value="${esc(d.name || (me ? "" : user.displayName || ""))}"></div>
        <div class="field"><label for="a_dob">Date of birth * <span class="hint">(3 years or older)</span></label><input id="a_dob" type="date" min="1930-01-01" max="${maxDob}" value="${esc(d.dob || "")}"></div>
        <div class="field"><label for="a_gender">Gender</label><select id="a_gender">${opts(["Male", "Female", "Other", "Prefer not to say"], d.gender, "Select")}</select></div>
        <div class="field"><label for="a_phone">Phone (WhatsApp) *</label><input id="a_phone" type="tel" inputmode="numeric" maxlength="14" placeholder="10-digit mobile number" value="${esc(d.phone || "")}"></div>
        <div class="field"><label for="a_emerg">Emergency contact number *</label><input id="a_emerg" type="tel" inputmode="numeric" maxlength="14" value="${esc(d.emergency || "")}"></div>
        <div class="field"><label for="a_program">Program *</label><select id="a_program">${opts(PROGRAMS, prog, "Select a program")}</select></div>
        <div class="field"><label for="a_batch">Preferred batch</label><select id="a_batch">${opts(BATCHES, d.batch, "No preference")}</select></div>
        <div class="field"><label for="a_blood">Blood group</label><select id="a_blood">${opts(BLOOD, d.blood, "Select")}</select></div>
        <div class="field" id="guardianField"><label for="a_guardian">Parent / guardian name <span class="hint" id="gHint"></span></label><input id="a_guardian" maxlength="80" value="${esc(d.guardian || "")}"></div>
        <div class="field full"><label for="a_addr">Address</label><textarea id="a_addr" rows="2" maxlength="300">${esc(d.address || "")}</textarea></div>
        <div class="field full photo-field">
          <label for="a_photo">Passport-size photo *</label>
          <div class="photo-row"><img id="a_prev" class="photo-prev" alt="Photo preview" ${safePhoto(d.photo) ? `src="${safePhoto(d.photo)}"` : "hidden"}>
          <div><input id="a_photo" type="file" accept="image/*"><p class="form-note">A clear, front-facing photo. It is resized to a small file and used only for the ID card.</p></div></div>
        </div>
        <div class="field full check"><label><input type="checkbox" id="a_gconsent" ${d.guardianConsent ? "checked" : ""}> I am the swimmer's parent or guardian and I consent to these details being used for training, as described in the <a href="privacy.html" target="_blank">Privacy policy</a>.</label></div>
        <div class="field full check"><label><input type="checkbox" id="a_consent" ${d.consent ? "checked" : ""}> I confirm these details are correct and I agree to the <a href="privacy.html" target="_blank">Privacy policy</a>. *</label></div>
      </div>
      <div class="cta-row"><button class="btn btn-coral" type="submit">${me ? "Save application" : "Submit application"}</button>${me ? `<button type="button" class="btn btn-outline" id="cancelEdit">Cancel</button>` : ""}</div>
    </form>`;
}

function wireApplication() {
  const form = $("#appForm"); let photo = safePhoto(S.me && S.me.photo);
  const syncMinor = () => {
    const minor = ageOn($("#a_dob").value) < 18;
    $("#gHint").textContent = minor ? "* (swimmer is under 18)" : "";
    $("#a_gconsent").closest(".field").hidden = !minor;
  };
  $("#a_dob").addEventListener("change", syncMinor); syncMinor();
  $("#a_photo").addEventListener("change", async (e) => {
    formError(form, "");
    try { photo = await compressPhoto(e.target.files[0]); $("#a_prev").src = photo; $("#a_prev").hidden = false; }
    catch (err) { e.target.value = ""; formError(form, err.message); }
  });
  if ($("#cancelEdit")) $("#cancelEdit").onclick = () => renderStudent();
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault(); formError(form, "");
    const v = (id) => $(id).value.trim();
    const data = {
      name: v("#a_name"), dob: v("#a_dob"), gender: v("#a_gender"), phone: normPhone(v("#a_phone")), emergency: normPhone(v("#a_emerg")),
      program: v("#a_program"), batch: v("#a_batch"), blood: v("#a_blood"), guardian: v("#a_guardian"), address: v("#a_addr"),
      photo, consent: $("#a_consent").checked, guardianConsent: $("#a_gconsent").checked, email: user.email || "",
    };
    const age = ageOn(data.dob), minor = age < 18;
    const fail = (sel, msg) => { $(sel).focus(); formError(form, msg); };
    if (data.name.length < 2) return fail("#a_name", "Please enter the swimmer's full name.");
    if (!data.dob || isNaN(age) || age < 3 || age > 100) return fail("#a_dob", "Please check the date of birth. The swimmer must be at least 3 years old.");
    if (!/^[6-9]\d{9}$/.test(data.phone)) return fail("#a_phone", "Please enter a valid 10-digit mobile number.");
    if (!/^[6-9]\d{9}$/.test(data.emergency)) return fail("#a_emerg", "Please enter a valid 10-digit emergency contact number.");
    if (!data.program) return fail("#a_program", "Please choose a program.");
    if (minor && data.guardian.length < 2) return fail("#a_guardian", "Please enter the parent or guardian's name.");
    if (minor && !data.guardianConsent) return fail("#a_gconsent", "A parent or guardian must give consent for swimmers under 18.");
    if (!photo) return fail("#a_photo", "Please add a passport-size photo.");
    if (!data.consent) return fail("#a_consent", "Please confirm the details and agree to the Privacy policy.");
    if (!minor) data.guardianConsent = false;
    const ref = F.doc(db, "students", user.uid);
    try {
      await busy(form.querySelector("[type=submit]"), "Saving…", async () => {
        if (!S.me) await F.setDoc(ref, Object.assign(data, { status: "applied", createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp() }));
        else await F.updateDoc(ref, Object.assign(data, { status: S.me.status === "fee_submitted" ? "fee_submitted" : "applied", updatedAt: F.serverTimestamp() }));
      });
      toast(S.me ? "Application saved." : "Application submitted.");
      await studentPortal(); window.scrollTo({ top: root.offsetTop - 100, behavior: "smooth" });
    } catch (e) { formError(form, errText(e)); }
  });
}

// ---------- fee payment (admission + later fees)
function payForm(purpose, fixedAmount, idPrefix = "p") {
  const upi = !!CFG.upiId;
  return `
    <form class="pay-form" id="${idPrefix}Form" novalidate>
      <div class="form-grid">
        ${purpose === "Admission fee" ? "" : `<div class="field"><label for="${idPrefix}_purpose">Payment for</label><select id="${idPrefix}_purpose">${opts(["Monthly fee", "Exam / certificate fee", "Competition fee", "Other"], "Monthly fee")}</select></div>
        <div class="field" id="${idPrefix}_monthWrap"><label for="${idPrefix}_month">Month</label><input id="${idPrefix}_month" type="month" value="${istDay().slice(0, 7)}"></div>`}
        <div class="field"><label for="${idPrefix}_amount">Amount (₹) *</label><input id="${idPrefix}_amount" type="number" min="1" step="1" inputmode="numeric" ${fixedAmount ? `value="${fixedAmount}"${purpose === "Admission fee" ? " readonly" : ""}` : `placeholder="Amount confirmed by our team"`}></div>
        <fieldset class="field full method"><legend>How did you pay? *</legend>
          <label><input type="radio" name="${idPrefix}_method" value="upi" ${upi ? "checked" : ""}> UPI</label>
          <label><input type="radio" name="${idPrefix}_method" value="cash" ${upi ? "" : "checked"}> Cash at the pool</label>
        </fieldset>
      </div>
      <div class="upi-box" id="${idPrefix}_upi">
        ${upi ? `<div class="pay-row"><div class="qr-wrap"><div class="qr" id="${idPrefix}_qr" role="img" aria-label="UPI payment QR code"></div><p class="form-note">Scan with any UPI app</p></div>
          <div class="pay-side"><a class="btn btn-solid" id="${idPrefix}_link" href="#">Open UPI app</a><p class="form-note">Paying to <b>${esc(CFG.upiId)}</b> (${esc(CFG.upiName || "")}). Check the name in your UPI app before paying.</p></div></div>`
        : `<p class="form-note">Ask our team on WhatsApp for UPI payment details.</p>`}
        <div class="field"><label for="${idPrefix}_utr">UPI transaction ID / UTR *</label><input id="${idPrefix}_utr" inputmode="numeric" maxlength="30" autocomplete="off" placeholder="12-digit number from your UPI app"></div>
      </div>
      <div class="cta-row"><button class="btn btn-coral" type="submit">Submit payment details</button></div>
      <p class="form-note">Our team checks every payment. It shows as “Awaiting check” until verified.</p>
    </form>`;
}

function wirePayForm(idPrefix, purposeFixed, onDone) {
  const form = $("#" + idPrefix + "Form"); if (!form) return;
  const amt = $("#" + idPrefix + "_amount"), box = $("#" + idPrefix + "_upi");
  const purposeSel = $("#" + idPrefix + "_purpose"), monthWrap = $("#" + idPrefix + "_monthWrap");
  const method = () => (form.querySelector(`[name=${idPrefix}_method]:checked`) || {}).value;
  const purpose = () => purposeFixed || (purposeSel.value === "Monthly fee" ? "Monthly fee (" + $("#" + idPrefix + "_month").value + ")" : purposeSel.value);
  const refreshQr = () => {
    box.hidden = method() !== "upi";
    if (purposeSel) monthWrap.hidden = purposeSel.value !== "Monthly fee";
    const q = $("#" + idPrefix + "_qr"); if (!q) return;
    const link = upiLink(amt.value, purpose() + " " + (S.me && (S.me.studentId || S.me.name) || ""));
    q.innerHTML = amt.value > 0 ? qrSvg(link) : `<p class="form-note">Enter the amount to show the QR code.</p>`;
    $("#" + idPrefix + "_link").href = link || "#";
  };
  form.addEventListener("input", refreshQr); form.addEventListener("change", refreshQr); refreshQr();
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault(); formError(form, "");
    const amount = Math.round(+amt.value), m = method(), utr = ($("#" + idPrefix + "_utr").value || "").replace(/\s/g, "");
    if (!(amount >= 1 && amount <= 100000)) { amt.focus(); return formError(form, "Please enter the amount."); }
    if (m === "upi" && !/^[A-Za-z0-9]{6,30}$/.test(utr)) { $("#" + idPrefix + "_utr").focus(); return formError(form, "Enter the UPI transaction ID shown in your UPI app after paying."); }
    const pay = { uid: user.uid, name: S.me.name, studentId: S.me.studentId || "", purpose: purpose(), amount, method: m, status: "pending", createdAt: F.serverTimestamp() };
    if (m === "upi") pay.utr = utr;
    try {
      await busy(form.querySelector("[type=submit]"), "Submitting…", () => onDone(pay));
    } catch (e) { formError(form, errText(e)); }
  });
}

function feeStep() {
  const fee = S.fees.admission;
  return `${timeline("applied")}
    <div class="portal-grid">
      <section class="form-card">
        <h3>Pay the admission fee</h3>
        <p class="form-note">${fee ? `The admission fee is <b>${money(fee)}</b>.` : "Our team will tell you the admission fee if you don't know it yet."}</p>
        ${payForm("Admission fee", fee, "adm")}
      </section>
      ${appSummary()}
    </div>`;
}
function wireFeeForm() {
  $("#editApp").onclick = () => renderStudent("edit");
  wirePayForm("adm", "Admission fee", async (pay) => {
    const b = F.writeBatch(db);
    b.set(F.doc(F.collection(db, "payments")), pay);
    b.update(F.doc(db, "students", user.uid), { status: "fee_submitted", updatedAt: F.serverTimestamp() });
    await b.commit();
    toast("Payment details submitted."); await studentPortal();
  });
}
function appSummary() {
  const me = S.me;
  return `<section class="form-card summary">
      <h3>Your application</h3>
      <div class="summary-head">${safePhoto(me.photo) ? `<img src="${safePhoto(me.photo)}" alt="" class="avatar-lg">` : ""}<div><b>${esc(me.name)}</b><span>${esc(me.program)}</span><span>${esc(me.batch || "No batch preference")}</span></div></div>
      <dl class="info-grid"><dt>Date of birth</dt><dd>${fmtDate(me.dob)}</dd><dt>Phone</dt><dd>${esc(me.phone)}</dd><dt>Emergency</dt><dd>${esc(me.emergency)}</dd>${me.guardian ? `<dt>Guardian</dt><dd>${esc(me.guardian)}</dd>` : ""}</dl>
      <button type="button" class="btn btn-outline btn-sm" id="editApp">Edit application</button>
    </section>`;
}
function waitingStep() {
  return `${timeline("fee_submitted")}
    <div class="portal-grid">
      <section class="form-card">
        <h3>Waiting for confirmation</h3>
        <p>Thank you. Our team will check your application and payment, then confirm your admission and batch. You'll see your Student ID and ID card here once it's confirmed.</p>
        <h4 class="mini-h">Your payments</h4><div id="myPayments" class="mini-list"><p class="form-note">Loading…</p></div>
        <details class="pay-details" id="repay" hidden><summary class="btn btn-coral btn-sm">Submit the payment again</summary>${payForm("Admission fee", S.fees.admission, "adm2")}</details>
      </section>
      ${appSummary()}
    </div>`;
}
function rejectedStep() {
  return `<section class="form-card"><h3>Your application was not approved</h3>
    ${S.me.rejectReason ? `<p class="callout bad">${esc(S.me.rejectReason)}</p>` : ""}
    <p class="form-note">You can update your application and send it again, or message us on WhatsApp.</p>
    <div class="cta-row"><button class="btn btn-coral" type="button" id="reapply">Update and re-apply</button></div></section>`;
}
async function loadMyPayments() {
  const box = $("#myPayments"); if (!box) return;
  try {
    const list = (await myList("payments")).sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0));
    box.innerHTML = list.length ? list.map((p) => `<div class="mini-row"><span><b>${esc(p.purpose)}</b><small>${fmtDate(p.createdAt)} · ${p.method === "upi" ? "UPI " + esc(p.utr || "") : "Cash"}</small></span><span>${money(p.amount)} ${badge(p.status)}</span></div>`).join("")
      : `<p class="form-note">No payments yet.</p>`;
    return list;
  } catch (e) { box.innerHTML = `<p class="form-note">${esc(errText(e))}</p>`; return []; }
}

// ---------- dashboard
function dashboard() {
  const me = S.me;
  return `
    ${me.status === "inactive" ? `<p class="callout warn">Your membership is currently inactive. Contact the office to reactivate it.</p>` : ""}
    <nav class="jump" aria-label="Sections"><a href="#d-today">Today</a><a href="#d-att">Attendance</a><a href="#d-notices">Notices</a><a href="#d-certs">Certificates</a><a href="#payments">Payments</a><a href="#d-privacy">My data</a></nav>
    <section class="id-hero">
      <div class="id-person">${safePhoto(me.photo) ? `<img src="${safePhoto(me.photo)}" alt="" class="avatar-lg">` : ""}
        <div><p class="eyebrow">Student ID</p><h2>${esc(me.studentId || "—")}</h2><p><b>${esc(me.name)}</b> · ${esc(me.program)}</p><p class="form-note">${esc(me.batch || "Batch to be assigned")} · Valid till ${fmtDate(me.validTill)}</p></div></div>
      <div class="id-card-wrap"><canvas id="idCanvas" width="1012" height="638" class="id-canvas" aria-label="Your student ID card"></canvas>
        <div class="cta-row"><button class="btn btn-solid btn-sm" id="idDl" type="button">Download ID card</button><button class="btn btn-outline btn-sm" id="idPrint" type="button">Print</button></div></div>
    </section>
    <div class="portal-grid">
      <section class="form-card" id="d-today"><h3>Today's check-in</h3><div id="todayBox"><p class="form-note">Loading…</p></div></section>
      <section class="form-card" id="d-notices"><h3>Notice board</h3><div id="noticeBox" class="mini-list"><p class="form-note">Loading…</p></div><a class="lane-link" href="notices.html">All notices <span aria-hidden="true">→</span></a></section>
    </div>
    <section class="form-card wide" id="d-att"><div class="sec-head"><h3>Attendance</h3><div class="cal-nav"><button type="button" class="btn btn-outline btn-sm" id="calPrev" aria-label="Previous month">‹</button><b id="calLabel"></b><button type="button" class="btn btn-outline btn-sm" id="calNext" aria-label="Next month">›</button></div></div>
      <div class="att-wrap"><div id="calendar" class="calendar"></div><div><p class="att-stat"><b id="attCount">0</b> days this month</p><div id="attList" class="mini-list"></div></div></div></section>
    <div class="portal-grid">
      <section class="form-card" id="d-certs"><h3>Certificates</h3><div id="certBox" class="mini-list"><p class="form-note">Loading…</p></div></section>
      <section class="form-card" id="payments"><h3>Payments</h3><div id="myPayments" class="mini-list"><p class="form-note">Loading…</p></div>
        <details class="pay-details"><summary class="btn btn-coral btn-sm">Pay a fee</summary>${payForm("other", S.fees.monthly, "fee")}</details></section>
    </div>
    <section class="form-card wide" id="d-privacy"><h3>My data &amp; privacy</h3>
      <p class="form-note">You can download a copy of everything we hold about you, or ask us to delete it. See the <a href="privacy.html">Privacy policy</a>.</p>
      ${me.deleteRequested ? `<p class="callout warn">You asked us to delete your data on ${fmtDate(me.deleteRequestedAt)}. Our team will contact you and complete it within 30 days.</p>` : ""}
      <div class="cta-row"><button type="button" class="btn btn-outline btn-sm" id="myData">Download my data</button>${me.deleteRequested ? "" : `<button type="button" class="btn btn-outline btn-sm danger" id="delReq">Request deletion</button>`}</div></section>`;
}

async function wireDashboard() {
  const me = S.me;
  const logo = await loadImage("assets/dsf-logo.png").catch(() => null);
  const photo = safePhoto(me.photo) ? await loadImage(me.photo).catch(() => null) : null;
  drawIdCard($("#idCanvas"), me, logo, photo);
  $("#idDl").onclick = () => $("#idCanvas").toBlob((b) => download((me.studentId || "student-id") + ".png", b), "image/png");
  $("#idPrint").onclick = () => printImage($("#idCanvas").toDataURL("image/png"), me.studentId, "85.6mm 54mm");
  wirePayForm("fee", null, async (pay) => { await F.addDoc(F.collection(db, "payments"), pay); toast("Payment details submitted."); $(".pay-details").open = false; loadMyPayments(); });
  loadMyPayments();

  // attendance
  let att = [];
  try { att = await myList("attendance"); } catch (e) { $("#attList").innerHTML = `<p class="form-note">${esc(errText(e))}</p>`; }
  const days = new Map(att.map((a) => [a.day, a]));
  const today = days.get(istDay());
  $("#todayBox").innerHTML = today
    ? `<p class="checked"><span aria-hidden="true">✓</span> Checked in at ${fmtTime(today.at)}</p>`
    : me.status === "active"
      ? `<p>At the pool, scan the <b>check-in QR code</b> on the trainer's screen with your phone camera. Allow location when asked.</p><p class="form-note">Report 10 minutes before your batch for free-hand exercise.</p>`
      : `<p class="form-note">Check-in is available for active students.</p>`;
  let month = istDay().slice(0, 7);
  const draw = () => {
    const [y, m] = month.split("-").map(Number), first = new Date(Date.UTC(y, m - 1, 1)), n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    $("#calLabel").textContent = first.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
    let h = ["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span class="cal-h">${d}</span>`).join("");
    for (let i = 0; i < (first.getUTCDay() + 6) % 7; i++) h += `<span></span>`;
    let count = 0;
    for (let d = 1; d <= n; d++) {
      const key = `${month}-${pad(d, 2)}`, hit = days.has(key); if (hit) count++;
      h += `<span class="cal-d${hit ? " hit" : ""}${key === istDay() ? " today" : ""}" ${hit ? `title="Present, ${esc(fmtTime(days.get(key).at))}"` : ""}>${d}</span>`;
    }
    $("#calendar").innerHTML = h; $("#attCount").textContent = count;
    const list = att.filter((a) => a.day.startsWith(month)).sort((a, b) => b.day.localeCompare(a.day));
    $("#attList").innerHTML = list.length ? list.slice(0, 12).map((a) => `<div class="mini-row"><span>${fmtDate(a.day)}</span><span>${fmtTime(a.at)} ${badge(a.method)}</span></div>`).join("") : `<p class="form-note">No attendance this month.</p>`;
  };
  const shift = (k) => { const [y, m] = month.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 + k, 1)); month = d.toISOString().slice(0, 7); draw(); };
  $("#calPrev").onclick = () => shift(-1); $("#calNext").onclick = () => shift(1); draw();

  // notices
  const notes = await noticesList(5);
  $("#noticeBox").innerHTML = notes.length ? notes.map((n) => `<div class="mini-row notice-mini${n.important ? " imp" : ""}"><span><b>${esc(n.title)}</b><small>${fmtDate(n.createdAt)}</small></span></div>`).join("") : `<p class="form-note">No notices right now.</p>`;

  // certificates
  let certs = [];
  try { certs = (await myList("certificates")).filter((c) => c.status === "valid").sort((a, b) => b.issuedOn.localeCompare(a.issuedOn)); } catch (e) { /* shown below */ }
  $("#certBox").innerHTML = certs.length ? certs.map((c, i) => `<div class="mini-row"><span><b>${esc(c.title)}</b><small>${esc(c.heading)} · ${fmtDate(c.issuedOn)} · ${esc(c.id)}</small></span><button type="button" class="btn btn-outline btn-sm" data-cert="${i}">Download</button></div>`).join("") : `<p class="form-note">Certificates issued to you will appear here.</p>`;
  $$("[data-cert]").forEach((b) => (b.onclick = () => downloadCertificate(certs[+b.dataset.cert])));

  // privacy
  $("#myData").onclick = async () => {
    const pay = await myList("payments").catch(() => []);
    const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v.toDate === "function" ? v.toDate().toISOString() : v)));
    const mine = Object.assign({}, me); delete mine.photo;
    const out = { exportedAt: new Date().toISOString(), account: { name: user.displayName, email: user.email }, student: clean(mine), photo: "(included in your ID card)", attendance: clean(att), payments: clean(pay), certificates: clean(certs) };
    download("my-dsf-data.json", new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
  };
  if ($("#delReq")) $("#delReq").onclick = async (ev) => {
    const b = ev.currentTarget;
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Tap again to confirm"; return; }
    try { await F.updateDoc(F.doc(db, "students", user.uid), { deleteRequested: true, deleteRequestedAt: F.serverTimestamp() }); toast("Deletion requested."); await studentPortal(); }
    catch (e) { toast(errText(e), "error"); }
  };
  if (location.hash) { const t = $(location.hash); if (t) t.scrollIntoView(); }
}

// ---------- ID card + certificate drawing
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fitText(g, text, maxW, size, weight, family) {
  let s = size; do { g.font = `${weight} ${s}px ${family}`; s -= 2; } while (g.measureText(text).width > maxW && s > 14);
}
function drawIdCard(cv, st, logo, photo) {
  const g = cv.getContext("2d"), W = cv.width, H = cv.height, F1 = "Inter, Arial, sans-serif", MONO = "'Space Mono', monospace";
  const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, "#04222E"); grd.addColorStop(1, "#0B6E82");
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = "rgba(47,217,196,0.22)"; g.lineWidth = 3;
  for (let k = 0; k < 4; k++) { g.beginPath(); for (let x = 0; x <= W; x += 8) { const y = 470 + k * 34 + Math.sin(x / 70 + k) * 12; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  g.fillStyle = "#fff"; rr(g, 36, 30, 150, 92, 16); g.fill();
  if (logo) { const lw = 126, lh = (lw * logo.naturalHeight) / logo.naturalWidth; g.drawImage(logo, 48, 30 + (92 - lh) / 2, lw, lh); }
  g.fillStyle = "#fff"; g.font = `700 34px ${F1}`; g.fillText("DREAMER SWIMMING", 206, 72);
  g.font = `700 34px ${F1}`; g.fillText("FOUNDATION", 206, 110);
  g.textAlign = "right"; g.font = `700 20px ${MONO}`; g.fillStyle = "#2FD9C4"; g.fillText("STUDENT ID", W - 36, 66); g.textAlign = "left";
  const px = 36, py = 160, pw = 214, ph = 268;
  g.save(); rr(g, px, py, pw, ph, 18); g.clip(); g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(px, py, pw, ph);
  if (photo) { const r = Math.max(pw / photo.width, ph / photo.height); g.drawImage(photo, px + (pw - photo.width * r) / 2, py + (ph - photo.height * r) / 2, photo.width * r, photo.height * r); }
  g.restore(); g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = 3; rr(g, px, py, pw, ph, 18); g.stroke();
  const tx = 278, maxW = W - tx - 36;
  fitText(g, st.name || "", maxW, 42, 700, F1); g.fillStyle = "#fff"; g.fillText(st.name || "", tx, 200);
  const row = (label, value, x, y, w) => { g.font = `700 15px ${MONO}`; g.fillStyle = "#2FD9C4"; g.fillText(label, x, y); fitText(g, value || "—", w, 25, 600, F1); g.fillStyle = "#fff"; g.fillText(value || "—", x, y + 28); };
  row("ID NO.", st.studentId, tx, 246, maxW);
  row("PROGRAM", st.program, tx, 314, maxW);
  row("BATCH", st.batch, tx, 382, 300); row("BLOOD", st.blood, tx + 330, 382, 120);
  row("EMERGENCY", st.emergency, tx + 470, 382, maxW - 470);
  g.fillStyle = "rgba(255,255,255,0.88)"; g.font = `500 17px ${F1}`;
  g.fillText("Valid till " + fmtDate(st.validTill), 36, 596);
  g.textAlign = "right"; g.fillText("Barasat, Kolkata · 87772 92030", W - 36, 596); g.textAlign = "left";
}

async function downloadCertificate(c) {
  const cv = document.createElement("canvas"); cv.width = 2000; cv.height = 1414;
  const g = cv.getContext("2d"), W = cv.width, H = cv.height, SERIF = "Georgia, 'Times New Roman', serif", F1 = "Inter, Arial, sans-serif";
  g.fillStyle = "#FBFEFD"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#04222E"; g.lineWidth = 14; g.strokeRect(50, 50, W - 100, H - 100);
  g.strokeStyle = "#2FD9C4"; g.lineWidth = 4; g.strokeRect(80, 80, W - 160, H - 160);
  for (let x = 120; x < W - 120; x += 56) { g.fillStyle = (x / 56) % 2 < 1 ? "#FF6B4D" : "#0B6E82"; g.beginPath(); g.ellipse(x, 130, 14, 8, 0, 0, Math.PI * 2); g.fill(); }
  const logo = await loadImage("assets/dsf-logo.png").catch(() => null);
  if (logo) { const lw = 220, lh = (lw * logo.naturalHeight) / logo.naturalWidth; g.drawImage(logo, (W - lw) / 2, 175, lw, lh); }
  g.textAlign = "center"; g.fillStyle = "#04222E";
  g.font = `700 40px ${F1}`; g.fillText("DREAMER SWIMMING FOUNDATION", W / 2, 360);
  g.font = `400 26px ${F1}`; g.fillStyle = "#0B6E82"; g.fillText("Barasat, Kolkata", W / 2, 400);
  g.fillStyle = "#04222E"; g.font = `italic 700 86px ${SERIF}`; g.fillText(c.heading, W / 2, 530);
  g.font = `400 34px ${F1}`; g.fillStyle = "#33555F"; g.fillText("This is to certify that", W / 2, 620);
  fitText(g, c.name, W - 400, 92, 700, SERIF); g.fillStyle = "#04222E"; g.fillText(c.name, W / 2, 730);
  g.strokeStyle = "#2FD9C4"; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 - 520, 760); g.lineTo(W / 2 + 520, 760); g.stroke();
  const line = c.kind === "achievement" ? "for" : c.kind === "participation" ? "for taking part in" : "has successfully completed";
  g.font = `400 34px ${F1}`; g.fillStyle = "#33555F"; g.fillText(line, W / 2, 830);
  fitText(g, c.title, W - 400, 54, 700, F1); g.fillStyle = "#0B6E82"; g.fillText(c.title, W / 2, 905);
  if (c.studentId) { g.font = `400 26px ${F1}`; g.fillStyle = "#33555F"; g.fillText("Student ID " + c.studentId, W / 2, 960); }
  g.textAlign = "left"; g.font = `400 28px ${F1}`; g.fillStyle = "#04222E";
  g.fillText("Date of issue: " + fmtDate(c.issuedOn), 200, 1150); g.fillText("Certificate no.: " + c.id, 200, 1195);
  g.textAlign = "right"; g.strokeStyle = "#04222E"; g.lineWidth = 2; g.beginPath(); g.moveTo(W - 640, 1150); g.lineTo(W - 360, 1150); g.stroke();
  g.font = `400 26px ${F1}`; g.fillText("Authorised signatory", W - 380, 1190);
  const url = new URL("verify.html?c=" + encodeURIComponent(c.id), location.href).href;
  const svg = qrSvg(url);
  if (svg) {
    const qi = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)).catch(() => null);
    if (qi) { g.fillStyle = "#fff"; g.fillRect(W - 330, 1040, 200, 200); g.drawImage(qi, W - 325, 1045, 190, 190); g.textAlign = "center"; g.font = `400 20px ${F1}`; g.fillStyle = "#33555F"; g.fillText("Scan to verify", W - 230, 1268); }
  }
  cv.toBlob((b) => download(c.id + ".png", b), "image/png");
}

// =====================================================================
//  ATTENDANCE CHECK-IN (attend.html?c=CODE)
// =====================================================================
async function attendPage() {
  const code = new URLSearchParams(location.search).get("c") || "";
  const shell = (title, body, kind = "") => { root.innerHTML = accountBar() + `<section class="form-card checkin ${kind}"><h3>${title}</h3>${body}</section>`; wireSignOut(); };
  if (!code) return shell("Scan the QR code at the pool", `<p>Ask your trainer to show the check-in QR code, then scan it with your phone camera.</p>`);
  root.innerHTML = `<p class="form-note">Checking your account…</p>`;
  if (await getStaff()) return shell("This is a staff account", `<p>Students check in with their own account. To mark a student present, use <a href="admin.html#attendance">Staff portal → Attendance</a>.</p>`);
  const snap = await F.getDoc(F.doc(db, "students", user.uid));
  const me = snap.exists() ? snap.data() : null;
  if (!me) return shell("No student account found", `<p>This Google account hasn't applied yet. Sign in with the account you applied with, or <a href="student.html">apply now</a>.</p>`, "bad");
  if (me.status !== "active") return shell("Check-in not available", `<p>Check-in is available once your admission is confirmed and your membership is active.</p><p><a href="student.html">Open the Student portal</a></p>`, "bad");
  const day = istDay(), ref = F.doc(db, "attendance", user.uid + "_" + day);
  const prior = await F.getDoc(ref).catch(() => null);
  if (prior && prior.exists()) return shell("Already checked in today", `<p class="checked"><span aria-hidden="true">✓</span> ${esc(me.name)}, you checked in at ${fmtTime(prior.data().at)}.</p><p><a href="student.html#d-att">See your attendance</a></p>`, "ok");
  shell("Confirming you're at the pool…", `<p>Please allow location access when your phone asks. It's used only for this check-in.</p><div class="spinner" aria-hidden="true"></div>`);
  let pos;
  try {
    pos = await new Promise((ok, bad) => {
      if (!navigator.geolocation) return bad({ code: 0 });
      navigator.geolocation.getCurrentPosition(ok, bad, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
  } catch (e) {
    return shell("Location needed", `<p>${e.code === 1 ? "Location permission was denied. Allow location for this site in your browser settings, then scan the QR code again." : "We couldn't get your location. Make sure location is on, then scan the QR code again."}</p>`, "bad");
  }
  const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  const dist = distanceM(here, POOL), acc = pos.coords.accuracy || 0;
  if (dist - Math.min(acc, 150) > MAX_DISTANCE_M) {
    return shell("You're not at the pool", `<p>You seem to be about ${dist >= 1000 ? (dist / 1000).toFixed(1) + " km" : Math.round(dist) + " m"} away. Check-in works only at Dreamer Swimming Foundation.</p>`, "bad");
  }
  try {
    await F.setDoc(ref, {
      uid: user.uid, name: me.name, studentId: me.studentId || "", program: me.program || "", batch: me.batch || "",
      day, code, at: F.serverTimestamp(), lat: Math.round(here.lat * 1000) / 1000, lng: Math.round(here.lng * 1000) / 1000, method: "qr",
    });
    history.replaceState(null, "", "attend.html");
    shell("You're checked in", `<p class="checked big"><span aria-hidden="true">✓</span> ${esc(me.name)}</p><p>${fmtDate(day)}, ${fmtTime(new Date())}. Have a great swim!</p><p><a href="student.html#d-att">See your attendance</a></p>`, "ok");
  } catch (e) {
    const denied = (e.code || "").includes("permission-denied");
    shell("Check-in failed", `<p>${denied ? "This QR code has expired. Scan the code on the trainer's screen again. It changes every 30 seconds." : esc(errText(e))}</p>`, "bad");
  }
}

// =====================================================================
//  CERTIFICATE VERIFICATION (public)
// =====================================================================
function verifyPage() {
  const q = new URLSearchParams(location.search).get("c") || "";
  root.innerHTML = `<form class="form-card" id="vForm" novalidate><div class="form-grid"><div class="field full"><label for="v_no">Certificate number</label><input id="v_no" placeholder="DSF-C-2026-0001" value="${esc(q)}" autocomplete="off"></div></div>
    <div class="cta-row"><button class="btn btn-solid" type="submit">Verify</button></div></form><div id="vOut" aria-live="polite"></div>`;
  const run = async () => {
    const no = $("#v_no").value.trim().toUpperCase(), out = $("#vOut");
    if (!/^DSF-C-\d{4}-\d{4,}$/.test(no)) { out.innerHTML = `<p class="callout bad">Enter a certificate number like DSF-C-2026-0001.</p>`; return; }
    out.innerHTML = `<p class="form-note">Checking…</p>`;
    try {
      const s = await F.getDoc(F.doc(db, "cert_public", no));
      if (!s.exists()) out.innerHTML = `<div class="verify-result bad"><h3>Not found</h3><p>No certificate with number ${esc(no)} was issued by Dreamer Swimming Foundation.</p></div>`;
      else {
        const c = s.data(), ok = c.status === "valid";
        out.innerHTML = `<div class="verify-result ${ok ? "ok" : "bad"}"><h3>${ok ? "✓ Genuine certificate" : "This certificate has been revoked"}</h3>
          <dl class="info-grid"><dt>Name</dt><dd>${esc(c.name)}</dd><dt>Certificate</dt><dd>${esc(c.heading)}: ${esc(c.title)}</dd><dt>Issued on</dt><dd>${fmtDate(c.issuedOn)}</dd><dt>Number</dt><dd>${esc(no)}</dd></dl></div>`;
      }
    } catch (e) { out.innerHTML = `<p class="callout bad">${esc(errText(e))}</p>`; }
  };
  $("#vForm").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  if (q) run();
}

// =====================================================================
//  STAFF PORTAL
// =====================================================================
const A = { staff: null, role: "", tab: "", students: null, payments: null, staffList: null, certs: null, roster: null };
const TABS_ADMIN = [["overview", "Overview"], ["applications", "Applications"], ["payments", "Payments"], ["students", "Students"],
  ["attendance", "Attendance"], ["certificates", "Certificates"], ["trainers", "Trainers"], ["notices", "Notices"], ["settings", "Settings"]];
const TABS_TRAINER = [["attendance", "Attendance"], ["notices", "Notices"]];

async function staffPortal() {
  root.innerHTML = `<p class="form-note">Checking staff access…</p>`;
  A.staff = await getStaff();
  if (!A.staff) {
    root.innerHTML = `<p class="form-note">This account isn't on the staff list. Opening the Student portal…</p>`;
    location.replace("student.html?from=staff"); return;
  }
  A.role = A.staff.role;
  const tabs = A.role === "admin" ? TABS_ADMIN : TABS_TRAINER;
  const want = location.hash.slice(1);
  A.tab = tabs.some((t) => t[0] === want) ? want : tabs[0][0];
  root.innerHTML = accountBar(`<span class="badge ${A.role === "admin" ? "ok" : "info"}">${A.role === "admin" ? "Administrator" : "Trainer"}</span>`) +
    `<nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === A.tab}">${l}</button>`).join("")}</nav><div id="panel" class="panel"></div>`;
  wireSignOut();
  $$("[data-tab]").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
  showTab(A.tab);
}
async function showTab(t) {
  A.tab = t; history.replaceState(null, "", "#" + t);
  $$("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
  const p = $("#panel"); p.innerHTML = `<p class="form-note">Loading…</p>`;
  try { await ({ overview: tOverview, applications: tApplications, payments: tPayments, students: tStudents, attendance: tAttendance, certificates: tCertificates, trainers: tTrainers, notices: tNotices, settings: tSettings })[t](p); }
  catch (e) { console.error(e); p.innerHTML = `<p class="callout bad">${esc(errText(e))}</p>`; }
}
const all = async (col) => (await F.getDocs(F.collection(db, col))).docs.map((d) => Object.assign({ id: d.id }, d.data()));
async function students(force) { if (force || !A.students) A.students = await all("students"); return A.students; }
async function payments(force) { if (force || !A.payments) A.payments = await all("payments"); return A.payments; }
const byNewest = (k) => (a, b) => (toDate(b[k]) || 0) - (toDate(a[k]) || 0);

async function tOverview(p) {
  const [st, pay, att] = await Promise.all([students(true), payments(true), F.getDocs(F.query(F.collection(db, "attendance"), F.where("day", "==", istDay())))]);
  const apps = st.filter((s) => ["applied", "fee_submitted"].includes(s.status)).length;
  const pend = pay.filter((x) => x.status === "pending").length;
  const act = st.filter((s) => s.status === "active").length;
  const del = st.filter((s) => s.deleteRequested);
  p.innerHTML = `<div class="stat-grid">
      <button type="button" class="stat" data-go="applications"><b>${apps}</b><span>Applications waiting</span></button>
      <button type="button" class="stat" data-go="payments"><b>${pend}</b><span>Payments to verify</span></button>
      <button type="button" class="stat" data-go="students"><b>${act}</b><span>Active students</span></button>
      <button type="button" class="stat" data-go="attendance"><b>${att.size}</b><span>Checked in today</span></button>
    </div>
    ${del.length ? `<section class="form-card wide"><h3>Data deletion requests</h3><p class="form-note">Complete these within 30 days (Students → open the student → Delete all data).</p>${del.map((s) => `<div class="mini-row"><span><b>${esc(s.name)}</b><small>${esc(s.studentId || "Applicant")} · requested ${fmtDate(s.deleteRequestedAt)}</small></span><button type="button" class="btn btn-outline btn-sm" data-open="${s.id}">Open</button></div>`).join("")}</section>` : ""}
    <div class="cta-row"><button type="button" class="btn btn-coral" id="ovKiosk">Open check-in QR</button></div>`;
  $$("[data-go]", p).forEach((b) => (b.onclick = () => showTab(b.dataset.go)));
  $$("[data-open]", p).forEach((b) => (b.onclick = () => openStudent(b.dataset.open)));
  $("#ovKiosk").onclick = openKiosk;
}

// ---------- applications
async function tApplications(p) {
  const [st, pay] = await Promise.all([students(true), payments(true)]);
  const list = st.filter((s) => ["applied", "fee_submitted"].includes(s.status)).sort(byNewest("createdAt"));
  if (!list.length) { p.innerHTML = `<p class="empty">No applications waiting.</p>`; return; }
  p.innerHTML = list.map((s) => {
    const adm = pay.filter((x) => x.uid === s.id && x.purpose === "Admission fee");
    return `<article class="app-card" data-id="${s.id}">
      <div class="app-head">${safePhoto(s.photo) ? `<img src="${safePhoto(s.photo)}" alt="" class="avatar-lg">` : ""}<div><h3>${esc(s.name)}</h3><p>${esc(s.program)} · ${esc(s.batch || "No batch preference")}</p><p class="form-note">Applied ${fmtDate(s.createdAt)} · ${badge(s.status)}</p></div></div>
      <dl class="info-grid"><dt>Age</dt><dd>${ageOn(s.dob)} (born ${fmtDate(s.dob)})</dd><dt>Gender</dt><dd>${esc(s.gender || "—")}</dd><dt>Phone</dt><dd><a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></dd><dt>Emergency</dt><dd>${esc(s.emergency)}</dd>
        <dt>Guardian</dt><dd>${esc(s.guardian || "—")}${s.guardianConsent ? " (consent given)" : ""}</dd><dt>Blood group</dt><dd>${esc(s.blood || "—")}</dd><dt>Address</dt><dd>${esc(s.address || "—")}</dd><dt>Email</dt><dd>${esc(s.email || "—")}</dd>
        <dt>Admission fee</dt><dd>${adm.length ? adm.map((x) => `${money(x.amount)} · ${x.method === "upi" ? "UPI " + esc(x.utr) : "Cash"} ${badge(x.status)}`).join("<br>") : "Not submitted yet"}</dd></dl>
      <form class="approve-form" novalidate>
        <div class="form-grid">
          <div class="field"><label>Program</label><select name="program">${opts(PROGRAMS, s.program)}</select></div>
          <div class="field"><label>Batch *</label><select name="batch">${opts(BATCHES, s.batch, "Choose batch")}</select></div>
          <div class="field"><label>Valid till</label><input type="date" name="validTill" value="${plusYear(istDay())}"></div>
          ${adm.some((x) => x.status === "pending") ? `<div class="field check"><label><input type="checkbox" name="verifyFee" checked> Mark admission fee as received</label></div>` : ""}
        </div>
        <div class="cta-row"><button class="btn btn-coral" type="submit">Approve admission</button><button class="btn btn-outline" type="button" data-reject>Reject…</button></div>
        <div class="reject-box" hidden><div class="field"><label>Reason (shown to the applicant)</label><input name="reason" maxlength="200" placeholder="e.g. Batch full, please choose another"></div><button class="btn btn-outline btn-sm danger" type="button" data-reject-go>Confirm rejection</button></div>
      </form></article>`;
  }).join("");
  $$(".app-card", p).forEach((card) => {
    const s = list.find((x) => x.id === card.dataset.id), f = $("form", card);
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault(); formError(f, "");
      if (!f.batch.value) return formError(f, "Choose the batch for this student.");
      try {
        await busy(f.querySelector("[type=submit]"), "Approving…", () => approve(s, { program: f.program.value, batch: f.batch.value, validTill: f.validTill.value || plusYear(istDay()) }, f.verifyFee && f.verifyFee.checked));
        toast(s.name + " approved."); tApplications(p);
      } catch (e) { formError(f, errText(e)); }
    });
    $("[data-reject]", card).onclick = () => { $(".reject-box", card).hidden = false; f.reason.focus(); };
    $("[data-reject-go]", card).onclick = async (ev) => {
      try { await busy(ev.currentTarget, "Saving…", () => F.updateDoc(F.doc(db, "students", s.id), { status: "rejected", rejectReason: f.reason.value.trim(), reviewedBy: user.email, updatedAt: F.serverTimestamp() })); toast("Application rejected."); tApplications(p); }
      catch (e) { formError(f, errText(e)); }
    };
  });
}

async function approve(s, { program, batch, validTill }, verifyFee) {
  const year = istDay().slice(0, 4);
  const sid = await F.runTransaction(db, async (tx) => {
    const cRef = F.doc(db, "meta", "counters"), c = await tx.get(cRef);
    let id = s.studentId;
    if (!id) { const n = ((c.exists() && c.data()["s" + year]) || 0) + 1; tx.set(cRef, { ["s" + year]: n }, { merge: true }); id = `DSF-${year}-${pad(n)}`; }
    tx.update(F.doc(db, "students", s.id), { status: "active", studentId: id, program, batch, validTill, approvedAt: F.serverTimestamp(), approvedBy: user.email, updatedAt: F.serverTimestamp() });
    tx.set(F.doc(db, "roster", s.id), { name: s.name, studentId: id, program, batch, status: "active" });
    return id;
  });
  if (verifyFee) {
    const pend = (await payments(true)).filter((x) => x.uid === s.id && x.purpose === "Admission fee" && x.status === "pending");
    await Promise.all(pend.map((x) => F.updateDoc(F.doc(db, "payments", x.id), { status: "verified", verifiedBy: user.email, verifiedAt: F.serverTimestamp() })));
  }
  A.students = null;
  return sid;
}

// ---------- payments
async function tPayments(p) {
  const pay = (await payments(true)).sort(byNewest("createdAt"));
  const pend = pay.filter((x) => x.status === "pending"), done = pay.filter((x) => x.status !== "pending").slice(0, 100);
  const row = (x, actions) => `<div class="mini-row pay-row-a" data-id="${x.id}"><span><b>${esc(x.name)}</b> <small>${esc(x.studentId || "Applicant")}</small><small>${esc(x.purpose)} · ${fmtDate(x.createdAt)} · ${x.method === "upi" ? "UPI " + esc(x.utr || "") : "Cash"}</small></span>
    <span class="row-actions"><b>${money(x.amount)}</b> ${actions ? `<button type="button" class="btn btn-solid btn-sm" data-ok>Verify</button><button type="button" class="btn btn-outline btn-sm" data-no>Reject</button>` : badge(x.status)}</span></div>`;
  p.innerHTML = `<section class="form-card wide"><h3>Awaiting check (${pend.length})</h3><p class="form-note">Match each UPI transaction ID against your bank or UPI app before verifying.</p>${pend.map((x) => row(x, true)).join("") || `<p class="empty">Nothing to verify.</p>`}</section>
    <section class="form-card wide"><div class="sec-head"><h3>History</h3><button type="button" class="btn btn-outline btn-sm" id="payCsv">Export CSV</button></div>${done.map((x) => row(x, false)).join("") || `<p class="empty">No payments yet.</p>`}</section>`;
  $$("[data-ok],[data-no]", p).forEach((b) => (b.onclick = async () => {
    const id = b.closest("[data-id]").dataset.id, ok = b.hasAttribute("data-ok");
    try { await busy(b, "…", () => F.updateDoc(F.doc(db, "payments", id), { status: ok ? "verified" : "rejected", verifiedBy: user.email, verifiedAt: F.serverTimestamp() })); toast(ok ? "Payment verified." : "Payment rejected."); tPayments(p); }
    catch (e) { toast(errText(e), "error"); }
  }));
  $("#payCsv").onclick = () => csv("payments.csv", [["Date", "Student ID", "Name", "Purpose", "Amount", "Method", "UTR", "Status"]].concat(pay.map((x) => [fmtDate(x.createdAt), x.studentId, x.name, x.purpose, x.amount, x.method, x.utr || "", x.status])));
}
function csv(name, rows) {
  const q = (v) => { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  download(name, new Blob(["﻿" + rows.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
}

// ---------- students
async function tStudents(p) {
  const st = await students(true);
  p.innerHTML = `<div class="toolbar"><input type="search" id="sQ" placeholder="Search name, ID or phone" aria-label="Search students"><select id="sF" aria-label="Filter by status"><option value="active">Active</option><option value="inactive">Inactive</option><option value="rejected">Not approved</option><option value="">All</option></select></div><div id="sList" class="student-list"></div>`;
  const draw = () => {
    const q = $("#sQ").value.trim().toLowerCase(), f = $("#sF").value;
    const list = st.filter((s) => (!f || s.status === f) && (!q || [s.name, s.studentId, s.phone].some((v) => String(v || "").toLowerCase().includes(q))))
      .sort((a, b) => String(a.name).localeCompare(b.name));
    $("#sList").innerHTML = list.length ? list.map((s) => `<button type="button" class="student-row" data-open="${s.id}">${safePhoto(s.photo) ? `<img src="${safePhoto(s.photo)}" alt="" class="avatar">` : `<span class="avatar"></span>`}
      <span><b>${esc(s.name)}</b><small>${esc(s.studentId || "—")} · ${esc(s.program)} · ${esc(s.batch || "—")}</small></span><span>${badge(s.status)}${s.deleteRequested ? ` <span class="badge bad">Deletion requested</span>` : ""}</span></button>`).join("")
      : `<p class="empty">No students match.</p>`;
    $$("[data-open]", p).forEach((b) => (b.onclick = () => openStudent(b.dataset.open)));
  };
  $("#sQ").oninput = draw; $("#sF").onchange = draw; draw();
}

async function openStudent(id) {
  const st = await students(); const s = st.find((x) => x.id === id); if (!s) return;
  const [att, pay, certs] = await Promise.all([
    F.getDocs(F.query(F.collection(db, "attendance"), F.where("uid", "==", id))).then((r) => r.docs.map((d) => d.data())).catch(() => []),
    payments().then((x) => x.filter((y) => y.uid === id)),
    F.getDocs(F.query(F.collection(db, "certificates"), F.where("uid", "==", id))).then((r) => r.docs.map((d) => Object.assign({ id: d.id }, d.data()))).catch(() => []),
  ]);
  const dlg = modal(`<div class="app-head">${safePhoto(s.photo) ? `<img src="${safePhoto(s.photo)}" alt="" class="avatar-lg">` : ""}<div><h3>${esc(s.name)}</h3><p>${esc(s.studentId || "No ID yet")} ${badge(s.status)}</p></div></div>
    ${s.deleteRequested ? `<p class="callout warn">Asked for data deletion on ${fmtDate(s.deleteRequestedAt)}.</p>` : ""}
    <dl class="info-grid"><dt>Born</dt><dd>${fmtDate(s.dob)} (age ${ageOn(s.dob)})</dd><dt>Phone</dt><dd><a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></dd><dt>Emergency</dt><dd>${esc(s.emergency)}</dd><dt>Guardian</dt><dd>${esc(s.guardian || "—")}</dd>
      <dt>Blood</dt><dd>${esc(s.blood || "—")}</dd><dt>Address</dt><dd>${esc(s.address || "—")}</dd><dt>Email</dt><dd>${esc(s.email || "—")}</dd><dt>Attendance</dt><dd>${att.length} days total</dd>
      <dt>Payments</dt><dd>${pay.length ? pay.map((x) => `${esc(x.purpose)}: ${money(x.amount)} ${badge(x.status)}`).join("<br>") : "None"}</dd><dt>Certificates</dt><dd>${certs.length ? certs.map((c) => `${esc(c.title)} (${esc(c.id)})`).join("<br>") : "None"}</dd></dl>
    ${s.studentId ? `<form id="editStu" class="form-grid" novalidate>
      <div class="field"><label>Program</label><select name="program">${opts(PROGRAMS, s.program)}</select></div>
      <div class="field"><label>Batch</label><select name="batch">${opts(BATCHES, s.batch)}</select></div>
      <div class="field"><label>Valid till</label><input type="date" name="validTill" value="${esc(s.validTill || "")}"></div>
      <div class="field"><label>Status</label><select name="status"><option value="active"${s.status === "active" ? " selected" : ""}>Active</option><option value="inactive"${s.status === "inactive" ? " selected" : ""}>Inactive</option></select></div>
      <div class="cta-row full"><button class="btn btn-solid btn-sm" type="submit">Save changes</button><button class="btn btn-outline btn-sm" type="button" id="stuCard">Download ID card</button><button class="btn btn-outline btn-sm" type="button" id="stuCert">Issue certificate</button></div></form>` : ""}
    <details class="danger-zone"><summary>Delete all data</summary><p class="form-note">Permanently deletes this student's record, photo, attendance, payments and certificates. Type <b>${esc(s.studentId || s.name)}</b> to confirm.</p><input id="delConfirm" aria-label="Type to confirm"><button type="button" class="btn btn-outline btn-sm danger" id="delGo">Delete permanently</button></details>`);
  const f = $("#editStu", dlg);
  if (f) {
    f.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const d = { program: f.program.value, batch: f.batch.value, validTill: f.validTill.value, status: f.status.value };
      try {
        await busy(f.querySelector("[type=submit]"), "Saving…", async () => {
          const b = F.writeBatch(db);
          b.update(F.doc(db, "students", id), Object.assign({ updatedAt: F.serverTimestamp() }, d));
          b.set(F.doc(db, "roster", id), { name: s.name, studentId: s.studentId, program: d.program, batch: d.batch, status: d.status });
          await b.commit();
        });
        Object.assign(s, d); toast("Saved."); dlg.close(); if (A.tab === "students") showTab("students");
      } catch (e) { formError(f, errText(e)); }
    });
    $("#stuCard", dlg).onclick = async () => {
      const cv = document.createElement("canvas"); cv.width = 1012; cv.height = 638;
      drawIdCard(cv, s, await loadImage("assets/dsf-logo.png").catch(() => null), safePhoto(s.photo) ? await loadImage(s.photo).catch(() => null) : null);
      cv.toBlob((b) => download(s.studentId + ".png", b), "image/png");
    };
    $("#stuCert", dlg).onclick = () => { A.certFor = id; dlg.close(); showTab("certificates"); };
  }
  $("#delGo", dlg).onclick = async (ev) => {
    if ($("#delConfirm", dlg).value.trim() !== (s.studentId || s.name)) return toast("Type the exact text to confirm.", "error");
    try {
      await busy(ev.currentTarget, "Deleting…", () => deleteStudent(s, certs));
      toast("All data deleted."); dlg.close(); A.students = null; showTab(A.tab);
    } catch (e) { toast(errText(e), "error"); }
  };
}
async function deleteStudent(s, certs) {
  const [att, pay] = await Promise.all([
    F.getDocs(F.query(F.collection(db, "attendance"), F.where("uid", "==", s.id))),
    F.getDocs(F.query(F.collection(db, "payments"), F.where("uid", "==", s.id))),
  ]);
  const refs = att.docs.map((d) => d.ref).concat(pay.docs.map((d) => d.ref), certs.map((c) => F.doc(db, "certificates", c.id)), certs.map((c) => F.doc(db, "cert_public", c.id)),
    [F.doc(db, "roster", s.id), F.doc(db, "students", s.id)]);
  for (let i = 0; i < refs.length; i += 400) { const b = F.writeBatch(db); refs.slice(i, i + 400).forEach((r) => b.delete(r)); await b.commit(); }
}
function modal(html) {
  const d = document.createElement("dialog"); d.className = "dlg";
  d.innerHTML = `<button type="button" class="dlg-x" aria-label="Close">×</button><div class="dlg-body">${html}</div>`;
  document.body.appendChild(d); d.showModal();
  $(".dlg-x", d).onclick = () => d.close();
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  d.addEventListener("close", () => d.remove());
  return d;
}

// ---------- attendance + kiosk
async function rosterList() {
  if (A.role === "admin") return (await students()).filter((s) => s.status === "active").map((s) => ({ id: s.id, name: s.name, studentId: s.studentId, program: s.program, batch: s.batch }));
  if (!A.roster) A.roster = (await all("roster")).filter((s) => s.status === "active");
  return A.roster;
}
async function tAttendance(p) {
  const day = A.attDay || istDay();
  p.innerHTML = `<div class="kiosk-cta form-card wide"><div><h3>Check-in QR</h3><p class="form-note">Show this on a phone or tablet at the pool. Students scan it with their phone camera. The code changes every 30 seconds and works only at the pool.</p></div><button type="button" class="btn btn-coral" id="kioskGo">Open check-in QR</button></div>
    <section class="form-card wide"><div class="sec-head"><h3>Attendance</h3><div class="toolbar"><input type="date" id="attDay" value="${day}" max="${istDay()}" aria-label="Date"><button type="button" class="btn btn-outline btn-sm" id="attCsv">Export month (CSV)</button></div></div>
      <div id="attOut"><p class="form-note">Loading…</p></div>
      <form id="manual" class="manual" novalidate><label for="mSel">Mark present manually</label><div class="toolbar"><select id="mSel"><option value="">Choose student</option></select><button class="btn btn-solid btn-sm" type="submit">Mark present</button></div></form></section>`;
  $("#kioskGo").onclick = openKiosk;
  const load = async () => {
    const d = $("#attDay").value || istDay(); A.attDay = d;
    const snap = await F.getDocs(F.query(F.collection(db, "attendance"), F.where("day", "==", d)));
    const rows = snap.docs.map((x) => x.data()).sort((a, b) => (toDate(a.at) || 0) - (toDate(b.at) || 0));
    $("#attOut").innerHTML = `<p class="att-stat"><b>${rows.length}</b> present on ${fmtDate(d)}</p>` + (rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Time</th><th>Student</th><th>ID</th><th>Batch</th><th>How</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${fmtTime(r.at)}</td><td>${esc(r.name)}</td><td>${esc(r.studentId)}</td><td>${esc(r.batch || "—")}</td><td>${badge(r.method)}</td></tr>`).join("")}</tbody></table></div>` : "");
    const present = new Set(rows.map((r) => r.uid));
    const ro = await rosterList().catch(() => []);
    $("#mSel").innerHTML = `<option value="">Choose student</option>` + ro.filter((r) => !present.has(r.id)).sort((a, b) => a.name.localeCompare(b.name)).map((r) => `<option value="${r.id}">${esc(r.name)} (${esc(r.studentId)})</option>`).join("");
  };
  $("#attDay").onchange = load;
  $("#manual").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const id = $("#mSel").value, d = $("#attDay").value || istDay(); if (!id) return;
    const r = (await rosterList()).find((x) => x.id === id);
    try {
      await busy(ev.target.querySelector("[type=submit]"), "Saving…", () => F.setDoc(F.doc(db, "attendance", id + "_" + d), { uid: id, name: r.name, studentId: r.studentId || "", program: r.program || "", batch: r.batch || "", day: d, at: F.serverTimestamp(), method: "manual", markedBy: user.email }));
      toast(r.name + " marked present."); load();
    } catch (e) { toast(errText(e), "error"); }
  });
  $("#attCsv").onclick = async () => {
    const m = ($("#attDay").value || istDay()).slice(0, 7);
    const snap = await F.getDocs(F.query(F.collection(db, "attendance"), F.where("day", ">=", m + "-01"), F.where("day", "<=", m + "-31")));
    const rows = snap.docs.map((x) => x.data()).sort((a, b) => a.day.localeCompare(b.day) || String(a.name).localeCompare(b.name));
    csv(`attendance-${m}.csv`, [["Date", "Time", "Student ID", "Name", "Program", "Batch", "Method"]].concat(rows.map((r) => [r.day, fmtTime(r.at), r.studentId, r.name, r.program, r.batch, r.method])));
  };
  load();
}

async function openKiosk() {
  const ov = document.createElement("div"); ov.className = "kiosk"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-label", "Check-in QR code");
  ov.innerHTML = `<div class="kiosk-inner"><p class="eyebrow">Dreamer Swimming Foundation</p><h2>Scan to check in</h2><div class="kiosk-qr" id="kQr"></div>
    <p class="kiosk-sub">Open your phone camera and point it at the code. Allow location when asked.</p>
    <p class="kiosk-meta"><span id="kLeft">New code in 30s</span> · <b id="kCount">0</b> checked in today</p>
    <p class="form-error" id="kErr" hidden></p><button type="button" class="btn btn-outline" id="kExit">Close</button></div>`;
  document.body.appendChild(ov); document.body.style.overflow = "hidden";
  let lock = null; try { lock = await navigator.wakeLock.request("screen"); } catch (e) { /* optional */ }
  let left = 30, alive = true;
  const rotate = async () => {
    const a = new Uint8Array(9); crypto.getRandomValues(a);
    const code = Array.from(a, (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
    try {
      await F.setDoc(F.doc(db, "kiosk", "current"), { code, day: istDay(), at: F.serverTimestamp(), by: user.email });
      $("#kQr", ov).innerHTML = qrSvg(new URL("attend.html?c=" + code, location.href).href); $("#kErr", ov).hidden = true;
    } catch (e) { const er = $("#kErr", ov); er.textContent = errText(e); er.hidden = false; }
    left = 30;
  };
  const count = async () => { try { const s = await F.getDocs(F.query(F.collection(db, "attendance"), F.where("day", "==", istDay()))); $("#kCount", ov).textContent = s.size; } catch (e) { /* ignore */ } };
  await rotate(); count();
  const tick = setInterval(() => { if (!alive) return; left--; $("#kLeft", ov).textContent = `New code in ${left}s`; if (left <= 0) { rotate(); count(); } }, 1000);
  const close = () => { alive = false; clearInterval(tick); if (lock) lock.release().catch(() => {}); document.body.style.overflow = ""; ov.remove(); document.removeEventListener("keydown", esc_); if (A.tab === "attendance") showTab("attendance"); };
  const esc_ = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", esc_);
  $("#kExit", ov).onclick = close;
}

// ---------- certificates
async function tCertificates(p) {
  const [st, certs] = await Promise.all([students(), all("certificates")]);
  A.certs = certs.sort((a, b) => b.id.localeCompare(a.id));
  const active = st.filter((s) => s.studentId).sort((a, b) => a.name.localeCompare(b.name));
  p.innerHTML = `<form class="form-card wide" id="certForm" novalidate><h3>Issue a certificate</h3><div class="form-grid">
      <div class="field"><label for="c_stu">Student *</label><select id="c_stu"><option value="">Choose student</option>${active.map((s) => `<option value="${s.id}"${A.certFor === s.id ? " selected" : ""}>${esc(s.name)} (${esc(s.studentId)})</option>`).join("")}</select></div>
      <div class="field"><label for="c_kind">Type *</label><select id="c_kind">${Object.entries(CERT_KINDS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join("")}</select></div>
      <div class="field" id="c_levelWrap"><label for="c_level">Level completed</label><select id="c_level">${opts(LEVELS)}</select></div>
      <div class="field full" id="c_detWrap" hidden><label for="c_det">Details * <span class="hint">(printed on the certificate)</span></label><input id="c_det" maxlength="90" placeholder="e.g. 1st place, 50 m freestyle, District Swimming Meet 2026"></div>
      <div class="field"><label for="c_date">Date of issue</label><input id="c_date" type="date" value="${istDay()}" max="${istDay()}"></div>
    </div><div class="cta-row"><button class="btn btn-coral" type="submit">Issue certificate</button></div></form>
    <section class="form-card wide"><h3>Issued certificates (${A.certs.length})</h3><div id="certList"></div></section>`;
  A.certFor = null;
  const sync = () => { const k = $("#c_kind").value; $("#c_levelWrap").hidden = k !== "level"; $("#c_detWrap").hidden = !["achievement", "participation"].includes(k); };
  $("#c_kind").onchange = sync; sync();
  const drawList = () => {
    $("#certList").innerHTML = A.certs.length ? A.certs.map((c, i) => `<div class="mini-row"><span><b>${esc(c.name)}</b> <small>${esc(c.studentId)}</small><small>${esc(c.heading)}: ${esc(c.title)} · ${fmtDate(c.issuedOn)} · ${esc(c.id)}</small></span>
      <span class="row-actions">${badge(c.status)}<button type="button" class="btn btn-outline btn-sm" data-dl="${i}">Download</button><button type="button" class="btn btn-outline btn-sm" data-rv="${i}">${c.status === "valid" ? "Revoke" : "Restore"}</button></span></div>`).join("") : `<p class="empty">No certificates yet.</p>`;
    $$("[data-dl]", p).forEach((b) => (b.onclick = () => downloadCertificate(A.certs[+b.dataset.dl])));
    $$("[data-rv]", p).forEach((b) => (b.onclick = async () => {
      const c = A.certs[+b.dataset.rv], status = c.status === "valid" ? "revoked" : "valid";
      try {
        await busy(b, "…", async () => { const bt = F.writeBatch(db); bt.update(F.doc(db, "certificates", c.id), { status }); bt.update(F.doc(db, "cert_public", c.id), { status }); await bt.commit(); });
        c.status = status; drawList(); toast(status === "valid" ? "Certificate restored." : "Certificate revoked.");
      } catch (e) { toast(errText(e), "error"); }
    }));
  };
  drawList();
  $("#certForm").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = ev.target; formError(f, "");
    const s = active.find((x) => x.id === $("#c_stu").value), kind = $("#c_kind").value, K = CERT_KINDS[kind], det = $("#c_det").value.trim();
    if (!s) return formError(f, "Choose the student.");
    if (!K.title && kind !== "level" && det.length < 3) return formError(f, "Enter the details to print on the certificate.");
    const title = kind === "level" ? $("#c_level").value : K.title || det, issuedOn = $("#c_date").value || istDay();
    try {
      const no = await busy(f.querySelector("[type=submit]"), "Issuing…", () => F.runTransaction(db, async (tx) => {
        const cRef = F.doc(db, "meta", "counters"), c = await tx.get(cRef), y = issuedOn.slice(0, 4);
        const n = ((c.exists() && c.data()["c" + y]) || 0) + 1, id = `DSF-C-${y}-${pad(n)}`;
        tx.set(cRef, { ["c" + y]: n }, { merge: true });
        tx.set(F.doc(db, "certificates", id), { uid: s.id, name: s.name, studentId: s.studentId, kind, heading: K.heading, title, issuedOn, status: "valid", issuedBy: user.email, createdAt: F.serverTimestamp() });
        tx.set(F.doc(db, "cert_public", id), { name: s.name, heading: K.heading, title, issuedOn, status: "valid" });
        return id;
      }));
      toast(`Certificate ${no} issued.`); tCertificates(p);
    } catch (e) { formError(f, errText(e)); }
  });
}

// ---------- trainers / staff
async function tTrainers(p) {
  const list = (await all("staff")).sort((a, b) => String(a.name).localeCompare(b.name));
  p.innerHTML = `<form class="form-card wide" id="staffForm" novalidate><h3>Add a trainer or administrator</h3><p class="form-note">They sign in with this Google account. Trainers can open the check-in QR, see attendance and post notices. Administrators can do everything.</p><div class="form-grid">
      <div class="field"><label for="t_email">Gmail address *</label><input id="t_email" type="email" autocomplete="off" placeholder="name@gmail.com"></div>
      <div class="field"><label for="t_name">Name *</label><input id="t_name" maxlength="60"></div>
      <div class="field"><label for="t_phone">Phone</label><input id="t_phone" type="tel" inputmode="numeric" maxlength="14"></div>
      <div class="field"><label for="t_spec">Speciality</label><input id="t_spec" maxlength="60" placeholder="e.g. Beginners, Competitive, Lifeguard"></div>
      <div class="field"><label for="t_role">Role</label><select id="t_role"><option value="trainer">Trainer</option><option value="admin">Administrator</option></select></div>
    </div><div class="cta-row"><button class="btn btn-coral" type="submit">Add staff member</button></div></form>
    <section class="form-card wide"><h3>Staff (${list.length})</h3>${list.map((t) => `<div class="mini-row" data-id="${esc(t.id)}"><span><b>${esc(t.name)}</b> ${badge(t.active ? "active" : "inactive")} <small>${esc(t.id)}${t.phone ? " · " + esc(t.phone) : ""}${t.speciality ? " · " + esc(t.speciality) : ""}</small></span>
      <span class="row-actions"><select data-role aria-label="Role"${t.id === user.email.toLowerCase() ? " disabled" : ""}><option value="trainer"${t.role === "trainer" ? " selected" : ""}>Trainer</option><option value="admin"${t.role === "admin" ? " selected" : ""}>Administrator</option></select>
      ${t.id === user.email.toLowerCase() ? `<small>You</small>` : `<button type="button" class="btn btn-outline btn-sm" data-act>${t.active ? "Deactivate" : "Activate"}</button><button type="button" class="btn btn-outline btn-sm danger" data-del>Remove</button>`}</span></div>`).join("")}</section>`;
  $("#staffForm").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = ev.target; formError(f, "");
    const email = $("#t_email").value.trim().toLowerCase(), name = $("#t_name").value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return formError(f, "Enter a valid Google email address.");
    if (name.length < 2) return formError(f, "Enter the staff member's name.");
    try {
      await busy(f.querySelector("[type=submit]"), "Adding…", () => F.setDoc(F.doc(db, "staff", email), { name, phone: normPhone($("#t_phone").value), speciality: $("#t_spec").value.trim(), role: $("#t_role").value, active: true, createdAt: F.serverTimestamp() }));
      toast(name + " added."); tTrainers(p);
    } catch (e) { formError(f, errText(e)); }
  });
  $$("[data-id]", p).forEach((row) => {
    const id = row.dataset.id, t = list.find((x) => x.id === id);
    const upd = async (data, msg) => { try { await F.updateDoc(F.doc(db, "staff", id), data); toast(msg); tTrainers(p); } catch (e) { toast(errText(e), "error"); } };
    const r = $("[data-role]", row); if (r) r.onchange = () => upd({ role: r.value }, "Role updated.");
    const a = $("[data-act]", row); if (a) a.onclick = () => upd({ active: !t.active }, t.active ? "Deactivated." : "Activated.");
    const d = $("[data-del]", row); if (d) d.onclick = async () => {
      if (d.dataset.confirm !== "1") { d.dataset.confirm = "1"; d.textContent = "Tap to confirm"; return; }
      try { await F.deleteDoc(F.doc(db, "staff", id)); toast("Removed."); tTrainers(p); } catch (e) { toast(errText(e), "error"); }
    };
  });
}

// ---------- notices
async function tNotices(p) {
  const s = await F.getDocs(F.query(F.collection(db, "notices"), F.orderBy("createdAt", "desc"), F.limit(50)));
  const list = s.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  p.innerHTML = `<form class="form-card wide" id="noticeForm" novalidate><h3>Post a notice</h3><div class="form-grid">
      <div class="field full"><label for="n_title">Title *</label><input id="n_title" maxlength="120"></div>
      <div class="field full"><label for="n_text">Message *</label><textarea id="n_text" rows="4" maxlength="2000"></textarea></div>
      <div class="field full check"><label><input type="checkbox" id="n_imp"> Mark as important</label></div></div>
      <div class="cta-row"><button class="btn btn-coral" type="submit">Post notice</button><a class="btn btn-outline" href="notices.html" target="_blank">View Notice Board</a></div></form>
    <section class="form-card wide"><h3>Posted notices</h3>${list.map((n) => `<div class="mini-row${n.important ? " notice-mini imp" : ""}" data-id="${n.id}"><span><b>${esc(n.title)}</b><small>${fmtDate(n.createdAt)}${n.by ? " · " + esc(n.by) : ""}</small><small class="clip">${esc(n.text)}</small></span><button type="button" class="btn btn-outline btn-sm danger" data-del>Delete</button></div>`).join("") || `<p class="empty">No notices yet.</p>`}</section>`;
  $("#noticeForm").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = ev.target; formError(f, "");
    const title = $("#n_title").value.trim(), text = $("#n_text").value.trim();
    if (!title || !text) return formError(f, "Enter both a title and a message.");
    try { await busy(f.querySelector("[type=submit]"), "Posting…", () => F.addDoc(F.collection(db, "notices"), { title, text, important: $("#n_imp").checked, by: user.email, createdAt: F.serverTimestamp() })); toast("Notice posted."); tNotices(p); }
    catch (e) { formError(f, errText(e)); }
  });
  $$("[data-del]", p).forEach((b) => (b.onclick = async () => {
    if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Tap to confirm"; return; }
    try { await F.deleteDoc(F.doc(db, "notices", b.closest("[data-id]").dataset.id)); toast("Deleted."); tNotices(p); } catch (e) { toast(errText(e), "error"); }
  }));
}

// ---------- settings
async function tSettings(p) {
  const fees = await getFees();
  p.innerHTML = `<form class="form-card wide" id="feeSet" novalidate><h3>Fees</h3><p class="form-note">Shown to students when they pay. Leave blank if the amount varies; students then enter the amount you tell them.</p><div class="form-grid">
      <div class="field"><label for="s_adm">Admission fee (₹)</label><input id="s_adm" type="number" min="0" step="1" value="${esc(fees.admission || "")}"></div>
      <div class="field"><label for="s_mon">Monthly fee (₹)</label><input id="s_mon" type="number" min="0" step="1" value="${esc(fees.monthly || "")}"></div></div>
      <div class="cta-row"><button class="btn btn-coral" type="submit">Save fees</button></div></form>
    <section class="form-card wide"><h3>How check-in is secured</h3><ul class="plain-list"><li>The QR code changes every 30 seconds and each code expires after 90 seconds, so a photo of an old code doesn't work.</li><li>Students must be within about ${MAX_DISTANCE_M} m of the pool, and the database rejects check-ins from farther away.</li><li>Only active students can check in, once per day.</li><li>UPI payments: ${CFG.upiId ? `going to <b>${esc(CFG.upiId)}</b>` : "<b>no UPI ID set</b>. Add it in config.js to show a QR code to students."}</li></ul></section>`;
  $("#feeSet").addEventListener("submit", async (ev) => {
    ev.preventDefault(); const f = ev.target;
    const n = (v) => (v === "" ? null : Math.max(0, Math.round(+v)));
    try { await busy(f.querySelector("[type=submit]"), "Saving…", () => F.setDoc(F.doc(db, "settings", "fees"), { admission: n($("#s_adm").value), monthly: n($("#s_mon").value) })); toast("Fees saved."); }
    catch (e) { formError(f, errText(e)); }
  });
}

boot();
