// netlify/functions/translate.js
//
// Traductor rápido de Talkova.
// Usa Claude API para traducir texto de cualquier idioma a cualquier idioma.
// Sigue el mismo patrón de autenticación que chat.js: el token de Supabase
// viaja en el header Authorization y aquí se verifica — nunca se confía
// en un userId que venga en el body.

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const FREE_DAILY_LIMIT = 10; // traducciones gratis por día en plan Free

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 1. Verificar el token de sesión (igual que chat.js)
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autenticado' }) };
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida o expirada' }) };
  }

  try {
    const { text, targetLang, sourceLang, voiceOutput } = JSON.parse(event.body);

    if (!text || !targetLang) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Faltan campos: text o targetLang' })
      };
    }

    if (text.length > 2000) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Texto demasiado largo (máximo 2000 caracteres)' })
      };
    }

    // 2. Verificar plan y uso diario del usuario
    const { data: userRow, error: userError } = await supabaseAdmin
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .single();

    if (userError || !userRow) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Usuario no encontrado' }) };
    }

    const plan = (userRow.plan || 'free').toLowerCase();
    const today = new Date().toISOString().split('T')[0];

    if (plan === 'free') {
      const { data: usage } = await supabaseAdmin
        .from('daily_usage')
        .select('translation_count')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      const currentCount = usage?.translation_count || 0;

      if (currentCount >= FREE_DAILY_LIMIT) {
        return {
          statusCode: 402,
          body: JSON.stringify({
            error: `Alcanzaste el límite de ${FREE_DAILY_LIMIT} traducciones gratis de hoy. Con Pro son ilimitadas.`,
            upgrade: true
          })
        };
      }
    }

    // 3. Llamar a Claude para traducir
    const sourceInstruction = sourceLang
      ? `del idioma ${sourceLang}`
      : 'detectando automáticamente el idioma de origen';

    const prompt = `Traduce el siguiente texto ${sourceInstruction} al idioma ${targetLang}.
Responde ÚNICAMENTE en formato JSON, sin texto adicional, sin backticks de markdown, con esta estructura exacta:
{"detectedLanguage": "idioma detectado en el texto original", "translation": "traducción del texto"}

Texto a traducir: "${text}"`;

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('Error de Claude API:', errText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Error al traducir' }) };
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let parsed;
    try {
      const cleaned = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('No se pudo parsear la respuesta de Claude:', rawText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Respuesta inválida del traductor' }) };
    }

    // 4. Generar audio opcional con ElevenLabs (voces Maya/Leo ya configuradas)
    let audioBase64 = null;
    if (voiceOutput) {
      const voiceId = getVoiceIdForLanguage(targetLang);
      if (voiceId) {
        try {
          const ttsResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'xi-api-key': process.env.ELEVENLABS_API_KEY
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
          }
        } catch (e) {
          console.error('Error generando audio:', e);
          // seguimos sin audio, no bloqueamos la traducción
        }
      }
    }

    // 5. Actualizar contador de uso diario (solo plan Free)
    if (plan === 'free') {
      await supabaseAdmin.rpc('bump_translation_usage', { p_user_id: user.id });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        detectedLanguage: parsed.detectedLanguage,
        translation: parsed.translation,
        audioBase64
      })
    };
  } catch (err) {
    console.error('Error en translate.js:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno del servidor' }) };
  }
};

// Mapea idioma destino a un voice ID de ElevenLabs (usa las voces que ya tienes
// configuradas para inglés/español; agrega más entradas si sumas más voces).
function getVoiceIdForLanguage(lang) {
  const map = {
    english: process.env.ELEVENLABS_VOICE_LEO,
    spanish: process.env.ELEVENLABS_VOICE_MAYA
  };
  return map[lang.toLowerCase()] || null;
}
