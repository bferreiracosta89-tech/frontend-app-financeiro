import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { buildMatrix, deletePayment, type Payment, type PaymentType } from '../services/payments';
import { useFinanceStore } from '../store/useStore';

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const TIPO_COLOR: Record<PaymentType,string> = {
  PARCELA:     colors.success,
  PARCIAL:     colors.warning,
  AMORTIZACAO: colors.info,
  LIQUIDACAO:  colors.ink,
  NAO_PAGO:    colors.danger,
};
const TIPO_LABEL: Record<PaymentType,string> = {
  PARCELA: '✓', PARCIAL: '½', AMORTIZACAO: '↓', LIQUIDACAO: '★', NAO_PAGO: '✗',
};

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function resolveCellStatus(debt: any, payments: Payment[]): PaymentType | null {
  if (!payments.length) return null;
  const paid = payments
    .filter((p: any) => p.tipo !== 'NAO_PAGO')
    .reduce((acc: number, p: any) => acc + Number(p.valor_pago ?? p.valorPago ?? 0), 0);
  if (payments.some((p) => p.tipo === 'LIQUIDACAO')) return 'LIQUIDACAO';
  if (Number(debt.parcela || 0) > 0 && paid >= Number(debt.parcela || 0) * 0.99) return 'PARCELA';
  if (paid > 0 && payments.some((p) => p.tipo === 'PARCIAL' || p.tipo === 'PARCELA')) return 'PARCIAL';
  if (payments.some((p) => p.tipo === 'AMORTIZACAO')) return 'AMORTIZACAO';
  if (payments.some((p) => p.tipo === 'NAO_PAGO')) return 'NAO_PAGO';
  return payments[0]?.tipo || null;
}

