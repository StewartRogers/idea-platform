const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const db = require('../database');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Keep key/label in sync with STAGES in public/app.js (~line 786) — no shared
// module boundary between server and the plain-<script> frontend in this stack.
const STAGES = [
  { key: 'problem_statement', label: 'Problem Statement', instruction: 'Help the user articulate a sharp problem statement: a specific target user, a specific pain they experience, and why it matters — the consequence of the problem going unsolved. Push past vague claims like "everyone has this problem" — ask for a concrete example or moment where the pain showed up. Ground your questions in what they already told you their idea is; don\'t make them re-explain the idea itself.' },
  { key: 'value_proposition', label: 'Value Proposition', instruction: 'Help the user build a value proposition in this shape: "For [target user] who has [problem], [idea] is a [category] that [key benefit], unlike [status quo / current alternative], it [differentiator]." Push them to name a real current alternative (even "doing nothing" or a spreadsheet counts) and a genuinely differentiating benefit, not a generic one.' },
  { key: 'hypothesis', label: 'Hypothesis', instruction: 'Help the user state a falsifiable hypothesis in this shape: "We believe [target user] will [specific behavior] because [reason]; we\'ll know it\'s true when [measurable signal]." Push for a concrete, observable signal (a number, an action, a rate) rather than a vague feeling of success.' },
];

// Infer which topic the coach should focus on next from which fields are
// already filled — server-owned since there's no more client "next" button
// driving stage progression.
function inferCurrentStage(idea) {
  for (let i = 0; i < STAGES.length; i++) {
    if (!idea[STAGES[i].key]?.trim()) return i;
  }
  return STAGES.length;
}

function buildSystemPrompt(idea, stage) {
  const currentStage = STAGES[stage];

  let stageFocus;
  if (!idea.description?.trim()) {
    stageFocus = `\n\n**This is the very first message.** Ask the user to describe their idea in their own words — what it is, roughly, and why they're excited about it. Keep it to one short, warm sentence. Do not ask about the problem statement, value proposition, or hypothesis yet.`;
  } else if (currentStage) {
    stageFocus = `\n\n**Current coaching focus**: Stage ${stage + 1} of ${STAGES.length} — "${currentStage.label}"
${currentStage.instruction}

Stay focused on this one topic until it is well covered. The user will tell you when they are ready to move on.`;
  } else {
    stageFocus = `\n\n**All three sections are developed.** Let the user know their idea is fully shaped and a pitch has been synthesized from their answers — invite them to keep refining any section if they'd like, or ask a warm wrap-up question.`;
  }

  return `You are an expert idea coach with broad knowledge of business, technology, social trends, and research. You help people develop their ideas through a genuinely bi-directional conversation.${stageFocus}

Context:
- Challenge they are addressing: "${idea.challenge_name}"
- Challenge description: "${idea.challenge_description || 'Not specified'}"
- Focus area: "${idea.focus_area_name}"
- The user's idea, in their own words so far: "${idea.description || '(not yet described — this is the opening message)'}"

Your coaching style is focused and concise:
- Keep responses short — 1-3 sentences maximum before your question
- Ask one clear question at a time to draw out more detail
- If the user's answer is thin, gently probe (e.g. "Can you be more specific about X?")
- When the current topic feels sufficiently covered, ask if they're ready to move on
- Be polite and professional, but not effusive — no lengthy affirmations or preamble
- Do NOT use bullet points or numbered lists — keep it conversational`;
}

const EXTRACT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    name:               { type: SchemaType.STRING, description: 'The idea name if mentioned' },
    description:        { type: SchemaType.STRING, description: 'A rich two-paragraph description of the idea, grounded in the user\'s own words from the opening exchange and any elaboration since. First paragraph: what the idea is and how it works. Second paragraph: the context, motivation, or vision behind it.' },
    problem_statement:  { type: SchemaType.STRING, description: 'The problem statement: target user, specific pain, and why it matters — following a target-user/pain/consequence shape.' },
    value_proposition:  { type: SchemaType.STRING, description: 'The value proposition in the shape: for [target user] who has [problem], [idea] is a [category] that [benefit], unlike [alternative], it [differentiator].' },
    hypothesis:         { type: SchemaType.STRING, description: 'The falsifiable hypothesis in the shape: we believe [user] will [behavior] because [reason]; we\'ll know it\'s true when [signal].' }
  },
  required: ['name', 'description', 'problem_statement', 'value_proposition', 'hypothesis']
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

  const { message } = req.body;
  const stage = inferCurrentStage(idea);

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
    const fields = ['name', 'description', 'problem_statement', 'value_proposition', 'hypothesis'];
    fields.forEach(f => {
      updates[f] = extracted[f]?.trim() || existing[f] || '';
    });

    db.prepare(`
      UPDATE ideas SET
        name = ?, description = ?, problem_statement = ?, value_proposition = ?,
        hypothesis = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(updates.name, updates.description, updates.problem_statement, updates.value_proposition,
           updates.hypothesis, req.params.id);

    res.json(updates);
  } catch (err) {
    console.error('Extract error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ideas/:id/pitch
// Synthesizes a tight, compelling pitch from name/description/problem_statement/
// value_proposition/hypothesis. This is a distinct generative call over already-
// extracted structured fields (not conversation extraction) — a pitch is rewritten,
// persuasive prose that's never said verbatim in the chat, so it needs its own
// call, and it's only meaningful once the three core fields are ready.
router.post('/:id/pitch', async (req, res) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Not found' });

  if (!idea.problem_statement?.trim() || !idea.value_proposition?.trim() || !idea.hypothesis?.trim()) {
    return res.json({ pitch: '' });
  }

  try {
    const pitchModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

    const result = await pitchModel.generateContent(
      `Write a compelling, tight elevator pitch (3-5 sentences, no bullet points, no markdown formatting, no headers, no preamble) for this idea, synthesizing the following into a cohesive, persuasive narrative:

Name: ${idea.name || '(untitled)'}
Description: ${idea.description}
Problem Statement: ${idea.problem_statement}
Value Proposition: ${idea.value_proposition}
Hypothesis: ${idea.hypothesis}

Return only the pitch text.`
    );

    const pitch = result.response.text().trim();

    db.prepare(`UPDATE ideas SET pitch = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(pitch, req.params.id);

    res.json({ pitch });
  } catch (err) {
    console.error('Pitch synthesis error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
