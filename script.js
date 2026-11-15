// Dreamer Swimming Foundation — interactions

document.getElementById('year').textContent = new Date().getFullYear();

// Nav background on scroll
const nav = document.getElementById('nav');
const onScroll = () => {
  if (window.scrollY > 40) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Mobile menu toggle
const toggle = document.getElementById('navToggle');
const menu = document.getElementById('mobileMenu');
toggle.addEventListener('click', () => {
  const isOpen = menu.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(isOpen));
});
menu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  });
});

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => io.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('is-visible'));
}

// ===== PAGE MODULES (each one runs only on the page that has its elements) =====
var DSF = window.DSF || {};
function $id(id) { return document.getElementById(id); }
function showMsg(el, msg) { el.textContent = msg || ""; el.hidden = !msg; if (msg) el.scrollIntoView({ block: "center", behavior: "smooth" }); }
function openWhatsApp(text) {
  // Same-tab navigation: pop-up blockers on mobile browsers stop window.open().
  window.location.href = "https://wa.me/" + (DSF.whatsapp || "918777292030") + "?text=" + encodeURIComponent(text);
}

// ---------- Firebase (REST, no SDK needed) ----------
var FB = DSF.firebase || {};
var FB_ON = !!(FB.apiKey && FB.projectId);
var FS_BASE = "https://firestore.googleapis.com/v1/projects/" + FB.projectId + "/databases/(default)/documents";
function fsNotices() {
  return fetch(FS_BASE + "/notices?pageSize=50&orderBy=" + encodeURIComponent("createdAt desc") + "&key=" + FB.apiKey)
    .then(function (r) { if (!r.ok) throw new Error("load " + r.status); return r.json(); })
    .then(function (j) {
      return (j.documents || []).map(function (d) {
        var f = d.fields || {};
        return {
          id: d.name.split("/").pop(),
          title: (f.title || {}).stringValue || "",
          text: (f.text || {}).stringValue || "",
          important: !!(f.important || {}).booleanValue,
          date: fmtDate((f.createdAt || {}).timestampValue)
        };
      });
    });
}
function fmtDate(ts) {
  if (!ts) return "";
  var d = new Date(ts); if (isNaN(d)) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function noticeCard(n) {
  var a = document.createElement("article");
  a.className = "notice-card" + (n.important ? " important" : "");
  var d = document.createElement("span"); d.className = "notice-date"; d.textContent = n.date || "";
  var h = document.createElement("h3"); h.textContent = n.title;
  var p = document.createElement("p"); p.textContent = n.text;
  a.append(d, h, p); return a;
}

// ---------- Notice Board ----------
(function () {
  var list = $id("noticeList"); if (!list) return;
  function render(items, emptyMsg) {
    list.innerHTML = "";
    if (!items.length) { var p = document.createElement("p"); p.className = "form-note"; p.textContent = emptyMsg; list.appendChild(p); return; }
    items.forEach(function (n) { list.appendChild(noticeCard(n)); });
  }
  if (!FB_ON) return render(window.NOTICES || [], "No notices right now.");
  fsNotices().then(function (items) { render(items, "No notices right now. Please check back later."); })
    .catch(function () { render([], "Notices could not be loaded. Please check your connection and reload the page."); });
})();

// ---------- Magazine ----------
(function () {
  var grid = $id("magGrid"); if (!grid) return;
  var items = window.MAGAZINE || [], empty = $id("magEmpty"), filters = $id("magFilters");
  var lb = $id("lightbox"), lbImg = $id("lbImg"), lbCap = $id("lbCap");
  if (!items.length) { empty.hidden = false; filters.hidden = true; return; }
  var cats = ["All"].concat(items.map(function (i) { return i.category; }).filter(function (v, i, a) { return v && a.indexOf(v) === i; }));
  var active = "All";
  function render() {
    grid.innerHTML = "";
    items.filter(function (i) { return active === "All" || i.category === active; }).forEach(function (i) {
      var b = document.createElement("button"); b.type = "button"; b.className = "mag-item";
      var img = document.createElement("img"); img.src = i.src; img.alt = i.caption || ""; img.loading = "lazy"; b.appendChild(img);
      if (i.caption) { var c = document.createElement("span"); c.className = "mag-cap"; c.textContent = i.caption; b.appendChild(c); }
      b.addEventListener("click", function () { lbImg.src = i.src; lbImg.alt = i.caption || ""; lbCap.textContent = i.caption || ""; lb.classList.add("open"); });
      grid.appendChild(b);
    });
  }
  cats.forEach(function (c) {
    var b = document.createElement("button"); b.type = "button"; b.className = "chip" + (c === active ? " active" : ""); b.textContent = c;
    b.addEventListener("click", function () {
      active = c;
      Array.prototype.forEach.call(filters.children, function (x) { x.classList.toggle("active", x.textContent === c); });
      render();
    });
    filters.appendChild(b);
  });
  function close() { lb.classList.remove("open"); }
  $id("lbClose").addEventListener("click", close);
  lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  render();
})();

// ---------- Admission form ----------
(function () {
  var form = $id("admForm"); if (!form) return;
  $id("f_photo").addEventListener("change", function (e) {
    var f = e.target.files[0], img = $id("photoPrev");
    if (!f) { img.hidden = true; img.removeAttribute("src"); return; }
    img.src = URL.createObjectURL(f); img.hidden = false;
  });
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $id("admError"); showMsg(err, "");
    var v = function (id) { return $id(id).value.trim(); };
    var missing = [["f_name", "student's name"], ["f_dob", "date of birth"], ["f_phone", "phone number"], ["f_program", "program"]]
      .filter(function (x) { return !v(x[0]); });
    if (missing.length) { $id(missing[0][0]).focus(); return showMsg(err, "Please fill in: " + missing.map(function (x) { return x[1]; }).join(", ") + "."); }
    if (v("f_phone").replace(/\D/g, "").length < 10) { $id("f_phone").focus(); return showMsg(err, "Please enter a valid 10-digit phone number."); }
    var dob = v("f_dob").split("-").reverse().join("/");
    var lines = [
      "*New admission request*",
      "Name: " + v("f_name"),
      "Date of birth: " + dob,
      v("f_gender") && "Gender: " + v("f_gender"),
      v("f_guardian") && "Parent/guardian: " + v("f_guardian"),
      "Phone: " + v("f_phone"),
      "Program: " + v("f_program"),
      "Preferred batch: " + (v("f_batch") || "No preference"),
      v("f_blood") && "Blood group: " + v("f_blood"),
      v("f_emerg") && "Emergency contact: " + v("f_emerg"),
      v("f_addr") && "Address: " + v("f_addr"),
      "\n(Student photo attached in this chat)"
    ].filter(Boolean);
    openWhatsApp(lines.join("\n"));
  });
})();

