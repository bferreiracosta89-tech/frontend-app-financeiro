import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { useFinanceStore } from '../store/useStore';
import { getDb } from '../db/database';

const LAST_SYNC_KEY = 'crf_last_sync';
const AUTO_INTERVAL_MS = 5 * 60 * 1000;

type EntityMap = {
  key: string;
  table: string;
  fk?: Record<string, { table: string; column: string; out: string }>;
};

const ENTITIES: EntityMap[] = [
  { key: 'debts', table: 'debts' },
  { key: 'accounts', table: 'accounts' },
  { key: 'expenses', table: 'expenses', fk: { account_id: { table: 'accounts', column: 'server_id', out: 'accountId' }, card_purchase_id: { table: 'card_purchases', column: 'server_id', out: 'cardPurchaseId' } } },
  { key: 'cardPurchases', table: 'card_purchases', fk: { debt_id: { table: 'debts', column: 'server_id', out: 'debtId' } } },
  { key: 'negotiations', table: 'negotiations', fk: { debt_id: { table: 'debts', column: 'server_id', out: 'debtId' } } },
  { key: 'reminders', table: 'reminders', fk: { debt_id: { table: 'debts', column: 'server_id', out: 'debtId' } } },
  { key: 'payments', table: 'payments', fk: { debt_id: { table: 'debts', column: 'server_id', out: 'debtId' }, account_id: { table: 'accounts', column: 'server_id', out: 'accountId' } } },
  { key: 'agreements', table: 'agreements', fk: { debt_id: { table: 'debts', column: 'server_id', out: 'debtId' } } },
  { key: 'legalAgreements', table: 'legal_agreements', fk: { debt_id: { table: 'debts', column: 'server_id', out: 'debtId' } } },
  { key: 'paymentAlerts', table: 'payment_alerts', fk: { debt_id: { table: 'debts', column: 'server_id', out: 'debtId' } } },
  { key: 'taxReports', table: 'tax_reports' },
];

type ColumnMap = Record<string, string>;

