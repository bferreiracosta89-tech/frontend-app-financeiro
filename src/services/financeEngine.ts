export type DebtLike = { id?: any; credor?: string; parcela?: number; total?: number; status?: string; deleted_at?: any; deletedAt?: any };
export type PaymentLike = { debt_id?: any; debtId?: any; competencia?: string; tipo?: string; valor_pago?: number; valorPago?: number; deleted_at?: any; deletedAt?: any };

export function currentCompetencia(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const n = (v: any) => Number(v || 0);
const st = (v: any) => String(v || '').toUpperCase();
const isDeleted = (x: any) => !!(x?.deleted_at || x?.deletedAt);

export function monthlyFinanceSnapshot(debts: DebtLike[], payments: PaymentLike[], competencia = currentCompetencia()) {
  const activeDebts = debts.filter((d) => {
    const status = st(d.status);
    return !isDeleted(d) && !['QUITADO', 'CANCELADO', 'PAUSADO'].includes(status) && n(d.parcela) > 0;
  });
  const monthPayments = payments.filter((p) => !isDeleted(p) && p.competencia === competencia);

  const details = activeDebts.map((d) => {
    const ps = monthPayments.filter((p) => String(p.debt_id ?? p.debtId) === String(d.id));
    const pago = ps.filter((p) => st(p.tipo) !== 'NAO_PAGO').reduce((a, p) => a + n(p.valor_pago ?? p.valorPago), 0);
    const previsto = n(d.parcela);
    const restante = Math.max(0, previsto - pago);
    const tipos = ps.map((p) => st(p.tipo));
    const situacao = tipos.includes('LIQUIDACAO') || st(d.status) === 'QUITADO'
      ? 'QUITADO'
      : tipos.includes('NAO_PAGO')
        ? 'NAO_PAGO'
        : pago >= previsto * 0.99
          ? 'PAGO'
          : pago > 0
            ? 'PARCIAL'
            : 'PENDENTE';
    return { debtId: d.id, credor: d.credor, previsto, pago, restante, situacao, payments: ps };
  });

  const previsto = details.reduce((a, d) => a + d.previsto, 0);
  const pago = details.reduce((a, d) => a + d.pago, 0);
  const pendente = details.reduce((a, d) => a + d.restante, 0);
  const registrados = new Set(monthPayments.map((p) => String(p.debt_id ?? p.debtId)));
  const naoRegistradas = activeDebts.filter((d) => !registrados.has(String(d.id)));
  return {
    competencia,
    previsto,
    pago,
    pendente,
    gap: pendente,
    details,
    naoRegistradas,
    qtdNaoRegistradas: naoRegistradas.length,
    percentualPago: previsto > 0 ? (pago / previsto) * 100 : 0,
  };
}

export function legalSuperendividamentoScore(rendaLiquida: number, minimoExistencial: number, parcelasPrevistas: number) {
  const base = Number(rendaLiquida || 0);
  const comprometimento = base > 0 ? (Number(parcelasPrevistas || 0) / base) * 100 : 0;
  const sobraAposMinimo = base - Number(minimoExistencial || 0) - Number(parcelasPrevistas || 0);
  return {
    comprometimento,
    sobraAposMinimo,
    elegivelAlerta: comprometimento >= 35 || sobraAposMinimo < 0,
    nivel: comprometimento >= 70 ? 'CRITICO' : comprometimento >= 50 ? 'ALTO' : comprometimento >= 35 ? 'ATENCAO' : 'CONTROLADO',
  };
}