// ---------- Pay Fees ----------
(function () {
  var form = $id("feeForm"); if (!form) return;
  var upiOn = !!DSF.upiId, d = {};
  $id("p_month").selectedIndex = new Date().getMonth();
  function syncMonth() { $id("p_month").closest(".field").hidden = $id("p_type").value !== "Monthly fee"; }
  $id("p_type").addEventListener("change", syncMonth); syncMonth();

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $id("feeError"); showMsg(err, "");
    var v = function (id) { return $id(id).value.trim(); };
    var amt = Math.round(parseFloat(v("p_amount")) * 100) / 100;
    if (!v("p_name")) { $id("p_name").focus(); return showMsg(err, "Please enter the student's name."); }
    if (!v("p_program")) { $id("p_program").focus(); return showMsg(err, "Please select the program."); }
    if (!(amt >= 1)) { $id("p_amount").focus(); return showMsg(err, "Please enter the fee amount confirmed by our team."); }
    d = { name: v("p_name"), sid: v("p_sid"), program: v("p_program"), amount: amt,
          purpose: v("p_type") + (v("p_type") === "Monthly fee" ? " (" + v("p_month") + ")" : "") };
    $id("payAmt").textContent = "₹" + amt.toLocaleString("en-IN");
    $id("payOn").hidden = !upiOn; $id("payOff").hidden = upiOn;
    $id("sendPay").textContent = upiOn ? "Send confirmation on WhatsApp" : "Ask for payment details on WhatsApp";
    $id("p_txn").closest(".form-grid").hidden = !upiOn;
    if (upiOn) {
      var note = (d.purpose + " " + d.name).slice(0, 60);
      var link = "upi://pay?pa=" + encodeURIComponent(DSF.upiId) + "&pn=" + encodeURIComponent(DSF.upiName || "") +
                 "&am=" + amt.toFixed(2) + "&cu=INR&tn=" + encodeURIComponent(note);
      $id("payLink").href = link; $id("payTo").textContent = DSF.upiId; $id("payName").textContent = DSF.upiName || "";
      try { var q = qrcode(0, "M"); q.addData(link); q.make(); $id("payQr").innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
      catch (e) { $id("payQr").textContent = "QR code unavailable. Use the button or copy the UPI ID."; }
    }
    $id("payStep").hidden = false; $id("payStep").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $id("copyUpi").addEventListener("click", function () {
    var b = $id("copyUpi");
    (navigator.clipboard ? navigator.clipboard.writeText(DSF.upiId) : Promise.reject())
      .then(function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy UPI ID"; }, 1800); },
            function () { window.prompt("UPI ID", DSF.upiId); });
  });

  $id("sendPay").addEventListener("click", function () {
    var err = $id("txnError"); showMsg(err, "");
    var txn = $id("p_txn").value.trim();
    if (upiOn && txn.replace(/\s/g, "").length < 6) { $id("p_txn").focus(); return showMsg(err, "Enter the UPI transaction ID shown in your UPI app after paying."); }
    var lines = upiOn ? [
      "*Fee payment*", "Student: " + d.name, d.sid && "Student ID: " + d.sid, "Program: " + d.program,
      "Payment for: " + d.purpose, "Amount: ₹" + d.amount, "UPI transaction ID: " + txn,
      "\n(Payment screenshot attached in this chat)"
    ] : [
      "*Fee payment enquiry*", "Student: " + d.name, d.sid && "Student ID: " + d.sid, "Program: " + d.program,
      "Payment for: " + d.purpose, "Amount: ₹" + d.amount, "\nPlease share the payment details."
    ];
    openWhatsApp(lines.filter(Boolean).join("\n"));
  });
})();

// ---------- Admin: login + post notices ----------
(function () {
  var login = $id("loginForm"); if (!login) return;
  var panel = $id("adminPanel"), KEY = "dsf_admin";
  if (!FB_ON) { $id("adminSetup").hidden = false; return; }

  function sess() { try { var s = JSON.parse(sessionStorage.getItem(KEY) || "null"); return s && s.exp > Date.now() ? s : null; } catch (e) { return null; } }
  function show() { var s = sess(); login.hidden = !!s; panel.hidden = !s; if (s) loadList(); }
  function signOut(msg) { try { sessionStorage.removeItem(KEY); } catch (e) {} show(); if (msg) showMsg($id("loginError"), msg); }
  function authed(url, opts) {
    var s = sess(); if (!s) { signOut("Your session expired. Please sign in again."); return Promise.reject(new Error("expired")); }
    opts = opts || {}; opts.headers = { "Authorization": "Bearer " + s.token, "Content-Type": "application/json" };
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) { signOut("Your session expired. Please sign in again."); throw new Error("expired"); }
      if (r.status === 403) throw new Error("This account is not allowed to post notices.");
      if (!r.ok) throw new Error("Something went wrong (" + r.status + "). Please try again.");
      return r.json();
    });
  }

  login.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $id("loginError"); showMsg(err, "");
    var email = $id("a_email").value.trim(), pass = $id("a_pass").value;
    if (!email || !pass) return showMsg(err, "Enter your email and password.");
    var btn = login.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Signing in…";
    fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + FB.apiKey, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: pass, returnSecureToken: true })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) { var m = ((x.j.error || {}).message || ""); throw new Error(/TOO_MANY/.test(m) ? "Too many attempts. Please wait a few minutes and try again." : "Wrong email or password."); }
        sessionStorage.setItem(KEY, JSON.stringify({ token: x.j.idToken, exp: Date.now() + (parseInt(x.j.expiresIn, 10) - 60) * 1000 }));
        $id("a_pass").value = ""; show();
      })
      .catch(function (e) { showMsg(err, e.message === "Failed to fetch" ? "Could not connect. Check your internet and try again." : e.message); })
      .then(function () { btn.disabled = false; btn.textContent = "Sign in"; });
  });
  $id("logoutBtn").addEventListener("click", function () { signOut(); });

  function loadList() {
    var box = $id("adminList"); box.textContent = "Loading…";
    fsNotices().then(function (items) {
      box.innerHTML = "";
      if (!items.length) { box.textContent = "No notices posted yet."; return; }
      items.forEach(function (n) {
        var card = noticeCard(n);
        var del = document.createElement("button"); del.type = "button"; del.className = "btn btn-outline btn-sm"; del.textContent = "Delete notice";
        del.addEventListener("click", function () {
          if (del.dataset.confirm !== "1") { del.dataset.confirm = "1"; del.textContent = "Tap again to delete"; setTimeout(function () { del.dataset.confirm = ""; del.textContent = "Delete notice"; }, 4000); return; }
          del.disabled = true; del.textContent = "Deleting…";
          authed(FS_BASE + "/notices/" + encodeURIComponent(n.id), { method: "DELETE" }).then(loadList, function (e) {
            del.disabled = false; del.textContent = "Delete notice"; if (e.message !== "expired") showMsg($id("noticeError"), e.message);
          });
        });
        card.appendChild(del); box.appendChild(card);
      });
    }).catch(function () { box.textContent = "Could not load notices. Reload the page to try again."; });
  }

  $id("noticeForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var err = $id("noticeError"), ok = $id("noticeOk"); showMsg(err, ""); ok.hidden = true;
    var title = $id("n_title").value.trim(), text = $id("n_text").value.trim();
    if (!title || !text) return showMsg(err, "Enter both a title and a message.");
    var btn = ev.target.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Posting…";
    authed(FS_BASE + "/notices", { method: "POST", body: JSON.stringify({ fields: {
      title: { stringValue: title }, text: { stringValue: text },
      important: { booleanValue: $id("n_imp").checked }, createdAt: { timestampValue: new Date().toISOString() }
    } }) }).then(function () {
      ev.target.reset(); ok.textContent = "Posted. It is now on the Notice Board."; ok.hidden = false; loadList();
    }, function (e) { if (e.message !== "expired") showMsg(err, e.message === "Failed to fetch" ? "Could not connect. Check your internet and try again." : e.message); })
      .then(function () { btn.disabled = false; btn.textContent = "Post notice"; });
  });
  show();
})();

