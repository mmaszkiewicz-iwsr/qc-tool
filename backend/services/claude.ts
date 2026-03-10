import Anthropic from '@anthropic-ai/sdk';
import { ClaudeResponse, QueryResult } from '../types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

const INTERPRETATION_SYSTEM_PROMPT = `You are a quality control data analyst. You will be given:
1. The user's original question
2. The SQL query that was executed
3. The result set (as JSON rows)

Respond in plain English as if speaking to a non-technical QC manager:
- Highlight key numbers, trends, or anomalies
- If the result set is empty, say so clearly and suggest a likely reason why no data was returned
- Interpret the data — do not reproduce raw rows verbatim
- Keep your response concise (3–6 sentences)
- Do not include the SQL in your response`;

function buildSystemPrompt(schemaContext: string): string {
  return `You are a SQL Server query assistant for a quality control database.
The user is performing QC checks. The database schema is:

${schemaContext}

When the user asks a question:
1. Write a single, read-only SQL SELECT statement (T-SQL syntax) to answer it.
2. Return ONLY a JSON object in this exact shape — no markdown fences, no text outside the JSON:

{
  "sql": "SELECT ...",
  "summary": "One-sentence plain English description of what the check does.",
  "chartHint": "bar | line | scatter | histogram | none"
}

Rules:
- Only SELECT statements. Never use INSERT, UPDATE, DELETE, DROP, ALTER, EXEC, EXECUTE, TRUNCATE, CREATE, MERGE, or BULK.
- If the question cannot be answered with a safe SELECT query, return:
  { "sql": null, "summary": "Explanation of why the question cannot be answered.", "chartHint": "none" }
- Use T-SQL syntax. Use aliases for readability.
- If the question is ambiguous, make a reasonable assumption and reflect it in the summary.
- Do not wrap your response in markdown code fences. Return raw JSON only.`;
}

export async function generateQuery(
  question: string,
  schemaContext: string
): Promise<ClaudeResponse> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(schemaContext),
    messages: [{ role: 'user', content: question }],
  });

  const rawText = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  // Strip markdown fences if Claude included them despite instructions
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed: ClaudeResponse;
  try {
    parsed = JSON.parse(jsonText) as ClaudeResponse;
  } catch {
    throw new Error(`Claude returned non-JSON response: ${rawText.slice(0, 200)}`);
  }

  // Normalise chartHint to a known value
  const validHints = ['bar', 'line', 'scatter', 'histogram', 'none'] as const;
  if (!validHints.includes(parsed.chartHint)) {
    parsed.chartHint = 'none';
  }

  return parsed;
}

export async function interpretResults(
  question: string,
  sql: string,
  result: QueryResult
): Promise<string> {
  const payload = {
    question,
    sql,
    rowCount: result.rows.length,
    truncated: result.truncated,
    // Cap rows sent to Claude to avoid huge prompts
    rows: result.rows.slice(0, 50),
  };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: INTERPRETATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(payload) }],
  });

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  return text.trim();
}
