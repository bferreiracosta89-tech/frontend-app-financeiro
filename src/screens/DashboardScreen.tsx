import React, { useCallback, useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, Section, Stat, ScreenHeader } from "../components/UI";
import { ProgressBar } from "../components/Charts";
import {
  useCreditAvailability,
  useFinanceStore,
  useMonthExpenses,
  useTotals,
} from "../store/useStore";
import { COLORS, SPACING } from "../utils/theme";
import { fmtBRL, fmtPct } from "../utils/format";
import { useFocusEffect } from "@react-navigation/native";

function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}
    >
      {children}
    </View>
  );
}

export default function DashboardScreen() {
  const { loadAll, income, debts, payments, minExist } = useFinanceStore();
  const {
    totalMinE,
    totalPagas,
    totalPausadas,
    saldoMensal,
    capacidade,
    compromet,
    totalPrevistoMes,
    totalPagoMes,
    totalPendenteMes,
    totalNaoPagoMes,
    totalJudicial,
    qtdSemRegistroMes,
  } = useTotals();

  const { totalLimite, totalUsado, totalDisponivel } = useCreditAvailability();
  const monthExp = useMonthExpenses();

  useEffect(() => {
    loadAll();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const corSaldo =
    saldoMensal > 0
      ? COLORS.success
      : saldoMensal === 0
        ? COLORS.warning
        : COLORS.danger;

  const competenciaAtual = new Date().toISOString().slice(0, 7);
  const barData = (debts || [])
    .filter((d: any) => !d.deleted_at && !d.deletedAt)
    .filter((d: any) => !["QUITADO", "CANCELADO", "PAUSADO"].includes(String(d.status || "").toUpperCase()))
    .filter((d: any) => Number(d.parcela || 0) > 0)
    .map((d: any) => {
      const previsto = Number(d.parcela || 0);
      const pago = (payments || [])
        .filter((p: any) => !p.deleted_at && !p.deletedAt)
        .filter((p: any) => String(p.competencia || "") === competenciaAtual)
        .filter((p: any) => String(p.debt_id ?? p.debtId ?? "") === String(d.id))
        .filter((p: any) => String(p.tipo || "").toUpperCase() !== "NAO_PAGO")
        .reduce((a: number, p: any) => a + Number(p.valor_pago ?? p.valorPago ?? 0), 0);
      return {
        label: d.credor || "Sem credor",
        previsto,
        pago: Math.min(previsto, pago),
        restante: Math.max(0, previsto - pago),
      };
    })
    .sort((a: any, b: any) => b.restante - a.restante)
    .slice(0, 8);

  const categorias = Object.entries(monthExp?.porCategoria || {}).sort(
    ([, a]: any, [, b]: any) => Number(b || 0) - Number(a || 0),
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 110 }}
      >
        <ScreenHeader title="Painel" subtitle="Resumo mensal, pendências, crédito e evolução financeira." />

        <Card style={{ backgroundColor: corSaldo }}>
          <Text
            style={{
              color: "#fff",
              opacity: 0.85,
              fontSize: 12,
              marginBottom: 4,
            }}
          >
            Saldo mensal após dívidas e mínimo
          </Text>
          <Text style={{ color: "#fff", fontSize: 30, fontWeight: "800" }}>
            {fmtBRL(Number(saldoMensal || 0))}
          </Text>
          <Text
            style={{ color: "#fff", opacity: 0.85, fontSize: 12, marginTop: 4 }}
          >
            Comprometimento da renda: {fmtPct(Number(compromet || 0))}
          </Text>
        </Card>

        <Card>
          <StatGrid>
            <Stat
              label="Renda líquida"
              value={fmtBRL(Number(income?.liquido || 0))}
              color={COLORS.info}
            />
            <Stat
              label="Mín. existencial"
              value={fmtBRL(Number(totalMinE || 0))}
              color={COLORS.warning}
            />
            <Stat
              label="Capacidade"
              value={fmtBRL(Number(capacidade || 0))}
              color={COLORS.success}
            />
            <Stat
              label="Previsto no mês"
              value={fmtBRL(Number(totalPrevistoMes || 0))}
              color={COLORS.info}
            />
            <Stat
              label="Pago no mês"
              value={fmtBRL(Number(totalPagoMes || 0))}
              color={COLORS.success}
            />
            <Stat
              label="Pendente no mês"
              value={fmtBRL(Number((totalPendenteMes ?? totalPagas) || 0))}
              color={COLORS.danger}
            />
            <Stat
              label="Não pago"
              value={fmtBRL(Number(totalNaoPagoMes || 0))}
              color={COLORS.warning}
            />
            <Stat
              label="Judicial"
              value={fmtBRL(Number(totalJudicial || 0))}
              color={COLORS.info}
            />
            <Stat
              label="Pausadas/Negociar"
              value={fmtBRL(Number(totalPausadas || 0))}
              color={COLORS.muted}
            />
            <Stat
              label="Reserva"
              value={fmtBRL(Number(minExist?.reserva || 0))}
              color={COLORS.info}
            />
          </StatGrid>
        </Card>

        <Card>
          <Text
            style={{ fontWeight: "800", marginBottom: 8, color: COLORS.text }}
          >
            Comprometimento da renda
          </Text>
          <ProgressBar
            value={Number(totalPagas || 0)}
            max={Number(income?.liquido || 1)}
            color={
              Number(compromet || 0) > 50
                ? COLORS.danger
                : Number(compromet || 0) > 30
                  ? COLORS.warning
                  : COLORS.success
            }
            height={12}
            label={`${fmtBRL(Number(totalPagas || 0))} de ${fmtBRL(Number(income?.liquido || 0))}`}
          />
          <Text
            style={{
              fontSize: 11,
              color: COLORS.muted,
              marginTop: 8,
              lineHeight: 16,
            }}
          >
            Lei 14.181/2021 protege o mínimo existencial. Comprometimento &gt;
            50% é sinal de superendividamento e dá direito a renegociação
            coletiva.
          </Text>
        </Card>

        <Card>
          <Text
            style={{ fontWeight: "800", marginBottom: 8, color: COLORS.text }}
          >
            Crédito disponível
          </Text>
          <StatGrid>
            <Stat
              label="Limite total"
              value={fmtBRL(Number(totalLimite || 0))}
              color={COLORS.info}
            />
            <Stat
              label="Usado"
              value={fmtBRL(Number(totalUsado || 0))}
              color={COLORS.danger}
            />
            <Stat
              label="Disponível"
              value={fmtBRL(Number(totalDisponivel || 0))}
              color={COLORS.success}
            />
          </StatGrid>
        </Card>

        {barData.length > 0 && (
          <Card>
            <Section title="Parcelas por credor">
              <View style={{ gap: 12 }}>
                {barData.map((item: any) => (
                  <View key={item.label} style={{ paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ color: COLORS.text, fontWeight: "800", flex: 1 }}>{item.label}</Text>
                      <Text style={{ color: item.restante > 0 ? COLORS.danger : COLORS.success, fontWeight: "800" }}>
                        {fmtBRL(item.pago)} / {fmtBRL(item.previsto)}
                      </Text>
                    </View>
                    <ProgressBar value={item.pago} max={Math.max(item.previsto, 1)} color={item.restante > 0 ? COLORS.warning : COLORS.success} height={10} />
                    <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>
                      Restante no mês: {fmtBRL(item.restante)}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          </Card>
        )}

        <Card>
          <Section title="Gastos diários neste mês">
            <Text
              style={{ fontSize: 22, fontWeight: "800", color: COLORS.text }}
            >
              {fmtBRL(Number(monthExp?.total || 0))}
            </Text>
            {categorias.length > 0 && (
              <View style={{ marginTop: 8 }}>
                {categorias.map(([cat, val]) => (
                  <View
                    key={cat}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: COLORS.text }}>{cat}</Text>
                    <Text style={{ color: COLORS.muted }}>
                      {fmtBRL(Number(val || 0))}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Section>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