// ---------- Staff ID card ----------
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var cv = $("idCanvas"); if (!cv) return;
  var ctx = cv.getContext("2d"), W = cv.width, H = cv.height;
  var logo = new Image(), photo = null;
  logo.onload = draw; logo.src = "assets/dsf-logo.png";

  var KEY = "dsf_last_serial";
  function pad(n) { return String(n).padStart(4, "0"); }
  var today = new Date(), iso = function (d) { return d.toISOString().slice(0, 10); };
  var last = 0; try { last = parseInt(localStorage.getItem(KEY) || "0", 10) || 0; } catch (e) {}
  $("i_serial").value = last + 1;
  $("i_issue").value = iso(today);
  $("i_valid").value = iso(new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()));

  function sid() {
    var y = ($("i_issue").value || iso(today)).slice(0, 4);
    return "DSF-" + y + "-" + pad(parseInt($("i_serial").value || "1", 10));
  }
  function fmt(s) { if (!s) return "—"; var p = s.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function fit(text, maxW, size, weight) {
    var s = size; do { ctx.font = weight + " " + s + "px Inter, Arial, sans-serif"; s -= 2; } while (ctx.measureText(text).width > maxW && s > 20);
  }

  function draw() {
    $("idPreview").textContent = sid();
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#04222E"); g.addColorStop(1, "#0B6E82");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // soft wave
    ctx.strokeStyle = "rgba(47,217,196,0.22)"; ctx.lineWidth = 3;
    for (var k = 0; k < 4; k++) { ctx.beginPath(); for (var x = 0; x <= W; x += 8) { var y = 470 + k * 34 + Math.sin(x / 70 + k) * 12; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }

    // header band
    ctx.fillStyle = "#fff"; rr(36, 30, 150, 92, 16); ctx.fill();
    if (logo.complete && logo.naturalWidth) { var lw = 126, lh = lw * logo.naturalHeight / logo.naturalWidth; ctx.drawImage(logo, 48, 30 + (92 - lh) / 2, lw, lh); }
    ctx.fillStyle = "#fff"; ctx.font = "700 40px 'Bricolage Grotesque', Inter, Arial, sans-serif"; ctx.textBaseline = "alphabetic";
    ctx.fillText("Dreamer", 206, 78);
    ctx.font = "600 17px 'Space Mono', monospace"; ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fillText("SWIMMING FOUNDATION", 208, 108);
    ctx.textAlign = "right"; ctx.font = "700 20px 'Space Mono', monospace"; ctx.fillStyle = "#2FD9C4"; ctx.fillText("STUDENT ID", W - 36, 66); ctx.textAlign = "left";

    // photo
    var px = 36, py = 160, pw = 214, ph = 268;
    ctx.save(); rr(px, py, pw, ph, 18); ctx.clip(); ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fillRect(px, py, pw, ph);
    if (photo) { var r = Math.max(pw / photo.width, ph / photo.height), dw = photo.width * r, dh = photo.height * r; ctx.drawImage(photo, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh); }
    else { ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "500 20px Inter, Arial"; ctx.textAlign = "center"; ctx.fillText("Photo", px + pw / 2, py + ph / 2); ctx.textAlign = "left"; }
    ctx.restore(); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 3; rr(px, py, pw, ph, 18); ctx.stroke();

    // details
    var tx = 278, maxW = W - tx - 36;
    var name = $("i_name").value.trim() || "Student Name";
    fit(name, maxW, 44, 700); ctx.fillStyle = "#fff"; ctx.fillText(name, tx, 205);
    function row(label, value, y) {
      ctx.font = "600 15px 'Space Mono', monospace"; ctx.fillStyle = "#2FD9C4"; ctx.fillText(label, tx, y);
      fit(value, maxW, 26, 600); ctx.fillStyle = "#fff"; ctx.fillText(value, tx, y + 28);
    }
    row("ID NO.", sid(), 252);
    row("PROGRAM", $("i_program").value, 322);
    ctx.font = "600 15px 'Space Mono', monospace"; ctx.fillStyle = "#2FD9C4";
    ctx.fillText("PHONE", tx, 392); ctx.fillText("BLOOD", tx + 250, 392); 
    ctx.font = "600 24px Inter, Arial"; ctx.fillStyle = "#fff";
    ctx.fillText($("i_phone").value.trim() || "—", tx, 420); ctx.fillText($("i_blood").value || "—", tx + 250, 420);

    // footer
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "500 17px Inter, Arial";
    ctx.fillText("Valid till " + fmt($("i_valid").value) + "   ·   Issued " + fmt($("i_issue").value), 36, 596);
    ctx.textAlign = "right"; ctx.fillText("Barasat, Kolkata · 87772 92030", W - 36, 596); ctx.textAlign = "left";
  }

  ["i_name", "i_program", "i_phone", "i_blood", "i_serial", "i_issue", "i_valid"].forEach(function (id) { $(id).addEventListener("input", draw); $(id).addEventListener("change", draw); });
  $("i_photo").addEventListener("change", function (e) {
    var f = e.target.files[0]; if (!f) { photo = null; return draw(); }
    var im = new Image(); im.onload = function () { photo = im; draw(); }; im.src = URL.createObjectURL(f);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  draw();

  function remember() { try { localStorage.setItem(KEY, String(parseInt($("i_serial").value, 10) || 0)); } catch (e) {} }
  $("dlBtn").addEventListener("click", function () {
    if (!$("i_name").value.trim()) { $("i_name").focus(); return alert("Enter the student's name first."); }
    draw();
    try {
      cv.toBlob(function (b) {
        var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = sid() + ".png"; document.body.appendChild(a); a.click(); a.remove();
        remember(); $("i_serial").value = (parseInt($("i_serial").value, 10) || 0) + 1; draw();
      }, "image/png");
    } catch (e) { alert("Download is blocked when opening this page as a local file. Use the live site instead."); }
  });
  $("printBtn").addEventListener("click", function () {
    draw();
    var w = window.open("", "_blank"); if (!w) return alert("Allow pop-ups to print.");
    w.document.write('<title>' + sid() + '</title><style>@page{size:85.6mm 54mm;margin:0}body{margin:0}img{width:85.6mm;height:54mm;display:block}</style><img src="' + cv.toDataURL("image/png") + '" onload="print()">');
    w.document.close();
  });
})();
