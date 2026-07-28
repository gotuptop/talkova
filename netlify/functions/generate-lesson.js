exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { messages, tutorName, userId, userName } = JSON.parse(event.body);

  // Generate lesson summary using Claude
  const summaryPrompt = `Based on this English tutoring conversation, create a personalized lesson summary.

Conversation:
${messages.map(m => `${m.role === 'user' ? 'Student' : tutorName}: ${m.content}`).join('\n')}

Create a lesson summary in this exact JSON format:
{
  "title": "Lesson title based on main topic",
  "topic": "Main topic practiced",
  "key_phrases": ["phrase 1", "phrase 2", "phrase 3", "phrase 4", "phrase 5"],
  "corrections": [{"wrong": "error made", "correct": "correct version", "tip": "brief explanation"}],
  "night_audio_script": "A calm, slow script with the key phrases to listen to before sleep. Include each phrase twice. Use simple, encouraging language. About 100 words.",
  "homework": "One simple task to practice before next session"
}`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: summaryPrompt }],
      }),
    });

    const data = await response.json();
    const text = data.content[0].text;
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    
    const lesson = JSON.parse(jsonMatch[0]);
    lesson.studentName = userName || 'Student';
    lesson.tutorName = tutorName;
    lesson.date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Save lesson to Supabase if userId provided
    if (userId) {
      try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        await fetch(`${supabaseUrl}/rest/v1/conversations`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            tutor_name: tutorName,
            messages: messages,
            errors_made: lesson.corrections || []
          })
        });
      } catch(e) {
        console.error('Supabase save error:', e);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
