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
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.statusCode = 500;
    res.end("Stripe is not configured.");
    return;
  }

  const query = req.query || {};
  const product = PRODUCTS[String(query.product || "")];
  if (!product) {
    res.statusCode = 400;
    res.end("Unknown product.");
    return;
  }

  const origin = `https://${req.headers.host}`;
  const passthrough = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "product" || value == null) continue;
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
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: Object.fromEntries(passthrough.entries()),
    });

    res.statusCode = 303;
    res.setHeader("Location", session.url);
    res.end();
  } catch (err) {
    res.statusCode = 502;
    res.end("Stripe error: " + err.message);
  }
};
