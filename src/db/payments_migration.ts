import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Migration idempotente: adiciona tabela `payments` ao SQLite.
 * Chame uma vez em initDatabase().
 */
export async function migratePayments(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS payments (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id       TEXT,
      debt_id         INTEGER NOT NULL,
      competencia     TEXT NOT NULL,
      data_pagamento  TEXT DEFAULT '',
      valor_pago      REAL NOT NULL DEFAULT 0,
      tipo            TEXT NOT NULL,
      juros           REAL DEFAULT 0,
      desconto        REAL DEFAULT 0,
      observacao      TEXT DEFAULT '',
      updated_at      TEXT DEFAULT (datetime('now')),
      deleted_at      TEXT,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_payments_debt_comp
      ON payments(debt_id, competencia);
    CREATE INDEX IF NOT EXISTS idx_payments_competencia
      ON payments(competencia);
  `);
  try { await db.execAsync("ALTER TABLE payments ADD COLUMN amortizacao_modo TEXT DEFAULT ''"); } catch {}
}
