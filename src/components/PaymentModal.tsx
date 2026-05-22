import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";

import { colors } from "../theme/colors";
import { listPayments, type PaymentType } from "../services/payments";

export interface PaymentModalDebt {
  id?: number;
  credor?: string;
  total?: number;
  parcela?: number;
}

export interface PaymentInput {
  debt_id: number;
  competencia: string;
  data_pagamento: string;
  valor_pago: number;
  tipo: PaymentType;
  juros: number;
  desconto: number;
  observacao: string;
  amortizacao_modo?: string;
}

interface Props {
  visible: boolean;
  debt: PaymentModalDebt | null;
  tipo?: PaymentType;
  onClose: () => void;
  onSubmit?: (data: PaymentInput) => Promise<void>;
}

const TITLES: Record<PaymentType, string> = {
  PARCELA: "Registrar pagamento de parcela",
  PARCIAL: "Pagamento parcial",
  AMORTIZACAO: "Amortização extra",
  LIQUIDACAO: "Liquidar dívida",
  NAO_PAGO: "Marcar mês como NÃO PAGO",
};

const DESCRIPTIONS: Record<PaymentType, string> = {
  PARCELA: "Abate o valor pago do saldo e incrementa as parcelas pagas.",
  PARCIAL: "Você pagou menos que a parcela cheia. Abate só o que pagou.",
  AMORTIZACAO:
    "Pagamento extra além da parcela mensal. Abate do saldo, não conta como parcela.",
  LIQUIDACAO:
    "Quitação final. Zera o saldo e marca a dívida como QUITADA. Informe o desconto se houve.",
  NAO_PAGO:
    "Registra que neste mês não houve pagamento. Não altera saldo, fica no histórico.",
};

