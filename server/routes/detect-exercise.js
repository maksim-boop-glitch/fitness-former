import Anthropic from '@anthropic-ai/sdk';

const VALID_EXERCISES = ['squat', 'deadlift', 'push-up', 'bench-press'];

export async function detectExerciseRoute(req, res) {
  const { imageBase64 } = req.body;
  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // API key not configured — return null so frontend falls back to heuristic
    return res.json({ exercise: null });
  }

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: 'What exercise is this person performing? Reply with exactly one of: squat, deadlift, push-up, bench-press. Reply with just the exercise name, nothing else.',
            },
          ],
        },
      ],
    });

    const raw = message.content[0].text.trim().toLowerCase();
    const exercise = VALID_EXERCISES.find(e => raw.includes(e)) ?? null;
    res.json({ exercise });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: 'Detection failed', exercise: null });
  }
}
