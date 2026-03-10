import { Router, Request, Response } from 'express';
import { getSchemaContext } from '../services/schema';
import { generateQuery, interpretResults } from '../services/claude';
import { executeQuery } from '../services/database';
import { validateSql } from '../middleware/sqlGuard';
import { writeAuditLog } from '../services/audit';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { question } = req.body as { question?: string };

  if (!question?.trim()) {
    return res.status(400).json({ error: 'question is required.' });
  }

  const schemaContext = getSchemaContext();
  if (!schemaContext) {
    return res.status(503).json({ error: 'Schema not yet loaded. Please try again in a moment.' });
  }

  // Step 1: Ask Claude to generate SQL
  let claudeResponse;
  try {
    claudeResponse = await generateQuery(question, schemaContext);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[query] Claude error:', message);
    return res.status(500).json({ error: 'Failed to generate a query. Please try rephrasing your question.' });
  }

  // Step 2: Guard — reject unsafe SQL before touching the DB
  const guard = validateSql(claudeResponse.sql);
  if (!guard.valid) {
    console.warn('[query] SQL guard rejected:', guard.reason);
    return res.status(422).json({
      error: guard.reason,
      summary: claudeResponse.summary,
    });
  }

  // Step 3: Execute against SQL Server
  const startMs = Date.now();
  let result;
  try {
    result = await executeQuery(claudeResponse.sql!);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('ETIMEOUT') || message.includes('timeout')) {
      return res.status(504).json({ error: 'Query timed out. Try a more specific question.' });
    }
    console.error('[query] DB error:', message);
    return res.status(500).json({ error: 'Database error while executing query.' });
  }

  const durationMs = Date.now() - startMs;

  // Step 4: Second Claude call — interpret the results
  let interpretation = '';
  try {
    interpretation = await interpretResults(question, claudeResponse.sql!, result);
  } catch (err: unknown) {
    // Non-fatal — return data even if interpretation fails
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[query] Interpretation call failed:', message);
    interpretation = 'Results returned. Interpretation unavailable.';
  }

  // Step 5: Audit log (non-blocking)
  writeAuditLog({
    question,
    sql: claudeResponse.sql!,
    rowCount: result.rows.length,
    truncated: result.truncated,
    durationMs,
  });

  return res.json({
    summary: claudeResponse.summary,
    sql: claudeResponse.sql,
    columns: result.columns,
    rows: result.rows,
    truncated: result.truncated,
    chartHint: claudeResponse.chartHint,
    interpretation,
  });
});

export default router;
