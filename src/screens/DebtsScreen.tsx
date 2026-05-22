import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Switch,
  Alert,
} from "react-native";
import { useFinanceStore } from "../store/useStore";
import { colors } from "../theme/colors";
import { COLORS, RADIUS, SPACING } from "../utils/theme";
import { createPayment, type PaymentType } from "../services/payments";
import PaymentModal from "../components/PaymentModal";

const TIPOS = [
  "Empréstimo",
  "Consignado",
  "Cartão",
  "Financiamento",
  "Fintech",
  "Outro",
];
const STATUSES = ["PAGAR", "NEGOCIAR", "PAUSADO", "QUITADO"];

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DebtsScreen() {
  const { debts, loadAll, addDebt, updateDebt, deleteDebt } = useFinanceStore();
  const [editing, setEditing] = useState<any | null>(null);
  const [paymentCtx, setPaymentCtx] = useState<{
    debt: any;
    tipo: PaymentType;
  } | null>(null);

  const ativos = debts.filter((d) => !d.deleted_at);

  const handleNew = () =>
    setEditing({
      credor: "",
      tipo: "Empréstimo",
      total: 0,
      parcela: 0,
      vencimento: "",
      status: "PAGAR",
      prioridade: "MEDIA",
      garantia: 0,
      observacao: "",
      numero_contrato: "",
      valor_total: 0,
      taxa_juros: 0,
      qtd_parcelas: 0,
      parcelas_pagas: 0,
    });

  const handleSave = async () => {
    try {
      if (!editing?.credor?.trim()) {
        Alert.alert("Erro", "Informe o credor");
        return;
      }

      if (editing.id) {
        await updateDebt(editing.id, editing);
      } else {
        await addDebt(editing);
      }

      setEditing(null);
    } catch (e: any) {
      console.log("ERRO AO SALVAR DÍVIDA", e);
      Alert.alert("Erro ao salvar dívida", e?.message || "Falha desconhecida.");
    }
  };
  const handleDelete = (d: any) => {
    Alert.alert(
      "Excluir dívida?",
      `Remover ${d.credor}? Os pagamentos associados também serão removidos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            await deleteDebt(d.id);
          },
        },
      ],
    );
  };

  const handlePayment = async (data: any) => {
    await createPayment(data);
    await loadAll();
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>Controle financeiro</Text>
          <Text style={s.title}>Dívidas</Text>
          <Text style={s.subtitle}>Acompanhe saldo, parcela, status e ações de pagamento.</Text>
        </View>
      </View>

      <Pressable style={s.addBtn} onPress={handleNew}>
        <Text style={s.addBtnText}>+ Nova dívida</Text>
      </Pressable>

      {ativos.map((d) => (
        <View key={d.id} style={s.card}>
          <View style={s.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.credor}>{d.credor}</Text>
              <Text style={s.sub}>
                {d.tipo}
                {d.numero_contrato ? ` · ${d.numero_contrato}` : ""}
              </Text>
            </View>
            <View style={[s.statusBadge, statusStyle(d.status)]}>
              <Text style={s.statusText}>{d.status}</Text>
            </View>
          </View>

          <View style={s.stats}>
            <Stat label="Parcela" value={fmt(d.parcela)} />
            <Stat label="Saldo devedor" value={fmt(d.total)} />
            <Stat
              label="Juros a.m."
              value={`${(d.taxa_juros || 0).toFixed(2)}%`}
            />
          </View>

          {d.qtd_parcelas > 0 && (
            <Text style={s.progress}>
              {d.parcelas_pagas}/{d.qtd_parcelas} parcelas
              {d.parcelas_pagas >= d.qtd_parcelas ? " ✓ Tudo pago" : ""}
            </Text>
          )}

          {/* Ações de PAGAMENTO */}
          <View style={s.paymentActions}>
            <PayBtn
              label="Pagar parcela"
              color={colors.success}
              onPress={() => setPaymentCtx({ debt: d, tipo: "PARCELA" })}
            />
            <PayBtn
              label="Pago parcial"
              color={colors.warning}
              onPress={() => setPaymentCtx({ debt: d, tipo: "PARCIAL" })}
            />
            <PayBtn
              label="Amortizar"
              color={colors.info}
              onPress={() => setPaymentCtx({ debt: d, tipo: "AMORTIZACAO" })}
            />
            <PayBtn
              label="Liquidar"
              color={colors.ink}
              onPress={() => setPaymentCtx({ debt: d, tipo: "LIQUIDACAO" })}
            />
            <PayBtn
              label="Não paguei"
              color={colors.danger}
              onPress={() => setPaymentCtx({ debt: d, tipo: "NAO_PAGO" })}
            />
          </View>

          <View style={s.bottomActions}>
            <Pressable onPress={() => setEditing(d)}>
              <Text style={[s.linkBtn, { color: colors.info }]}>Editar</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(d)}>
              <Text style={[s.linkBtn, { color: colors.danger }]}>Excluir</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Modal de edição da dívida */}
      <Modal
        visible={!!editing}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(null)}
      >
        <View style={s.backdrop}>
          <View style={s.modalCard}>
            <ScrollView>
              <Text style={s.modalTitle}>
                {editing?.id ? "Editar dívida" : "Nova dívida"}
              </Text>
              {editing && (
                <>
                  <Inp
                    label="Credor"
                    value={editing.credor}
                    onChange={(v: string) =>
                      setEditing({ ...editing, credor: v })
                    }
                  />
                  <Select
                    label="Tipo"
                    value={editing.tipo}
                    options={TIPOS}
                    onChange={(v: string) =>
                      setEditing({ ...editing, tipo: v })
                    }
                  />
                  <Inp
                    label="Nº do contrato"
                    value={editing.numero_contrato}
                    onChange={(v: string) =>
                      setEditing({ ...editing, numero_contrato: v })
                    }
                  />
                  <Inp
                    label="Valor total contratado (R$)"
                    value={String(editing.valor_total ?? 0)}
                    onChange={(v: string) =>
                      setEditing({
                        ...editing,
                        valor_total: parseFloat(String(v)) || 0,
                      })
                    }
                    kt="decimal-pad"
                  />
                  <Inp
                    label="Saldo devedor atual (R$)"
                    value={String(editing.total ?? 0)}
                    onChange={(v: string) =>
                      setEditing({ ...editing, total: parseFloat(String(v)) || 0 })
                    }
                    kt="decimal-pad"
                  />
                  <Inp
                    label="Taxa de juros (% a.m.)"
                    value={String(editing.taxa_juros ?? 0)}
                    onChange={(v: string) =>
                      setEditing({ ...editing, taxa_juros: parseFloat(String(v)) || 0 })
                    }
                    kt="decimal-pad"
                  />
                  <Inp
                    label="Valor da parcela (R$)"
                    value={String(editing.parcela ?? 0)}
                    onChange={(v: string) =>
                      setEditing({ ...editing, parcela: parseFloat(String(v)) || 0 })
                    }
                    kt="decimal-pad"
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Inp
                        label="Qtd parcelas"
                        value={String(editing.qtd_parcelas ?? 0)}
                        onChange={(v: string) =>
                          setEditing({
                            ...editing,
                            qtd_parcelas: parseInt(String(v)) || 0,
                          })
                        }
                        kt="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Inp
                        label="Parcelas pagas"
                        value={String(editing.parcelas_pagas ?? 0)}
                        onChange={(v: string) =>
                          setEditing({
                            ...editing,
                            parcelas_pagas: parseInt(String(v)) || 0,
                          })
                        }
                        kt="number-pad"
                      />
                    </View>
                  </View>
                  <Inp
                    label="Vencimento"
                    value={editing.vencimento}
                    onChange={(v: string) =>
                      setEditing({ ...editing, vencimento: v })
                    }
                  />
                  <Select
                    label="Status"
                    value={editing.status}
                    options={STATUSES}
                    onChange={(v: string) =>
                      setEditing({ ...editing, status: v })
                    }
                  />
                  <View style={s.switchRow}>
                    <Text style={s.fieldLabel}>
                      Possui garantia real (imóvel/veículo)
                    </Text>
                    <Switch
                      value={!!editing.garantia}
                      onValueChange={(v: boolean) =>
                        setEditing({ ...editing, garantia: v ? 1 : 0 })
                      }
                    />
                  </View>
                </>
              )}
              <View style={s.modalActions}>
                <Pressable
                  style={[s.modalBtn, s.modalBtnGhost]}
                  onPress={() => setEditing(null)}
                >
                  <Text style={{ color: colors.ink, fontWeight: "bold" }}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.modalBtn, s.modalBtnPrimary]}
                  onPress={handleSave}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>
                    Salvar
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal de pagamento */}
      <PaymentModal
        visible={!!paymentCtx}
        debt={paymentCtx?.debt || null}
        tipo={paymentCtx?.tipo || "PARCELA"}
        onClose={() => setPaymentCtx(null)}
        onSubmit={handlePayment}
      />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}
function PayBtn({ label, color, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={[s.payBtn, { borderColor: color }]}>
      <Text style={[s.payBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}
function Inp({ label, value, onChange, kt }: any) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value || ""}
        onChangeText={onChange}
        keyboardType={kt || "default"}
        style={s.input}
      />
    </View>
  );
}
function Select({ label, value, options, onChange }: any) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.selectRow}>
        {options.map((opt: string) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[s.selectChip, value === opt && s.selectChipActive]}
          >
            <Text
              style={[
                s.selectChipText,
                value === opt && s.selectChipTextActive,
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function statusStyle(status: string) {
  if (status === "PAGAR") return { backgroundColor: colors.dangerBg };
  if (status === "NEGOCIAR") return { backgroundColor: colors.warningBg };
  if (status === "PAUSADO") return { backgroundColor: colors.border };
  if (status === "QUITADO") return { backgroundColor: colors.successBg };
  return {};
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.md, paddingBottom: 110 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm },
  eyebrow: { color: COLORS.info, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },
  subtitle: { color: COLORS.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  addBtn: {
    backgroundColor: COLORS.info,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  addBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  credor: { fontSize: 17, fontWeight: "900", color: COLORS.text, letterSpacing: -0.2 },
  sub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border },
  statusText: { fontSize: 10, fontWeight: "900", color: COLORS.text },
  stats: { flexDirection: "row", gap: 8, marginTop: 12 },
  stat: { flex: 1, backgroundColor: COLORS.neutralBg, padding: 10, borderRadius: RADIUS.md },
  statLabel: { fontSize: 10, color: COLORS.muted, textTransform: "uppercase", fontWeight: "800" },
  statValue: { fontSize: 14, fontWeight: "900", color: COLORS.text, marginTop: 3 },
  progress: { fontSize: 12, color: COLORS.muted, marginTop: 10, fontWeight: "700" },
  paymentActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  payBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.surface,
  },
  payBtnText: { fontSize: 11, fontWeight: "900" },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  linkBtn: { fontSize: 13, fontWeight: "900" },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.48)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: "92%",
  },
  modalTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, marginBottom: SPACING.md },
  fieldLabel: { fontSize: 12, color: COLORS.muted, marginBottom: 6, fontWeight: "800" },
  input: {
    backgroundColor: COLORS.neutralBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 },
  selectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  selectChipActive: { backgroundColor: COLORS.info, borderColor: COLORS.info },
  selectChipText: { fontSize: 12, color: COLORS.text, fontWeight: "700" },
  selectChipTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: SPACING.lg },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.md },
  modalBtnGhost: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  modalBtnPrimary: { backgroundColor: COLORS.info },
});
