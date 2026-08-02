// netlify/functions/stripe-webhook.js
// Stripe tells us when a subscription starts, renews, fails or ends.
// This is the only place the plan column is allowed to change.

const crypto = require('crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Price id -> plan name, so a renewal event can tell Pro from Premium.
const PLAN_BY_PRICE = {
  [process.env.STRIPE_PRICE_PRO]: 'pro',
  [process.env.STRIPE_PRICE_PREMIUM]: 'premium'
};

// Stripe signs every request. Without this check anyone could POST here
// and hand themselves a Premium subscription.
function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || !WEBHOOK_SECRET) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('=', 2))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject anything older than five minutes — blocks replayed requests.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function updateUser(userId, fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(fields)
  });
  if (!res.ok) console.error('User update failed:', res.status, await res.text());
  return res.ok;
}

// Renewal and cancellation events carry the customer, not always the user id.
async function findUserByCustomer(customerId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?stripe_customer_id=eq.${customerId}&select=id`,
      { headers: { apikey: SERVICE_KEY } }
    );
    const rows = await res.json();
    return rows[0]?.id || null;
  } catch (e) {
    return null;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!verifySignature(rawBody, signature)) {
    console.error('Rejected webhook: bad signature');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (e) {
    return { statusCode: 400, body: 'Malformed payload' };
  }

  const object = stripeEvent.data?.object || {};
  console.log('Stripe event:', stripeEvent.type);

  try {
    switch (stripeEvent.type) {

      // The subscription just started. Record the plan and the customer id
      // so later events can find this user again.
      case 'checkout.session.completed': {
        const userId = object.client_reference_id || object.metadata?.userId;
        const plan = object.metadata?.plan;
        if (!userId || !plan) {
          console.error('checkout.session.completed without user or plan');
          break;
        }
        await updateUser(userId, {
          plan,
          stripe_customer_id: object.customer || null
        });
        console.log(`User ${userId} is now on ${plan}`);
        break;
      }

      // Renewal, plan change, payment trouble, or the end of a cancellation
      // period. The status decides whether access continues.
      case 'customer.subscription.updated': {
        const userId = object.metadata?.userId || await findUserByCustomer(object.customer);
        if (!userId) { console.error('subscription.updated: no user match'); break; }

        const active = ['active', 'trialing'].includes(object.status);
        const priceId = object.items?.data?.[0]?.price?.id;
        const plan = active ? (PLAN_BY_PRICE[priceId] || object.metadata?.plan || 'pro') : 'free';

        await updateUser(userId, { plan });
        console.log(`User ${userId} -> ${plan} (status ${object.status})`);
        break;
      }

      // Subscription is over. Back to free.
      case 'customer.subscription.deleted': {
        const userId = object.metadata?.userId || await findUserByCustomer(object.customer);
        if (!userId) { console.error('subscription.deleted: no user match'); break; }
        await updateUser(userId, { plan: 'free' });
        console.log(`User ${userId} back to free`);
        break;
      }

      default:
        // Everything else is fine to ignore.
        break;
    }
  } catch (error) {
    // Returning 500 makes Stripe retry, which is what we want on a real failure.
    console.error('Webhook handling error:', error);
    return { statusCode: 500, body: 'Handler error' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
