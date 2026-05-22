import { getDb } from "../db/database";
import { PaymentTipo } from "../store/usePayments";

export type PaymentType =
  | "PARCELA"
  | "AMORTIZACAO"
  | "LIQUIDACAO"
  | "PARCIAL"
  | "NAO_PAGO";

export interface Payment {
  id: number;
  server_id?: string;
  debt_id: number;
  competencia: string;
  data_pagamento: string;
  valor_pago: number;
  tipo: PaymentType;
  amortizacao_modo?: string;
  amortizacaoModo?: string;
  juros: number;
  desconto: number;
  observacao: string;
  updated_at?: string;
  updatedAt?: string;
  deleted_at?: string | null;
  sync_status?: string;
}

type DebtRow = {
  id: number;
  total?: number;
  valor_total?: number;
  parcela?: number;
  parcelas_pagas?: number;
  status?: string;
};

const nowIso = () => new Date().toISOString();

function normalizeMoney(value: any): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function getDebtTotal(d: DebtRow): number {
  const total = normalizeMoney(d.total);
  if (total > 0) return total;
  return normalizeMoney(d.valor_total);
}

/**
 * Cria pagamento e aplica o efeito financeiro na dívida local.
 * - PARCELA, PARCIAL e AMORTIZACAO reduzem saldo.
 * - LIQUIDACAO quita a dívida.
 * - NAO_PAGO apenas registra a competência sem abater saldo.
 */
export async function createPayment(
  input: Omit<
    Payment,
    "id" | "server_id" | "updated_at" | "updatedAt" | "deleted_at"
  >,
): Promise<number> {
  const db = await getDb();
  const now = nowIso();

  const res = await db.runAsync(
    `INSERT INTO payments (
      debt_id,
      competencia,
      data_pagamento,
      valor_pago,
      tipo,
      amortizacao_modo,
      juros,
      desconto,
      observacao,
      updated_at,
      updatedAt,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      input.debt_id,
      input.competencia,
      input.data_pagamento,
      normalizeMoney(input.valor_pago),
      input.tipo,
      input.amortizacao_modo || input.amortizacaoModo || "",
      normalizeMoney(input.juros),
      normalizeMoney(input.desconto),
      input.observacao || "",
      now,
      now,
    ],
  );

  await applyPaymentEffect(
    input.debt_id,
    input.tipo,
    normalizeMoney(input.valor_pago),
    1,
    input.competencia,
    input.amortizacao_modo || input.amortizacaoModo || "",
  );
  return Number(res.lastInsertRowId || 0);
}

/** Soft-delete e reverte o efeito financeiro do pagamento. */
export async function deletePayment(id: number): Promise<void> {
  const db = await getDb();
  const p = (await db.getFirstAsync(
    `SELECT * FROM payments WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
    [id],
  )) as Payment | null;

  if (!p) return;

  const now = nowIso();
  await db.runAsync(
    `UPDATE payments
     SET deleted_at = ?, updated_at = ?, updatedAt = ?, sync_status = 'PENDING'
     WHERE id = ?`,
    [now, now, now, id],
  );

  await applyPaymentEffect(
    Number(p.debt_id),
    p.tipo,
    normalizeMoney(p.valor_pago),
    -1,
    p.competencia,
    (p as any).amortizacao_modo || (p as any).amortizacaoModo || "",
  );
}

