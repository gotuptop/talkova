// netlify/functions/chat.js
// Two jobs: talk to the tutor (Anthropic), and speak the reply out loud (ElevenLabs).

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const FREE_DAILY_MESSAGES = 60;   // safety ceiling; the 5-conversation limit lives in the UI
const MAX_TTS_CHARS = 2000;
const MAX_HISTORY = 30;


// The language pair lives in the database, not in this file. Adding a language
// is one line here plus one entry in the picker on the front end.
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

const langName = code => LANGUAGES[code]?.name || LANGUAGES.en.name;

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

// Plan and language pair come from the same row, so one query covers both.
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

// Atomic counter, one row per user per day.
async function bumpUsage(userId) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_usage`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_user: userId })
    });
    return (await res.json()) || 0;
  } catch (e) {
    return 0;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const user = await getUser(event);
  if (!user) return json(401, { error: 'Sign in to keep practicing.' });

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return json(400, { error: 'Malformed request body.' });
  }

  const { messages, tutorName, tutorDesc, tts, mode } = body;
  const profile = await getProfile(user.id);
  const plan = profile.plan;
  const target = langName(profile.learning);   // what they are learning
  const native = langName(profile.native);     // what they already speak

  /* ---------- ElevenLabs: speak the reply ---------- */
  if (tts) {
    // Voice is a paid feature, and night audio is Premium only. Without this
    // check anyone could burn through the ElevenLabs credits.
    if (plan === 'free') {
      return json(402, { error: 'Voice conversations are included in Pro.', upgrade: true });
    }
    if (mode === 'night' && plan !== 'premium') {
      return json(402, { error: 'Night audio is included in Premium.', upgrade: true });
    }
    if (typeof tts !== 'string' || tts.length > MAX_TTS_CHARS) {
      return json(400, { error: 'That text is too long to read aloud.' });
    }

    const voiceIds = {
      Leo: process.env.ELEVENLABS_VOICE_LEO,
      Maya: process.env.ELEVENLABS_VOICE_MAYA,
      Nova: process.env.ELEVENLABS_VOICE_NOVA
    };
    const voiceId = voiceIds[tutorName] || voiceIds.Maya;

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: tts,
          // Flash v2.5 costs 0.5 credits per character instead of 1, and it is
          // still multilingual. ElevenLabs recommends it over Turbo.
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.85,
            speed: 0.82,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        console.error('ElevenLabs error:', response.status, await response.text());
        return json(502, { error: 'The voice service did not respond. Try again.' });
      }

      const audioBuffer = await response.arrayBuffer();
      return json(200, { audio: Buffer.from(audioBuffer).toString('base64') });
    } catch (error) {
      console.error('TTS error:', error);
      return json(500, { error: 'The voice service did not respond. Try again.' });
    }
  }

  /* ---------- Anthropic: the tutor replies ---------- */
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: 'No message to answer.' });
  }

  const used = await bumpUsage(user.id);
  if (plan === 'free' && used > FREE_DAILY_MESSAGES) {
    return json(402, {
      error: 'You have reached the free daily limit. Come back tomorrow or upgrade.',
      upgrade: true
    });
  }

  const systemPrompt = `You are ${tutorName}, a friendly bilingual ${target} tutor on Talkova. Your personality: ${tutorDesc}

The learner speaks ${native} and is learning ${target}.

Rules:
- Respond warmly and encouragingly. Never make the learner feel bad.
- When the user makes ${target} mistakes, gently correct them: ❌ [wrong] → ✅ [correct] — explain WHY briefly.
- If they write in ${native}, respond in ${native} AND show them how to say it in ${target}.
- Keep responses short: 2–4 sentences. Always end with a follow-up question to keep the conversation going.
- Feel like a supportive bilingual friend, not a textbook.

IMPORTANT: At the end of every response, add a JSON block (hidden from display) with this exact format:
<progress>{"errors":["list any grammar errors the user made"],"topics":["topic of this conversation e.g. greetings, restaurant, work, family"],"level":"Beginner or Intermediate or Advanced based on the learner's ${target}"}</progress>`;

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
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.slice(-MAX_HISTORY)
      })
    });

    const data = await response.json();
    if (!response.ok || !data.content) {
      console.error('Anthropic error:', data);
      return json(502, { error: 'The tutor is not responding. Try again in a moment.' });
    }

    const fullText = data.content[0].text;

    const progressMatch = fullText.match(/<progress>(.*?)<\/progress>/s);
    let progressData = null;
    if (progressMatch) {
      try { progressData = JSON.parse(progressMatch[1]); } catch (e) {}
    }
    const cleanText = fullText.replace(/<progress>.*?<\/progress>/s, '').trim();

    // Progress tracking is a paid feature, and the user id comes from the
    // token — never from the request body.
    if (progressData && plan !== 'free') {
      try {
        if (progressData.level) {
          await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
            method: 'PATCH',
            headers: {
              apikey: SERVICE_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ level: progressData.level })
          });
        }

        // One row per topic that accumulates, instead of a new row per message.
        if (progressData.topics?.length) {
          await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_progress`, {
            method: 'POST',
            headers: {
              apikey: SERVICE_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              p_user: user.id,
              p_topic: String(progressData.topics[0]).toLowerCase().slice(0, 60),
              p_errors: progressData.errors?.length || 0
            })
          });
        }
      } catch (e) {
        console.error('Progress save error:', e);
      }
    }

    return json(200, {
      content: cleanText,
      progress: plan === 'free' ? null : progressData,
      plan,
      learning: profile.learning,
      native: profile.native
    });
  } catch (error) {
    console.error('chat error:', error);
    return json(500, { error: 'The tutor is not responding. Try again in a moment.' });
  }
};
