import { create } from "zustand";
import { getDb } from "../db/database";

type Singleton = any;
type Plural = any[];

function intFrom(...values: any[]) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const n = parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}


function validateInstallments(label: string, total: number, parcela: number, qtdParcelas: number) {
  if (total > 0 && parcela > 0 && qtdParcelas > 0) {
    const calc = Math.round(parcela * qtdParcelas * 100) / 100;
    if (Math.abs(calc - total) > 0.05) {
      throw new Error(`${label}: valor da parcela x quantidade de parcelas precisa fechar o valor total. Total informado: ${total.toFixed(2)}; cálculo: ${calc.toFixed(2)}.`);
    }
  }
}
function resolveInstallment(total: number, parcela: number, qtdParcelas: number) {
  if (parcela > 0) return parcela;
  if (total > 0 && qtdParcelas > 0) return Math.round((total / qtdParcelas) * 100) / 100;
  return 0;
}

function statusByBalance(baseStatus: string, total: number, qtdParcelas: number, parcelasPagas: number) {
  if (total <= 0) return "QUITADO";
  if (qtdParcelas > 0 && parcelasPagas >= qtdParcelas) return "QUITADO";
  return baseStatus;
}

function normalizedDebtInput(d: any) {
  const total = Number(d.total ?? d.valor_total ?? d.valorTotal ?? 0);
  const valorTotal = Number(d.valor_total ?? d.valorTotal ?? d.total ?? 0);
  const qtdParcelas = Number(d.qtd_parcelas ?? d.qtdParcelas ?? 0);
  const parcelasPagas = Number(d.parcelas_pagas ?? d.parcelasPagas ?? 0);
  return {
    credor: d.credor || "",
    tipo: d.tipo || "Empréstimo",
    total,
    valor_total: valorTotal > 0 ? valorTotal : total,
    parcela: (() => { const p = resolveInstallment(total, Number(d.parcela || 0), qtdParcelas); validateInstallments("Dívida", total, p, qtdParcelas); return p; })(),
    vencimento: d.vencimento || "",
    status: statusByBalance(d.status || "PAGAR", total, qtdParcelas, parcelasPagas),
    prioridade: d.prioridade || "MEDIA",
    garantia: d.garantia ? 1 : 0,
    observacao: d.observacao || "",
    numero_contrato: d.numero_contrato || d.numeroContrato || "",
    taxa_juros: Number(d.taxa_juros || d.taxaJuros || 0),
    qtd_parcelas: qtdParcelas,
    parcelas_pagas: Math.max(0, parcelasPagas),
  };
}

async function softDeleteDebtChildrenLocal(db: any, debtId: any) {
  const ts = new Date().toISOString();
  for (const table of ["agreements", "negotiations", "reminders", "payment_alerts"]) {
    try {
      await db.runAsync(`UPDATE ${table} SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE debt_id=? AND (deleted_at IS NULL OR deleted_at='')`, [ts, ts, ts, debtId]);
    } catch {}
  }
}

