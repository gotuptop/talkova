exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { messages, tutorName, tutorDesc, tts, userId } = JSON.parse(event.body);

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
            stability: 0.6,
            similarity_boost: 0.85,
            speed: 0.82,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error('ElevenLabs error:', response.status, errBody);
        throw new Error(`ElevenLabs error: ${response.status} - ${errBody}`);
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
- Feel like a supportive bilingual friend, not a textbook.

IMPORTANT: At the end of every response, add a JSON block (hidden from display) with this exact format:
<progress>{"errors":["list any grammar errors the user made"],"topics":["topic of this conversation e.g. greetings, restaurant, work, family"],"level":"Beginner or Intermediate or Advanced based on user's English"}</progress>`;

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
    const fullText = data.content[0].text;

    // Extract progress data from hidden JSON block
    const progressMatch = fullText.match(/<progress>(.*?)<\/progress>/s);
    let progressData = null;
    if (progressMatch) {
      try {
        progressData = JSON.parse(progressMatch[1]);
      } catch(e) {}
    }

    // Clean text - remove the hidden progress block
    const cleanText = fullText.replace(/<progress>.*?<\/progress>/s, '').trim();

    // Save progress to Supabase if userId provided
    if (userId && progressData) {
      try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

        // Update user level
        if (progressData.level) {
          await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ level: progressData.level })
          });
        }

        // Save progress entry
        if (progressData.topics && progressData.topics.length > 0) {
          await fetch(`${supabaseUrl}/rest/v1/progress`, {
            method: 'POST',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId,
              topic: progressData.topics[0],
              errors_count: progressData.errors ? progressData.errors.length : 0,
              practice_count: 1,
              last_practiced: new Date().toISOString()
            })
          });
        }
      } catch(e) {
        console.error('Supabase save error:', e);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content: cleanText,
        progress: progressData
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