const PULL_COLUMN_MAP: Record<string, ColumnMap> = {
  debts: {
    credor: 'credor',
    tipo: 'tipo',
    numeroContrato: 'numero_contrato',
    valorTotal: 'valor_total',
    total: 'total',
    parcela: 'parcela',
    taxaJuros: 'taxa_juros',
    qtdParcelas: 'qtd_parcelas',
    parcelasPagas: 'parcelas_pagas',
    vencimento: 'vencimento',
    status: 'status',
    prioridade: 'prioridade',
    garantia: 'garantia',
    observacao: 'observacao',
    statusAnterior: 'status_anterior',
    totalAnterior: 'total_anterior',
    valorTotalAnterior: 'valor_total_anterior',
    parcelaAnterior: 'parcela_anterior',
    qtdParcelasAnterior: 'qtd_parcelas_anterior',
    parcelasPagasAnterior: 'parcelas_pagas_anterior',
  },
  accounts: {
    nome: 'nome',
    tipo: 'tipo',
    saldo: 'saldo',
    limiteTotal: 'limite_total',
    limiteUsado: 'limite_usado',
    vencimentoFatura: 'vencimento_fatura',
    diaFechamento: 'dia_fechamento',
    diaVencimento: 'dia_vencimento',
    observacao: 'observacao',
  },
  expenses: {
    data: 'data',
    descricao: 'descricao',
    categoria: 'categoria',
    valor: 'valor',
    vencimento: 'vencimento',
    pago: 'pago',
    essencial: 'essencial',
    formaPagamento: 'forma_pagamento',
    parcelado: 'parcelado',
    qtdParcelas: 'qtd_parcelas',
    observacao: 'observacao',
  },
  cardPurchases: {
    descricao: 'descricao',
    estabelecimento: 'estabelecimento',
    dataCompra: 'data_compra',
    valorTotal: 'valor_total',
    qtdParcelas: 'qtd_parcelas',
    parcelasPagas: 'parcelas_pagas',
    valorParcela: 'valor_parcela',
    primeiraParcela: 'primeira_parcela',
    observacao: 'observacao',
  },
  negotiations: {
    credor: 'credor',
    valorOriginal: 'valor_original',
    valorAcordado: 'valor_acordado',
    qtdParcelas: 'qtd_parcelas',
    parcelasPagas: 'parcelas_pagas',
    data: 'data',
    canal: 'canal',
    resposta: 'resposta',
    proposta: 'proposta',
    novaParcela: 'nova_parcela',
    prazo: 'prazo',
    aceito: 'aceito',
    proximaAcao: 'proxima_acao',
  },
  reminders: {
    titulo: 'titulo',
    diaDoMes: 'dia_do_mes',
    ativo: 'ativo',
    notificationId: 'notification_id',
  },
  payments: {
    competencia: 'competencia',
    dataPagamento: 'data_pagamento',
    data: 'data',
    valorPago: 'valor_pago',
    valor: 'valor',
    tipo: 'tipo',
    amortizacaoModo: 'amortizacao_modo',
    juros: 'juros',
    desconto: 'desconto',
    status: 'status',
    observacao: 'observacao',
  },
  agreements: {
    debtCredor: 'debt_credor',
    credor: 'credor',
    tipo: 'tipo',
    status: 'status',
    data: 'data',
    dataAcordo: 'data_acordo',
    valorOriginal: 'valor_original',
    valorAcordado: 'valor_acordado',
    desconto: 'desconto',
    novaParcela: 'nova_parcela',
    prazo: 'prazo',
    qtdParcelas: 'qtd_parcelas',
    parcelasPagas: 'parcelas_pagas',
    primeiroVencimento: 'primeiro_vencimento',
    canal: 'canal',
    homologado: 'homologado',
    substituiDivida: 'substitui_divida',
    observacao: 'observacao',
  },
  legalAgreements: {
    debtIds: 'debt_ids',
    numeroProcesso: 'numero_processo',
    processo: 'processo',
    orgao: 'orgao',
    vara: 'vara',
    dataAudiencia: 'data_audiencia',
    dataHomologacao: 'data_homologacao',
    valorConsolidado: 'valor_consolidado',
    valorTotal: 'valor_total',
    parcelaJudicial: 'parcela_judicial',
    parcela: 'parcela',
    qtdParcelas: 'qtd_parcelas',
    parcelasPagas: 'parcelas_pagas',
    primeiroVencimento: 'primeiro_vencimento',
    credoresIncluidos: 'credores_incluidos',
    substituiDividas: 'substitui_dividas',
    prazo: 'prazo',
    status: 'status',
    observacao: 'observacao',
  },
  paymentAlerts: {
    competencia: 'competencia',
    status: 'status',
    mensagem: 'mensagem',
  },
  taxReports: {
    ano: 'ano',
    rendimentos: 'rendimentos',
    dividas: 'dividas',
    pagamentos: 'pagamentos',
    dividasDeclaraveis: 'dividas_declaraveis',
    pagamentosEfetuados: 'pagamentos_efetuados',
    jurosPagos: 'juros_pagos',
    descontosObtidos: 'descontos_obtidos',
    bancos: 'bancos',
    bens: 'bens',
    observacao: 'observacao',
    payload: 'payload',
  },
};

const RELATION_PULL_MAP: Record<string, Record<string, { table: string; column: string }>> = {
  expenses: {
    accountId: { table: 'accounts', column: 'account_id' },
    cardPurchaseId: { table: 'card_purchases', column: 'card_purchase_id' },
  },
  cardPurchases: { debtId: { table: 'debts', column: 'debt_id' } },
  negotiations: { debtId: { table: 'debts', column: 'debt_id' } },
  reminders: { debtId: { table: 'debts', column: 'debt_id' } },
  payments: {
    debtId: { table: 'debts', column: 'debt_id' },
    accountId: { table: 'accounts', column: 'account_id' },
  },
  agreements: { debtId: { table: 'debts', column: 'debt_id' } },
  legalAgreements: { debtId: { table: 'debts', column: 'debt_id' } },
  paymentAlerts: { debtId: { table: 'debts', column: 'debt_id' } },
};

async function getLastSync(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_SYNC_KEY);
}
async function setLastSync(iso: string) {
  await SecureStore.setItemAsync(LAST_SYNC_KEY, iso);
}
export async function getLastSyncDate(): Promise<string | null> {
  return getLastSync();
}

function localId(id: number | string | undefined): string {
  return `local-${id ?? ''}`;
}

