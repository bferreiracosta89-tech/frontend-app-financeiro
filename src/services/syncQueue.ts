import { getDb } from "../db/database";

export async function ensureSyncQueue() {
  const db = await getDb();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL,
      local_id TEXT,
      action TEXT NOT NULL,
      payload TEXT,
      status TEXT DEFAULT 'PENDING',
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_map (
      local_id TEXT PRIMARY KEY,
      server_id TEXT,
      entity TEXT,
      updated_at TEXT
    );
  `);
}

export async function enqueueSync(entity: string, localId: string | number | null, action: string, payload?: any) {
  const db = await getDb();
  await ensureSyncQueue();

  await db.runAsync(
    `INSERT INTO sync_queue (entity, local_id, action, payload, status, attempts, updated_at)
     VALUES (?, ?, ?, ?, 'PENDING', 0, datetime('now'))`,
    [entity, localId ? String(localId) : null, action, payload ? JSON.stringify(payload) : null],
  );
}

export async function listPendingSyncQueue() {
  const db = await getDb();
  await ensureSyncQueue();

  return (await db.getAllAsync(
    `SELECT * FROM sync_queue WHERE status IN ('PENDING','ERROR') ORDER BY id ASC LIMIT 100`,
  )) as any[];
}

export async function markQueueSynced(id: number) {
  const db = await getDb();
  await db.runAsync(`UPDATE sync_queue SET status='SYNCED', updated_at=datetime('now') WHERE id=?`, [id]);
}

export async function markQueueError(id: number, error: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sync_queue SET status='ERROR', attempts=attempts+1, last_error=?, updated_at=datetime('now') WHERE id=?`,
    [error, id],
  );
}

export async function applySyncMap(syncMap: Array<{ entity: string; localId: string; serverId: string }>) {
  const db = await getDb();
  await ensureSyncQueue();

  for (const m of syncMap || []) {
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_map (local_id, server_id, entity, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [String(m.localId), String(m.serverId), String(m.entity)],
    );
  }
}