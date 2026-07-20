exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { messages, tutorName, tutorDesc } = JSON.parse(event.body);

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