function toIsoOrNull(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s ? s : null;
}

function boolToInt(v: any): number {
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true' ? 1 : 0;
}

async function fkServerId(table: string, local: any): Promise<string | null> {
  if (!local) return null;
  const db = await getDb();
  const row = (await db.getFirstAsync(`SELECT server_id FROM ${table} WHERE id=?`, [local])) as any;
  return row?.server_id || null;
}

async function localIdFromServer(table: string, serverId: any): Promise<number | null> {
  if (!serverId) return null;
  const db = await getDb();
  const row = (await db.getFirstAsync(`SELECT id FROM ${table} WHERE server_id=?`, [String(serverId)])) as any;
  return row?.id ?? null;
}

/**
 * Para sync, é obrigatório incluir registros excluídos também.
 * Antes o app filtrava deleted_at e por isso exclusões nunca chegavam ao backend/web.
 */
async function rows(table: string): Promise<any[]> {
  const db = await getDb();
  // Envia para o backend apenas o que realmente mudou localmente.
  // Antes o app enviava todas as linhas a cada sync; em negociações isso podia recriar
  // registros ou reaplicar efeitos de domínio indevidamente.
  return (await db.getAllAsync(
    `SELECT * FROM ${table} WHERE sync_status='PENDING' OR sync_status IS NULL OR sync_status=''`
  )) as any[];
}

async function buildEntityPush(entity: EntityMap): Promise<any[]> {
  const data = await rows(entity.table);
  const out: any[] = [];
  for (const row of data) {
    const item: any = {
      ...row,
      id: row.server_id || localId(row.id),
      localId: localId(row.id),
      serverId: row.server_id || undefined,
    };

    if (row.updatedAt || row.updated_at) item.updatedAt = row.updatedAt || row.updated_at;
    if ('deleted_at' in row) item.deletedAt = row.deleted_at || null;

    if (entity.fk) {
      for (const [localCol, conf] of Object.entries(entity.fk)) {
        const server = await fkServerId(conf.table, row[localCol]);
        item[conf.out] = server || (row[localCol] ? localId(row[localCol]) : null);
      }
    }

    if ('fonte_pagadora' in row) item.fontePagadora = row.fonte_pagadora;
    if ('data_recebimento' in row) item.dataRecebimento = row.data_recebimento;
    if ('data_protocolo' in row) item.dataProtocolo = row.data_protocolo;
    if ('data_audiencia' in row) item.dataAudiencia = row.data_audiencia;

    if ('data_pagamento' in row) item.dataPagamento = row.data_pagamento;
    if ('valor_pago' in row) item.valorPago = row.valor_pago;
    if ('numero_contrato' in row) item.numeroContrato = row.numero_contrato;
    if ('valor_total' in row) item.valorTotal = row.valor_total;
    if ('taxa_juros' in row) item.taxaJuros = row.taxa_juros;
    if ('qtd_parcelas' in row) item.qtdParcelas = row.qtd_parcelas;
    if ('parcelas_pagas' in row) item.parcelasPagas = row.parcelas_pagas;
    if ('status_anterior' in row) item.statusAnterior = row.status_anterior;
    if ('total_anterior' in row) item.totalAnterior = row.total_anterior;
    if ('valor_total_anterior' in row) item.valorTotalAnterior = row.valor_total_anterior;
    if ('parcela_anterior' in row) item.parcelaAnterior = row.parcela_anterior;
    if ('qtd_parcelas_anterior' in row) item.qtdParcelasAnterior = row.qtd_parcelas_anterior;
    if ('parcelas_pagas_anterior' in row) item.parcelasPagasAnterior = row.parcelas_pagas_anterior;
    if ('dia_do_mes' in row) item.diaDoMes = row.dia_do_mes;
    if ('notification_id' in row) item.notificationId = row.notification_id;
    if ('limite_total' in row) item.limiteTotal = row.limite_total;
    if ('limite_usado' in row) item.limiteUsado = row.limite_usado;
    if ('vencimento_fatura' in row) item.vencimentoFatura = row.vencimento_fatura;
    if ('dia_fechamento' in row) item.diaFechamento = row.dia_fechamento;
    if ('dia_vencimento' in row) item.diaVencimento = row.dia_vencimento;
    if ('forma_pagamento' in row) item.formaPagamento = row.forma_pagamento;
    if ('account_id' in row) item.accountId = row.account_id;
    if ('card_purchase_id' in row) item.cardPurchaseId = row.card_purchase_id;
    if ('data_compra' in row) item.dataCompra = row.data_compra;
    if ('valor_parcela' in row) item.valorParcela = row.valor_parcela;
    if ('primeira_parcela' in row) item.primeiraParcela = row.primeira_parcela;
    if ('valor_original' in row) item.valorOriginal = row.valor_original;
    if ('valor_acordado' in row) item.valorAcordado = row.valor_acordado;
    if ('nova_parcela' in row) item.novaParcela = row.nova_parcela;
    if ('proxima_acao' in row) item.proximaAcao = row.proxima_acao;
    if ('debt_credor' in row) item.debtCredor = row.debt_credor;
    if ('data_acordo' in row) item.dataAcordo = row.data_acordo;
    if ('primeiro_vencimento' in row) item.primeiroVencimento = row.primeiro_vencimento;
    if ('substitui_divida' in row) item.substituiDivida = row.substitui_divida;
    if ('debt_ids' in row) item.debtIds = row.debt_ids;
    if ('numero_processo' in row) item.numeroProcesso = row.numero_processo;
    if ('data_homologacao' in row) item.dataHomologacao = row.data_homologacao;
    if ('valor_consolidado' in row) item.valorConsolidado = row.valor_consolidado;
    if ('parcela_judicial' in row) item.parcelaJudicial = row.parcela_judicial;
    if ('credores_incluidos' in row) item.credoresIncluidos = row.credores_incluidos;
    if ('substitui_dividas' in row) item.substituiDividas = row.substitui_dividas;
    if ('dividas_declaraveis' in row) item.dividasDeclaraveis = row.dividas_declaraveis;
    if ('pagamentos_efetuados' in row) item.pagamentosEfetuados = row.pagamentos_efetuados;
    if ('juros_pagos' in row) item.jurosPagos = row.juros_pagos;
    if ('descontos_obtidos' in row) item.descontosObtidos = row.descontos_obtidos;

    out.push(item);
  }
  return out;
}

