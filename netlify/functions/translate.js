// netlify/functions/translate.js
// Traductor rápido de Talkova. Mismo patrón que chat.js: llamadas directas
// a la API REST de Supabase con fetch, sin el paquete @supabase/supabase-js.

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const FREE_DAILY_TRANSLATIONS = 10;
const MAX_TEXT_CHARS = 2000;

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

async function getPlan(userId) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=plan`,
      { headers: { apikey: SERVICE_KEY } }
    );
    const row = (await res.json())[0] || {};
    return (row.plan || 'free').toLowerCase();
  } catch (e) {
    return 'free';
  }
}

// Atomic counter, one row per user per day — misma forma que bump_voice y bump_usage.
async function bumpTranslations(userId) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bump_translation_usage`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, 'Content-Type': 'application/json' },
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
  if (!user) return json(401, { error: 'Inicia sesión para traducir.' });

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return json(400, { error: 'Solicitud mal formada.' });
  }

  const { text, targetLang, sourceLang, voiceOutput } = body;

  if (!text || !targetLang) {
    return json(400, { error: 'Faltan campos: text o targetLang' });
  }
  if (typeof text !== 'string' || text.length > MAX_TEXT_CHARS) {
    return json(400, { error: 'Texto demasiado largo (máximo 2000 caracteres)' });
  }

  const plan = await getPlan(user.id);

  if (plan === 'free') {
    const used = await bumpTranslations(user.id);
    if (used > FREE_DAILY_TRANSLATIONS) {
      return json(402, {
        error: `Alcanzaste el límite de ${FREE_DAILY_TRANSLATIONS} traducciones gratis de hoy. Con Pro son ilimitadas.`,
        upgrade: true
      });
    }
  }

  const sourceInstruction = sourceLang
    ? `del idioma ${sourceLang}`
    : 'detectando automáticamente el idioma de origen';

  const prompt = `Traduce el siguiente texto ${sourceInstruction} al idioma ${targetLang}.
Responde ÚNICAMENTE en formato JSON, sin texto adicional, sin backticks de markdown, con esta estructura exacta:
{"detectedLanguage": "idioma detectado en el texto original", "translation": "traducción del texto"}

Texto a traducir: "${text}"`;

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok || !data.content) {
      console.error('Anthropic error:', data);
      return json(502, { error: 'El traductor no respondió. Intenta de nuevo.' });
    }

    const rawText = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('No se pudo parsear la respuesta de Claude:', rawText);
      return json(502, { error: 'Respuesta inválida del traductor.' });
    }

    // Audio opcional con ElevenLabs (voces Maya/Leo ya configuradas)
    let audioBase64 = null;
    if (voiceOutput) {
      const voiceIds = {
        english: process.env.ELEVENLABS_VOICE_LEO,
        spanish: process.env.ELEVENLABS_VOICE_MAYA
      };
      const voiceId = voiceIds[String(targetLang).toLowerCase()];
      if (voiceId) {
        try {
          const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
              method: 'POST',
              headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                text: parsed.translation,
                model_id: 'eleven_flash_v2_5'
              })
            }
          );
          if (ttsResponse.ok) {
            const audioBuffer = await ttsResponse.arrayBuffer();
            audioBase64 = Buffer.from(audioBuffer).toString('base64');
          } else {
            console.error('ElevenLabs error:', ttsResponse.status, await ttsResponse.text());
          }
        } catch (e) {
          console.error('TTS error:', e);
          // seguimos sin audio, no bloqueamos la traducción
        }
      }
    }

    return json(200, {
      detectedLanguage: parsed.detectedLanguage,
      translation: parsed.translation,
      audioBase64
    });
  } catch (error) {
    console.error('translate error:', error);
    return json(500, { error: 'El traductor no respondió. Intenta de nuevo.' });
  }
};
