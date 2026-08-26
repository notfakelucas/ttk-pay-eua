(function () {
  if (window.__stripeCheckoutModalInstalled) return;
  window.__stripeCheckoutModalInstalled = true;

  var stripeJsPromise = null;
  function loadStripeJs() {
    if (window.Stripe) return Promise.resolve(window.Stripe);
    if (stripeJsPromise) return stripeJsPromise;
    stripeJsPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.onload = function () { resolve(window.Stripe); };
      script.onerror = function () { reject(new Error("Falha ao carregar o Stripe.")); };
      document.head.appendChild(script);
    });
    return stripeJsPromise;
  }

  function buildOverlay() {
    var overlay = document.createElement("div");
    overlay.id = "stripe-checkout-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);" +
      "display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow:auto;";

    var panel = document.createElement("div");
    panel.style.cssText =
      "background:#fff;border-radius:16px;max-width:480px;width:100%;margin:auto;" +
      "position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.35);min-height:120px;";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "Fechar");
    closeBtn.style.cssText =
      "position:absolute;top:4px;right:8px;background:none;border:none;font-size:28px;" +
      "line-height:1;cursor:pointer;color:#333;z-index:2;padding:6px 10px;";

    var loading = document.createElement("div");
    loading.style.cssText =
      "padding:60px 24px;text-align:center;color:#666;font:600 15px system-ui, -apple-system, sans-serif;";
    loading.textContent = "A carregar pagamento seguro…";

    var mountEl = document.createElement("div");
    mountEl.id = "stripe-checkout-embedded-container";

    panel.appendChild(closeBtn);
    panel.appendChild(loading);
    panel.appendChild(mountEl);
    overlay.appendChild(panel);

    return { overlay: overlay, closeBtn: closeBtn, loading: loading, mountEl: mountEl };
  }

  function closeModal(refs, state) {
    if (state.checkout && state.checkout.destroy) {
      try { state.checkout.destroy(); } catch (e) {}
    }
    if (refs.overlay.parentNode) refs.overlay.parentNode.removeChild(refs.overlay);
    document.body.style.overflow = state.previousOverflow || "";
    document.removeEventListener("keydown", state.onKeyDown, true);
  }

  window.openStripeCheckout = function (path) {
    var refs = buildOverlay();
    var state = { checkout: null, previousOverflow: document.body.style.overflow };
    document.body.appendChild(refs.overlay);
    document.body.style.overflow = "hidden";

    state.onKeyDown = function (e) {
      if (e.key === "Escape") closeModal(refs, state);
    };
    document.addEventListener("keydown", state.onKeyDown, true);

    refs.closeBtn.addEventListener("click", function () { closeModal(refs, state); });
    refs.overlay.addEventListener("click", function (e) {
      if (e.target === refs.overlay) closeModal(refs, state);
    });

    var url = window.forwardParamsToCheckout ? window.forwardParamsToCheckout(path) : path;
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    url = url + sep + "mode=embedded";

    Promise.all([
      fetch(url).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) throw new Error((data && data.error) || "Não foi possível iniciar o pagamento.");
          return data;
        });
      }),
      loadStripeJs(),
    ])
      .then(function (results) {
        var data = results[0];
        var Stripe = results[1];
        var stripe = Stripe(data.publishableKey);
        return stripe.initEmbeddedCheckout({ clientSecret: data.clientSecret });
      })
      .then(function (embeddedCheckout) {
        state.checkout = embeddedCheckout;
        refs.loading.remove();
        embeddedCheckout.mount(refs.mountEl);
      })
      .catch(function (err) {
        refs.loading.textContent = (err && err.message) || "Não foi possível iniciar o pagamento. Tente novamente.";
        refs.loading.style.color = "#e11d48";
      });
  };
})();
