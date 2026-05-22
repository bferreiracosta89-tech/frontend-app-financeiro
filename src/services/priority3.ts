import { getDb } from "../db/database";

export type Agreement = any;
export type LegalAgreement = any;
export type TaxReport = any;

const now = () => new Date().toISOString();
const num = (v: any) => Number(v || 0);
const intFrom = (...values: any[]) => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const n = parseInt(String(value).replace(/[^0-9-]/g, ""), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
};
const statusByBalance = (baseStatus: string, total: number, qtdParcelas: number, parcelasPagas: number) => {
  if (total <= 0) return "QUITADO";
  if (qtdParcelas > 0 && parcelasPagas >= qtdParcelas) return "QUITADO";
  return baseStatus;
};
const bool = (v: any) =>
  v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true";

function validateInstallmentMath(label: string, total: number, parcela: number, qtdParcelas: number) {
  if (total > 0 && parcela > 0 && qtdParcelas > 0) {
    const calc = Math.round(parcela * qtdParcelas * 100) / 100;
    if (Math.abs(calc - total) > 0.05) {
      throw new Error(`${label}: valor da parcela x quantidade de parcelas precisa fechar o valor total. Total informado: ${total.toFixed(2)}; cálculo: ${calc.toFixed(2)}.`);
    }
  }
}
function resolveParcela(total: number, parcela: number, qtdParcelas: number) {
  if (parcela > 0) return parcela;
  if (total > 0 && qtdParcelas > 0) return Math.round((total / qtdParcelas) * 100) / 100;
  return 0;
}


function parseDebtIds(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return Array.from(new Set(value.map(String).filter(Boolean)));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return Array.from(new Set(parsed.map(String).filter(Boolean)));
    } catch {}
    return Array.from(new Set(value.split(",").map((x) => x.trim()).filter(Boolean)));
  }
  return [String(value)].filter(Boolean);
}

async function captureDebtSnapshot(db: any, debtId: any) {
  const current: any = await db.getFirstAsync(
    `SELECT * FROM debts WHERE id=? AND (deleted_at IS NULL OR deleted_at='')`,
    [debtId],
  );
  if (!current) return null;
  if (!current.status_anterior) {
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
        current.status || "PAGAR",
        num(current.total),
        num(current.valor_total || current.total),
        num(current.parcela),
        num(current.qtd_parcelas),
        num(current.parcelas_pagas),
        debtId,
      ],
    );
    return {
      ...current,
      status_anterior: current.status || "PAGAR",
      total_anterior: num(current.total),
      valor_total_anterior: num(current.valor_total || current.total),
      parcela_anterior: num(current.parcela),
      qtd_parcelas_anterior: num(current.qtd_parcelas),
      parcelas_pagas_anterior: num(current.parcelas_pagas),
    };
  }
  return current;
}

