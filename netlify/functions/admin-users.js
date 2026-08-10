// netlify/functions/admin-users.js
// Returns the full user list — but only to the account listed in ADMIN_EMAIL.
// The service key never leaves this function.

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase();

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

exports.handler = async function (event) {
  const user = await getUser(event);
  if (!user) return json(401, { error: 'Sign in first.' });

  if (!ADMIN_EMAIL) {
    console.error('ADMIN_EMAIL is not set');
    return json(500, { error: 'Admin access is not configured.' });
  }
  if ((user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return json(403, { error: 'This page is not available for your account.' });
  }

  try {
    const usersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=id,email,name,plan,level,total_conversations,` +
      `learning_language,native_language,stripe_customer_id,created_at&order=created_at.desc`,
      { headers: { apikey: SERVICE_KEY } }
    );
    const users = await usersRes.json();
    if (!Array.isArray(users)) {
      console.error('Unexpected users payload:', users);
      return json(502, { error: 'Could not read the user list.' });
    }

    // Conversations and lessons per user, counted here so the page stays simple.
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const convRes = await fetch(
      `${SUPABASE_URL}/rest/v1/conversations?select=user_id,created_at&created_at=gte.${since.toISOString()}`,
      { headers: { apikey: SERVICE_KEY } }
    );
    const convs = await convRes.json();
    const convCount = {};
    if (Array.isArray(convs)) {
      convs.forEach(c => { convCount[c.user_id] = (convCount[c.user_id] || 0) + 1; });
    }

    const rows = users.map(u => ({
      email: u.email,
      name: u.name,
      plan: (u.plan || 'free').toLowerCase(),
      level: u.level,
      learning: u.learning_language || 'en',
      native: u.native_language || 'es',
      totalConversations: u.total_conversations || 0,
      last30: convCount[u.id] || 0,
      paying: Boolean(u.stripe_customer_id),
      createdAt: u.created_at
    }));

    const paid = rows.filter(r => r.plan !== 'free');
    const mrr = paid.reduce((sum, r) => sum + (r.plan === 'premium' ? 19.99 : 9.99), 0);

    return json(200, {
      rows,
      totals: {
        users: rows.length,
        free: rows.filter(r => r.plan === 'free').length,
        pro: rows.filter(r => r.plan === 'pro').length,
        premium: rows.filter(r => r.plan === 'premium').length,
        activeLast30: rows.filter(r => r.last30 > 0).length,
        mrr: Math.round(mrr * 100) / 100
      }
    });
  } catch (error) {
    console.error('admin-users error:', error);
    return json(500, { error: 'Could not read the user list.' });
  }
};
