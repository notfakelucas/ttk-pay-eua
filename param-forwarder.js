(function () {
  if (window.__paramForwarderInstalled) return;
  window.__paramForwarderInstalled = true;

  var CHECKOUT_HOSTS = new Set(["checkout.vendepay.com"]);

  function currentParams() {
    var params = new URLSearchParams(window.location.search);
    params.delete("__route");
    return params;
  }

  function appendCurrentParams(rawUrl) {
    var params = currentParams();
    if (!rawUrl || !params.toString()) return rawUrl;

    try {
      var url = new URL(rawUrl, window.location.href);
      params.forEach(function (value, key) {
        if (!url.searchParams.has(key)) url.searchParams.set(key, value);
      });
      return url.toString();
    } catch (error) {
      return rawUrl;
    }
  }

  function decorateCheckoutLinks() {
    document.querySelectorAll("a[href]").forEach(function (link) {
      try {
        var url = new URL(link.href, window.location.href);
        if (CHECKOUT_HOSTS.has(url.hostname)) {
          link.href = appendCurrentParams(link.href);
        }
      } catch (error) {}
    });
  }

  function appendParamsToInternalUrl(rawUrl) {
    var params = currentParams();
    if (!rawUrl || !params.toString()) return rawUrl;

    try {
      var url = new URL(rawUrl, window.location.href);
      if (url.origin !== window.location.origin || url.search) return rawUrl;
      url.search = params.toString();
      return url.pathname + url.search + url.hash;
    } catch (error) {
      return rawUrl;
    }
  }

  function patchHistoryMethod(methodName) {
    var original = history[methodName];
    history[methodName] = function (state, title, url) {
      if (typeof url === "string") {
        return original.call(this, state, title, appendParamsToInternalUrl(url));
      }
      return original.apply(this, arguments);
    };
  }

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  document.addEventListener(
    "click",
    function (event) {
      var link = event.target && event.target.closest && event.target.closest("a[href]");
      if (!link) return;

      try {
        var url = new URL(link.href, window.location.href);
        if (!CHECKOUT_HOSTS.has(url.hostname)) return;
        link.href = appendCurrentParams(link.href);
      } catch (error) {}
    },
    true
  );

  decorateCheckoutLinks();
  new MutationObserver(decorateCheckoutLinks).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.forwardParamsToCheckout = appendCurrentParams;
})();
