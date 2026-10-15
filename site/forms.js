// Website forms (AIG-754 interest, AIG-619 licence): post the form as JSON to the relay and say how it went. No cookies,
// no trackers; nothing is kept in the browser. <form data-post="/interest"> or "/apply"; fields by their name attribute.
// Texts come from SiteI18n (i18n.js, AIG-1226); the thanks line is the form's data-thanks, translated through data-i18n-attr.
// AIG-1282: the form is sealed here, before it leaves the browser, to the AI-gile board's public key (GET /owner.pub on the relay),
// so the server only ever holds text it can't read: X25519 + HKDF-SHA256 + AES-256-GCM, the board's own DM envelope (lib/dm.js
// seal, without a signature). A browser without X25519 in WebCrypto sends it plain over https and the relay seals it on arrival.
(function () {
  var RELAY = "https://relay.aigile.lol", V = "aigile-dm-v1", ownerKey = null;
  function b64u(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64u(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var r = atob(s), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return b; }
  function getOwner() {
    if (ownerKey) return Promise.resolve(ownerKey);
    return fetch(RELAY + "/owner.pub", { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { if (!/^[A-Za-z0-9_-]{43}$/.test(j.x || "")) throw 0; return (ownerKey = j.x); });
  }
  // to: "apply" or "interest". Resolves to the sealed envelope; rejects when this browser can't (then the relay seals it).
  function seal(to, payload) {
    var S = window.crypto && crypto.subtle, enc = new TextEncoder();
    if (!S) return Promise.reject(new Error("no WebCrypto"));
    return getOwner().then(function (x) {
      var owner = unb64u(x);
      return Promise.all([S.importKey("raw", owner, { name: "X25519" }, false, []), S.generateKey({ name: "X25519" }, true, ["deriveBits"])]).then(function (k) {
        return Promise.all([S.exportKey("raw", k[1].publicKey), S.deriveBits({ name: "X25519", public: k[0] }, k[1].privateKey, 256)]);
      }).then(function (r) {
        var epk = new Uint8Array(r[0]), salt = new Uint8Array(epk.length + owner.length);
        salt.set(epk); salt.set(owner, epk.length);
        return S.importKey("raw", r[1], "HKDF", false, ["deriveKey"]).then(function (ikm) {
          return S.deriveKey({ name: "HKDF", hash: "SHA-256", salt: salt, info: enc.encode(V + "|msg") }, ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
        }).then(function (key) {
          var iv = crypto.getRandomValues(new Uint8Array(12));
          var head = { v: 1, to: to, from: "web", id: b64u(crypto.getRandomValues(new Uint8Array(16))), ts: Date.now(), epk: b64u(epk) };
          var aad = enc.encode([V, head.v, head.to, head.from, head.id, head.ts, head.epk].join("\n"));
          return S.encrypt({ name: "AES-GCM", iv: iv, additionalData: aad }, key, enc.encode(JSON.stringify(payload))).then(function (ct) {
            head.iv = b64u(iv); head.ct = b64u(ct); return head;
          });
        });
      });
    });
  }
  document.querySelectorAll("form[data-post]").forEach(function (f) {
    var out = f.querySelector(".form-msg"), btn = f.querySelector("button[type=submit]"), where = f.getAttribute("data-post");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var o = {};
      new FormData(f).forEach(function (v, k) { o[k] = String(v).trim(); });
      btn.disabled = true; out.className = "form-msg"; out.textContent = SiteI18n.t("form.sending");
      seal(where.slice(1), o).then(function (env) { return { sealed: env }; }, function () { return o; })
        .then(function (body) { return fetch(RELAY + where, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (r) {
          if (r.ok) { f.reset(); out.className = "form-msg ok"; out.textContent = f.getAttribute("data-thanks"); }
          else { out.className = "form-msg bad"; out.textContent = (r.j && r.j.error) || SiteI18n.t("form.failed"); }
        })
        .catch(function () { out.className = "form-msg bad"; out.textContent = SiteI18n.t("form.offline"); })
        .then(function () { btn.disabled = false; });
    });
  });
})();
