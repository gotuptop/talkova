// netlify/functions/generate-lesson.js
// Builds the end-of-session lesson summary and files it under the student's account.

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;


const LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  it: 'Italian',
  de: 'German',
  nl: 'Dutch',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  sk: 'Slovak',
  hu: 'Hungarian',
  ro: 'Romanian',
  bg: 'Bulgarian',
  hr: 'Croatian',
  el: 'Greek',
  uk: 'Ukrainian',
  ru: 'Russian',
  tr: 'Turkish',
  ar: 'Arabic',
  hi: 'Hindi',
  ta: 'Tamil',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  id: 'Indonesian',
  ms: 'Malay',
  fil: 'Filipino',
  vi: 'Vietnamese'
};
const langName = code => LANGUAGES[code] || LANGUAGES.en;

const json = (statusCode, payload) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

// Confirms the caller is signed in. Returns the Supabase user, or null.
async function getUser(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !SUPABASE_URL) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      console.error('Auth check rejected:', res.status, await res.text());
      return null;
    }
    const user = await res.json();
    return user && user.id ? user : null;
  } catch (e) {
    console.error('Token check failed:', e);
    return null;
  }
}

// Reads the plan straight from the database — never from the request body.
async function getProfile(userId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=plan,learning_language,native_language`,
      { headers: { apikey: SERVICE_KEY } }
    );
    const row = (await res.json())[0] || {};
    return {
      plan: (row.plan || 'free').toLowerCase(),
      learning: row.learning_language || 'en',
      native: row.native_language || 'es'
    };
  } catch (e) {
    return { plan: 'free', learning: 'en', native: 'es' };
  }
}

// Free plan tops out at 5 lessons a day.
async function lessonsToday(userId) {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/lessons?user_id=eq.${userId}&created_at=gte.${start.toISOString()}&select=id`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Prefer: 'count=exact',
          Range: '0-0'
        }
      }
    );
    const range = res.headers.get('content-range') || '';
    return parseInt(range.split('/')[1], 10) || 0;
  } catch (e) {
    return 0;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const user = await getUser(event);
  if (!user) {
    return json(401, { error: 'Sign in to generate your lesson.' });
  }

  const profile = await getProfile(user.id);
  const plan = profile.plan;
  const target = langName(profile.learning);
  const native = langName(profile.native);

  if (plan === 'free' && (await lessonsToday(user.id)) >= 5) {
    return json(402, {
      error: 'The free plan covers 5 lessons a day. Upgrade to keep going.',
      upgrade: true
    });
  }

  let messages, tutorName, userName, conversationId;
  try {
    ({ messages, tutorName, userName, conversationId } = JSON.parse(event.body));
  } catch (e) {
    return json(400, { error: 'Malformed request body.' });
  }

  if (!Array.isArray(messages) || messages.length < 2) {
    return json(400, { error: 'Not enough conversation to build a lesson.' });
  }

  // Cap the transcript so a very long session can't blow up the token bill.
  const transcript = messages
    .slice(-40)
    .map(m => `${m.role === 'user' ? 'Student' : tutorName}: ${m.content}`)
    .join('\n');

  const summaryPrompt = `Based on this ${target} tutoring conversation, create a personalized lesson summary.
The learner speaks ${native} and is learning ${target}. Write the key phrases and the
night audio script in ${target}; write the tips and explanations in ${native}.

Conversation:
${transcript}

Create a lesson summary in this exact JSON format, and return nothing else:
{
  "title": "Lesson title based on main topic",
  "topic": "Main topic practiced",
  "key_phrases": ["phrase 1", "phrase 2", "phrase 3", "phrase 4", "phrase 5"],
  "corrections": [{"wrong": "error made", "correct": "correct version", "tip": "brief explanation"}],
  "night_audio_script": "A calm, slow script in ${target} with the key phrases to listen to before sleep. Include each phrase twice. Use simple, encouraging language. About 100 words.",
  "homework": "One simple task to practice before next session"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: summaryPrompt }]
      })
    });

    const data = await response.json();
    if (!response.ok || !data.content) {
      console.error('Anthropic error:', data);
      return json(502, { error: 'The tutor could not build the lesson. Try again.' });
    }

    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return json(502, { error: 'The lesson came back malformed. Try again.' });

    const lesson = JSON.parse(jsonMatch[0]);
    lesson.studentName = userName || user.user_metadata?.name || 'Student';
    lesson.tutorName = tutorName;
    lesson.date = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // File the lesson. The conversation row is written by the browser —
    // inserting it here too was creating a duplicate for every session.
    try {
      const saved = await fetch(`${SUPABASE_URL}/rest/v1/lessons`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          user_id: user.id,
          conversation_id: conversationId || null,
          tutor_name: tutorName,
          title: lesson.title || null,
          topic: lesson.topic || null,
          key_phrases: lesson.key_phrases || [],
          corrections: lesson.corrections || [],
          night_audio_script: lesson.night_audio_script || null,
          homework: lesson.homework || null
        })
      });
      const rows = await saved.json();
      if (Array.isArray(rows) && rows[0]) lesson.id = rows[0].id;
    } catch (e) {
      console.error('Lesson save error:', e);
    }

    // Mirror the corrections onto the conversation row for progress tracking.
    if (conversationId && lesson.corrections?.length) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
          method: 'PATCH',
          headers: {
            apikey: SERVICE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ errors_made: lesson.corrections })
        });
      } catch (e) {
        console.error('Conversation update error:', e);
      }
    }

    return json(200, { lesson, plan, learning: profile.learning });
  } catch (error) {
    console.error('generate-lesson error:', error);
    return json(500, { error: 'Something went wrong building the lesson.' });
  }
};
