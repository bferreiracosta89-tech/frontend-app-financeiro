import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFinanceStore } from "../store/useStore";
import { COLORS, RADIUS, SPACING } from "../utils/theme";
import { fmtBRL, parseNumber } from "../utils/format";
import type { Negotiation, NegotiationChannel } from "../db/types";

const CHANNELS: NegotiationChannel[] = [
  "Telefone",
  "WhatsApp",
  "App",
  "Agência",
  "E-mail",
];

type NegotiationForm = Negotiation & {
  debt_id?: number | null;
  debtId?: number | null;
  valor_original?: number;
  valorOriginal?: number;
  valor_acordado?: number;
  valorAcordado?: number;
  qtd_parcelas?: number;
  qtdParcelas?: number;
  parcelas_pagas?: number;
  parcelasPagas?: number;
};

const empty: NegotiationForm = {
  debt_id: null,
  credor: "",
  data: "",
  canal: "Telefone",
  resposta: "",
  proposta: "",
  valor_original: 0,
  valor_acordado: 0,
  novaParcela: 0,
  qtd_parcelas: 0,
  parcelas_pagas: 0,
  prazo: "",
  aceito: false,
  proximaAcao: "",
};

const normalizeId = (v: any) =>
  v === undefined || v === null || v === "" ? null : Number(v);

