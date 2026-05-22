import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { useFinanceStore } from '../store/useStore';
import { usePaymentStore, cellStatus, CellStatus, Payment } from '../store/usePayments';
import PaymentModal from '../components/PaymentModal';
import { colors } from '../theme/colors';
import { Debt } from '../db/types';

const MES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MesAMesScreen() {
  const debts = useFinanceStore((s) => s.debts);
  const { payments, loaded, loadAll, excluir } = usePaymentStore();

  const [ano, setAno] = useState(new Date().getFullYear());
  const [modalDebt, setModalDebt] = useState<Debt | null>(null);
  const [detailCell, setDetailCell] = useState<{ debt: Debt; competencia: string; payments: Payment[] } | null>(null);

  useEffect(() => { loadAll(); }, []);

  const ativas = debts.filter((d) => d.status !== 'QUITADO');
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i+1).padStart(2,'0')}`);

  // Indexa pagamentos: chave "debtId|YYYY-MM" → array de payments
  const cells: Record<string, Payment[]> = {};
  for (const p of payments) {
    if (!p.competencia.startsWith(`${ano}-`)) continue;
    const k = `${p.debtId}|${p.competencia}`;
    (cells[k] ||= []).push(p);
  }

  // Totais por mês
  const totaisMes = meses.map((m) => {
    let pago = 0, esperado = 0;
    for (const d of ativas) {
      esperado += d.parcela;
      const cs = cells[`${d.id}|${m}`] || [];
      pago += cs.reduce((a, p) => a + (p.tipo === 'NAO_PAGO' ? 0 : p.valorPago), 0);
    }
    return { mes: m, pago, esperado };
  });

  if (!loaded) {
    return <View style={s.center}><ActivityIndicator color={colors.info} /></View>;
  }

  if (ativas.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>Nenhuma dívida ativa.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Seletor de ano */}
      <View style={s.yearBar}>
        <Pressable onPress={() => setAno(ano - 1)} style={s.yearBtn}>
          <Text style={s.yearBtnTxt}>‹</Text>
        </Pressable>
        <Text style={s.yearTxt}>{ano}</Text>
        <Pressable onPress={() => setAno(ano + 1)} style={s.yearBtn}>
          <Text style={s.yearBtnTxt}>›</Text>
        </Pressable>
      </View>

      {/* Legenda */}
      <View style={s.legend}>
        <Legend color={colors.success} label="Pago" />
        <Legend color={colors.warning} label="Parcial" />
        <Legend color={colors.info} label="Amort." />
        <Legend color={colors.danger} label="Não pago" />
        <Legend color="#666" label="Quitado" />
      </View>

      {/* Matriz: horizontal scrollable */}
      <ScrollView horizontal>
        <ScrollView>
          <View>
            {/* Cabeçalho: meses */}
            <View style={s.row}>
              <View style={[s.cellHeader, s.firstCol]}>
                <Text style={s.headerTxt}>Credor</Text>
              </View>
              {MES_NOMES.map((m) => (
                <View key={m} style={s.cellHeader}><Text style={s.headerTxt}>{m}</Text></View>
              ))}
              <View style={[s.cellHeader, { width: 90 }]}>
                <Text style={s.headerTxt}>Total ano</Text>
              </View>
            </View>

            {ativas.map((d) => {
              const totalAno = meses.reduce((a, m) => {
                const cs = cells[`${d.id}|${m}`] || [];
                return a + cs.reduce((s, p) => s + (p.tipo === 'NAO_PAGO' ? 0 : p.valorPago), 0);
              }, 0);
              return (
                <View key={d.id} style={s.row}>
                  <Pressable style={[s.firstCol, s.cell]} onPress={() => setModalDebt(d)}>
                    <Text style={s.credorTxt} numberOfLines={1}>{d.credor}</Text>
                    <Text style={s.credorSub}>{fmtBRL(d.parcela)}</Text>
                  </Pressable>
                  {meses.map((m) => {
                    const cs = cells[`${d.id}|${m}`] || [];
                    const { status, total } = cellStatus(cs);
                    return (
                      <Pressable key={m} style={[s.cell, cellStyle(status)]}
                        onPress={() => {
                          if (cs.length) setDetailCell({ debt: d, competencia: m, payments: cs });
                          else setModalDebt(d);
                        }}>
                        {status !== 'VAZIO' && (
                          <Text style={[s.cellTxt, cellTextStyle(status)]}>
                            {status === 'NAO_PAGO' ? '✗' : status === 'LIQUIDADO' ? '✓✓' : '✓'}
                          </Text>
                        )}
                        {total > 0 && (
                          <Text style={[s.cellMini, cellTextStyle(status)]}>
                            {(total/1000).toFixed(total >= 1000 ? 1 : 2)}{total >= 1000 ? 'k' : ''}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                  <View style={[s.cell, { width: 90 }]}>
                    <Text style={s.totalTxt}>{fmtBRL(totalAno)}</Text>
                  </View>
                </View>
              );
            })}

            {/* Linha de totais */}
            <View style={[s.row, s.totalRow]}>
              <View style={[s.firstCol, s.cell]}><Text style={s.headerTxt}>Total/mês</Text></View>
              {totaisMes.map((t) => (
                <View key={t.mes} style={[s.cell, s.totalCell]}>
                  <Text style={s.totalTxt}>
                    {t.pago > 0 ? (t.pago/1000).toFixed(1)+'k' : '—'}
                  </Text>
                </View>
              ))}
              <View style={[s.cell, { width: 90 }]}>
                <Text style={s.totalTxt}>
                  {fmtBRL(totaisMes.reduce((a, t) => a + t.pago, 0))}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </ScrollView>

      <PaymentModal visible={!!modalDebt} debt={modalDebt} onClose={() => setModalDebt(null)} />

      {detailCell && (
        <DetailModal
          debt={detailCell.debt}
          competencia={detailCell.competencia}
          payments={detailCell.payments}
          onClose={() => setDetailCell(null)}
          onDelete={async (id) => {
            const confirm = await new Promise<boolean>((r) =>
              Alert.alert('Excluir', 'Reverter este pagamento? O saldo voltará ao valor anterior.',
                [{ text: 'Cancelar', onPress: () => r(false) },
                 { text: 'Excluir', style: 'destructive', onPress: () => r(true) }]));
            if (confirm) {
              await excluir(id);
              setDetailCell(null);
            }
          }}
          onAddMore={() => { const d = detailCell.debt; setDetailCell(null); setModalDebt(d); }}
        />
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendTxt}>{label}</Text>
    </View>
  );
}

function cellStyle(status: CellStatus) {
  switch (status) {
    case 'PAGO':      return { backgroundColor: colors.successBg };
    case 'PARCIAL':   return { backgroundColor: colors.warningBg };
    case 'AMORT':     return { backgroundColor: colors.infoBg };
    case 'NAO_PAGO':  return { backgroundColor: colors.dangerBg };
    case 'LIQUIDADO': return { backgroundColor: '#DDDDDD' };
    default:          return { backgroundColor: colors.card };
  }
}
function cellTextStyle(status: CellStatus) {
  switch (status) {
    case 'PAGO':      return { color: colors.success };
    case 'PARCIAL':   return { color: colors.warning };
    case 'AMORT':     return { color: colors.info };
    case 'NAO_PAGO':  return { color: colors.danger };
    case 'LIQUIDADO': return { color: '#333' };
    default:          return { color: colors.muted };
  }
}

// ---------------- Detail Modal -----------------
function DetailModal({ debt, competencia, payments, onClose, onDelete, onAddMore }: {
  debt: Debt; competencia: string; payments: Payment[];
  onClose: () => void; onDelete: (id: number) => void; onAddMore: () => void;
}) {
  return (
    <View style={s.detailOverlay}>
      <View style={s.detailCard}>
        <Text style={s.detailTitle}>{debt.credor} · {competencia}</Text>
        <ScrollView style={{ maxHeight: 300 }}>
          {payments.map((p) => (
            <View key={p.id} style={s.detailRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.detailType}>{tipoLabel(p.tipo)}</Text>
                <Text style={s.detailVal}>{fmtBRL(p.valorPago)}</Text>
                {p.dataPagamento ? <Text style={s.detailDate}>Pago em {p.dataPagamento}</Text> : null}
                {p.observacao ? <Text style={s.detailObs}>{p.observacao}</Text> : null}
              </View>
              <Pressable onPress={() => onDelete(p.id!)}><Text style={s.detailDel}>excluir</Text></Pressable>
            </View>
          ))}
        </ScrollView>
        <View style={s.detailFooter}>
          <Pressable style={[s.btn, s.btnGhost]} onPress={onClose}>
            <Text style={s.btnGhostText}>Fechar</Text>
          </Pressable>
          <Pressable style={[s.btn, s.btnPrimary]} onPress={onAddMore}>
            <Text style={s.btnPrimaryText}>+ Adicionar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
function tipoLabel(t: string) {
  return { PARCELA: 'Parcela', AMORTIZACAO: 'Amortização', LIQUIDACAO: 'Liquidação',
           PARCIAL: 'Parcial', NAO_PAGO: 'Não pago' }[t] || t;
}

const CELL_W = 56;
const FIRST_W = 130;

const s = StyleSheet.create({
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:    { color: colors.muted, fontSize: 14 },
  yearBar:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
              padding: 12, backgroundColor: colors.card,
              borderBottomWidth: 1, borderBottomColor: colors.border },
  yearBtn:  { paddingHorizontal: 18, paddingVertical: 6 },
  yearBtnTxt:{ fontSize: 22, color: colors.info, fontWeight: 'bold' },
  yearTxt:  { fontSize: 18, fontWeight: 'bold', marginHorizontal: 16, color: colors.ink },
  legend:   { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 12,
              backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendTxt: { fontSize: 11, color: colors.muted },
  row:      { flexDirection: 'row' },
  firstCol: { width: FIRST_W, backgroundColor: colors.card,
              borderRightWidth: 1, borderRightColor: colors.border },
  cell:     { width: CELL_W, padding: 4, alignItems: 'center', justifyContent: 'center',
              borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border, minHeight: 56 },
  cellHeader:{ width: CELL_W, padding: 6, alignItems: 'center', justifyContent: 'center',
               backgroundColor: colors.card, borderRightWidth: 1, borderBottomWidth: 1,
               borderColor: colors.border },
  headerTxt:{ fontSize: 11, fontWeight: 'bold', color: colors.muted, textTransform: 'uppercase' },
  credorTxt:{ fontSize: 12, fontWeight: '600', color: colors.ink, paddingHorizontal: 6 },
  credorSub:{ fontSize: 10, color: colors.muted, paddingHorizontal: 6, marginTop: 2 },
  cellTxt:  { fontSize: 16, fontWeight: 'bold' },
  cellMini: { fontSize: 9 },
  totalTxt: { fontSize: 11, fontWeight: '600', color: colors.ink },
  totalRow: { backgroundColor: colors.card },
  totalCell:{ backgroundColor: colors.card },

  detailOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                   backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  detailCard:    { backgroundColor: colors.card, borderRadius: 12, padding: 16 },
  detailTitle:   { fontSize: 16, fontWeight: 'bold', color: colors.ink, marginBottom: 12 },
  detailRow:     { flexDirection: 'row', padding: 10, borderBottomWidth: 1,
                   borderBottomColor: colors.border, alignItems: 'flex-start' },
  detailType:    { fontSize: 12, color: colors.muted, textTransform: 'uppercase' },
  detailVal:     { fontSize: 16, fontWeight: 'bold', color: colors.ink, marginTop: 2 },
  detailDate:    { fontSize: 11, color: colors.muted, marginTop: 2 },
  detailObs:     { fontSize: 12, color: colors.ink, marginTop: 2 },
  detailDel:     { color: colors.danger, fontSize: 12, padding: 6 },
  detailFooter:  { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn:           { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  btnGhost:      { borderWidth: 1, borderColor: colors.muted },
  btnGhostText:  { color: colors.muted, fontWeight: '600' },
  btnPrimary:    { backgroundColor: colors.info },
  btnPrimaryText:{ color: '#fff', fontWeight: '700' },
});
