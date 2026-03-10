import fs from 'fs';
import path from 'path';
import { AuditEntry } from '../types';

const LOG_PATH = path.join(__dirname, '..', 'logs', 'audit.log');

export function writeAuditLog(entry: Omit<AuditEntry, 'timestamp'>): void {
  const record: AuditEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(record) + '\n';

  fs.appendFile(LOG_PATH, line, (err) => {
    if (err) console.error('[audit] Failed to write log entry:', err.message);
  });
}
