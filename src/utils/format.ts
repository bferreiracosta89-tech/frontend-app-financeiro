export const fmtBRL = (n: number | null | undefined): string => {
  const v = Number(n) || 0;
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
};

export const fmtPct = (n: number): string =>
  `${(Math.round(n * 10) / 10).toFixed(1).replace('.', ',')}%`;

export const fmtDate = (iso: string): string => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const parseNumber = (s: string): number => {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export const monthLabelPt = (ym: string): string => {
  const [y, m] = ym.split('-');
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${meses[parseInt(m, 10) - 1] || ''}/${y}`;
};
