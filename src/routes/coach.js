const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const db = require('../database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const STAGES = [
  { key: 'name',          label: 'Idea Name',         instruction: 'Help the user find a concise, memorable name. Explore a few options together, discuss what different names convey, and help them settle on something that captures the essence of the idea.' },
  { key: 'description',   label: 'Description',        instruction: 'Build a rich understanding of what the idea is and the vision behind it. Ask about how it works, what makes it different, and what inspired it. The goal is two substantial paragraphs of insight.' },
  { key: 'problem_what',  label: 'Problem — What',     instruction: 'Get specific about the problem being solved. Push past vague answers — ask for concrete examples, specific pain points, and what currently happens without this solution.' },
  { key: 'problem_who',   label: 'Problem — Who',      instruction: 'Identify exactly who is affected. Explore demographics, contexts, and specific groups. Help the user get precise rather than saying "everyone".' },
  { key: 'problem_scale', label: 'Problem — Scale',    instruction: 'Explore the significance and breadth of this problem. Share any relevant statistics or research you know about. Help the user articulate how widespread or impactful this problem truly is.' },
  { key: 'benefits',      label: 'Potential Benefits', instruction: 'Explore the positive outcomes this idea would create. Go beyond the obvious — think about second-order effects, who benefits most, and what change in the world this idea enables.' },
];

function buildSystemPrompt(challenge, stage) {
  const currentStage = STAGES[stage];
  const stageFocus = currentStage
    ? `\n\n**Current coaching focus**: Stage ${stage + 1} of ${STAGES.length} — "${currentStage.label}"
${currentStage.instruction}

Stay focused on this one topic until it is well covered. The user will tell you when they are ready to move on.`
    : `\n\n**All stages complete.** Give the user a warm, encouraging summary of their fully developed idea, highlighting its strengths.`;

  return `You are an expert idea coach with broad knowledge of business, technology, social trends, and research. You help people develop their ideas through a genuinely bi-directional conversation.${stageFocus}

Context:
- Challenge they are addressing: "${challenge.name}"
- Challenge description: "${challenge.challenge_description || 'Not specified'}"
- Focus area: "${challenge.focus_area_name}"

Your coaching style is focused and concise:
- Keep responses short — 1-3 sentences maximum before your question
- Ask one clear question at a time to draw out more detail
- If the user's answer is thin, gently probe (e.g. "Can you be more specific about X?")
- When the current topic feels sufficiently covered, ask if they're ready to move on
- Be polite and professional, but not effusive — no lengthy affirmations or preamble
- Do NOT use bullet points or numbered lists — keep it conversational
- **Opening message only**: One short sentence asking the user to share their idea. Nothing else.`;
}

const EXTRACT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    name:          { type: SchemaType.STRING, description: 'The idea name if mentioned' },
    description:   { type: SchemaType.STRING, description: 'A rich two-paragraph description of the idea. First paragraph: what the idea is and how it works. Second paragraph: the context, motivation, or vision behind it. Write in full sentences with detail.' },
    problem_what:  { type: SchemaType.STRING, description: 'What problem it solves' },
    problem_who:   { type: SchemaType.STRING, description: 'Who is affected by the problem' },
    problem_scale: { type: SchemaType.STRING, description: 'How significant/widespread the problem is' },
    benefits:      { type: SchemaType.STRING, description: 'Potential benefits of the idea' }
  },
  required: ['name', 'description', 'problem_what', 'problem_who', 'problem_scale', 'benefits']
};

// Convert stored conversation (role: user/assistant) to Gemini format (role: user/model)
function toGeminiHistory(messages) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
}

// POST /api/ideas/:id/coach
// Body: { message: string } (omit for auto-start on first message)
// Response: SSE stream of text tokens
router.post('/:id/coach', async (req, res) => {
  const idea = db.prepare(`
    SELECT i.*, c.name as challenge_name, c.description as challenge_description,
           fa.name as focus_area_name
    FROM ideas i
    JOIN challenges c ON c.id = i.challenge_id
    JOIN focus_areas fa ON fa.id = c.focus_area_id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  const MAX_MESSAGES = 100; // 50 back-and-forth exchanges
  const conversation = JSON.parse(idea.conversation || '[]');
  if (conversation.length >= MAX_MESSAGES) {
    return res.status(400).json({ error: 'Conversation limit reached. This idea has a very long coaching history — consider starting a new idea to continue exploring.' });
  }

  const { message, stage = 0 } = req.body;

  // Add user message if provided
  if (message?.trim()) {
    conversation.push({ role: 'user', content: message.trim() });
  }

  // For auto-start, seed with a silent opener so the coach greets first
  if (conversation.length === 0) {
    conversation.push({ role: 'user', content: "Hello, I'm ready to develop my idea." });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';

  try {
    const geminiHistory = toGeminiHistory(conversation);
    // Last entry is the message being sent now; the rest is chat history
    const lastMsg = geminiHistory[geminiHistory.length - 1];
    const history = geminiHistory.slice(0, -1);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      systemInstruction: buildSystemPrompt(idea, stage)
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(lastMsg.parts[0].text);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'token', text })}\n\n`);
      }
    }

    // Save updated conversation
    conversation.push({ role: 'assistant', content: fullResponse });
    db.prepare(`UPDATE ideas SET conversation = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(JSON.stringify(conversation), req.params.id);

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Coach stream error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    res.end();
  }
});

// POST /api/ideas/:id/extract
// Extracts structured idea fields from the conversation using JSON mode
router.post('/:id/extract', async (req, res) => {
  const idea = db.prepare('SELECT conversation FROM ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Not found' });

  const conversation = JSON.parse(idea.conversation || '[]');
  if (conversation.length === 0) return res.json({});

  const convoText = conversation
    .map(m => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n\n');

  try {
    const extractModel = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: EXTRACT_SCHEMA
      }
    });

    const result = await extractModel.generateContent(
      `Extract idea information from this coaching conversation. Return empty string "" for any fields not yet discussed.\n\nFor the description field: write two full paragraphs — the first explaining what the idea is and how it works, the second covering the context, motivation, or vision behind it. Use complete sentences and be detailed.\n\n${convoText}`
    );

    const extracted = JSON.parse(result.response.text());

    // Update idea fields — only overwrite with non-empty extracted values
    const existing = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
    const updates = {};
    const fields = ['name', 'description', 'problem_what', 'problem_who', 'problem_scale', 'benefits'];
    fields.forEach(f => {
      updates[f] = extracted[f]?.trim() || existing[f] || '';
    });

    db.prepare(`
      UPDATE ideas SET
        name = ?, description = ?, problem_what = ?, problem_who = ?,
        problem_scale = ?, benefits = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(updates.name, updates.description, updates.problem_what, updates.problem_who,
           updates.problem_scale, updates.benefits, req.params.id);

    res.json(updates);
  } catch (err) {
    console.error('Extract error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