async function applyPaymentEffect(
  debtId: number,
  tipo: PaymentTipo,
  valorPago: number,
  delta: 1 | -1,
  competencia?: string,
  amortizacaoModo: string = "",
) {
  const db = await getDb();

  const debt: any = await db.getFirstAsync("SELECT * FROM debts WHERE id=?", [
    debtId,
  ]);

  if (!debt) return;

  const totalAtual = Number(debt.total || 0);
  const parcelasPagasAtual = Number(debt.parcelas_pagas || 0);
  const valor = Math.max(0, Number(valorPago || 0));

  let newTotal = totalAtual;
  let newParcelasPagas = parcelasPagasAtual;
  let newStatus = String(debt.status || "PAGAR");

  switch (tipo) {
    case "PARCELA":
    case "PARCIAL": {
      newTotal = Math.max(0, totalAtual - valor * delta);
      if (competencia && Number(debt.parcela || 0) > 0) {
        const rows = (await db.getAllAsync(
          `SELECT * FROM payments WHERE debt_id = ? AND competencia = ? AND tipo IN ('PARCELA','PARCIAL','LIQUIDACAO') AND (deleted_at IS NULL OR deleted_at = '')`,
          [debtId, competencia],
        )) as any[];
        const paidByOtherRecords = rows.reduce((a, p) => a + Number(p.valor_pago || p.valorPago || 0), 0);
        // No create, a linha já está na tabela; no delete, ela já saiu da consulta por deleted_at.
        // Por isso calculamos a transição pelo delta para decidir se a competência virou PAGO.
        const paidBefore = delta === 1 ? Math.max(0, paidByOtherRecords - valor) : paidByOtherRecords + valor;
        const paidAfter = delta === 1 ? paidByOtherRecords : paidByOtherRecords;
        const installment = Number(debt.parcela || 0);
        const wasPaid = paidBefore >= installment * 0.99;
        const isPaid = paidAfter >= installment * 0.99;
        if (!wasPaid && isPaid) newParcelasPagas += 1;
        if (wasPaid && !isPaid) newParcelasPagas -= 1;
      } else if (tipo === "PARCELA") {
        newParcelasPagas = Math.max(0, parcelasPagasAtual + delta);
      }
      break;
    }

    case "AMORTIZACAO": {
      newTotal = Math.max(0, totalAtual - valor * delta);
      const modo = String(amortizacaoModo || "").toUpperCase();
      const parcelaAtual = Number(debt.parcela || 0);
      const qtdAtual = Number(debt.qtd_parcelas || debt.qtdParcelas || 0);
      const restantes = Math.max(0, qtdAtual - newParcelasPagas);
      if (parcelaAtual > 0 && restantes > 0) {
        const now = new Date().toISOString();
        if (modo === "PROXIMAS") {
          const parcelasEquivalentes = Math.floor(valor / parcelaAtual);
          newParcelasPagas = Math.max(0, Math.min(qtdAtual, newParcelasPagas + parcelasEquivalentes * delta));
          await db.runAsync(
            `UPDATE debts SET total=?, valor_total=?, parcela=?, qtd_parcelas=?, parcelas_pagas=?, status=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?`,
            [newTotal, newTotal, parcelaAtual, qtdAtual, newParcelasPagas, newTotal <= 0 || newParcelasPagas >= qtdAtual ? "QUITADO" : newStatus, now, now, debtId],
          );
          return;
        }
        if (modo === "ULTIMAS") {
          const restantesDepois = Math.max(1, qtdAtual - newParcelasPagas);
          const novaParcela = Math.round((newTotal / restantesDepois) * 100) / 100;
          await db.runAsync(
            `UPDATE debts SET total=?, valor_total=?, parcela=?, qtd_parcelas=?, parcelas_pagas=?, status=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?`,
            [newTotal, newTotal, novaParcela, qtdAtual, newParcelasPagas, newTotal <= 0 ? "QUITADO" : newStatus, now, now, debtId],
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

  if (newTotal <= 0 && tipo !== "NAO_PAGO") {
    newTotal = 0;
    newStatus = "QUITADO";
  }
  if (Number(debt.qtd_parcelas || 0) > 0 && newParcelasPagas >= Number(debt.qtd_parcelas || 0)) {
    newStatus = "QUITADO";
  }

  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE debts
SET total = ?,
         valor_total = ?,
         parcelas_pagas = ?,
         status = ?,
         updatedAt = ?,
         updated_at = ?,
         sync_status = 'PENDING'
     WHERE id = ?`,
    [newTotal, newTotal, newParcelasPagas, newStatus, now, now, debtId],
  );
}

export async function listPayments(filter?: {
  debtId?: number;
  competencia?: string;
  ano?: string;
}): Promise<Payment[]> {
  const db = await getDb();
  let sql =
    "SELECT * FROM payments WHERE deleted_at IS NULL OR deleted_at = ''";
  const args: any[] = [];

  if (filter?.debtId) {
    sql += " AND debt_id = ?";
    args.push(filter.debtId);
  }

  if (filter?.competencia) {
    sql += " AND competencia = ?";
    args.push(filter.competencia);
  }

  if (filter?.ano) {
    sql += " AND competencia LIKE ?";
    args.push(`${filter.ano}-%`);
  }

  sql += " ORDER BY competencia DESC, data_pagamento DESC, id DESC";
  return (await db.getAllAsync(sql, args)) as Payment[];
}

export async function totalPagoNoMes(competencia: string): Promise<number> {
  const db = await getDb();
  const r = (await db.getFirstAsync(
    `SELECT COALESCE(SUM(valor_pago), 0) as total
     FROM payments
     WHERE competencia = ?
       AND tipo <> 'NAO_PAGO'
       AND (deleted_at IS NULL OR deleted_at = '')`,
    [competencia],
  )) as { total: number } | null;

  return normalizeMoney(r?.total);
}

export async function buildMatrix(ano: string): Promise<{
  months: string[];
  debts: any[];
  cells: Record<string, Payment[]>;
}> {
  const db = await getDb();
  const months = Array.from(
    { length: 12 },
    (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`,
  );

  const debts = await db.getAllAsync(`SELECT * FROM debts ORDER BY credor ASC`);
  const payments = await listPayments({ ano });
  const cells: Record<string, Payment[]> = {};

  for (const p of payments) {
    const key = `${p.debt_id}|${p.competencia}`;
    if (!cells[key]) cells[key] = [];
    cells[key].push(p);
  }

  return { months, debts, cells };
}
