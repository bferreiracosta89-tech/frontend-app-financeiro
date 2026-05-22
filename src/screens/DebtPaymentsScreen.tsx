import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFinanceStore } from "../store/useStore";
import PaymentModal from "../components/PaymentModal";
import { colors } from "../theme/colors";
import {
  createPayment,
  deletePayment,
  type PaymentType,
} from "../services/payments";

interface Props {
  route?: { params?: { debtId?: number | string } };
  navigation: any;
}

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const normalizePayment = (p: any) => ({
  ...p,
  id: Number(p.id),
  debtId: Number(p.debt_id ?? p.debtId),
  valorPago: Number(p.valor_pago ?? p.valorPago ?? 0),
  dataPagamento: p.data_pagamento ?? p.dataPagamento ?? "",
  juros: Number(p.juros || 0),
  desconto: Number(p.desconto || 0),
  tipo: p.tipo,
  competencia: p.competencia,
  observacao: p.observacao || "",
});

export default function DebtPaymentsScreen({ route, navigation }: Props) {
  const rawDebtId = route?.params?.debtId;
  const initialDebtId =
    rawDebtId !== undefined && rawDebtId !== null ? Number(rawDebtId) : null;

  const { debts, payments, loadAll } = useFinanceStore();
  const [loading, setLoading] = useState(true);
  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(
    initialDebtId,
  );
  const [modal, setModal] = useState<{ debt: any; tipo: PaymentType } | null>(
    null,
  );

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  const activeDebts = useMemo(
    () =>
      (debts || []).filter(
        (d: any) =>
          !d.deleted_at &&
          !["QUITADO", "CANCELADO"].includes(
            String(d.status || "").toUpperCase(),
          ),
      ),
    [debts],
  );

  const selectedDebt = selectedDebtId
    ? (debts || []).find((d: any) => Number(d.id) === Number(selectedDebtId))
    : null;

  const normalizedPayments = useMemo(
    () =>
      (payments || []).filter((p: any) => !p.deleted_at).map(normalizePayment),
    [payments],
  );

  const debtPayments = selectedDebt
    ? normalizedPayments.filter(
        (p: any) => Number(p.debtId) === Number(selectedDebt.id),
      )
    : [];

  const totalPago = debtPayments
    .filter((p: any) => p.tipo !== "NAO_PAGO")
    .reduce((a: number, p: any) => a + Number(p.valorPago || 0), 0);

  const totalJuros = debtPayments.reduce(
    (a: number, p: any) => a + Number(p.juros || 0),
    0,
  );
  const totalDesconto = debtPayments.reduce(
    (a: number, p: any) => a + Number(p.desconto || 0),
    0,
  );

  const openPayment = (debt: any, tipo: PaymentType = "PARCELA") => {
    setSelectedDebtId(Number(debt.id));
    setModal({ debt, tipo });
  };

  const handleSubmit = async (data: any) => {
    try {
      await createPayment({
        debt_id: Number(data.debt_id ?? data.debtId),
        competencia: data.competencia,
        data_pagamento: data.data_pagamento ?? data.dataPagamento,
        valor_pago: Number(data.valor_pago ?? data.valorPago ?? 0),
        tipo: data.tipo,
        juros: Number(data.juros || 0),
        desconto: Number(data.desconto || 0),
        observacao: data.observacao || "",
      });
      setModal(null);
      await loadAll();
    } catch (e: any) {
      Alert.alert(
        "Erro ao registrar pagamento",
        e?.message || "Falha desconhecida.",
      );
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      "Excluir pagamento",
      "O saldo da dívida será revertido. Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            await deletePayment(id);
            await loadAll();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.info} />
      </View>
    );
  }

  if (!selectedDebt) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={s.header}>
          <Text style={s.title}>Pagamentos de dívidas</Text>
          <Text style={s.subtitle}>
            Selecione uma dívida abaixo para registrar ou revisar pagamentos.
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
          {activeDebts.length === 0 ? (
            <Text style={s.empty}>Nenhuma dívida ativa encontrada.</Text>
          ) : (
            activeDebts.map((d: any) => (
              <View key={d.id} style={s.card}>
                <View style={s.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.competencia}>
                      {d.credor || "Sem credor"}
                    </Text>
                    <Text style={s.meta}>
                      Saldo {fmtBRL(d.total || d.valor_total)} · Parcela{" "}
                      {fmtBRL(d.parcela)}
                    </Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: colors.infoBg }]}>
                    <Text style={[s.badgeTxt, { color: colors.info }]}>
                      {d.status || "PAGAR"}
                    </Text>
                  </View>
                </View>

                <View style={s.actionsRow}>
                  <Pressable
                    style={s.smallBtn}
                    onPress={() => setSelectedDebtId(Number(d.id))}
                  >
                    <Text style={s.smallBtnText}>Ver histórico</Text>
                  </Pressable>
                  <Pressable
                    style={s.smallBtnPrimary}
                    onPress={() => openPayment(d, "PARCELA")}
                  >
                    <Text style={s.smallBtnTextPrimary}>Pagar</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <PaymentModal
          visible={!!modal}
          debt={modal?.debt || null}
          tipo={modal?.tipo || "PARCELA"}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.header}>
        <Pressable onPress={() => setSelectedDebtId(null)}>
          <Text style={{ color: colors.info, marginBottom: 8 }}>
            ← Trocar dívida
          </Text>
        </Pressable>

        <Text style={s.title}>{selectedDebt.credor}</Text>
        <Text style={s.subtitle}>
          {selectedDebt.tipo}
          {selectedDebt.numeroContrato
            ? ` · ${selectedDebt.numeroContrato}`
            : ""}
        </Text>

        <View style={s.statsRow}>
          <Stat
            label="Saldo atual"
            value={fmtBRL(selectedDebt.total || selectedDebt.valor_total)}
            color={colors.danger}
          />
          <Stat
            label="Parcela"
            value={fmtBRL(selectedDebt.parcela)}
            color={colors.ink}
          />
          <Stat
            label="Pagas"
            value={`${selectedDebt.parcelas_pagas || selectedDebt.parcelasPagas || 0}/${selectedDebt.qtd_parcelas || selectedDebt.qtdParcelas || "?"}`}
            color={colors.success}
          />
        </View>

        <View style={s.statsRow}>
          <Stat
            label="Pago histórico"
            value={fmtBRL(totalPago)}
            color={colors.success}
          />
          <Stat
            label="Juros pagos"
            value={fmtBRL(totalJuros)}
            color={colors.warning}
          />
          <Stat
            label="Descontos"
            value={fmtBRL(totalDesconto)}
            color={colors.info}
          />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
      >
        <View style={s.quickActions}>
          <Pressable
            style={s.quickBtn}
            onPress={() => openPayment(selectedDebt, "PARCELA")}
          >
            <Text style={s.quickTxt}>Parcela</Text>
          </Pressable>
          <Pressable
            style={s.quickBtn}
            onPress={() => openPayment(selectedDebt, "PARCIAL")}
          >
            <Text style={s.quickTxt}>Parcial</Text>
          </Pressable>
          <Pressable
            style={s.quickBtn}
            onPress={() => openPayment(selectedDebt, "AMORTIZACAO")}
          >
            <Text style={s.quickTxt}>Amortizar</Text>
          </Pressable>
          <Pressable
            style={s.quickBtnDanger}
            onPress={() => openPayment(selectedDebt, "NAO_PAGO")}
          >
            <Text style={s.quickTxtDanger}>Não pago</Text>
          </Pressable>
        </View>

        {debtPayments.length === 0 ? (
          <Text style={s.empty}>Nenhum pagamento registrado.</Text>
        ) : (
          debtPayments.map((p: any) => (
            <View key={p.id} style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.competencia}>{p.competencia}</Text>
                <View style={[s.badge, badgeStyle(p.tipo)]}>
                  <Text style={[s.badgeTxt, badgeTextStyle(p.tipo)]}>
                    {tipoLabel(p.tipo)}
                  </Text>
                </View>
              </View>
              <Text style={s.valor}>
                {p.tipo === "NAO_PAGO" ? "—" : fmtBRL(p.valorPago)}
              </Text>
              {p.dataPagamento ? (
                <Text style={s.meta}>Pago em {p.dataPagamento}</Text>
              ) : null}
              {(p.juros > 0 || p.desconto > 0) && (
                <Text style={s.meta}>
                  {p.juros > 0 ? `Juros ${fmtBRL(p.juros)}` : ""}
                  {p.juros > 0 && p.desconto > 0 ? " · " : ""}
                  {p.desconto > 0 ? `Desconto ${fmtBRL(p.desconto)}` : ""}
                </Text>
              )}
              {p.observacao ? <Text style={s.obs}>{p.observacao}</Text> : null}
              <Pressable onPress={() => handleDelete(p.id)} style={s.delBtn}>
                <Text style={s.delTxt}>Excluir</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      <PaymentModal
        visible={!!modal}
        debt={modal?.debt || null}
        tipo={modal?.tipo || "PARCELA"}
        onClose={() => setModal(null)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function tipoLabel(t: string) {
  return (
    {
      PARCELA: "Parcela",
      AMORTIZACAO: "Amortização",
      LIQUIDACAO: "Liquidação",
      PARCIAL: "Parcial",
      NAO_PAGO: "Não pago",
    }[t] || t
  );
}

function badgeStyle(t: string) {
  if (t === "NAO_PAGO") return { backgroundColor: colors.dangerBg };
  if (t === "LIQUIDACAO") return { backgroundColor: "#DDDDDD" };
  if (t === "AMORTIZACAO") return { backgroundColor: colors.infoBg };
  if (t === "PARCIAL") return { backgroundColor: colors.warningBg };
  return { backgroundColor: colors.successBg };
}

function badgeTextStyle(t: string) {
  if (t === "NAO_PAGO") return { color: colors.danger };
  if (t === "LIQUIDACAO") return { color: "#333" };
  if (t === "AMORTIZACAO") return { color: colors.info };
  if (t === "PARCIAL") return { color: colors.warning };
  return { color: colors.success };
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: "bold", color: colors.ink },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  statsRow: { flexDirection: "row", marginTop: 12, gap: 8 },
  stat: { flex: 1 },
  statLabel: { fontSize: 10, color: colors.muted, textTransform: "uppercase" },
  statValue: { fontSize: 15, fontWeight: "bold", marginTop: 2 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 32 },
  card: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  competencia: { fontSize: 14, fontWeight: "bold", color: colors.ink },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeTxt: { fontSize: 10, fontWeight: "bold" },
  valor: { fontSize: 18, fontWeight: "bold", color: colors.ink, marginTop: 6 },
  meta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  obs: { fontSize: 12, color: colors.ink, marginTop: 4, fontStyle: "italic" },
  delBtn: { alignSelf: "flex-end", marginTop: 8 },
  delTxt: { color: colors.danger, fontSize: 12 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  smallBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  smallBtnText: { color: colors.ink, fontWeight: "bold" },
  smallBtnPrimary: {
    flex: 1,
    backgroundColor: colors.info,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  smallBtnTextPrimary: { color: "#fff", fontWeight: "bold" },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  quickBtn: {
    flexGrow: 1,
    backgroundColor: colors.infoBg,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  quickTxt: { color: colors.info, fontWeight: "bold" },
  quickBtnDanger: {
    flexGrow: 1,
    backgroundColor: colors.dangerBg,
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  quickTxtDanger: { color: colors.danger, fontWeight: "bold" },
});
