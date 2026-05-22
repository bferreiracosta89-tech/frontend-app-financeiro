import * as SQLite from "expo-sqlite";

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbInstance) dbInstance = await SQLite.openDatabaseAsync("finance.db");
  return dbInstance;
};

async function columnExists(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = (await db.getAllAsync(`PRAGMA table_info(${table})`)) as any[];
  return rows.some((r) => r.name === column);
}

async function tableExists(
  db: SQLite.SQLiteDatabase,
  table: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [table],
  );
  return !!row?.name;
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  try {
    if (!(await tableExists(db, table))) return;

    if (!(await columnExists(db, table, column))) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (e) {
    console.warn(`migration ignored ${table}.${column}`, e);
  }
}

/**
 * Mantém compatibilidade entre código antigo e novo.
 * Algumas telas/services usam updatedAt; outras usam updated_at.
 * Por enquanto, criamos os dois para não quebrar o app durante estabilização.
 */
async function ensureCommonSyncColumns(
  db: SQLite.SQLiteDatabase,
  table: string,
): Promise<void> {
  await ensureColumn(db, table, "server_id", "TEXT DEFAULT ''");
  await ensureColumn(db, table, "sync_status", "TEXT DEFAULT 'PENDING'");
  await ensureColumn(db, table, "updatedAt", "TEXT DEFAULT ''");
  await ensureColumn(db, table, "updated_at", "TEXT DEFAULT ''");
  await ensureColumn(db, table, "deleted_at", "TEXT DEFAULT NULL");
}

