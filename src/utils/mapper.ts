export function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);

  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc: any, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      acc[camelKey] = snakeToCamel(obj[key]);
      return acc;
    }, {});
  }

  return obj;
}

export function cleanForPrisma(data: any) {
  const clean = snakeToCamel(data);

  delete clean.userId;
  delete clean.createdAt;
  delete clean.updatedAt;
  delete clean.serverId;
  delete clean.localId;
  delete clean.syncStatus;
  delete clean.pendingSync;

  // Campos locais que podem existir no SQLite mas não no Prisma atual
  delete clean.saldo;
  delete clean.limiteUsado;
  delete clean.vencimentoFatura;

  const booleanFields = [
    "protocolado",
    "garantia",
    "aceito",
    "ativo",
    "pago",
    "essencial",
    "parcelado",
    "homologado",
  ];

  for (const field of booleanFields) {
    if (field in clean) clean[field] = Boolean(clean[field]);
  }

  return clean;
}