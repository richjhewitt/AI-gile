// Website forms (AIG-754 interest, AIG-619 licence): post the form as JSON to the relay and say how it went. No cookies,
// no trackers; nothing is kept in the browser. <form data-post="/interest"> or "/apply"; fields by their name attribute.
(function () {
  var RELAY = "https://relay.aigile.lol";
  document.querySelectorAll("form[data-post]").forEach(function (f) {
    var out = f.querySelector(".form-msg"), btn = f.querySelector("button[type=submit]");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var o = {};
      new FormData(f).forEach(function (v, k) { o[k] = String(v).trim(); });
      btn.disabled = true; out.className = "form-msg"; out.textContent = "Sending…";
      fetch(RELAY + f.getAttribute("data-post"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (r) {
          if (r.ok) { f.reset(); out.className = "form-msg ok"; out.textContent = f.getAttribute("data-thanks"); }
          else { out.className = "form-msg bad"; out.textContent = (r.j && r.j.error) || "That didn't work: try again later."; }
        })
        .catch(function () { out.className = "form-msg bad"; out.textContent = "Couldn't reach AI-gile: try again later."; })
        .then(function () { btn.disabled = false; });
    });
  });
})();
