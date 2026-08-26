const Stripe = require("stripe");

const PRODUCTS = {
  course: {
    name: "Extra Income Fixing Computers - Digital Course",
    amountCents: 3700,
    currency: "eur",
    cancelPath: "/landingpage",
    successPath: "/up1",
  },
  release: {
    name: "Security Contribution - Withdrawal Release",
    amountCents: 2412,
    currency: "eur",
    cancelPath: "/confirmar-saque",
    successPath: "/thanks",
  },
  release_discount: {
    name: "Security Contribution - Withdrawal Release (Discounted)",
    amountCents: 2070,
    currency: "eur",
    cancelPath: "/back-redirect",
    successPath: "/thanks",
  },
};

module.exports = async (req, res) => {
  const query = req.query || {};
  const embedded = String(query.mode || "") === "embedded";

  const fail = (statusCode, message) => {
    res.statusCode = statusCode;
    if (embedded) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: message }));
    } else {
      res.end(message);
    }
  };

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    fail(500, "Stripe is not configured.");
    return;
  }
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (embedded && !publishableKey) {
    fail(500, "Stripe is not configured.");
    return;
  }

  const product = PRODUCTS[String(query.product || "")];
  if (!product) {
    fail(400, "Unknown product.");
    return;
  }

  const origin = `https://${req.headers.host}`;
  const passthrough = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "product" || key === "mode" || value == null) continue;
    passthrough.set(key, String(value));
  }
  // Strip any stale order/valor carried over from a previous purchase's
  // success_url (the site forwards current query params onto internal
  // navigations), so they can't shadow the real values set below.
  passthrough.delete("order");
  passthrough.delete("valor");

  const successParams = new URLSearchParams(passthrough);
  successParams.set("valor", (product.amountCents / 100).toFixed(2));
  const successUrl =
    `${origin}${product.successPath}?${successParams.toString()}` +
    `&order={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}${product.cancelPath}?${passthrough.toString()}`;

  try {
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: product.currency,
            product_data: { name: product.name },
            unit_amount: product.amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: Object.fromEntries(passthrough.entries()),
      ...(embedded
        ? { ui_mode: "embedded", return_url: successUrl }
        : { success_url: successUrl, cancel_url: cancelUrl }),
    });

    if (embedded) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ clientSecret: session.client_secret, publishableKey }));
      return;
    }

    res.statusCode = 303;
    res.setHeader("Location", session.url);
    res.end();
  } catch (err) {
    fail(502, "Stripe error: " + err.message);
  }
};
