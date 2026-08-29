const PIXEL_CODE = "DA94793C77U3MKV9S0RG";
const TIKTOK_EVENTS_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

const ALLOWED_EVENTS = new Set([
  "ViewContent",
  "InitiateCheckout",
  "CompletePayment",
  "CompleteRegistration",
  "SubmitForm",
  "Contact",
]);

async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value).trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("hex");
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Method not allowed." }));
    return;
  }

  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: "TikTok access token not configured." }));
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  const { event, event_id, url, email, phone, external_id, properties } = body;

  if (!event || !ALLOWED_EVENTS.has(event)) {
    res.statusCode = 400;
    res.end(JSON.stringify({ ok: false, error: "Unknown or missing event." }));
    return;
  }

  const user = {};
  if (email) user.email = await sha256Hex(email);
  if (phone) user.phone = await sha256Hex(phone.replace(/[^\d+]/g, ""));
  if (external_id) user.external_id = await sha256Hex(external_id);

  const forwardedFor = req.headers["x-forwarded-for"];
  const clientIp = Array.isArray(forwardedFor) ? forwardedFor[0] : (forwardedFor || "").split(",")[0].trim();
  if (clientIp) user.ip = clientIp;
  if (req.headers["user-agent"]) user.user_agent = req.headers["user-agent"];

  const payload = {
    event_source: "web",
    event_source_id: PIXEL_CODE,
    data: [
      {
        event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event_id || undefined,
        user,
        properties: properties || {},
        page: url ? { url } : undefined,
      },
    ],
  };

  try {
    const response = await fetch(TIKTOK_EVENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": accessToken,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.code !== 0) {
      res.statusCode = 502;
      res.end(JSON.stringify({ ok: false, error: result.message || "TikTok Events API error." }));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    res.statusCode = 502;
    res.end(JSON.stringify({ ok: false, error: "Failed to reach TikTok Events API." }));
  }
};