export const initDatabase = async (): Promise<void> => {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sync_map (
      local_id TEXT PRIMARY KEY NOT NULL,
      server_id TEXT DEFAULT '',
      entity TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bruto REAL DEFAULT 0,
      liquido REAL DEFAULT 0,
      fonte_pagadora TEXT DEFAULT '',
      banco TEXT DEFAULT '',
      data_recebimento TEXT DEFAULT '',
      observacao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS min_existencial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alimentacao REAL DEFAULT 0,
      transporte REAL DEFAULT 0,
      agua REAL DEFAULT 0,
      energia REAL DEFAULT 0,
      internet REAL DEFAULT 0,
      saude REAL DEFAULT 0,
      outros REAL DEFAULT 0,
      reserva REAL DEFAULT 0,
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS legal_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      protocolado INTEGER DEFAULT 0,
      local TEXT DEFAULT 'Defensoria Pública',
      data_protocolo TEXT DEFAULT '',
      numero TEXT DEFAULT '',
      data_audiencia TEXT DEFAULT '',
      status TEXT DEFAULT '',
      observacao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credor TEXT NOT NULL,
      tipo TEXT DEFAULT '',
      numero_contrato TEXT DEFAULT '',
      valor_total REAL DEFAULT 0,
      total REAL DEFAULT 0,
      parcela REAL DEFAULT 0,
      taxa_juros REAL DEFAULT 0,
      qtd_parcelas INTEGER DEFAULT 0,
      parcelas_pagas INTEGER DEFAULT 0,
      vencimento TEXT DEFAULT '',
      status TEXT DEFAULT 'PAGAR',
      prioridade TEXT DEFAULT 'MEDIA',
      garantia INTEGER DEFAULT 0,
      observacao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL,
      status_anterior TEXT DEFAULT NULL,
      total_anterior REAL DEFAULT NULL,
      valor_total_anterior REAL DEFAULT NULL,
      parcela_anterior REAL DEFAULT NULL,
      qtd_parcelas_anterior INTEGER DEFAULT NULL,
      parcelas_pagas_anterior INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      tipo TEXT DEFAULT 'CONTA_CORRENTE',
      saldo REAL DEFAULT 0,
      limite_total REAL DEFAULT 0,
      limite_usado REAL DEFAULT 0,
      vencimento_fatura TEXT DEFAULT '',
      dia_fechamento INTEGER DEFAULT 0,
      dia_vencimento INTEGER DEFAULT 0,
      observacao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT DEFAULT '',
      descricao TEXT NOT NULL,
      categoria TEXT DEFAULT 'Outros',
      valor REAL DEFAULT 0,
      vencimento TEXT DEFAULT '',
      pago INTEGER DEFAULT 0,
      essencial INTEGER DEFAULT 0,
      forma_pagamento TEXT DEFAULT 'Dinheiro',
      account_id INTEGER DEFAULT NULL,
      parcelado INTEGER DEFAULT 0,
      qtd_parcelas INTEGER DEFAULT 1,
      card_purchase_id INTEGER DEFAULT NULL,
      observacao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS card_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER DEFAULT NULL,
      descricao TEXT DEFAULT '',
      estabelecimento TEXT DEFAULT '',
      data_compra TEXT DEFAULT '',
      valor_total REAL DEFAULT 0,
      qtd_parcelas INTEGER DEFAULT 1,
      parcelas_pagas INTEGER DEFAULT 0,
      valor_parcela REAL DEFAULT 0,
      primeira_parcela TEXT DEFAULT '',
      observacao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS negotiations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER DEFAULT NULL,
      credor TEXT NOT NULL,
      valor_original REAL DEFAULT 0,
      valor_acordado REAL DEFAULT 0,
      qtd_parcelas INTEGER DEFAULT 0,
      parcelas_pagas INTEGER DEFAULT 0,
      data TEXT DEFAULT '',
      canal TEXT DEFAULT 'Telefone',
      resposta TEXT DEFAULT '',
      proposta TEXT DEFAULT '',
      nova_parcela REAL DEFAULT 0,
      prazo TEXT DEFAULT '',
      aceito INTEGER DEFAULT 0,
      proxima_acao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER DEFAULT NULL,
      titulo TEXT DEFAULT '',
      dia_do_mes INTEGER DEFAULT 1,
      ativo INTEGER DEFAULT 1,
      notification_id TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER DEFAULT NULL,
      account_id INTEGER DEFAULT NULL,
      competencia TEXT DEFAULT '',
      data_pagamento TEXT DEFAULT '',
      data TEXT DEFAULT '',
      valor REAL DEFAULT 0,
      valor_pago REAL DEFAULT 0,
      tipo TEXT DEFAULT 'PARCELA',
      amortizacao_modo TEXT DEFAULT '',
      juros REAL DEFAULT 0,
      desconto REAL DEFAULT 0,
      status TEXT DEFAULT 'PAGO',
      observacao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE SET NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER DEFAULT NULL,
      debt_credor TEXT DEFAULT '',
      credor TEXT DEFAULT '',
      tipo TEXT DEFAULT 'EXTRAJUDICIAL',
      status TEXT DEFAULT 'SIMULACAO',
      data TEXT DEFAULT '',
      data_acordo TEXT DEFAULT '',
      valor_original REAL DEFAULT 0,
      valor_acordado REAL DEFAULT 0,
      desconto REAL DEFAULT 0,
      nova_parcela REAL DEFAULT 0,
      prazo TEXT DEFAULT '',
      qtd_parcelas INTEGER DEFAULT 0,
      parcelas_pagas INTEGER DEFAULT 0,
      primeiro_vencimento TEXT DEFAULT '',
      canal TEXT DEFAULT '',
      homologado INTEGER DEFAULT 0,
      substitui_divida INTEGER DEFAULT 0,
      observacao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS legal_agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_ids TEXT DEFAULT '',
      debt_id INTEGER DEFAULT NULL,
      numero_processo TEXT DEFAULT '',
      processo TEXT DEFAULT '',
      orgao TEXT DEFAULT '',
      vara TEXT DEFAULT '',
      data_audiencia TEXT DEFAULT '',
      data_homologacao TEXT DEFAULT '',
      valor_consolidado REAL DEFAULT 0,
      valor_total REAL DEFAULT 0,
      parcela_judicial REAL DEFAULT 0,
      parcela REAL DEFAULT 0,
      qtd_parcelas INTEGER DEFAULT 0,
      parcelas_pagas INTEGER DEFAULT 0,
      primeiro_vencimento TEXT DEFAULT '',
      credores_incluidos TEXT DEFAULT '',
      substitui_dividas INTEGER DEFAULT 0,
      prazo TEXT DEFAULT '',
      status TEXT DEFAULT 'EM_ANDAMENTO',
      observacao TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS tax_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ano INTEGER DEFAULT 0,
      rendimentos REAL DEFAULT 0,
      dividas REAL DEFAULT 0,
      pagamentos REAL DEFAULT 0,
      dividas_declaraveis REAL DEFAULT 0,
      pagamentos_efetuados REAL DEFAULT 0,
      juros_pagos REAL DEFAULT 0,
      descontos_obtidos REAL DEFAULT 0,
      bancos TEXT DEFAULT '',
      bens TEXT DEFAULT '',
      observacao TEXT DEFAULT '',
      payload TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER DEFAULT NULL,
      competencia TEXT DEFAULT '',
      status TEXT DEFAULT 'PENDENTE',
      mensagem TEXT DEFAULT '',
      server_id TEXT DEFAULT '',
      sync_status TEXT DEFAULT 'PENDING',
      updatedAt TEXT DEFAULT '',
      updated_at TEXT DEFAULT '',
      deleted_at TEXT DEFAULT NULL,
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE SET NULL
    );
  `);

  const tables = [
    "income",
    "min_existencial",
    "legal_plan",
    "debts",
    "accounts",
    "expenses",
    "card_purchases",
    "negotiations",
    "reminders",
    "payments",
    "agreements",
    "legal_agreements",
    "tax_reports",
    "payment_alerts",
  ];

  for (const table of tables) await ensureCommonSyncColumns(db, table);

  await runDefensiveMigrations(db);
  await seedInitialData(db);
};

async function runDefensiveMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  // debts
  await ensureColumn(db, "debts", "numero_contrato", "TEXT DEFAULT ''");
  await ensureColumn(db, "debts", "valor_total", "REAL DEFAULT 0");
  await ensureColumn(db, "debts", "total", "REAL DEFAULT 0");
  await ensureColumn(db, "debts", "parcela", "REAL DEFAULT 0");
  await ensureColumn(db, "debts", "taxa_juros", "REAL DEFAULT 0");
  await ensureColumn(db, "debts", "qtd_parcelas", "INTEGER DEFAULT 0");
  await ensureColumn(db, "debts", "parcelas_pagas", "INTEGER DEFAULT 0");
  await ensureColumn(db, "debts", "status_anterior", "TEXT DEFAULT NULL");
  await ensureColumn(db, "debts", "total_anterior", "REAL DEFAULT NULL");
  await ensureColumn(db, "debts", "valor_total_anterior", "REAL DEFAULT NULL");
  await ensureColumn(db, "debts", "parcela_anterior", "REAL DEFAULT NULL");
  await ensureColumn(db, "debts", "qtd_parcelas_anterior", "INTEGER DEFAULT NULL");
  await ensureColumn(db, "debts", "parcelas_pagas_anterior", "INTEGER DEFAULT NULL");

  // accounts
  await ensureColumn(db, "accounts", "saldo", "REAL DEFAULT 0");
  await ensureColumn(db, "accounts", "limite_total", "REAL DEFAULT 0");
  await ensureColumn(db, "accounts", "limite_usado", "REAL DEFAULT 0");
  await ensureColumn(db, "accounts", "vencimento_fatura", "TEXT DEFAULT ''");
  await ensureColumn(db, "accounts", "dia_fechamento", "INTEGER DEFAULT 0");
  await ensureColumn(db, "accounts", "dia_vencimento", "INTEGER DEFAULT 0");
  await ensureColumn(db, "accounts", "observacao", "TEXT DEFAULT ''");

  // expenses
  await ensureColumn(db, "expenses", "data", "TEXT DEFAULT ''");
  await ensureColumn(db, "expenses", "vencimento", "TEXT DEFAULT ''");
  await ensureColumn(db, "expenses", "pago", "INTEGER DEFAULT 0");
  await ensureColumn(db, "expenses", "essencial", "INTEGER DEFAULT 0");
  await ensureColumn(db, "expenses", "forma_pagamento", "TEXT DEFAULT 'Dinheiro'");
  await ensureColumn(db, "expenses", "account_id", "INTEGER DEFAULT NULL");
  await ensureColumn(db, "expenses", "parcelado", "INTEGER DEFAULT 0");
  await ensureColumn(db, "expenses", "qtd_parcelas", "INTEGER DEFAULT 1");
  await ensureColumn(db, "expenses", "card_purchase_id", "INTEGER DEFAULT NULL");

  // negotiations
  await ensureColumn(db, "negotiations", "debt_id", "INTEGER DEFAULT NULL");
  await ensureColumn(db, "negotiations", "valor_original", "REAL DEFAULT 0");
  await ensureColumn(db, "negotiations", "valor_acordado", "REAL DEFAULT 0");
  await ensureColumn(db, "negotiations", "qtd_parcelas", "INTEGER DEFAULT 0");
  await ensureColumn(db, "negotiations", "parcelas_pagas", "INTEGER DEFAULT 0");

  // legal agreements
  await ensureColumn(db, "legal_agreements", "debt_ids", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "debt_id", "INTEGER DEFAULT NULL");

  // card purchases
  await ensureColumn(db, "card_purchases", "debt_id", "INTEGER DEFAULT NULL");
  await ensureColumn(db, "card_purchases", "estabelecimento", "TEXT DEFAULT ''");
  await ensureColumn(db, "card_purchases", "data_compra", "TEXT DEFAULT ''");
  await ensureColumn(db, "card_purchases", "valor_total", "REAL DEFAULT 0");
  await ensureColumn(db, "card_purchases", "qtd_parcelas", "INTEGER DEFAULT 1");
  await ensureColumn(db, "card_purchases", "parcelas_pagas", "INTEGER DEFAULT 0");
  await ensureColumn(db, "card_purchases", "valor_parcela", "REAL DEFAULT 0");
  await ensureColumn(db, "card_purchases", "primeira_parcela", "TEXT DEFAULT ''");

  // payments
  await ensureColumn(db, "payments", "debt_id", "INTEGER DEFAULT NULL");
  await ensureColumn(db, "payments", "account_id", "INTEGER DEFAULT NULL");
  await ensureColumn(db, "payments", "competencia", "TEXT DEFAULT ''");
  await ensureColumn(db, "payments", "data_pagamento", "TEXT DEFAULT ''");
  await ensureColumn(db, "payments", "data", "TEXT DEFAULT ''");
  await ensureColumn(db, "payments", "valor", "REAL DEFAULT 0");
  await ensureColumn(db, "payments", "valor_pago", "REAL DEFAULT 0");
  await ensureColumn(db, "payments", "tipo", "TEXT DEFAULT 'PARCELA'");
  await ensureColumn(db, "payments", "amortizacao_modo", "TEXT DEFAULT ''");
  await ensureColumn(db, "payments", "juros", "REAL DEFAULT 0");
  await ensureColumn(db, "payments", "desconto", "REAL DEFAULT 0");
  await ensureColumn(db, "payments", "status", "TEXT DEFAULT 'PAGO'");
  await ensureColumn(db, "payments", "observacao", "TEXT DEFAULT ''");

  // negotiations
  await ensureColumn(db, "negotiations", "proposta", "TEXT DEFAULT ''");
  await ensureColumn(db, "negotiations", "nova_parcela", "REAL DEFAULT 0");
  await ensureColumn(db, "negotiations", "prazo", "TEXT DEFAULT ''");
  await ensureColumn(db, "negotiations", "proxima_acao", "TEXT DEFAULT ''");
  await ensureColumn(db, "negotiations", "aceito", "INTEGER DEFAULT 0");

  // agreements
  await ensureColumn(db, "agreements", "debt_id", "INTEGER DEFAULT NULL");
  await ensureColumn(db, "agreements", "debt_credor", "TEXT DEFAULT ''");
  await ensureColumn(db, "agreements", "credor", "TEXT DEFAULT ''");
  await ensureColumn(db, "agreements", "tipo", "TEXT DEFAULT 'EXTRAJUDICIAL'");
  await ensureColumn(db, "agreements", "status", "TEXT DEFAULT 'SIMULACAO'");
  await ensureColumn(db, "agreements", "data", "TEXT DEFAULT ''");
  await ensureColumn(db, "agreements", "data_acordo", "TEXT DEFAULT ''");
  await ensureColumn(db, "agreements", "valor_original", "REAL DEFAULT 0");
  await ensureColumn(db, "agreements", "valor_acordado", "REAL DEFAULT 0");
  await ensureColumn(db, "agreements", "desconto", "REAL DEFAULT 0");
  await ensureColumn(db, "agreements", "nova_parcela", "REAL DEFAULT 0");
  await ensureColumn(db, "agreements", "prazo", "TEXT DEFAULT ''");
  await ensureColumn(db, "agreements", "qtd_parcelas", "INTEGER DEFAULT 0");
  await ensureColumn(db, "agreements", "parcelas_pagas", "INTEGER DEFAULT 0");
  await ensureColumn(db, "agreements", "primeiro_vencimento", "TEXT DEFAULT ''");
  await ensureColumn(db, "agreements", "canal", "TEXT DEFAULT ''");
  await ensureColumn(db, "agreements", "homologado", "INTEGER DEFAULT 0");
  await ensureColumn(db, "agreements", "substitui_divida", "INTEGER DEFAULT 0");
  await ensureColumn(db, "agreements", "observacao", "TEXT DEFAULT ''");

  // legal agreements
  await ensureColumn(db, "legal_agreements", "numero_processo", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "processo", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "orgao", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "vara", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "data_audiencia", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "data_homologacao", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "valor_consolidado", "REAL DEFAULT 0");
  await ensureColumn(db, "legal_agreements", "valor_total", "REAL DEFAULT 0");
  await ensureColumn(db, "legal_agreements", "parcela_judicial", "REAL DEFAULT 0");
  await ensureColumn(db, "legal_agreements", "parcela", "REAL DEFAULT 0");
  await ensureColumn(db, "legal_agreements", "qtd_parcelas", "INTEGER DEFAULT 0");
  await ensureColumn(db, "legal_agreements", "parcelas_pagas", "INTEGER DEFAULT 0");
  await ensureColumn(db, "legal_agreements", "primeiro_vencimento", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "credores_incluidos", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "substitui_dividas", "INTEGER DEFAULT 0");
  await ensureColumn(db, "legal_agreements", "prazo", "TEXT DEFAULT ''");
  await ensureColumn(db, "legal_agreements", "status", "TEXT DEFAULT 'EM_ANDAMENTO'");
  await ensureColumn(db, "legal_agreements", "observacao", "TEXT DEFAULT ''");

  // tax reports
  await ensureColumn(db, "tax_reports", "ano", "INTEGER DEFAULT 0");
  await ensureColumn(db, "tax_reports", "rendimentos", "REAL DEFAULT 0");
  await ensureColumn(db, "tax_reports", "dividas", "REAL DEFAULT 0");
  await ensureColumn(db, "tax_reports", "pagamentos", "REAL DEFAULT 0");
  await ensureColumn(db, "tax_reports", "dividas_declaraveis", "REAL DEFAULT 0");
  await ensureColumn(db, "tax_reports", "pagamentos_efetuados", "REAL DEFAULT 0");
  await ensureColumn(db, "tax_reports", "juros_pagos", "REAL DEFAULT 0");
  await ensureColumn(db, "tax_reports", "descontos_obtidos", "REAL DEFAULT 0");
  await ensureColumn(db, "tax_reports", "bancos", "TEXT DEFAULT ''");
  await ensureColumn(db, "tax_reports", "bens", "TEXT DEFAULT ''");
  await ensureColumn(db, "tax_reports", "observacao", "TEXT DEFAULT ''");
  await ensureColumn(db, "tax_reports", "payload", "TEXT DEFAULT ''");
  await ensureColumn(db, "tax_reports", "created_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  // indexes
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_pay_debt_comp ON payments(debt_id, competencia);
    CREATE INDEX IF NOT EXISTS idx_pay_comp ON payments(competencia);
    CREATE INDEX IF NOT EXISTS idx_agreements_debt ON agreements(debt_id);
    CREATE INDEX IF NOT EXISTS idx_tax_reports_ano ON tax_reports(ano);
  `);
}