export default function MonthlyMatrixScreen() {
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [matrix, setMatrix] = useState<{ months: string[]; debts: any[]; cells: Record<string, Payment[]> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ debt: any; month: string; payments: Payment[] } | null>(null);
  const reloadStore = useFinanceStore((s) => s.loadAll);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await buildMatrix(ano);
      setMatrix(m);
    } finally { setLoading(false); }
  }, [ano]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onCellPress = (debt: any, month: string) => {
    if (!matrix) return;
    const key = `${debt.id}|${month}`;
    const payments = matrix.cells[key] || [];
    if (payments.length === 0) {
      Alert.alert('Sem registro', `Nenhum movimento registrado para ${debt.credor} em ${month}. Use a tela Dívidas para registrar.`);
      return;
    }
    setSelected({ debt, month, payments });
  };

  const handleDelete = async (id: number) => {
    Alert.alert('Excluir pagamento?', 'O efeito no saldo da dívida será revertido.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try {
          await deletePayment(id);
          await reloadStore();
          await load();
          setSelected(null);
        } catch (e: any) {
          Alert.alert('Erro', e?.message || 'Falha');
        }
      }},
    ]);
  };

  if (loading || !matrix) {
    return <View style={s.center}><ActivityIndicator color={colors.info} /></View>;
  }

  const ativos = matrix.debts.filter((d: any) => !d.deleted_at);
  const anoNum = parseInt(ano, 10);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => setAno(String(anoNum - 1))} style={s.yearBtn}><Text style={s.yearBtnText}>‹</Text></Pressable>
        <Text style={s.yearText}>{ano}</Text>
        <Pressable onPress={() => setAno(String(anoNum + 1))} style={s.yearBtn}><Text style={s.yearBtnText}>›</Text></Pressable>
      </View>

      <Text style={s.legend}>
        ✓ Parcela paga · ½ Parcial · ↓ Amortização · ★ Liquidação · ✗ Não pago
      </Text>

      <ScrollView horizontal>
        <ScrollView>
          <View style={s.matrix}>
            {/* Cabeçalho de meses */}
            <View style={s.row}>
              <View style={[s.cellHeader, s.firstCol]}>
                <Text style={s.headerText}>Credor</Text>
              </View>
              {matrix.months.map((m, i) => (
                <View key={m} style={s.cellHeader}>
                  <Text style={s.headerText}>{MONTH_NAMES[i]}</Text>
                </View>
              ))}
            </View>
            {/* Linhas: uma por dívida */}
            {ativos.map((debt: any) => (
              <View key={debt.id} style={s.row}>
                <View style={[s.cell, s.firstCol]}>
                  <Text style={s.debtName} numberOfLines={1}>{debt.credor}</Text>
                  <Text style={s.debtSub}>Parcela {fmt(debt.parcela)}</Text>
                </View>
                {matrix.months.map((m) => {
                  const key = `${debt.id}|${m}`;
                  const payments = matrix.cells[key] || [];
                  const statusTipo = resolveCellStatus(debt, payments);
                  const bg = statusTipo ? TIPO_COLOR[statusTipo] + '22' : 'transparent';
                  const fg = statusTipo ? TIPO_COLOR[statusTipo] : colors.muted;
                  const label = statusTipo ? TIPO_LABEL[statusTipo] : '·';
                  return (
                    <Pressable key={m} onPress={() => onCellPress(debt, m)}
                      style={[s.cell, { backgroundColor: bg }]}>
                      <Text style={[s.cellSymbol, { color: fg }]}>{label}</Text>
                      {payments.length > 1 && <Text style={[s.cellSub, { color: fg }]}>×{payments.length}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {ativos.length === 0 && (
              <Text style={{ padding: 20, color: colors.muted }}>Cadastre dívidas para ver a matriz.</Text>
            )}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Detalhe da célula */}
      {selected && (
        <View style={s.detail}>
          <Text style={s.detailTitle}>{selected.debt.credor} · {selected.month}</Text>
          <ScrollView style={{ maxHeight: 200 }}>
            {selected.payments.map((p) => (
              <View key={p.id} style={s.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.paymentTipo}>
                    <Text style={{ color: TIPO_COLOR[p.tipo] }}>{TIPO_LABEL[p.tipo]}</Text>
                    {'  '}{p.tipo} · {fmt(p.valor_pago)}
                  </Text>
                  {!!p.data_pagamento && <Text style={s.paymentDate}>Pago em {p.data_pagamento}</Text>}
                  {p.desconto > 0 && <Text style={s.paymentNote}>Desconto: {fmt(p.desconto)}</Text>}
                  {p.juros > 0 && <Text style={s.paymentNote}>Juros: {fmt(p.juros)}</Text>}
                  {!!p.observacao && <Text style={s.paymentNote}>{p.observacao}</Text>}
                </View>
                <Pressable onPress={() => handleDelete(p.id)} style={s.delBtn}>
                  <Text style={s.delBtnText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          <Pressable onPress={() => setSelected(null)} style={s.closeBtn}>
            <Text style={s.closeBtnText}>Fechar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 16 },
  yearBtn:   { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  yearBtnText: { fontSize: 18, color: colors.ink, fontWeight: 'bold' },
  yearText:  { fontSize: 18, fontWeight: 'bold', color: colors.ink, minWidth: 70, textAlign: 'center' },
  legend:    { fontSize: 11, color: colors.muted, paddingHorizontal: 12, paddingBottom: 8 },
  matrix:    { padding: 4 },
  row:       { flexDirection: 'row' },
  cell:      { width: 50, height: 56, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  firstCol:  { width: 140, alignItems: 'flex-start', paddingHorizontal: 6 },
  cellHeader:{ width: 50, height: 30, borderWidth: 0.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  headerText:{ fontSize: 11, fontWeight: 'bold', color: colors.muted },
  debtName:  { fontSize: 13, fontWeight: 'bold', color: colors.ink },
  debtSub:   { fontSize: 10, color: colors.muted },
  cellSymbol:{ fontSize: 18, fontWeight: 'bold' },
  cellSub:   { fontSize: 9 },
  detail:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopWidth: 1, borderColor: colors.border, padding: 16, maxHeight: '50%' },
  detailTitle:{ fontSize: 16, fontWeight: 'bold', color: colors.ink, marginBottom: 8 },
  paymentRow:{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderColor: colors.border, paddingVertical: 8 },
  paymentTipo:{ fontSize: 13, fontWeight: 'bold', color: colors.ink },
  paymentDate:{ fontSize: 11, color: colors.muted, marginTop: 2 },
  paymentNote:{ fontSize: 11, color: colors.muted },
  delBtn:    { padding: 8 },
  delBtnText:{ fontSize: 16, color: colors.danger, fontWeight: 'bold' },
  closeBtn:  { marginTop: 12, paddingVertical: 10, backgroundColor: colors.bg, borderRadius: 6, alignItems: 'center' },
  closeBtnText: { color: colors.ink, fontWeight: 'bold' },
});
