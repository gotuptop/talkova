export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages, tutorName, tutorDesc } = req.body;

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
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Lo siento, something went wrong. Try again!';
    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ reply: 'Connection error. Please try again.' });
  }
}