function todayYMD(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentYM(): string {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PaymentModal({
  visible,
  debt,
  tipo = "PARCELA",
  onClose,
  onSubmit,
}: Props) {
  const [competencia, setCompetencia] = useState(currentYM());
  const [data, setData] = useState(todayYMD());
  const [valor, setValor] = useState("");
  const [juros, setJuros] = useState("");
  const [desconto, setDesconto] = useState("");
  const [obs, setObs] = useState("");
  const [amortizacaoModo, setAmortizacaoModo] = useState<"ULTIMAS" | "PROXIMAS">("ULTIMAS");
  const [saving, setSaving] = useState(false);
  const [paidInCompetence, setPaidInCompetence] = useState(0);

  useEffect(() => {
    if (visible && debt) {
      setCompetencia(currentYM());
      setData(tipo === "NAO_PAGO" ? "" : todayYMD());

      setValor(
        tipo === "PARCELA"
          ? String(Math.max(0, Number(debt.parcela || 0) - paidInCompetence))
          : tipo === "LIQUIDACAO"
            ? String(debt.total || 0)
            : "",
      );

      setJuros("");
      setDesconto("");
      setObs("");
      setAmortizacaoModo("ULTIMAS");
    }
  }, [visible, debt, tipo]);


  useEffect(() => {
    let cancelled = false;
    async function loadPaid() {
      if (!visible || !debt?.id) return;
      try {
        const rows = await listPayments({ debtId: Number(debt.id), competencia });
        if (cancelled) return;
        const paid = rows
          .filter((p: any) => p.tipo !== "NAO_PAGO" && !p.deleted_at)
          .reduce((a: number, p: any) => a + Number(p.valor_pago || p.valorPago || 0), 0);
        setPaidInCompetence(paid);
        if (tipo === "PARCELA") setValor(String(Math.max(0, Number(debt.parcela || 0) - paid)));
      } catch {
        if (!cancelled) setPaidInCompetence(0);
      }
    }
    loadPaid();
    return () => { cancelled = true; };
  }, [visible, debt?.id, debt?.parcela, competencia, tipo]);

  if (!debt) return null;

  const handleSave = async () => {
    if (!competencia.match(/^\d{4}-\d{2}$/)) {
      Alert.alert("Erro", "Competência inválida. Use formato YYYY-MM.");
      return;
    }

    const valorPago = parseFloat(valor || "0") || 0;

    if (tipo !== "NAO_PAGO" && valorPago <= 0) {
      Alert.alert("Erro", "Informe o valor pago.");
      return;
    }

    if (!debt.id) {
      Alert.alert("Erro", "Dívida inválida.");
      return;
    }

    setSaving(true);

    try {
      if (onSubmit) {
        await onSubmit({
          debt_id: debt.id,
          competencia,
          data_pagamento: data,
          valor_pago: valorPago,
          tipo,
          juros: parseFloat(juros || "0") || 0,
          desconto: parseFloat(desconto || "0") || 0,
          observacao: obs,
          amortizacao_modo: tipo === "AMORTIZACAO" ? amortizacaoModo : "",
        });
      }

      onClose();
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        <View style={s.card}>
          <ScrollView>
            <Text style={s.title}>{TITLES[tipo]}</Text>
            <Text style={s.debtName}>{debt.credor || "Dívida"}</Text>
            <Text style={s.help}>{DESCRIPTIONS[tipo]}</Text>

            <Field
              label="Competência (YYYY-MM)"
              value={competencia}
              onChange={setCompetencia}
            />

            {tipo === "PARCELA" && paidInCompetence > 0 && (
              <Text style={s.help}>
                Já pago no mês: {paidInCompetence.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Restante da parcela: {Math.max(0, Number(debt.parcela || 0) - paidInCompetence).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </Text>
            )}

            {tipo !== "NAO_PAGO" && (
              <>
                <Field
                  label="Data do pagamento (YYYY-MM-DD)"
                  value={data}
                  onChange={setData}
                />

                <Field
                  label="Valor pago (R$)"
                  value={valor}
                  onChange={setValor}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            {(tipo === "PARCELA" || tipo === "PARCIAL") && (
              <Field
                label="Juros/multa pagos junto (R$)"
                value={juros}
                onChange={setJuros}
                keyboardType="decimal-pad"
              />
            )}

            {tipo === "LIQUIDACAO" && (
              <Field
                label="Desconto obtido (R$)"
                value={desconto}
                onChange={setDesconto}
                keyboardType="decimal-pad"
              />
            )}


            {tipo === "AMORTIZACAO" && (
              <View style={s.field}>
                <Text style={s.fieldLabel}>Como amortizar?</Text>
                <View style={s.choiceRow}>
                  <Pressable style={[s.choice, amortizacaoModo === "ULTIMAS" && s.choiceActive]} onPress={() => setAmortizacaoModo("ULTIMAS")}>
                    <Text style={s.choiceText}>Reduzir últimas parcelas/prazo</Text>
                  </Pressable>
                  <Pressable style={[s.choice, amortizacaoModo === "PROXIMAS" && s.choiceActive]} onPress={() => setAmortizacaoModo("PROXIMAS")}>
                    <Text style={s.choiceText}>Reduzir próximas parcelas</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Field label="Observação" value={obs} onChange={setObs} multiline />

            <View style={s.summary}>
              <Text style={s.summaryTitle}>Efeito no saldo:</Text>
              <Text style={s.summaryText}>
                {effectSummary(
                  tipo,
                  Number(debt.total || 0),
                  Number(valor || 0),
                )}
              </Text>
            </View>

            <View style={s.actions}>
              <Pressable style={[s.btn, s.btnGhost]} onPress={onClose}>
                <Text style={s.btnGhostText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[s.btn, s.btnPrimary]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={s.btnPrimaryText}>
                  {saving ? "Salvando..." : "Confirmar"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function effectSummary(
  tipo: PaymentType,
  saldo: number,
  valor: number,
): string {
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

  switch (tipo) {
    case "PARCELA":
      return `Saldo: ${fmt(saldo)} → ${fmt(
        Math.max(0, saldo - valor),
      )} (conta parcela quando completar o valor mensal)`;

    case "PARCIAL":
    case "AMORTIZACAO":
      return `Saldo: ${fmt(saldo)} → ${fmt(Math.max(0, saldo - valor))}. Escolha se reduz prazo ou valor das próximas parcelas.`;

    case "LIQUIDACAO":
      return `Saldo: ${fmt(saldo)} → ${fmt(0)} · Status: QUITADO`;

    case "NAO_PAGO":
      return `Saldo permanece em ${fmt(saldo)} · só registro histórico.`;

    default:
      return "";
  }
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: "default" | "decimal-pad" | "number-pad";
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType || "default"}
        multiline={!!multiline}
        style={[s.input, multiline && s.inputMultiline]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    maxHeight: "90%",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.ink,
  },
  debtName: {
    fontSize: 16,
    color: colors.info,
    marginTop: 4,
  },
  help: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 16,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 10,
    color: colors.ink,
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  summary: {
    backgroundColor: colors.infoBg,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: colors.info,
    textTransform: "uppercase",
  },
  summaryText: {
    fontSize: 13,
    color: colors.ink,
    marginTop: 4,
  },
  choiceRow: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 },
  choiceActive: { borderColor: colors.info, backgroundColor: colors.infoBg },
  choiceText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostText: {
    color: colors.ink,
    fontWeight: "bold",
  },
  btnPrimary: {
    backgroundColor: colors.info,
  },
  btnPrimaryText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
