import { create } from 'zustand';
import {
  addPayment, deletePayment, listAllPayments,
  ensurePaymentsTable,
  Payment, PaymentTipo,
} from '../db/payments';
import { useFinanceStore } from './useStore';

interface PaymentState {
  payments: Payment[];
  loaded: boolean;
  loadAll: () => Promise<void>;
  registrar: (p: Payment) => Promise<number>;
  excluir: (id: number) => Promise<void>;
}

export const usePaymentStore = create<PaymentState>((set, get) => ({
  payments: [],
  loaded: false,

  loadAll: async () => {
    await ensurePaymentsTable();
    const data = await listAllPayments();
    set({ payments: data, loaded: true });
  },

  registrar: async (p) => {
    const id = await addPayment(p);
    // Recarrega a lista local + a lista de dívidas (saldo mudou)
    await get().loadAll();
    await useFinanceStore.getState().loadAll();
    return id;
  },

  excluir: async (id) => {
    await deletePayment(id);
    await get().loadAll();
    await useFinanceStore.getState().loadAll();
  },
}));

/** Devolve pagamentos de uma dívida específica, ordenados por competência desc. */
export function usePaymentsOfDebt(debtId: number | undefined): Payment[] {
  const all = usePaymentStore((s) => s.payments);
  if (!debtId) return [];
  return all.filter((p) => p.debtId === debtId);
}

/** Status de uma célula da matriz mês a mês: pago, parcial, não pago, vazio. */
export type CellStatus = 'PAGO' | 'PARCIAL' | 'AMORT' | 'NAO_PAGO' | 'LIQUIDADO' | 'VAZIO';

export function cellStatus(payments: Payment[]): { status: CellStatus; total: number } {
  if (!payments.length) return { status: 'VAZIO', total: 0 };
  const total = payments.reduce((a, p) => a + (p.tipo === 'NAO_PAGO' ? 0 : p.valorPago), 0);
  if (payments.some((p) => p.tipo === 'LIQUIDACAO')) return { status: 'LIQUIDADO', total };
  if (payments.some((p) => p.tipo === 'PARCELA'))    return { status: 'PAGO', total };
  if (payments.some((p) => p.tipo === 'PARCIAL'))    return { status: 'PARCIAL', total };
  if (payments.some((p) => p.tipo === 'AMORTIZACAO'))return { status: 'AMORT', total };
  if (payments.some((p) => p.tipo === 'NAO_PAGO'))   return { status: 'NAO_PAGO', total };
  return { status: 'VAZIO', total };
}

export type { Payment, PaymentTipo };
