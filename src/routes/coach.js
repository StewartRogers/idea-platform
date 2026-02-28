const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const db = require('../database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function buildSystemPrompt(challenge) {
  return `You are an enthusiastic and supportive idea coach helping someone develop their idea.

Context:
- Challenge they are addressing: "${challenge.name}"
- Challenge description: "${challenge.challenge_description || 'Not specified'}"
- Focus area: "${challenge.focus_area_name}"

Your goal is to guide the user through developing their idea by capturing these key elements through natural conversation:
1. **Idea Name** - a concise, memorable name
2. **Description** - a clear explanation of the idea
3. **Problem - What** - what specific problem does this solve?
4. **Problem - Who** - who is affected by this problem?
5. **Problem - Scale** - how significant or widespread is this problem?
6. **Potential Benefits** - what positive outcomes would this idea create?

Guidelines:
- Be warm, encouraging, and curious
- Ask 1-2 focused questions at a time — don't overwhelm
- Build on what the user has shared, acknowledge their responses
- If an answer is vague, gently probe for more detail
- When you feel you have good information on a topic, naturally move to the next
- Keep responses concise (2-4 sentences max before your questions)
- Do NOT number your questions or use bullet points in the conversation — keep it conversational`;
}

const EXTRACT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    name:          { type: SchemaType.STRING, description: 'The idea name if mentioned' },
    description:   { type: SchemaType.STRING, description: 'What the idea is about' },
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

  const conversation = JSON.parse(idea.conversation || '[]');
  const { message } = req.body;

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
      model: 'gemini-2.0-flash',
      systemInstruction: buildSystemPrompt(idea)
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
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: EXTRACT_SCHEMA
      }
    });

    const result = await extractModel.generateContent(
      `Extract idea information from this coaching conversation. Return empty string "" for any fields not yet discussed.\n\n${convoText}`
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