async function seedInitialData(db: SQLite.SQLiteDatabase) {
  const incomeCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) c FROM income");
  if ((incomeCount?.c ?? 0) === 0) {
    await db.runAsync("INSERT INTO income (bruto, liquido, updatedAt, updated_at) VALUES (?, ?, ?, ?)", [
      11900,
      9500,
      new Date().toISOString(),
      new Date().toISOString(),
    ]);
  }

  const minCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) c FROM min_existencial");
  if ((minCount?.c ?? 0) === 0) {
    await db.runAsync(
      `INSERT INTO min_existencial (alimentacao, transporte, agua, energia, internet, saude, outros, reserva, updatedAt, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [2500, 800, 120, 320, 120, 200, 0, 400, new Date().toISOString(), new Date().toISOString()],
    );
  }

  const legalCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) c FROM legal_plan");
  if ((legalCount?.c ?? 0) === 0) {
    await db.runAsync("INSERT INTO legal_plan (protocolado, updatedAt, updated_at) VALUES (0, ?, ?)", [
      new Date().toISOString(),
      new Date().toISOString(),
    ]);
  }

  const debtsCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) c FROM debts");
  if ((debtsCount?.c ?? 0) === 0) {
    const debts = [
      ["Banco do Brasil", "Empréstimo pessoal", "PAGAR", "MEDIA", 0],
      ["Itaú", "Cartão", "NEGOCIAR", "BAIXA", 0],
      ["Cooperforte", "Consignado", "PAGAR", "ALTA", 0],
      ["Mercado Pago", "Fintech", "PAUSADO", "BAIXA", 0],
      ["Caixa", "Empréstimo", "PAGAR", "MEDIA", 0],
      ["Nubank", "Cartão", "PAGAR", "BAIXA", 0],
      ["Carrefour", "Cartão", "PAGAR", "BAIXA", 0],
      ["Financiamento habitacional", "Habitacional", "PAGAR", "ALTA", 1],
      ["Financiamento de veículo", "Veículo", "PAGAR", "ALTA", 1],
    ];

    for (const [credor, tipo, status, prioridade, garantia] of debts) {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO debts (credor, tipo, status, prioridade, garantia, updatedAt, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [credor as string, tipo as string, status as string, prioridade as string, garantia as number, now, now],
      );
    }
  }

  const accountsCount = await db.getFirstAsync<{ c: number }>("SELECT COUNT(*) c FROM accounts");
  if ((accountsCount?.c ?? 0) === 0) {
    const accounts = [
      ["Banco do Brasil", "CONTA_CORRENTE", 1000],
      ["Itaú", "CARTAO_CREDITO", 0],
      ["Nubank", "CARTAO_CREDITO", 0],
      ["Carrefour", "CARTAO_CREDITO", 0],
      ["Caixa", "CONTA_CORRENTE", 500],
    ];

    for (const [nome, tipo, limite] of accounts) {
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO accounts (nome, tipo, limite_total, updatedAt, updated_at) VALUES (?, ?, ?, ?, ?)",
        [nome as string, tipo as string, limite as number, now, now],
      );
    }
  }
}

export const wipeAll = async () => {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM payments;
    DELETE FROM payment_alerts;
    DELETE FROM expenses;
    DELETE FROM card_purchases;
    DELETE FROM reminders;
    DELETE FROM agreements;
    DELETE FROM legal_agreements;
    DELETE FROM tax_reports;
    DELETE FROM accounts;
    DELETE FROM debts;
    DELETE FROM negotiations;
    DELETE FROM income;
    DELETE FROM min_existencial;
    DELETE FROM legal_plan;
    DELETE FROM sync_map;
  `);
  await seedInitialData(db);
};