async function buildPush(): Promise<any> {
  const s = useFinanceStore.getState();
  const push: any = { income: s.income, minExist: s.minExist, legal: s.legal };
  for (const entity of ENTITIES) push[entity.key] = await buildEntityPush(entity);
  return push;
}

async function applySyncMap(syncMap: any[]) {
  if (!syncMap?.length) return;
  const db = await getDb();
  const byEntity: Record<string, string> = Object.fromEntries(ENTITIES.map((e) => [e.key, e.table]));
  for (const m of syncMap) {
    const table = byEntity[m.entity];
    const localNumericId = String(m.localId || '').replace('local-', '');
    if (!table || !localNumericId || !m.serverId) continue;
    await db.runAsync(`UPDATE ${table} SET server_id=?, sync_status='SYNCED' WHERE id=?`, [m.serverId, localNumericId]);
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_map (local_id, server_id, entity, updated_at) VALUES (?, ?, ?, ?)`,
      [m.localId, m.serverId, m.entity, new Date().toISOString()],
    );
  }
}

async function upsertSingleton(table: string, data: any, map: ColumnMap) {
  if (!data) return;
  const db = await getDb();
  const row: any = await db.getFirstAsync(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`);
  const payload: any = {};
  for (const [src, col] of Object.entries(map)) {
    if (src in data) payload[col] = data[src];
  }
  payload.server_id = data.id || data.serverId || '';
  payload.updatedAt = data.updatedAt || '';
  payload.updated_at = data.updatedAt || '';
  payload.sync_status = 'SYNCED';

  const cols = Object.keys(payload);
  if (row?.id) {
    await db.runAsync(
      `UPDATE ${table} SET ${cols.map((c) => `${c}=?`).join(', ')} WHERE id=?`,
      [...cols.map((c) => payload[c]), row.id],
    );
  } else {
    await db.runAsync(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map((c) => payload[c]),
    );
  }
}