const money = (v: any) => Number(v || 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

export default function NegotiationsScreen() {
  const {
    debts,
    negotiations,
    addNegotiation,
    updateNegotiation,
    deleteNegotiation,
  } = useFinanceStore();

  const [editing, setEditing] = useState<NegotiationForm | null>(null);

  const activeDebts = (debts || []).filter(
    (d: any) =>
      !d.deleted_at &&
      !d.deletedAt &&
      !["QUITADO", "CANCELADO"].includes(String(d.status || "").toUpperCase()),
  );

  if (editing) {
    return (
      <NegForm
        neg={editing}
        debts={activeDebts}
        onClose={() => setEditing(null)}
        onSave={async (n) => {
          try {
            if (n.id) await updateNegotiation(n.id, n);
            else await addNegotiation(n);
            setEditing(null);
          } catch (e: any) {
            console.log("ERRO AO SALVAR NEGOCIAÇÃO", e);
            Alert.alert(
              "Erro ao salvar negociação",
              e?.message || "Falha desconhecida.",
            );
          }
        }}
        onDelete={async (id) => {
          await deleteNegotiation(id);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.h1}>Negociações</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => setEditing({ ...empty })}
        >
          <Text style={s.addBtnText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {negotiations.length === 0 && (
          <Text style={s.empty}>Nenhum registro.</Text>
        )}
        {negotiations.map((n: any) => (
          <TouchableOpacity
            key={n.id}
            style={s.card}
            onPress={() =>
              setEditing({
                ...n,
                debt_id: normalizeId(n.debt_id ?? n.debtId),
                novaParcela: Number(n.nova_parcela ?? n.novaParcela ?? 0),
                valor_acordado: Number(
                  n.valor_acordado ?? n.valorAcordado ?? 0,
                ),
                valor_original: Number(
                  n.valor_original ?? n.valorOriginal ?? 0,
                ),
                qtd_parcelas: Number(n.qtd_parcelas ?? n.qtdParcelas ?? 0),
                aceito: !!(n.aceito === true || n.aceito === 1),
                proximaAcao: n.proxima_acao ?? n.proximaAcao ?? "",
              })
            }
            activeOpacity={0.7}
          >
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.credor}>{n.credor}</Text>
                <Text style={s.tipo}>
                  {n.debt_id ? `Dívida #${n.debt_id} · ` : "Sem vínculo · "}
                  {n.canal}
                  {n.data ? " • " + n.data : ""}
                </Text>
              </View>
              <View
                style={[
                  s.pill,
                  {
                    backgroundColor: n.aceito
                      ? COLORS.successBg
                      : COLORS.warningBg,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "500",
                    color: n.aceito ? COLORS.success : COLORS.warning,
                  }}
                >
                  {n.aceito ? "Aceito" : "Em curso"}
                </Text>
              </View>
            </View>
            {n.resposta ? <Text style={s.resp}>{n.resposta}</Text> : null}
            {Number(n.nova_parcela ?? n.novaParcela ?? 0) > 0 ? (
              <Text style={s.newParcel}>
                Nova parcela:{" "}
                {fmtBRL(Number(n.nova_parcela ?? n.novaParcela ?? 0))}
                {n.qtd_parcelas
                  ? ` · ${n.qtd_parcelas} parcelas`
                  : n.prazo
                    ? " em " + n.prazo
                    : ""}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function NegForm({
  neg,
  debts,
  onClose,
  onSave,
  onDelete,
}: {
  neg: NegotiationForm;
  debts: any[];
  onClose: () => void;
  onSave: (n: NegotiationForm) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [form, setForm] = useState<NegotiationForm>(neg);
  const set = <K extends keyof NegotiationForm>(k: K, v: NegotiationForm[K]) =>
    setForm((x: any) => ({ ...x, [k]: v }));

  const selectDebt = (id: number) => {
    const d = debts.find((x: any) => Number(x.id) === Number(id));
    if (!d) return;
    setForm((f: any) => ({
      ...f,
      debt_id: Number(d.id),
      debtId: Number(d.id),
      credor: d.credor || "",
      valor_original: Number(d.total ?? d.valor_total ?? 0),
      valorOriginal: Number(d.total ?? d.valor_total ?? 0),
      valor_acordado: Number(f.valor_acordado || d.total || d.valor_total || 0),
      valorAcordado: Number(f.valor_acordado || d.total || d.valor_total || 0),
      novaParcela: Number(f.novaParcela || d.parcela || 0),
      qtd_parcelas: Number(f.qtd_parcelas || d.qtd_parcelas || 0),
      qtdParcelas: Number(f.qtd_parcelas || d.qtd_parcelas || 0),
      parcelas_pagas: 0,
      parcelasPagas: 0,
    }));
  };

  const handleSave = async () => {
    if (!form.debt_id && !form.debtId) {
      Alert.alert(
        "Atenção",
        "Selecione uma dívida cadastrada para vincular a negociação.",
      );
      return;
    }
    if (!form.credor.trim()) {
      Alert.alert("Atenção", "Selecione uma dívida válida.");
      return;
    }
    const qtd = Number(form.qtd_parcelas ?? form.qtdParcelas ?? 0);
    const parcela = money(form.novaParcela ?? (form as any).nova_parcela);
    const valorAcordadoInformado = money(form.valor_acordado ?? form.valorAcordado);

    if (form.aceito) {
      if (parcela <= 0 || qtd <= 0) {
        Alert.alert("Atenção", "Informe a nova parcela e a quantidade de parcelas da negociação.");
        return;
      }
      const calculado = round2(parcela * qtd);
      if (valorAcordadoInformado > 0 && Math.abs(valorAcordadoInformado - calculado) > 0.05) {
        Alert.alert(
          "Corrigir negociação",
          `O valor negociado precisa bater com parcelas x valor da parcela.\n\nValor informado: ${fmtBRL(valorAcordadoInformado)}\nCálculo: ${qtd} x ${fmtBRL(parcela)} = ${fmtBRL(calculado)}`
        );
        return;
      }
    }

    const valorAcordadoFinal = valorAcordadoInformado > 0 ? valorAcordadoInformado : round2(parcela * qtd);
    await onSave({
      ...form,
      debt_id: normalizeId(form.debt_id ?? form.debtId),
      debtId: normalizeId(form.debt_id ?? form.debtId),
      novaParcela: parcela as any,
      valor_acordado: valorAcordadoFinal,
      valorAcordado: valorAcordadoFinal,
      qtd_parcelas: qtd,
      qtdParcelas: qtd,
      // O backend/sync usa qtdParcelas como quantidade oficial.
      prazo: String(qtd || ""),
      parcelas_pagas: 0,
      parcelasPagas: 0,
    });
  };

  const handleDelete = () => {
    Alert.alert("Excluir", "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => onDelete(form.id!),
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={s.cancel}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={s.h1}>{form.id ? "Editar" : "Nova"}</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={s.save}>Salvar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Field label="Dívida vinculada">
          <View style={s.debtList}>
            {debts.length === 0 ? (
              <Text style={s.emptySmall}>Nenhuma dívida ativa cadastrada.</Text>
            ) : null}
            {debts.map((d: any) => {
              const active =
                Number(form.debt_id ?? form.debtId) === Number(d.id);
              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => selectDebt(Number(d.id))}
                  style={[s.debtOption, active && s.debtOptionActive]}
                >
                  <Text style={[s.debtCredor, active && s.debtTextActive]}>
                    {d.credor}
                  </Text>
                  <Text style={[s.debtMeta, active && s.debtTextActive]}>
                    Saldo {fmtBRL(Number(d.total || 0))} · Parcela{" "}
                    {fmtBRL(Number(d.parcela || 0))} · {d.status || "PAGAR"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Field>

        <Field label="Credor vinculado">
          <TextInput
            style={[s.input, s.inputDisabled]}
            value={form.credor}
            editable={false}
          />
        </Field>

        <View style={{ flexDirection: "row", gap: SPACING.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="Data (AAAA-MM-DD)">
              <TextInput
                style={s.input}
                placeholder="2026-05-15"
                value={form.data}
                onChangeText={(v) => set("data", v)}
              />
            </Field>
          </View>
        </View>

        <Field label="Canal">
          <View style={s.choices}>
            {CHANNELS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => set("canal", c)}
                style={[s.choice, form.canal === c && s.choiceActive]}
              >
                <Text
                  style={[s.choiceText, form.canal === c && s.choiceTextActive]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <Field label="Resposta recebida">
          <TextInput
            style={[s.input, { height: 70 }]}
            multiline
            value={form.resposta}
            onChangeText={(v) => set("resposta", v)}
          />
        </Field>
        <Field label="Proposta apresentada">
          <TextInput
            style={[s.input, { height: 70 }]}
            multiline
            value={form.proposta}
            onChangeText={(v) => set("proposta", v)}
          />
        </Field>

        <View style={{ flexDirection: "row", gap: SPACING.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="Valor acordado">
              <TextInput
                style={s.input}
                keyboardType="numeric"
                value={String(form.valor_acordado ?? form.valorAcordado ?? 0)}
                onChangeText={(v) =>
                  setForm((x: any) => ({
                    ...x,
                    valor_acordado: parseNumber(v),
                    valorAcordado: parseNumber(v),
                  }))
                }
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Nova parcela">
              <TextInput
                style={s.input}
                keyboardType="numeric"
                value={String(form.novaParcela ?? form.novaParcela ?? 0)}
                onChangeText={(v) =>
                  setForm((x: any) => ({
                    ...x,
                    novaParcela: parseNumber(v),
                  }))
                }
              />
            </Field>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: SPACING.sm }}>
          <View style={{ flex: 1 }}>
            <Field label="Qtd parcelas">
              <TextInput
                style={s.input}
                keyboardType="number-pad"
                value={String(form.qtd_parcelas ?? form.qtdParcelas ?? 0)}
                onChangeText={(v) =>
                  setForm((x: any) => ({
                    ...x,
                    qtd_parcelas: parseInt(v || "0", 10) || 0,
                    qtdParcelas: parseInt(v || "0", 10) || 0,
                  }))
                }
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Prazo">
              <TextInput
                style={s.input}
                placeholder="36 meses"
                value={form.prazo}
                onChangeText={(v) => set("prazo", v)}
              />
            </Field>
          </View>
        </View>

        <View style={s.switchRow}>
          <Text style={s.label}>Acordo aceito</Text>
          <Switch
            value={!!form.aceito}
            onValueChange={(v) => set("aceito", v)}
          />
        </View>

        <Field label="Próxima ação">
          <TextInput
            style={s.input}
            value={form.proximaAcao ?? form.proximaAcao ?? ""}
            onChangeText={(v) => set("proximaAcao", v)}
          />
        </Field>

        <Text style={s.infoText}>
          Ao salvar como aceito, a dívida vinculada será atualizada para
          NEGOCIAR, com parcelas pagas zeradas.
        </Text>

        {form.id ? (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
            <Text style={s.deleteText}>Excluir</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  h1: { fontSize: 18, fontWeight: "500", color: COLORS.text },
  addBtn: {
    backgroundColor: COLORS.info,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  addBtnText: { color: "#fff", fontWeight: "500", fontSize: 13 },
  cancel: { color: COLORS.textMuted, fontSize: 14 },
  save: { color: COLORS.info, fontWeight: "500", fontSize: 14 },
  content: { padding: SPACING.lg, paddingBottom: 40 },
  empty: { textAlign: "center", color: COLORS.textMuted, paddingVertical: 40 },
  emptySmall: { color: COLORS.textMuted, fontSize: 12, padding: SPACING.sm },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  row: { flexDirection: "row", alignItems: "flex-start" },
  credor: { fontSize: 14, fontWeight: "500", color: COLORS.text },
  tipo: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  resp: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 0.5,
    borderColor: COLORS.border,
  },
  newParcel: { fontSize: 12, color: COLORS.info, marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  label: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.text,
  },
  inputDisabled: { backgroundColor: COLORS.bg, color: COLORS.textMuted },
  choices: { flexDirection: "row", gap: SPACING.xs, flexWrap: "wrap" },
  choice: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
  },
  choiceActive: { backgroundColor: COLORS.info, borderColor: COLORS.info },
  choiceText: { fontSize: 12, color: COLORS.text },
  choiceTextActive: { color: "#fff", fontWeight: "500" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  deleteBtn: {
    backgroundColor: COLORS.dangerBg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginTop: SPACING.md,
  },
  deleteText: { color: COLORS.danger, fontWeight: "500" },
  debtList: { gap: SPACING.sm },
  debtOption: {
    borderWidth: 0.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  debtOptionActive: {
    borderColor: COLORS.info,
    backgroundColor: COLORS.infoBg,
  },
  debtCredor: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  debtMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  debtTextActive: { color: COLORS.info },
  infoText: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