async function captureDebtSnapshot(db: any, debtId: any) {
  const debt: any = await db.getFirstAsync(
    `SELECT * FROM debts WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
    [debtId],
  );
  if (!debt) return null;

  if (!debt.status_anterior) {
    await db.runAsync(
      `UPDATE debts
          SET status_anterior=?,
              total_anterior=?,
              valor_total_anterior=?,
              parcela_anterior=?,
              qtd_parcelas_anterior=?,
              parcelas_pagas_anterior=?
        WHERE id=?`,
      [
        debt.status || 'PAGAR',
        Number(debt.total || 0),
        Number(debt.valor_total || debt.total || 0),
        Number(debt.parcela || 0),
        Number(debt.qtd_parcelas || 0),
        Number(debt.parcelas_pagas || 0),
        debtId,
      ],
    );
    return {
      ...debt,
      status_anterior: debt.status || 'PAGAR',
      total_anterior: Number(debt.total || 0),
      valor_total_anterior: Number(debt.valor_total || debt.total || 0),
      parcela_anterior: Number(debt.parcela || 0),
      qtd_parcelas_anterior: Number(debt.qtd_parcelas || 0),
      parcelas_pagas_anterior: Number(debt.parcelas_pagas || 0),
    };
  }

  return debt;
}

async function restoreDebtSnapshot(db: any, debtId: any) {
  const debt: any = await db.getFirstAsync(
    `SELECT * FROM debts WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`,
    [debtId],
  );
  if (!debt) return;
  const ts = new Date().toISOString();

  await db.runAsync(
    `UPDATE debts
        SET status=COALESCE(NULLIF(status_anterior,''),'PAGAR'),
            total=COALESCE(total_anterior,total),
            valor_total=COALESCE(valor_total_anterior,valor_total,total),
            parcela=COALESCE(parcela_anterior,parcela),
            qtd_parcelas=COALESCE(qtd_parcelas_anterior,qtd_parcelas),
            parcelas_pagas=COALESCE(parcelas_pagas_anterior,parcelas_pagas),
            status_anterior=NULL,
            total_anterior=NULL,
            valor_total_anterior=NULL,
            parcela_anterior=NULL,
            qtd_parcelas_anterior=NULL,
            parcelas_pagas_anterior=NULL,
            updatedAt=?,
            updated_at=?,
            sync_status='PENDING'
      WHERE id=?`,
    [ts, ts, debtId],
  );
}

function round2Local(v: number) { return Math.round(v * 100) / 100; }

function assertNegotiationMath(n: any) {
  const accepted = !!(n?.aceito ?? n?.accepted);
  if (!accepted) return;
  const qtd = intFrom(n?.qtd_parcelas, n?.qtdParcelas, n?.prazo);
  const parcela = Number(n?.nova_parcela ?? n?.novaParcela ?? 0);
  const valor = Number(n?.valor_acordado ?? n?.valorAcordado ?? 0);
  if (qtd <= 0 || parcela <= 0) throw new Error('Informe quantidade de parcelas e nova parcela da negociação.');
  const calculado = round2Local(qtd * parcela);
  if (valor > 0 && Math.abs(valor - calculado) > 0.05) {
    throw new Error(`Negociação inválida: valor acordado (${valor.toFixed(2)}) precisa ser igual a parcelas x parcela (${calculado.toFixed(2)}).`);
  }
}

async function applyNegotiationToDebt(db: any, n: any) {
  assertNegotiationMath(n);
  const accepted = !!(n?.aceito ?? n?.accepted);
  const debtId = n?.debt_id ?? n?.debtId ?? null;
  if (!debtId) return;

  if (!accepted) {
    await restoreDebtSnapshot(db, debtId);
    return;
  }

  const debt: any = await captureDebtSnapshot(db, debtId);
  if (!debt) return;

  const novaParcela = Number(n?.nova_parcela ?? n?.novaParcela ?? 0);
  const valorAcordado = Number(n?.valor_acordado ?? n?.valorAcordado ?? n?.total_acordado ?? n?.totalAcordado ?? 0);
  const qtdParcelas = intFrom(n?.qtd_parcelas, n?.qtdParcelas, n?.prazo);
  const parcelasPagas = intFrom(n?.parcelas_pagas, n?.parcelasPagas, 0);
  const ts = new Date().toISOString();

  const novoTotal = valorAcordado > 0 ? valorAcordado : Number(debt.total || 0);
  const qtdFinal = qtdParcelas > 0 ? qtdParcelas : Number(debt.qtd_parcelas || 0);
  const novaParcelaFinal = resolveInstallment(novoTotal, novaParcela, qtdFinal) || Number(debt.parcela || 0);
  validateInstallments("Negociação", novoTotal, novaParcelaFinal, qtdFinal);
  const parcelasPagasFinal = Math.max(0, parcelasPagas);
  // Negociação aceita não deve quitar automaticamente a dívida. Só quita se o saldo for explicitamente zero.
  const statusFinal = novoTotal <= 0 ? 'QUITADO' : 'NEGOCIAR';

  await db.runAsync(
    `UPDATE debts
       SET total = ?,
           valor_total = ?,
           parcela = ?,
           qtd_parcelas = ?,
           parcelas_pagas = ?,
           status = ?,
           updatedAt = ?,
           updated_at = ?,
           sync_status = 'PENDING'
     WHERE id = ?`,
    [novoTotal, novoTotal, novaParcelaFinal, qtdFinal, parcelasPagasFinal, statusFinal, ts, ts, debtId],
  );
}

interface State {
  income: Singleton | null;
  minExist: Singleton | null;
  legal: Singleton | null;

  debts: Plural;
  cardPurchases: Plural;
  expenses: Plural;
  accounts: Plural;
  negotiations: Plural;
  reminders: Plural;
  payments: Plural;
  legalAgreements: Plural;

  loadAll: () => Promise<void>;

  addDebt: (d: any) => Promise<number>;
  updateDebt: (id: number, d: any) => Promise<void>;
  deleteDebt: (id: number) => Promise<void>;

  setIncome: (data: any) => Promise<void>;
  setMinExist: (data: any) => Promise<void>;
  setLegal: (data: any) => Promise<void>;

  saveIncome: (data: any) => Promise<void>;
  saveMinExist: (data: any) => Promise<void>;
  saveLegal: (data: any) => Promise<void>;

  addExpense: (e: any) => Promise<number>;
  updateExpense: (id: number, e: any) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;

  addAccount: (a: any) => Promise<number>;
  updateAccount: (id: number, a: any) => Promise<void>;
  deleteAccount: (id: number) => Promise<void>;

  addNegotiation: (n: any) => Promise<number>;
  updateNegotiation: (id: number, n: any) => Promise<void>;
  deleteNegotiation: (id: number) => Promise<void>;

  addCardPurchase: (c: any) => Promise<number>;
  updateCardPurchase: (id: number, c: any) => Promise<void>;
  deleteCardPurchase: (id: number) => Promise<void>;

  addReminder: (r: any) => Promise<number>;
  deleteReminder: (id: number) => Promise<void>;
}

export const useFinanceStore = create<State>((set, get) => ({
  income: null,
  minExist: null,
  legal: null,

  debts: [],
  cardPurchases: [],
  expenses: [],
  accounts: [],
  negotiations: [],
  reminders: [],
  payments: [],
  legalAgreements: [],

  loadAll: async () => {
    const db = await getDb();

    const [
      income,
      minExist,
      legal,
      debts,
      cardPurchases,
      expenses,
      accounts,
      negotiations,
      reminders,
      payments,
      legalAgreements,
    ] = await Promise.all([
      db.getFirstAsync("SELECT * FROM income ORDER BY id DESC LIMIT 1"),
      db.getFirstAsync(
        "SELECT * FROM min_existencial ORDER BY id DESC LIMIT 1",
      ),
      db.getFirstAsync("SELECT * FROM legal_plan ORDER BY id DESC LIMIT 1"),
      db.getAllAsync("SELECT * FROM debts WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY id DESC"),
      db.getAllAsync("SELECT * FROM card_purchases WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY id DESC"),
      db.getAllAsync("SELECT * FROM expenses WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY id DESC"),
      db.getAllAsync("SELECT * FROM accounts WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY id DESC"),
      db.getAllAsync("SELECT * FROM negotiations WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY id DESC"),
      db.getAllAsync("SELECT * FROM reminders WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY id DESC"),
      db.getAllAsync("SELECT * FROM payments WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY id DESC"),
      db.getAllAsync("SELECT * FROM legal_agreements WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY id DESC"),
    ]);

    set({
      income,
      minExist,
      legal,
      debts: debts as any[],
      cardPurchases: cardPurchases as any[],
      expenses: expenses as any[],
      accounts: accounts as any[],
      negotiations: negotiations as any[],
      reminders: reminders as any[],
      payments: payments as any[],
      legalAgreements: legalAgreements as any[],
    });
  },

  addDebt: async (d) => {
    const db = await getDb();
    const debt = normalizedDebtInput(d);
    const ts = new Date().toISOString();

    const r = await db.runAsync(
      `INSERT INTO debts (
        credor, tipo, total, parcela, vencimento, status, prioridade, garantia,
        observacao, numero_contrato, valor_total, taxa_juros, qtd_parcelas,
        parcelas_pagas, updatedAt, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        debt.credor, debt.tipo, debt.total, debt.parcela, debt.vencimento,
        debt.status, debt.prioridade, debt.garantia, debt.observacao,
        debt.numero_contrato, debt.valor_total, debt.taxa_juros,
        debt.qtd_parcelas, debt.parcelas_pagas, ts, ts,
      ],
    );

    await get().loadAll();
    return Number(r.lastInsertRowId || 0);
  },

  updateDebt: async (id, d) => {
    const db = await getDb();
    const debt = normalizedDebtInput(d);
    const ts = new Date().toISOString();

    await db.runAsync(
      `UPDATE debts SET
        credor=?, tipo=?, total=?, parcela=?, vencimento=?, status=?, prioridade=?, garantia=?,
        observacao=?, numero_contrato=?, valor_total=?, taxa_juros=?, qtd_parcelas=?, parcelas_pagas=?,
        updatedAt=?, updated_at=?, sync_status='PENDING'
      WHERE id=?`,
      [
        debt.credor, debt.tipo, debt.total, debt.parcela, debt.vencimento,
        debt.status, debt.prioridade, debt.garantia, debt.observacao,
        debt.numero_contrato, debt.valor_total, debt.taxa_juros,
        debt.qtd_parcelas, debt.parcelas_pagas, ts, ts, id,
      ],
    );

    await get().loadAll();
  },

  deleteDebt: async (id) => {
    const db = await getDb();
    const ts = new Date().toISOString();
    await db.runAsync(
      "UPDATE debts SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?",
      [ts, ts, ts, id],
    );
    await softDeleteDebtChildrenLocal(db, id);
    await get().loadAll();
  },

  setIncome: async (data) => {
    const db = await getDb();

    await db.runAsync(
      `UPDATE income SET
        bruto=?,
        liquido=?,
        fonte_pagadora=?,
        banco=?,
        data_recebimento=?,
        observacao=?
      WHERE id = (SELECT id FROM income ORDER BY id DESC LIMIT 1)`,
      [
        Number(data.bruto || 0),
        Number(data.liquido || 0),
        data.fonte_pagadora || data.fontePagadora || "",
        data.banco || "",
        data.data_recebimento || data.dataRecebimento || "",
        data.observacao || "",
      ],
    );

    await get().loadAll();
  },

  saveIncome: async (data) => {
    await get().setIncome(data);
  },

  setMinExist: async (data) => {
    const db = await getDb();

    await db.runAsync(
      `UPDATE min_existencial SET
        alimentacao=?,
        transporte=?,
        agua=?,
        energia=?,
        internet=?,
        saude=?,
        outros=?,
        reserva=?
      WHERE id = (SELECT id FROM min_existencial ORDER BY id DESC LIMIT 1)`,
      [
        Number(data.alimentacao || 0),
        Number(data.transporte || 0),
        Number(data.agua || 0),
        Number(data.energia || 0),
        Number(data.internet || 0),
        Number(data.saude || 0),
        Number(data.outros || 0),
        Number(data.reserva || 0),
      ],
    );

    await get().loadAll();
  },

  saveMinExist: async (data) => {
    await get().setMinExist(data);
  },

  setLegal: async (data) => {
    const db = await getDb();

    await db.runAsync(
      `UPDATE legal_plan SET
        protocolado=?,
        local=?,
        data_protocolo=?,
        numero=?,
        data_audiencia=?,
        status=?,
        observacao=?
      WHERE id = (SELECT id FROM legal_plan ORDER BY id DESC LIMIT 1)`,
      [
        data.protocolado ? 1 : 0,
        data.local || "",
        data.data_protocolo || data.dataProtocolo || "",
        data.numero || "",
        data.data_audiencia || data.dataAudiencia || "",
        data.status || "",
        data.observacao || "",
      ],
    );

    await get().loadAll();
  },

  saveLegal: async (data) => {
    await get().setLegal(data);
  },

  addExpense: async (e) => {
    const db = await getDb();

    const r = await db.runAsync(
      `INSERT INTO expenses (
        descricao, categoria, valor, vencimento, pago, essencial, observacao,
        data, forma_pagamento, account_id, parcelado, qtd_parcelas,
        card_purchase_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.descricao || "",
        e.categoria || "Outros",
        Number(e.valor || 0),
        e.vencimento || "",
        e.pago ? 1 : 0,
        e.essencial ? 1 : 0,
        e.observacao || "",
        e.data || "",
        e.forma_pagamento || e.formaPagamento || "Dinheiro",
        e.account_id || e.accountId || null,
        e.parcelado ? 1 : 0,
        Number(e.qtd_parcelas || e.qtdParcelas || 1),
        e.card_purchase_id || e.cardPurchaseId || null,
      ],
    );

    await get().loadAll();
    return Number(r.lastInsertRowId || 0);
  },

  updateExpense: async (id, e) => {
    const db = await getDb();

    await db.runAsync(
      `UPDATE expenses SET
        descricao=?,
        categoria=?,
        valor=?,
        vencimento=?,
        pago=?,
        essencial=?,
        observacao=?,
        data=?,
        forma_pagamento=?,
        account_id=?,
        parcelado=?,
        qtd_parcelas=?,
        card_purchase_id=?
      WHERE id=?`,
      [
        e.descricao || "",
        e.categoria || "Outros",
        Number(e.valor || 0),
        e.vencimento || "",
        e.pago ? 1 : 0,
        e.essencial ? 1 : 0,
        e.observacao || "",
        e.data || "",
        e.forma_pagamento || e.formaPagamento || "Dinheiro",
        e.account_id || e.accountId || null,
        e.parcelado ? 1 : 0,
        Number(e.qtd_parcelas || e.qtdParcelas || 1),
        e.card_purchase_id || e.cardPurchaseId || null,
        id,
      ],
    );

    await get().loadAll();
  },

  deleteExpense: async (id) => {
    const db = await getDb();
    const ts = new Date().toISOString();
    await db.runAsync(
      "UPDATE expenses SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?",
      [ts, ts, ts, id],
    );
    await get().loadAll();
  },

  addAccount: async (a) => {
    const db = await getDb();

    const r = await db.runAsync(
      `INSERT INTO accounts (
        nome, tipo, saldo, limite_total, limite_usado, vencimento_fatura,
        observacao, dia_fechamento, dia_vencimento
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.nome || "",
        a.tipo || "CONTA_CORRENTE",
        Number(a.saldo || 0),
        Number(a.limite_total || a.limiteTotal || 0),
        Number(a.limite_usado || a.limiteUsado || 0),
        a.vencimento_fatura || a.vencimentoFatura || "",
        a.observacao || "",
        Number(a.dia_fechamento || a.diaFechamento || 0),
        Number(a.dia_vencimento || a.diaVencimento || 0),
      ],
    );

    await get().loadAll();
    return Number(r.lastInsertRowId || 0);
  },

  updateAccount: async (id, a) => {
    const db = await getDb();

    await db.runAsync(
      `UPDATE accounts SET
        nome=?,
        tipo=?,
        saldo=?,
        limite_total=?,
        limite_usado=?,
        vencimento_fatura=?,
        observacao=?,
        dia_fechamento=?,
        dia_vencimento=?
      WHERE id=?`,
      [
        a.nome || "",
        a.tipo || "CONTA_CORRENTE",
        Number(a.saldo || 0),
        Number(a.limite_total || a.limiteTotal || 0),
        Number(a.limite_usado || a.limiteUsado || 0),
        a.vencimento_fatura || a.vencimentoFatura || "",
        a.observacao || "",
        Number(a.dia_fechamento || a.diaFechamento || 0),
        Number(a.dia_vencimento || a.diaVencimento || 0),
        id,
      ],
    );

    await get().loadAll();
  },

  deleteAccount: async (id) => {
    const db = await getDb();
    const ts = new Date().toISOString();
    await db.runAsync(
      "UPDATE accounts SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?",
      [ts, ts, ts, id],
    );
    await get().loadAll();
  },

  addNegotiation: async (n) => {
    const db = await getDb();
    assertNegotiationMath(n);
    const debtId = n.debt_id ?? n.debtId ?? null;
    const activeExisting: any = debtId
      ? await db.getFirstAsync(
          "SELECT id FROM negotiations WHERE debt_id=? AND (deleted_at IS NULL OR deleted_at='') AND sync_status='PENDING' ORDER BY id DESC LIMIT 1",
          [debtId],
        )
      : null;
    if (activeExisting?.id) {
      await get().updateNegotiation(activeExisting.id, n);
      return Number(activeExisting.id);
    }

    const r = await db.runAsync(
      `INSERT INTO negotiations (
        debt_id, credor, valor_original, valor_acordado, qtd_parcelas, parcelas_pagas,
        data, canal, resposta, proposta, nova_parcela, prazo, aceito, proxima_acao,
        updatedAt, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        n.debt_id ?? n.debtId ?? null,
        n.credor || "",
        Number(n.valor_original ?? n.valorOriginal ?? 0),
        Number(n.valor_acordado ?? n.valorAcordado ?? 0),
        Number(n.qtd_parcelas ?? n.qtdParcelas ?? 0),
        0,
        n.data || "",
        n.canal || "Telefone",
        n.resposta || "",
        n.proposta || "",
        Number(n.nova_parcela ?? n.novaParcela ?? 0),
        n.prazo || "",
        n.aceito ? 1 : 0,
        n.proxima_acao || n.proximaAcao || "",
        new Date().toISOString(),
        new Date().toISOString(),
      ],
    );

    await applyNegotiationToDebt(db, { ...n, id: r.lastInsertRowId });
    await get().loadAll();
    return Number(r.lastInsertRowId || 0);
  },

  updateNegotiation: async (id, n) => {
    const db = await getDb();
    assertNegotiationMath(n);
    const old: any = await db.getFirstAsync("SELECT * FROM negotiations WHERE id=?", [id]);
    const oldDebtId = old?.debt_id ?? old?.debtId ?? null;
    const newDebtId = n.debt_id ?? n.debtId ?? null;

    if (oldDebtId && String(oldDebtId) !== String(newDebtId || '')) {
      await restoreDebtSnapshot(db, oldDebtId);
    }

    await db.runAsync(
      `UPDATE negotiations SET
        debt_id=?,
        credor=?,
        valor_original=?,
        valor_acordado=?,
        qtd_parcelas=?,
        parcelas_pagas=0,
        data=?,
        canal=?,
        resposta=?,
        proposta=?,
        nova_parcela=?,
        prazo=?,
        aceito=?,
        proxima_acao=?,
        updatedAt=?,
        updated_at=?,
        sync_status='PENDING'
      WHERE id=?`,
      [
        n.debt_id ?? n.debtId ?? null,
        n.credor || "",
        Number(n.valor_original ?? n.valorOriginal ?? 0),
        Number(n.valor_acordado ?? n.valorAcordado ?? 0),
        Number(n.qtd_parcelas ?? n.qtdParcelas ?? 0),
        n.data || "",
        n.canal || "Telefone",
        n.resposta || "",
        n.proposta || "",
        Number(n.nova_parcela ?? n.novaParcela ?? 0),
        n.prazo || "",
        n.aceito ? 1 : 0,
        n.proxima_acao || n.proximaAcao || "",
        new Date().toISOString(),
        new Date().toISOString(),
        id,
      ],
    );

    await applyNegotiationToDebt(db, { ...n, id });
    await get().loadAll();
  },

  deleteNegotiation: async (id) => {
    const db = await getDb();
    const ts = new Date().toISOString();
    const existing: any = await db.getFirstAsync("SELECT * FROM negotiations WHERE id=?", [id]);
    await db.runAsync(
      "UPDATE negotiations SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?",
      [ts, ts, ts, id],
    );
    const debtId = existing?.debt_id ?? existing?.debtId ?? null;
    if (debtId) await restoreDebtSnapshot(db, debtId);
    await get().loadAll();
  },

  addCardPurchase: async (c) => {
    const db = await getDb();

    const r = await db.runAsync(
      `INSERT INTO card_purchases (
        debt_id, descricao, estabelecimento, data_compra, valor_total,
        qtd_parcelas, parcelas_pagas, valor_parcela, primeira_parcela,
        observacao
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.debt_id || c.debtId,
        c.descricao || "",
        c.estabelecimento || "",
        c.data_compra || c.dataCompra || "",
        Number(c.valor_total || c.valorTotal || 0),
        Number(c.qtd_parcelas || c.qtdParcelas || 1),
        Number(c.parcelas_pagas || c.parcelasPagas || 0),
        Number(c.valor_parcela || c.valorParcela || 0),
        c.primeira_parcela || c.primeiraParcela || "",
        c.observacao || "",
      ],
    );

    await get().loadAll();
    return Number(r.lastInsertRowId || 0);
  },

  updateCardPurchase: async (id, c) => {
    const db = await getDb();

    await db.runAsync(
      `UPDATE card_purchases SET
        debt_id=?,
        descricao=?,
        estabelecimento=?,
        data_compra=?,
        valor_total=?,
        qtd_parcelas=?,
        parcelas_pagas=?,
        valor_parcela=?,
        primeira_parcela=?,
        observacao=?
      WHERE id=?`,
      [
        c.debt_id || c.debtId,
        c.descricao || "",
        c.estabelecimento || "",
        c.data_compra || c.dataCompra || "",
        Number(c.valor_total || c.valorTotal || 0),
        Number(c.qtd_parcelas || c.qtdParcelas || 1),
        Number(c.parcelas_pagas || c.parcelasPagas || 0),
        Number(c.valor_parcela || c.valorParcela || 0),
        c.primeira_parcela || c.primeiraParcela || "",
        c.observacao || "",
        id,
      ],
    );

    await get().loadAll();
  },

  deleteCardPurchase: async (id) => {
    const db = await getDb();
    const ts = new Date().toISOString();
    await db.runAsync(
      "UPDATE card_purchases SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?",
      [ts, ts, ts, id],
    );
    await get().loadAll();
  },

  addReminder: async (r) => {
    const db = await getDb();

    const result = await db.runAsync(
      `INSERT INTO reminders (
        debt_id, titulo, dia_do_mes, ativo, notification_id
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        r.debt_id || r.debtId || null,
        r.titulo || "",
        Number(r.dia_do_mes || r.diaDoMes || 1),
        r.ativo ? 1 : 0,
        r.notification_id || r.notificationId || "",
      ],
    );

    await get().loadAll();
    return Number(result.lastInsertRowId || 0);
  },

  deleteReminder: async (id) => {
    const db = await getDb();
    const ts = new Date().toISOString();
    await db.runAsync(
      "UPDATE reminders SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?",
      [ts, ts, ts, id],
    );
    await get().loadAll();
  },
}));

export const currentCompetencia = (date = new Date()) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const n = (v: any) => Number(v || 0);
const norm = (v: any) =>
  String(v || "")
    .trim()
    .toUpperCase();
const isDeleted = (x: any) => !!(x?.deleted_at || x?.deletedAt);
const isActiveDebt = (d: any) =>
  !isDeleted(d) && !["QUITADO", "CANCELADO"].includes(norm(d.status));
const isPayableDebt = (d: any) =>
  isActiveDebt(d) && !["PAUSADO"].includes(norm(d.status));
const paymentDebtId = (p: any) => String(p.debt_id ?? p.debtId ?? "");
const paymentValue = (p: any) => n(p.valor_pago ?? p.valorPago);
const boolLike = (v: any) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';

export const useTotals = () => {
  return useFinanceStore((s) => {
    const competencia = currentCompetencia();
    const debts = (s.debts || []).filter((d: any) => !isDeleted(d));
    const payments = (s.payments || []).filter((p: any) => !isDeleted(p));

    const judicialAgreements = (s.legalAgreements || []).filter((a: any) =>
      !isDeleted(a) && boolLike(a.substitui_dividas ?? a.substituiDividas ?? true),
    );

    const payableDebts = debts.filter((d: any) => isPayableDebt(d) && norm(d.status) !== 'JUDICIAL');
    const judicialDebts = debts.filter((d: any) => isActiveDebt(d) && norm(d.status) === 'JUDICIAL');
    const pausedOrNegotiating = debts.filter((d: any) =>
      ["PAUSADO", "NEGOCIAR"].includes(norm(d.status)),
    );

    const totalDividas = payableDebts.reduce(
      (a: number, d: any) => a + n(d.total ?? d.valor_total ?? d.valorTotal),
      0,
    );

    const totalJudicial = judicialAgreements.reduce(
      (a: number, ag: any) => a + n(ag.parcela_judicial ?? ag.parcelaJudicial ?? ag.parcela),
      0,
    );

    const totalPrevistoMes =
      payableDebts.reduce((a: number, d: any) => a + n(d.parcela), 0) +
      totalJudicial;

    const payableIds = new Set(payableDebts.map((d: any) => String(d.id)));
    const monthPayments = payments
      .filter((p: any) => String(p.competencia || "") === competencia)
      .filter((p: any) => payableIds.has(paymentDebtId(p)));

    const totalPagoMes = payableDebts.reduce((acc: number, d: any) => {
      const paid = monthPayments
        .filter((p: any) => paymentDebtId(p) === String(d.id) && norm(p.tipo) !== "NAO_PAGO")
        .reduce((a: number, p: any) => a + paymentValue(p), 0);
      return acc + Math.min(n(d.parcela), paid);
    }, 0);

    const totalPendenteMes = payableDebts.reduce((acc: number, d: any) => {
      const paid = monthPayments
        .filter((p: any) => paymentDebtId(p) === String(d.id) && norm(p.tipo) !== "NAO_PAGO")
        .reduce((a: number, p: any) => a + paymentValue(p), 0);
      return acc + Math.max(0, n(d.parcela) - paid);
    }, 0) + totalJudicial;

    const naoPagasMesIds = new Set(
      monthPayments
        .filter((p: any) => norm(p.tipo) === "NAO_PAGO")
        .map(paymentDebtId),
    );

    const pagasOuRegistradasMesIds = new Set(monthPayments.map(paymentDebtId));

    const dividasSemRegistroMes = payableDebts.filter(
      (d: any) => !pagasOuRegistradasMesIds.has(String(d.id)),
    );

    const totalNaoPagoMes = payableDebts
      .filter((d: any) => naoPagasMesIds.has(String(d.id)))
      .reduce((a: number, d: any) => a + n(d.parcela), 0);

    const totalPausadas = pausedOrNegotiating.reduce(
      (a: number, d: any) => a + n(d.parcela),
      0,
    );

    const rendaLiquida = n(s.income?.liquido);

    const totalMinE =
      n(s.minExist?.alimentacao) +
      n(s.minExist?.transporte) +
      n(s.minExist?.agua) +
      n(s.minExist?.energia) +
      n(s.minExist?.internet) +
      n(s.minExist?.saude) +
      n(s.minExist?.outros) +
      n(s.minExist?.reserva);

    const totalGastos = (s.expenses || [])
      .filter((e: any) => {
        if (isDeleted(e)) return false;
        const data = String(e.data || e.vencimento || "");
        return data.startsWith(competencia);
      })
      .reduce((a: number, e: any) => {
        const valor = n(e.valor);
        const parcelado = Boolean(e.parcelado);
        const qtd = Math.max(1, n(e.qtd_parcelas ?? e.qtdParcelas));
        return a + (parcelado ? valor / qtd : valor);
      }, 0);

    const saldoMensal =
      rendaLiquida - totalMinE - totalGastos - totalPendenteMes;
    const compromet =
      rendaLiquida > 0 ? (totalPendenteMes / rendaLiquida) * 100 : 0;
    const totalNegociadas = debts
      .filter((d: any) =>
        ["NEGOCIAR", "NEGOCIADA", "ACORDADO"].includes(
          String(d.status || "").toUpperCase(),
        ),
      )
      .reduce((a: number, d: any) => a + Number(d.parcela || 0), 0);
    return {
      competencia,
      totalDividas,
      totalPrevistoMes,
      totalPagoMes,
      totalPendenteMes,
      totalNaoPagoMes,
      qtdNaoPagasMes: naoPagasMesIds.size,
      dividasSemRegistroMes,
      qtdSemRegistroMes: dividasSemRegistroMes.length,

      // Mantém os nomes antigos para o Dashboard atual funcionar sem quebrar.
      totalPagas: totalPrevistoMes,
      totalPausadas,
      totalNegociadas,
      totalJudicial,
      qtdJudicial: judicialDebts.length,
      totalGastos,
      rendaLiquida,
      totalMinE,
      saldoMensal,
      compromet,
      minExistencial: s.minExist,
      capacidade: saldoMensal,
    };
  });
};

export const useMonthExpenses = () => {
  return useFinanceStore((s) => {
    const competencia = currentCompetencia();

    const monthExpenses = (s.expenses || []).filter((e: any) => {
      if (isDeleted(e)) return false;
      const data = String(e.data || e.vencimento || "");
      return data.startsWith(competencia);
    });

    const expenseMonthValue = (e: any) => {
      const valor = n(e.valor);
      const parcelado = Boolean(e.parcelado);
      const qtd = Math.max(1, n(e.qtd_parcelas ?? e.qtdParcelas));
      return parcelado ? valor / qtd : valor;
    };

    const total = monthExpenses.reduce(
      (a: number, e: any) => a + expenseMonthValue(e),
      0,
    );

    const porCategoria = monthExpenses.reduce(
      (acc: Record<string, number>, e: any) => {
        const cat = e.categoria || "Outros";
        acc[cat] = (acc[cat] || 0) + expenseMonthValue(e);
        return acc;
      },
      {},
    );

    return {
      competencia,
      total,
      porCategoria,
    };
  });
};

export const useCreditAvailability = () => {
  return useFinanceStore((s) => {
    const expenses = (s.expenses || []).filter((e: any) => !isDeleted(e));
    const cardPurchases = (s.cardPurchases || []).filter(
      (c: any) => !isDeleted(c),
    );

    const detalhe = (s.accounts || [])
      .filter((acc: any) => !isDeleted(acc))
      .map((acc: any) => {
        const accountId = String(acc.id);
        const limiteTotal = n(acc.limite_total ?? acc.limiteTotal);
        const limiteManualUsado = n(acc.limite_usado ?? acc.limiteUsado);

        const gastosCredito = expenses
          .filter(
            (e: any) => String(e.account_id ?? e.accountId ?? "") === accountId,
          )
          .filter((e: any) =>
            norm(e.forma_pagamento ?? e.formaPagamento).includes("CRED"),
          )
          .reduce((a: number, e: any) => a + n(e.valor), 0);

        // Quando a compra de cartão não tiver account_id, ela ainda entra no uso geral do cartão se existir vínculo futuro.
        const comprasCartao = cardPurchases
          .filter((c: any) => {
            if (String(c.account_id ?? c.accountId ?? "") === accountId) return true;
            const debtId = String(c.debt_id ?? c.debtId ?? "");
            const debt = (s.debts || []).find((d: any) => String(d.id) === debtId || String(d.server_id ?? d.serverId ?? "") === debtId);
            return !!debt && String(debt.credor || "").trim() === String(acc.nome || "").trim();
          })
          .reduce((a: number, c: any) => {
            const valorParcela = n(c.valor_parcela ?? c.valorParcela);
            const qtd = n(c.qtd_parcelas ?? c.qtdParcelas);
            const pagas = n(c.parcelas_pagas ?? c.parcelasPagas);
            return a + (valorParcela > 0 ? valorParcela * Math.max(0, qtd - pagas) : n(c.valor_total ?? c.valorTotal));
          }, 0);

        const usado = limiteManualUsado + gastosCredito + comprasCartao;
        const disponivel = Math.max(0, limiteTotal - usado);

        return {
          ...acc,
          limiteTotal,
          usado,
          disponivel,
        };
      });

    const limiteGeral = detalhe.reduce(
      (a: number, x: any) => a + x.limiteTotal,
      0,
    );

    const usadoGeral = detalhe.reduce((a: number, x: any) => a + x.usado, 0);

    return {
      detalhe,
      total: limiteGeral,
      limiteGeral,
      usadoGeral,
      disponivel: Math.max(0, limiteGeral - usadoGeral),
      totalLimite: limiteGeral,
      totalUsado: usadoGeral,
      totalDisponivel: Math.max(0, limiteGeral - usadoGeral),
    };
  });
};
