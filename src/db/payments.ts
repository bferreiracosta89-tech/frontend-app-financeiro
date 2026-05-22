import { getDb } from "./database";

export type PaymentTipo =
  | "PARCELA"
  | "AMORTIZACAO"
  | "LIQUIDACAO"
  | "PARCIAL"
  | "NAO_PAGO";

export interface Payment {
  id?: number;
  debtId: number;
  competencia: string;
  dataPagamento: string;
  valorPago: number;
  tipo: PaymentTipo;
  amortizacaoModo?: "PROXIMAS" | "ULTIMAS" | "";
  juros: number;
  desconto: number;
  observacao: string;
  createdAt?: string;
}

/** Cria/atualiza a tabela se não existir. */
export async function ensurePaymentsTable() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER DEFAULT NULL,
      account_id INTEGER DEFAULT NULL,
      competencia TEXT NOT NULL,
      data_pagamento TEXT DEFAULT '',
      data TEXT DEFAULT '',
      valor REAL DEFAULT 0,
      valor_pago REAL DEFAULT 0,
      tipo TEXT NOT NULL,
      amortizacao_modo TEXT DEFAULT '',
      juros REAL DEFAULT 0,
      desconto REAL DEFAULT 0,
      status TEXT DEFAULT 'PAGO',
      observacao TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pay_debt_comp ON payments(debt_id, competencia);
    CREATE INDEX IF NOT EXISTS idx_pay_comp ON payments(competencia);
  `);

  // Migração defensiva para bancos antigos.
  const cols = [
    ["account_id", "INTEGER DEFAULT NULL"],
    ["data", "TEXT DEFAULT ''"],
    ["valor", "REAL DEFAULT 0"],
    ["status", "TEXT DEFAULT 'PAGO'"],
    ["amortizacao_modo", "TEXT DEFAULT ''"],
    ["server_id", "TEXT DEFAULT ''"],
    ["sync_status", "TEXT DEFAULT 'PENDING'"],
    ["updatedAt", "TEXT DEFAULT ''"],
    ["updated_at", "TEXT DEFAULT ''"],
    ["deleted_at", "TEXT DEFAULT NULL"],
  ] as const;

  for (const [col, def] of cols) {
    try {
      const info = (await db.getAllAsync(`PRAGMA table_info(payments)`)) as any[];
      if (!info.some((r) => r.name === col)) {
        await db.execAsync(`ALTER TABLE payments ADD COLUMN ${col} ${def}`);
      }
    } catch {}
  }
}

const rowToPayment = (r: any): Payment => ({
  id: r.id,
  debtId: r.debt_id,
  competencia: r.competencia,
  dataPagamento: r.data_pagamento || "",
  valorPago: Number(r.valor_pago ?? r.valor ?? 0),
  tipo: r.tipo,
  amortizacaoModo: r.amortizacao_modo || "",
  juros: Number(r.juros || 0),
  desconto: Number(r.desconto || 0),
  observacao: r.observacao || "",
  createdAt: r.created_at,
});

async function applyEffect(
  debtId: number,
  tipo: PaymentTipo,
  valorPago: number,
  delta: 1 | -1,
  amortizacaoModo: string = "",
) {
  const db = await getDb();
  const debt: any = await db.getFirstAsync(
    "SELECT * FROM debts WHERE id=? AND (deleted_at IS NULL OR deleted_at = '')",
    [debtId],
  );
  if (!debt) return;

  const valor = Math.max(0, Number(valorPago || 0));
  const totalAtual = Number(debt.total || 0);
  const parcelasPagasAtual = Number(debt.parcelas_pagas || 0);

  let newTotal = totalAtual;
  let newParcelasPagas = parcelasPagasAtual;
  let newStatus = String(debt.status || "PAGAR");

  switch (tipo) {
    case "PARCELA":
      newTotal = Math.max(0, totalAtual - valor * delta);
      newParcelasPagas = Math.max(0, parcelasPagasAtual + delta);
      break;
    case "PARCIAL":
      newTotal = Math.max(0, totalAtual - valor * delta);
      break;
    case "AMORTIZACAO": {
      newTotal = Math.max(0, totalAtual - valor * delta);
      const modo = String(amortizacaoModo || "").toUpperCase();
      const parcelaAtual = Number(debt.parcela || 0);
      const qtdAtual = Number(debt.qtd_parcelas || 0);
      const restantes = Math.max(0, qtdAtual - newParcelasPagas);
      if (parcelaAtual > 0 && restantes > 0) {
        if (modo === "PROXIMAS") {
          const parcelasEquivalentes = Math.floor(valor / parcelaAtual);
          newParcelasPagas = Math.max(0, Math.min(qtdAtual, newParcelasPagas + parcelasEquivalentes * delta));
          await db.runAsync(
            `UPDATE debts SET total=?, valor_total=?, parcela=?, qtd_parcelas=?, parcelas_pagas=?, status=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?`,
            [newTotal, newTotal, parcelaAtual, qtdAtual, newParcelasPagas, newTotal <= 0 || newParcelasPagas >= qtdAtual ? "QUITADO" : newStatus, new Date().toISOString(), new Date().toISOString(), debtId],
          );
          return;
        }
        if (modo === "ULTIMAS") {
          const restantesDepois = Math.max(1, qtdAtual - newParcelasPagas);
          const novaParcela = Math.round((newTotal / restantesDepois) * 100) / 100;
          await db.runAsync(
            `UPDATE debts SET total=?, valor_total=?, parcela=?, qtd_parcelas=?, parcelas_pagas=?, status=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?`,
            [newTotal, newTotal, novaParcela, qtdAtual, newParcelasPagas, newTotal <= 0 ? "QUITADO" : newStatus, new Date().toISOString(), new Date().toISOString(), debtId],
          );
          return;
        }
      }
      break;
    }
    case "LIQUIDACAO":
      if (delta === 1) {
        newTotal = 0;
        newStatus = "QUITADO";
      } else {
        newTotal = totalAtual + valor;
        newStatus = "PAGAR";
      }
      break;
    case "NAO_PAGO":
      break;
  }

  if (newTotal <= 0 && tipo !== "NAO_PAGO") newStatus = "QUITADO";
  const qtdParcelas = Number(debt.qtd_parcelas || 0);
  if (qtdParcelas > 0 && newParcelasPagas >= qtdParcelas && tipo !== "NAO_PAGO") newStatus = "QUITADO";

  const ts = new Date().toISOString();
  await db.runAsync(
    `UPDATE debts
       SET total=?,
           valor_total=?,
           parcelas_pagas=?,
           status=?,
           updatedAt=?,
           updated_at=?,
           sync_status='PENDING'
     WHERE id=?`,
    [newTotal, newTotal, newParcelasPagas, newStatus, ts, ts, debtId],
  );
}

export async function addPayment(p: Payment): Promise<number> {
  await ensurePaymentsTable();
  const db = await getDb();
  const ts = new Date().toISOString();

  if (p.tipo !== "NAO_PAGO") {
    const naoPagoExistente: any = await db.getFirstAsync(
      `SELECT * FROM payments
       WHERE debt_id = ?
         AND competencia = ?
         AND tipo = 'NAO_PAGO'
         AND (deleted_at IS NULL OR deleted_at = '')`,
      [p.debtId, p.competencia],
    );

    if (naoPagoExistente?.id) {
      await db.runAsync(
        `UPDATE payments
            SET deleted_at=?,
                updatedAt=?,
                updated_at=?,
                sync_status='PENDING'
          WHERE id=?`,
        [ts, ts, ts, naoPagoExistente.id],
      );
    }
  }

  const r = await db.runAsync(
    `INSERT INTO payments (
       debt_id, competencia, data_pagamento, data, valor_pago, valor, tipo, amortizacao_modo,
       juros, desconto, status, observacao, updatedAt, updated_at, sync_status
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING')`,
    [
      p.debtId,
      p.competencia,
      p.dataPagamento || "",
      p.dataPagamento || "",
      Number(p.valorPago || 0),
      Number(p.valorPago || 0),
      p.tipo,
      p.amortizacaoModo || "",
      Number(p.juros || 0),
      Number(p.desconto || 0),
      p.tipo === "NAO_PAGO" ? "NAO_PAGO" : "PAGO",
      p.observacao || "",
      ts,
      ts,
    ],
  );

  await applyEffect(p.debtId, p.tipo, p.valorPago, 1, p.amortizacaoModo || "");
  return r.lastInsertRowId as number;
}