async function restoreDebtSnapshot(db: any, debtId: any) {
  const current: any = await db.getFirstAsync(
    `SELECT * FROM debts WHERE id=? AND (deleted_at IS NULL OR deleted_at='')`,
    [debtId],
  );
  if (!current) return;
  const ts = now();
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

async function updateDebtByAgreement(db: any, a: any) {
  const debtId = a?.debt_id ?? a?.debtId ?? null;
  const substitui = bool(a?.substitui_divida ?? a?.substituiDivida ?? true);
  if (!debtId) return;

  if (!substitui) {
    await restoreDebtSnapshot(db, debtId);
    return;
  }

  const current: any = await captureDebtSnapshot(db, debtId);
  if (!current) return;

  const valorAcordado = num(a?.valor_acordado ?? a?.valorAcordado);
  const novaParcela = num(a?.nova_parcela ?? a?.novaParcela);
  const qtdParcelas = intFrom(a?.qtd_parcelas, a?.qtdParcelas, a?.prazo);
  const parcelasPagas = intFrom(a?.parcelas_pagas, a?.parcelasPagas, 0);
  const ts = now();

  const novoTotal = valorAcordado > 0 ? valorAcordado : num(current.total);
  const qtdFinal = qtdParcelas > 0 ? qtdParcelas : num(current.qtd_parcelas);
  const novaParcelaFinal = resolveParcela(novoTotal, novaParcela, qtdFinal) || num(current.parcela);
  validateInstallmentMath("Acordo", novoTotal, novaParcelaFinal, qtdFinal);
  const parcelasPagasFinal = Math.max(0, parcelasPagas);
  const statusText = String(a?.status || '').toUpperCase();
  const baseStatus = statusText === 'QUITADO' ? 'QUITADO' : bool(a?.homologado) || ['ACEITO','ATIVO'].includes(statusText) ? 'ACORDADO' : 'NEGOCIAR';
  const status = statusByBalance(baseStatus, novoTotal, qtdFinal, parcelasPagasFinal);

  await db.runAsync(
    `UPDATE debts
       SET total=?,
           valor_total=?,
           parcela=?,
           qtd_parcelas=?,
           parcelas_pagas=?,
           status=?,
           updatedAt=?,
           updated_at=?,
           sync_status='PENDING'
     WHERE id=?`,
    [novoTotal, novoTotal, novaParcelaFinal, qtdFinal, parcelasPagasFinal, status, ts, ts, debtId],
  );
}

async function updateDebtByLegalAgreement(db: any, a: any) {
  const debtIds = parseDebtIds(a?.debt_ids ?? a?.debtIds ?? a?.debt_id ?? a?.debtId ?? "");
  const substitui = bool(a?.substitui_dividas ?? a?.substituiDividas ?? true);
  if (!debtIds.length) return;

  if (!substitui) {
    for (const debtId of debtIds) await restoreDebtSnapshot(db, debtId);
    return;
  }

  const valorConsolidado = num(a?.valor_consolidado ?? a?.valorConsolidado ?? a?.valor_total ?? a?.valorTotal);
  const parcelaJudicial = num(a?.parcela_judicial ?? a?.parcelaJudicial ?? a?.parcela);
  const qtdParcelas = intFrom(a?.qtd_parcelas, a?.qtdParcelas, a?.prazo);
  const parcelasPagas = intFrom(a?.parcelas_pagas, a?.parcelasPagas, 0);
  const ts = now();

  const currents: any[] = [];
  for (const debtId of debtIds) {
    const current: any = await captureDebtSnapshot(db, debtId);
    if (current) currents.push(current);
  }
  if (!currents.length) return;

  const consolidatedTotal = valorConsolidado > 0 ? valorConsolidado : currents.reduce((acc, d) => acc + num(d.total), 0);
  const qtdFinal = qtdParcelas > 0 ? qtdParcelas : Math.max(...currents.map((d) => num(d.qtd_parcelas)), 0);
  const consolidatedParcela = resolveParcela(consolidatedTotal, parcelaJudicial, qtdFinal) || currents.reduce((acc, d) => acc + num(d.parcela), 0);
  validateInstallmentMath("Acordo judicial", consolidatedTotal, consolidatedParcela, qtdFinal);
  const parcelasPagasFinal = Math.max(0, parcelasPagas);

  for (let i = 0; i < currents.length; i++) {
    const current = currents[i];
    const isMaster = i === 0;
    const novoTotal = isMaster ? consolidatedTotal : 0;
    const novaParcelaFinal = isMaster ? consolidatedParcela : 0;
    const qtdFinalDebt = isMaster ? qtdFinal : 0;
    const parcelasDebt = isMaster ? parcelasPagasFinal : 0;
    const statusFinal = statusByBalance("JUDICIAL", novoTotal, qtdFinalDebt, parcelasDebt);

    await db.runAsync(
      `UPDATE debts
         SET total=?,
             valor_total=?,
             parcela=?,
             qtd_parcelas=?,
             parcelas_pagas=?,
             status=?,
             updatedAt=?,
             updated_at=?,
             sync_status='PENDING'
       WHERE id=?`,
      [novoTotal, novoTotal, novaParcelaFinal, qtdFinalDebt, parcelasDebt, statusFinal, ts, ts, current.id],
    );
  }
}

export async function listAgreements() {
  const db = await getDb();
  return (await db.getAllAsync(
    "SELECT * FROM agreements WHERE deleted_at IS NULL ORDER BY id DESC",
  )) as Agreement[];
}

export async function saveAgreement(a: any) {
  const db = await getDb();
  const payload = {
    ...a,
    debt_id: a.debt_id ?? a.debtId ?? null,
    debt_credor: a.debt_credor || a.debtCredor || a.credor || "",
    tipo: a.tipo || "EXTRAJUDICIAL",
    status: a.status || "SIMULACAO",
    data_acordo: a.data_acordo || a.dataAcordo || "",
    valor_original: num(a.valor_original ?? a.valorOriginal),
    valor_acordado: num(a.valor_acordado ?? a.valorAcordado),
    desconto: num(a.desconto),
    nova_parcela: num(a.nova_parcela ?? a.novaParcela),
    qtd_parcelas: num(a.qtd_parcelas ?? a.qtdParcelas),
    parcelas_pagas: 0,
    primeiro_vencimento: a.primeiro_vencimento || a.primeiroVencimento || "",
    canal: a.canal || "",
    homologado: bool(a.homologado) ? 1 : 0,
    substitui_divida: bool(a.substitui_divida ?? a.substituiDivida ?? true)
      ? 1
      : 0,
    observacao: a.observacao || "",
  };

  let id = a.id;
  const previousAgreement: any = id
    ? await db.getFirstAsync("SELECT * FROM agreements WHERE id=?", [id])
    : null;

  if (id) {
    await db.runAsync(
      `UPDATE agreements SET debt_id=?, debt_credor=?, tipo=?, status=?, data_acordo=?, valor_original=?, valor_acordado=?, desconto=?, nova_parcela=?, qtd_parcelas=?, parcelas_pagas=?, primeiro_vencimento=?, canal=?, homologado=?, substitui_divida=?, observacao=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?`,
      [
        payload.debt_id,
        payload.debt_credor,
        payload.tipo,
        payload.status,
        payload.data_acordo,
        payload.valor_original,
        payload.valor_acordado,
        payload.desconto,
        payload.nova_parcela,
        payload.qtd_parcelas,
        payload.parcelas_pagas,
        payload.primeiro_vencimento,
        payload.canal,
        payload.homologado,
        payload.substitui_divida,
        payload.observacao,
        now(),
        now(),
        id,
      ],
    );
  } else {
    const r = await db.runAsync(
      `INSERT INTO agreements (debt_id, debt_credor, tipo, status, data_acordo, valor_original, valor_acordado, desconto, nova_parcela, qtd_parcelas, parcelas_pagas, primeiro_vencimento, canal, homologado, substitui_divida, observacao, updatedAt, updated_at, sync_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING')`,
      [
        payload.debt_id,
        payload.debt_credor,
        payload.tipo,
        payload.status,
        payload.data_acordo,
        payload.valor_original,
        payload.valor_acordado,
        payload.desconto,
        payload.nova_parcela,
        payload.qtd_parcelas,
        payload.parcelas_pagas,
        payload.primeiro_vencimento,
        payload.canal,
        payload.homologado,
        payload.substitui_divida,
        payload.observacao,
        now(),
        now(),
      ],
    );
    id = Number(r.lastInsertRowId || 0);
  }

  const oldDebtId = previousAgreement?.debt_id ?? previousAgreement?.debtId ?? null;
  const newDebtId = payload.debt_id ?? null;
  if (oldDebtId && String(oldDebtId) !== String(newDebtId || "")) {
    await restoreDebtSnapshot(db, oldDebtId);
  }

  await updateDebtByAgreement(db, { ...payload, id });
  return id;
}

export async function listLegalAgreements() {
  const db = await getDb();
  return (await db.getAllAsync(
    "SELECT * FROM legal_agreements WHERE deleted_at IS NULL ORDER BY id DESC",
  )) as LegalAgreement[];
}

export async function saveLegalAgreement(a: any) {
  const db = await getDb();
  const payload = {
    ...a,
    debt_ids: a.debt_ids || a.debtIds || a.debt_id || a.debtId || "",
    debt_id: a.debt_id ?? a.debtId ?? null,
    numero_processo: a.numero_processo || a.numeroProcesso || "",
    orgao: a.orgao || "",
    vara: a.vara || "",
    data_audiencia: a.data_audiencia || a.dataAudiencia || "",
    data_homologacao: a.data_homologacao || a.dataHomologacao || "",
    status: a.status || "EM_ANDAMENTO",
    valor_consolidado: num(a.valor_consolidado ?? a.valorConsolidado),
    parcela_judicial: num(a.parcela_judicial ?? a.parcelaJudicial),
    qtd_parcelas: num(a.qtd_parcelas ?? a.qtdParcelas),
    parcelas_pagas: 0,
    primeiro_vencimento: a.primeiro_vencimento || a.primeiroVencimento || "",
    credores_incluidos: a.credores_incluidos || a.credoresIncluidos || "",
    substitui_dividas: bool(a.substitui_dividas ?? a.substituiDividas ?? true)
      ? 1
      : 0,
    observacao: a.observacao || "",
  };

  let id = a.id;
  const previousLegalAgreement: any = id
    ? await db.getFirstAsync("SELECT * FROM legal_agreements WHERE id=?", [id])
    : null;

  if (id) {
    await db.runAsync(
      `UPDATE legal_agreements SET debt_ids=?, debt_id=?, numero_processo=?, orgao=?, vara=?, data_audiencia=?, data_homologacao=?, status=?, valor_consolidado=?, parcela_judicial=?, qtd_parcelas=?, parcelas_pagas=?, primeiro_vencimento=?, credores_incluidos=?, substitui_dividas=?, observacao=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?`,
      [
        payload.debt_ids,
        payload.debt_id,
        payload.numero_processo,
        payload.orgao,
        payload.vara,
        payload.data_audiencia,
        payload.data_homologacao,
        payload.status,
        payload.valor_consolidado,
        payload.parcela_judicial,
        payload.qtd_parcelas,
        payload.parcelas_pagas,
        payload.primeiro_vencimento,
        payload.credores_incluidos,
        payload.substitui_dividas,
        payload.observacao,
        now(),
        now(),
        id,
      ],
    );
  } else {
    const r = await db.runAsync(
      `INSERT INTO legal_agreements (debt_ids, debt_id, numero_processo, orgao, vara, data_audiencia, data_homologacao, status, valor_consolidado, parcela_judicial, qtd_parcelas, parcelas_pagas, primeiro_vencimento, credores_incluidos, substitui_dividas, observacao, updatedAt, updated_at, sync_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING')`,
      [
        payload.debt_ids,
        payload.debt_id,
        payload.numero_processo,
        payload.orgao,
        payload.vara,
        payload.data_audiencia,
        payload.data_homologacao,
        payload.status,
        payload.valor_consolidado,
        payload.parcela_judicial,
        payload.qtd_parcelas,
        payload.parcelas_pagas,
        payload.primeiro_vencimento,
        payload.credores_incluidos,
        payload.substitui_dividas,
        payload.observacao,
        now(),
        now(),
      ],
    );
    id = Number(r.lastInsertRowId || 0);
  }

  const oldDebtIds = parseDebtIds(previousLegalAgreement?.debt_ids ?? previousLegalAgreement?.debtIds ?? previousLegalAgreement?.debt_id ?? previousLegalAgreement?.debtId ?? "");
  const newDebtIds = parseDebtIds(payload.debt_ids ?? payload.debt_id ?? "");
  for (const oldDebtId of oldDebtIds.filter((x) => !newDebtIds.includes(String(x)))) {
    await restoreDebtSnapshot(db, oldDebtId);
  }

  await updateDebtByLegalAgreement(db, { ...payload, id });
  return id;
}

export async function buildTaxReport(ano: number) {
  const db = await getDb();
  const income = (await db.getFirstAsync(
    "SELECT * FROM income ORDER BY id DESC LIMIT 1",
  )) as any;
  const debts = (await db.getAllAsync(
    "SELECT * FROM debts WHERE deleted_at IS NULL OR deleted_at = ''",
  )) as any[];
  const payments = (await db.getAllAsync(
    "SELECT * FROM payments WHERE (deleted_at IS NULL OR deleted_at = '') AND substr(COALESCE(data_pagamento,''),1,4)=?",
    [String(ano)],
  )) as any[];
  const agreements = (await db.getAllAsync(
    "SELECT * FROM agreements WHERE deleted_at IS NULL OR deleted_at = ''",
  )) as any[];
  const dividas = debts.reduce(
    (a, d) => a + Number(d.total || d.valor_total || 0),
    0,
  );
  const pagos = payments.reduce(
    (a, p) => a + Number(p.valor_pago || p.valor || 0),
    0,
  );
  const juros = payments.reduce((a, p) => a + Number(p.juros || 0), 0);
  const descontos = agreements.reduce(
    (a, ag) => a + Number(ag.desconto || 0),
    0,
  );
  return {
    ano,
    rendimentos: Number(income?.liquido || 0) * 12,
    dividas_declaraveis: dividas,
    pagamentos_efetuados: pagos,
    juros_pagos: juros,
    descontos_obtidos: descontos,
    bancos: debts
      .map((d) => d.credor)
      .filter(Boolean)
      .join(", "),
  };
}

export async function saveTaxReport(rp: any) {
  const db = await getDb();
  const norm = {
    ...rp,
    dividas_declaraveis: Number(rp.dividas_declaraveis ?? rp.dividasDeclaraveis ?? 0),
    pagamentos_efetuados: Number(rp.pagamentos_efetuados ?? rp.pagamentosEfetuados ?? 0),
    juros_pagos: Number(rp.juros_pagos ?? rp.jurosPagos ?? 0),
    descontos_obtidos: Number(rp.descontos_obtidos ?? rp.descontosObtidos ?? 0),
  };
  const existing = (await db.getFirstAsync(
    "SELECT * FROM tax_reports WHERE ano=? AND (deleted_at IS NULL OR deleted_at = '')",
    [Number(norm.ano)],
  )) as any;
  if (existing?.id) {
    await db.runAsync(
      `UPDATE tax_reports SET rendimentos=?, dividas_declaraveis=?, pagamentos_efetuados=?, juros_pagos=?, descontos_obtidos=?, bancos=?, observacao=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?`,
      [
        Number(norm.rendimentos || 0),
        Number(norm.dividas_declaraveis || 0),
        Number(norm.pagamentos_efetuados || 0),
        Number(norm.juros_pagos || 0),
        Number(norm.descontos_obtidos || 0),
        norm.bancos || "",
        norm.observacao || "",
        now(),
        now(),
        existing.id,
      ],
    );
    return existing.id;
  }
  const res = await db.runAsync(
    `INSERT INTO tax_reports (ano, rendimentos, dividas_declaraveis, pagamentos_efetuados, juros_pagos, descontos_obtidos, bancos, observacao, updatedAt, updated_at, sync_status) VALUES (?,?,?,?,?,?,?,?,?,?,'PENDING')`,
    [
      Number(norm.ano),
      Number(norm.rendimentos || 0),
      Number(norm.dividas_declaraveis || 0),
      Number(norm.pagamentos_efetuados || 0),
      Number(norm.juros_pagos || 0),
      Number(norm.descontos_obtidos || 0),
      norm.bancos || "",
      norm.observacao || "",
      now(),
      now(),
    ],
  );
  return Number(res.lastInsertRowId || 0);
}


export async function updateTaxReport(id: any, rp: any) {
  const db = await getDb();
  const norm = {
    ...rp,
    dividas_declaraveis: Number(rp.dividas_declaraveis ?? rp.dividasDeclaraveis ?? 0),
    pagamentos_efetuados: Number(rp.pagamentos_efetuados ?? rp.pagamentosEfetuados ?? 0),
    juros_pagos: Number(rp.juros_pagos ?? rp.jurosPagos ?? 0),
    descontos_obtidos: Number(rp.descontos_obtidos ?? rp.descontosObtidos ?? 0),
  };
  await db.runAsync(
    `UPDATE tax_reports SET ano=?, rendimentos=?, dividas_declaraveis=?, pagamentos_efetuados=?, juros_pagos=?, descontos_obtidos=?, bancos=?, observacao=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?`,
    [
      Number(norm.ano), Number(norm.rendimentos || 0), Number(norm.dividas_declaraveis || 0),
      Number(norm.pagamentos_efetuados || 0), Number(norm.juros_pagos || 0), Number(norm.descontos_obtidos || 0),
      norm.bancos || '', norm.observacao || '', now(), now(), id,
    ],
  );
}

export async function deleteTaxReport(id: any) {
  const db = await getDb();
  const ts = now();
  await db.runAsync("UPDATE tax_reports SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?", [ts, ts, ts, id]);
}

export async function listTaxReports() {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    "SELECT * FROM tax_reports WHERE deleted_at IS NULL OR deleted_at = '' ORDER BY ano DESC",
  )) as TaxReport[];
  return rows.map((r: any) => ({
    ...r,
    dividasDeclaraveis: r.dividasDeclaraveis ?? r.dividas_declaraveis,
    pagamentosEfetuados: r.pagamentosEfetuados ?? r.pagamentos_efetuados,
    jurosPagos: r.jurosPagos ?? r.juros_pagos,
    descontosObtidos: r.descontosObtidos ?? r.descontos_obtidos,
  }));
}

export async function deleteAgreement(id: number) {
  const db = await getDb();
  const agreement: any = await db.getFirstAsync(
    "SELECT * FROM agreements WHERE id = ?",
    [id],
  );

  if (!agreement) return;

  const debtId = agreement.debt_id ?? agreement.debtId ?? null;
  const ts = now();

  await db.runAsync(
    "UPDATE agreements SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?",
    [ts, ts, ts, id],
  );

  if (debtId) await restoreDebtSnapshot(db, debtId);
}

export async function deleteLegalAgreement(id: number) {
  const db = await getDb();
  const legal: any = await db.getFirstAsync(
    "SELECT * FROM legal_agreements WHERE id = ?",
    [id],
  );

  if (!legal) return;

  const debtIds = parseDebtIds(legal.debt_ids ?? legal.debtIds ?? legal.debt_id ?? legal.debtId ?? "");
  const ts = now();

  await db.runAsync(
    "UPDATE legal_agreements SET deleted_at=?, updatedAt=?, updated_at=?, sync_status='PENDING' WHERE id=?",
    [ts, ts, ts, id],
  );

  for (const debtId of debtIds) await restoreDebtSnapshot(db, debtId);
}
