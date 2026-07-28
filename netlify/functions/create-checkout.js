// netlify/functions/create-checkout.js
// Opens a Stripe Checkout session for the signed-in student.

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// The browser sends a plan name. The price is resolved here so nobody can
// subscribe to an arbitrary price by editing the request.
const PRICES = {
  pro: process.env.STRIPE_PRICE_PRO,
  premium: process.env.STRIPE_PRICE_PREMIUM
};

const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

async function getUser(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !SUPABASE_URL) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user && user.id ? user : null;
  } catch (e) {
    console.error('Token check failed:', e);
    return null;
  }
}

// Reuse the Stripe customer if this student already has one.
async function getStripeCustomerId(userId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=stripe_customer_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const rows = await res.json();
    return rows[0]?.stripe_customer_id || null;
  } catch (e) {
    return null;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const user = await getUser(event);
  if (!user) {
    return json(401, { error: 'Sign in before subscribing.' });
  }

  let plan;
  try {
    ({ plan } = JSON.parse(event.body));
  } catch (e) {
    return json(400, { error: 'Malformed request body.' });
  }

  plan = String(plan || '').toLowerCase();
  const priceId = PRICES[plan];
  if (!priceId) {
    return json(400, { error: 'Pick either the Pro or the Premium plan.' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY is not set');
    return json(500, { error: 'Payments are not configured yet.' });
  }

  try {
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', 'https://talkova.app/?success=true&session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url', 'https://talkova.app/#pricing');
    params.append('allow_promotion_codes', 'true');

    // Identity travels three ways so the webhook can always map back to the user:
    params.append('client_reference_id', user.id);
    params.append('metadata[userId]', user.id);
    params.append('metadata[plan]', plan);

    // ...and onto the subscription itself, so renewal, payment failure and
    // cancellation events carry it too. Session metadata does not survive there.
    params.append('subscription_data[metadata][userId]', user.id);
    params.append('subscription_data[metadata][plan]', plan);

    const existingCustomer = await getStripeCustomerId(user.id);
    if (existingCustomer) {
      params.append('customer', existingCustomer);
    } else if (user.email) {
      params.append('customer_email', user.email);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Stripe error:', data.error);
      return json(502, { error: 'Checkout could not open. Try again in a moment.' });
    }

    return json(200, { url: data.url });
  } catch (error) {
    console.error('create-checkout error:', error);
    return json(500, { error: 'Checkout could not open. Try again in a moment.' });
  }
};
