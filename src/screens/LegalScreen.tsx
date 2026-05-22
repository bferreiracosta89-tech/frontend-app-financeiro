import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useFinanceStore, useTotals } from "../store/useStore";
import { COLORS, RADIUS, SPACING } from "../utils/theme";
import { fmtBRL } from "../utils/format";
import type { LegalLocation } from "../db/types";

const LOCATIONS: LegalLocation[] = ["Defensoria Pública", "PROCON", "Juizado"];

export default function LegalScreen() {
  const { legal, saveLegal, income, minExist, debts, negotiations } =
    useFinanceStore();
  const totals = useTotals();
  const [form, setForm] = useState(legal);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((x: any) => ({ ...x, [k]: v }));

  const handleSave = async () => {
    await saveLegal(form);
    Alert.alert("Sucesso", "Plano jurídico salvo");
  };

  const generatePdf = async () => {
    const html = buildReportHtml({
      income,
      minExist,
      debts,
      negotiations,
      legal: form,
      totals,
    });
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: "Relatório financeiro" });
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível gerar o PDF");
    }
  };

  const generateRequerimento = () => {
    const listaDividas = debts
      .map(
        (d) =>
          `- ${d.credor}: total ${fmtBRL(d.total)} | parcela ${fmtBRL(d.parcela)} | ${d.garantia ? "com garantia" : "sem garantia"}`,
      )
      .join("\n");
    const texto = `REQUERIMENTO DE REPACTUAÇÃO DE DÍVIDAS
Fundamento: Lei nº 14.181/2021 — Lei do Superendividamento

O(A) requerente, pessoa física consumidora, encontra-se em situação de superendividamento, comprometida na manutenção do mínimo existencial.

DADOS FINANCEIROS:
- Renda líquida mensal: ${fmtBRL(income.liquido)}
- Mínimo existencial mensal: ${fmtBRL(totals.totalMinE)}
- Reserva para imprevistos: ${fmtBRL(minExist.reserva)}
- Capacidade mensal global de pagamento: ${fmtBRL(totals.capacidade)}

RELAÇÃO DE CREDORES:
${listaDividas}

REQUER:
A designação de audiência conciliatória global com todos os credores, com apresentação de plano de pagamento que respeite a capacidade mensal demonstrada e preserve o mínimo existencial, na forma do art. 104-A do CDC.

Local e data: _________________________
Assinatura: __________________________`;

    Alert.alert("Requerimento gerado", texto, [{ text: "OK" }]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.h1}>Mais</Text>

        <View
          style={[
            s.card,
            { backgroundColor: COLORS.infoBg, borderColor: COLORS.info },
          ]}
        >
          <Text style={[s.cardLabel, { color: COLORS.info }]}>
            PLANO JURÍDICO
          </Text>
          <Text style={[s.cardText, { color: COLORS.info }]}>
            Lei do Superendividamento (14.181/2021)
          </Text>
        </View>

        <View style={s.card}>
          <View style={s.switchRow}>
            <Text style={s.label}>Documento protocolado</Text>
            <Switch
              value={form.protocolado}
              onValueChange={(v) => set("protocolado", v)}
            />
          </View>
          <Field label="Local">
            <View style={s.choices}>
              {LOCATIONS.map((l) => (
                <TouchableOpacity
                  key={l}
                  onPress={() => set("local", l)}
                  style={[s.choice, form.local === l && s.choiceActive]}
                >
                  <Text
                    style={[
                      s.choiceText,
                      form.local === l && s.choiceTextActive,
                    ]}
                  >
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <View style={{ flex: 1 }}>
              <Field label="Data protocolo">
                <TextInput
                  style={s.input}
                  placeholder="AAAA-MM-DD"
                  value={form.dataProtocolo}
                  onChangeText={(v) => set("dataProtocolo", v)}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Nº protocolo">
                <TextInput
                  style={s.input}
                  value={form.numero}
                  onChangeText={(v) => set("numero", v)}
                />
              </Field>
            </View>
          </View>
          <Field label="Data audiência">
            <TextInput
              style={s.input}
              placeholder="AAAA-MM-DD"
              value={form.dataAudiencia}
              onChangeText={(v) => set("dataAudiencia", v)}
            />
          </Field>
          <Field label="Status">
            <TextInput
              style={s.input}
              value={form.status}
              onChangeText={(v) => set("status", v)}
            />
          </Field>
          <Field label="Observações">
            <TextInput
              style={[s.input, { height: 70 }]}
              multiline
              value={form.observacao}
              onChangeText={(v) => set("observacao", v)}
            />
          </Field>
          <TouchableOpacity style={s.btn} onPress={handleSave}>
            <Text style={s.btnText}>Salvar plano jurídico</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.btnSecondary} onPress={generateRequerimento}>
          <Text style={s.btnSecondaryText}>Gerar requerimento</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={generatePdf}>
          <Text style={s.btnText}>Exportar relatório PDF</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function buildReportHtml({
  income,
  minExist,
  debts,
  negotiations,
  legal,
  totals,
}: any): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Helvetica,Arial,sans-serif;color:#222;padding:20px}
h1{color:#185FA5;border-bottom:2px solid #185FA5;padding-bottom:8px}
h2{color:#185FA5;margin-top:24px;font-size:16px}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
th,td{border:1px solid #ddd;padding:6px;text-align:left}
th{background:#E6F1FB;color:#0C447C}
.box{background:#F1EFE8;padding:12px;border-radius:6px;margin:10px 0}
.alert{background:#FCEBEB;color:#791F1F;padding:12px;border-left:4px solid #E24B4A;border-radius:4px}
</style></head><body>
<h1>Relatório de Restauração Financeira</h1>
<p style="color:#888">Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
<h2>Resumo</h2>
<div class="box">
<p><b>Renda líquida:</b> ${fmtBRL(income.liquido)}</p>
<p><b>Mínimo existencial:</b> ${fmtBRL(totals.totalMinE)}</p>
<p><b>Dívidas a pagar:</b> ${fmtBRL(totals.totalPagas)}</p>
<p><b>Capacidade mensal:</b> ${fmtBRL(totals.capacidade)}</p>
<p><b>Saldo:</b> ${fmtBRL(totals.saldo)}</p>
</div>
<h2>Dívidas</h2>
<table><tr><th>Credor</th><th>Total</th><th>Parcela</th><th>Status</th><th>Prior.</th><th>Garantia</th></tr>
${debts.map((d: any) => `<tr><td>${d.credor}</td><td>${fmtBRL(d.total)}</td><td>${fmtBRL(d.parcela)}</td><td>${d.status}</td><td>${d.prioridade}</td><td>${d.garantia ? "Sim" : "Não"}</td></tr>`).join("")}
</table>
<h2>Negociações</h2>
<table><tr><th>Credor</th><th>Data</th><th>Canal</th><th>Resposta</th><th>Aceito</th></tr>
${negotiations.map((n: any) => `<tr><td>${n.credor}</td><td>${n.data}</td><td>${n.canal}</td><td>${n.resposta}</td><td>${n.aceito ? "Sim" : "Não"}</td></tr>`).join("")}
</table>
<h2>Plano jurídico</h2>
<div class="box">
<p><b>Protocolado:</b> ${legal.protocolado ? "Sim" : "Não"}</p>
<p><b>Local:</b> ${legal.local}</p>
<p><b>Nº:</b> ${legal.numero}</p>
<p><b>Data protocolo:</b> ${legal.dataProtocolo || "-"}</p>
<p><b>Data audiência:</b> ${legal.dataAudiencia || "-"}</p>
<p><b>Status:</b> ${legal.status || "-"}</p>
</div>
${totals.saldo < 0 ? '<div class="alert"><b>ALERTA:</b> saldo negativo. Configura superendividamento — buscar Defensoria Pública.</div>' : ""}
</body></html>`;
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
  content: { padding: SPACING.lg, paddingBottom: 40 },
  h1: {
    fontSize: 22,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  cardLabel: { fontSize: 11, fontWeight: "500", letterSpacing: 0.5 },
  cardText: { fontSize: 13, marginTop: 4 },
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
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
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
  btn: {
    backgroundColor: COLORS.info,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  btnText: { color: "#fff", fontWeight: "500" },
  btnSecondary: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    marginBottom: SPACING.md,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  btnSecondaryText: { color: COLORS.text, fontWeight: "500" },
});