async function upsertPlural(entity: EntityMap, item: any) {
  if (!item?.id) return;
  const db = await getDb();
  const serverId = String(item.id);
  let existing: any = await db.getFirstAsync(`SELECT id FROM ${entity.table} WHERE server_id=?`, [serverId]);
  if (!existing?.id) {
    const mapped: any = await db.getFirstAsync(
      `SELECT local_id FROM sync_map WHERE entity=? AND server_id=?`,
      [entity.key, serverId],
    );
    const localNumericId = String(mapped?.local_id || '').replace('local-', '');
    if (localNumericId) {
      const byLocal: any = await db.getFirstAsync(`SELECT id FROM ${entity.table} WHERE id=?`, [localNumericId]);
      if (byLocal?.id) existing = byLocal;
    }
  }

  const map = PULL_COLUMN_MAP[entity.key] || {};
  const payload: any = {
    server_id: serverId,
    sync_status: 'SYNCED',
    updatedAt: item.updatedAt || '',
    updated_at: item.updatedAt || '',
    deleted_at: toIsoOrNull(item.deletedAt),
  };

  for (const [src, col] of Object.entries(map)) {
    if (!(src in item)) continue;
    let value = item[src];
    if (['garantia', 'pago', 'essencial', 'parcelado', 'aceito', 'ativo', 'homologado', 'substituiDivida', 'substituiDividas'].includes(src)) {
      value = boolToInt(value);
    }
    payload[col] = value ?? '';
  }

  const rel = RELATION_PULL_MAP[entity.key] || {};
  for (const [src, conf] of Object.entries(rel)) {
    if (src in item) {
      payload[conf.column] = await localIdFromServer(conf.table, item[src]);
    }
  }

  const cols = Object.keys(payload);

  if (existing?.id) {
    await db.runAsync(
      `UPDATE ${entity.table} SET ${cols.map((c) => `${c}=?`).join(', ')} WHERE id=?`,
      [...cols.map((c) => payload[c]), existing.id],
    );
  } else {
    await db.runAsync(
      `INSERT INTO ${entity.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      cols.map((c) => payload[c]),
    );
  }
}

async function applyPullToLocal(pull: any) {
  if (!pull) return;

  await upsertSingleton('income', pull.income, {
    bruto: 'bruto',
    liquido: 'liquido',
    fontePagadora: 'fonte_pagadora',
    banco: 'banco',
    dataRecebimento: 'data_recebimento',
    observacao: 'observacao',
  });

  await upsertSingleton('min_existencial', pull.minExist, {
    alimentacao: 'alimentacao',
    transporte: 'transporte',
    agua: 'agua',
    energia: 'energia',
    internet: 'internet',
    saude: 'saude',
    outros: 'outros',
    reserva: 'reserva',
  });

  await upsertSingleton('legal_plan', pull.legal, {
    protocolado: 'protocolado',
    local: 'local',
    dataProtocolo: 'data_protocolo',
    numero: 'numero',
    dataAudiencia: 'data_audiencia',
    status: 'status',
    observacao: 'observacao',
  });

  // Ordem importa: dívidas/contas precisam existir antes de payments/acordos.
  const order = [
    'debts',
    'accounts',
    'cardPurchases',
    'expenses',
    'negotiations',
    'reminders',
    'payments',
    'agreements',
    'legalAgreements',
    'paymentAlerts',
    'taxReports',
  ];

  const byKey: Record<string, EntityMap> = Object.fromEntries(ENTITIES.map((e) => [e.key, e]));
  for (const key of order) {
    const entity = byKey[key];
    const items = pull[key];
    if (!entity || !Array.isArray(items)) continue;
    for (const item of items) await upsertPlural(entity, item);
  }
}

export async function syncNow(): Promise<void> {
  const since = await getLastSync();
  const push = await buildPush();
  const r = (await api.sync(since, push)) as { now: string; pull: any; syncMap?: any[] };
  await applySyncMap(r.syncMap || []);
  await applyPullToLocal(r.pull || {});
  await setLastSync(r.now);
  await useFinanceStore.getState().loadAll();
}

let autoTimer: ReturnType<typeof setInterval> | null = null;
export function startAutoSync() {
  if (autoTimer) return;
  syncNow().catch((e) => console.warn('sync inicial falhou', e?.message || e));
  autoTimer = setInterval(() => syncNow().catch(() => {}), AUTO_INTERVAL_MS);
}
export function stopAutoSync() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
}
