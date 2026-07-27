exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { priceId, userId, userEmail } = JSON.parse(event.body);
  const secretKey = process.env.STRIPE_SECRET_KEY;

  try {
    // Build form data for Stripe API
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', 'https://talkova.app/?success=true');
    params.append('cancel_url', 'https://talkova.app/#pricing');
    params.append('allow_promotion_codes', 'true');
    if (userEmail) params.append('customer_email', userEmail);
    if (userId) params.append('metadata[userId]', userId);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Stripe error');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: data.url })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
