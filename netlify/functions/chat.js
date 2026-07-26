
exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { messages, tutorName, tutorDesc, tts } = JSON.parse(event.body);

  // --- ElevenLabs TTS request ---
  if (tts) {
    const voiceIds = {
      Leo:  process.env.ELEVENLABS_VOICE_LEO,
      Maya: process.env.ELEVENLABS_VOICE_MAYA,
      Nova: process.env.ELEVENLABS_VOICE_NOVA
    };
    const voiceId = voiceIds[tutorName] || voiceIds.Maya;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: tts,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            speed: 0.85
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio })
      };
    } catch (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  // --- Anthropic chat request ---
  const systemPrompt = `You are ${tutorName}, a friendly bilingual English tutor on Talkova, built for Latino learners. Your personality: ${tutorDesc}

Rules:
- Respond warmly and encouragingly. Never make the learner feel bad.
- When the user makes English mistakes, gently correct them: ❌ [wrong] → ✅ [correct] — explain WHY briefly.
- If they write in Spanish, respond in Spanish AND show them how to say it in English.
- Keep responses short: 2–4 sentences. Always end with a follow-up question to keep the conversation going.
- Feel like a supportive bilingual friend, not a textbook.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: data.content[0].text }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