export async function deletePayment(id: number): Promise<void> {
  await ensurePaymentsTable();
  const db = await getDb();
  const existing: any = await db.getFirstAsync(
    "SELECT * FROM payments WHERE id=? AND (deleted_at IS NULL OR deleted_at = '')",
    [id],
  );
  if (!existing) return;

  const ts = new Date().toISOString();
  await db.runAsync(
    `UPDATE payments
        SET deleted_at=?,
            updatedAt=?,
            updated_at=?,
            sync_status='PENDING'
      WHERE id=?`,
    [ts, ts, ts, id],
  );

  await applyEffect(existing.debt_id, existing.tipo, existing.valor_pago, -1, existing.amortizacao_modo || "");
}

export async function listPaymentsByDebt(debtId: number): Promise<Payment[]> {
  await ensurePaymentsTable();
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM payments
      WHERE debt_id=?
        AND (deleted_at IS NULL OR deleted_at = '')
      ORDER BY competencia DESC, id DESC`,
    [debtId],
  );
  return rows.map(rowToPayment);
}

export async function listPaymentsByYear(ano: string): Promise<Payment[]> {
  await ensurePaymentsTable();
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM payments
      WHERE competencia LIKE ?
        AND (deleted_at IS NULL OR deleted_at = '')
      ORDER BY competencia ASC`,
    [`${ano}-%`],
  );
  return rows.map(rowToPayment);
}

export async function listAllPayments(): Promise<Payment[]> {
  await ensurePaymentsTable();
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM payments
      WHERE deleted_at IS NULL OR deleted_at = ''
      ORDER BY competencia DESC`,
  );
  return rows.map(rowToPayment);
}
