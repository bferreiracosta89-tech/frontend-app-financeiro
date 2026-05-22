import React, { useEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import {
  Button,
  Card,
  ChoicePills,
  DateField,
  Field,
  MoneyField,
  ScreenScroll,
  Section,
  SwitchRow,
} from "../components/UI";
import { COLORS } from "../utils/theme";
import { useFinanceStore } from "../store/useStore";
import { fmtBRL } from "../utils/format";
import {
  deleteLegalAgreement,
  listLegalAgreements,
  saveLegalAgreement,
} from "../services/priority3";

function parseDebtIds(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return Array.from(new Set(value.map(String).filter(Boolean)));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return Array.from(new Set(parsed.map(String).filter(Boolean)));
    } catch {}
    return Array.from(new Set(value.split(",").map((x) => x.trim()).filter(Boolean)));
  }
  return [String(value)].filter(Boolean);
}

const empty = {
  debt_ids: "[]",
  numero_processo: "",
  orgao: "Defensoria Pública",
  vara: "",
  data_audiencia: "",
  data_homologacao: "",
  status: "EM_ANDAMENTO",
  valor_consolidado: 0,
  parcela_judicial: 0,
  qtd_parcelas: 0,
  parcelas_pagas: 0,
  primeiro_vencimento: "",
  credores_incluidos: "",
  substitui_dividas: false,
  observacao: "",
};

export default function LegalAgreementsScreen() {
  const { debts, loadAll } = useFinanceStore();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const availableDebts = useMemo(() =>
    (debts || []).filter((d: any) => {
      const st = String(d.status || "").toUpperCase();
      return !(d.deleted_at || d.deletedAt) && !["QUITADO", "CANCELADO"].includes(st);
    }),
    [debts],
  );

  const load = async () => setItems(await listLegalAgreements());

  useEffect(() => {
    loadAll().catch(() => undefined);
    load().catch((e: any) =>
      Alert.alert("Erro", e?.message || "Falha ao carregar acordos judiciais"),
    );
  }, []);

  useEffect(() => {
    const selected = availableDebts.filter((d: any) =>
      selectedDebtIds.includes(String(d.id)),
    );
    const total = selected.reduce((a: number, d: any) => a + Number(d.total || d.valor_total || 0), 0);
    const parcelaAtual = selected.reduce((a: number, d: any) => a + Number(d.parcela || 0), 0);
    const credores = selected.map((d: any) => d.credor).filter(Boolean).join(", ");

    setForm((old: any) => ({
      ...old,
      debt_ids: JSON.stringify(selectedDebtIds),
      valor_consolidado: selectedDebtIds.length ? total : old.valor_consolidado,
      parcela_judicial: selectedDebtIds.length && !old.parcela_judicial ? parcelaAtual : old.parcela_judicial,
      credores_incluidos: selectedDebtIds.length ? credores : old.credores_incluidos,
      substitui_dividas: selectedDebtIds.length ? true : old.substitui_dividas,
    }));
  }, [selectedDebtIds, availableDebts]);

  const toggleDebt = (id: string) => {
    setSelectedDebtIds((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    );
  };

  const save = async () => {
    setSaving(true);

    try {
      if (!selectedDebtIds.length) {
        Alert.alert("Atenção", "Selecione pelo menos uma dívida para o acordo judicial.");
        return;
      }
      await saveLegalAgreement({ ...form, debt_ids: JSON.stringify(selectedDebtIds) });
      setForm(empty);
      setSelectedDebtIds([]);
      await loadAll();
      await load();
      Alert.alert("Pronto", "Acordo judicial salvo.");
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const edit = (a: any) => {
    const ids = parseDebtIds(a.debt_ids ?? a.debtIds ?? a.debt_id ?? a.debtId);
    setSelectedDebtIds(ids);
    setForm({
      ...empty,
      ...a,
      debt_ids: JSON.stringify(ids),
      substitui_dividas: !!a.substitui_dividas,
      valor_consolidado: Number(a.valor_consolidado || 0),
      parcela_judicial: Number(a.parcela_judicial || 0),
      qtd_parcelas: Number(a.qtd_parcelas || 0),
      parcelas_pagas: Number(a.parcelas_pagas || 0),
    });
  };

  const remove = (a: any) => {
    Alert.alert(
      "Excluir acordo judicial",
      "Deseja excluir este acordo judicial?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            await deleteLegalAgreement(Number(a.id));
            await load();
          },
        },
      ],
    );
  };

  return (
    <ScreenScroll>
      <Section
        title={
          form.id
            ? "Editar acordo judicial"
            : "Acordo judicial / repactuação homologada"
        }
      >
        <Card>
          <Text style={{ fontWeight: "800", color: COLORS.text, marginBottom: 8 }}>
            Dívidas vinculadas ao acordo
          </Text>
          {availableDebts.map((d: any) => {
            const checked = selectedDebtIds.includes(String(d.id));
            return (
              <View key={d.id} style={{ borderWidth: 1, borderColor: checked ? COLORS.info : COLORS.border, borderRadius: 12, padding: 10, marginBottom: 8 }}>
                <Text style={{ fontWeight: "800", color: COLORS.text }}>{d.credor}</Text>
                <Text style={{ color: COLORS.muted, marginBottom: 8 }}>
                  Saldo {fmtBRL(Number(d.total || d.valor_total || 0))} · Parcela {fmtBRL(Number(d.parcela || 0))} · {d.status || "PAGAR"}
                </Text>
                <Button
                  title={checked ? "Remover do acordo" : "Selecionar dívida"}
                  variant={checked ? "secondary" : "ghost"}
                  onPress={() => toggleDebt(String(d.id))}
                />
              </View>
            );
          })}

          <Field
            label="Número do processo"
            value={form.numero_processo}
            onChangeText={(v: string) =>
              setForm({ ...form, numero_processo: v })
            }
          />

          <Field
            label="Órgão"
            value={form.orgao}
            onChangeText={(v: string) => setForm({ ...form, orgao: v })}
          />

          <Field
            label="Vara / unidade"
            value={form.vara}
            onChangeText={(v: string) => setForm({ ...form, vara: v })}
          />

          <ChoicePills
            label="Status"
            value={form.status}
            options={[
              "EM_ANDAMENTO",
              "AUDIENCIA",
              "HOMOLOGADO",
              "CUMPRINDO",
              "QUITADO",
              "DESCUMPRIDO",
            ]}
            onChange={(v: string) => setForm({ ...form, status: v })}
          />

          <DateField
            label="Data audiência"
            value={form.data_audiencia}
            onChange={(v: string) => setForm({ ...form, data_audiencia: v })}
          />

          <DateField
            label="Data homologação"
            value={form.data_homologacao}
            onChange={(v: string) => setForm({ ...form, data_homologacao: v })}
          />

          <MoneyField
            label="Valor consolidado"
            value={form.valor_consolidado}
            onChange={(n: number) => setForm({ ...form, valor_consolidado: n })}
          />

          <MoneyField
            label="Parcela judicial"
            value={form.parcela_judicial}
            onChange={(n: number) => setForm({ ...form, parcela_judicial: n })}
          />

          <Field
            label="Quantidade de parcelas"
            keyboardType="numeric"
            value={String(form.qtd_parcelas || "")}
            onChangeText={(v: string) =>
              setForm({ ...form, qtd_parcelas: parseInt(String(v), 10) || 0 })
            }
          />

          <DateField
            label="Primeiro vencimento"
            value={form.primeiro_vencimento}
            onChange={(v: string) =>
              setForm({ ...form, primeiro_vencimento: v })
            }
          />

          <Field
            label="Credores incluídos"
            value={form.credores_incluidos}
            multiline
            onChangeText={(v: string) =>
              setForm({ ...form, credores_incluidos: v })
            }
          />

          <SwitchRow
            label="Substitui dívidas originais nos cálculos"
            value={!!form.substitui_dividas}
            onChange={(v: boolean) =>
              setForm({ ...form, substitui_dividas: v })
            }
          />

          <Field
            label="Observação"
            value={form.observacao}
            multiline
            onChangeText={(v: string) => setForm({ ...form, observacao: v })}
          />

          <Button
            title={
              saving
                ? "Salvando..."
                : form.id
                  ? "Salvar alterações"
                  : "Salvar acordo judicial"
            }
            onPress={save}
            disabled={saving}
            full
          />

          {form.id ? (
            <Button
              title="Cancelar edição"
              variant="ghost"
              onPress={() => { setForm(empty); setSelectedDebtIds([]); }}
              full
            />
          ) : null}
        </Card>
      </Section>

      <Section title="Acordos judiciais cadastrados">
        {items.length === 0 ? (
          <Text style={{ color: COLORS.muted }}>
            Nenhum acordo judicial cadastrado.
          </Text>
        ) : null}

        {items.map((a) => (
          <Card key={a.id}>
            <Text style={{ fontWeight: "800", color: COLORS.text }}>
              {a.numero_processo || a.numeroProcesso || "Processo sem número"}
            </Text>
            <Text style={{ color: COLORS.muted }}>
              {a.status} · {fmtBRL(a.parcela_judicial || a.parcelaJudicial)} /
              mês
            </Text>
            <Text style={{ color: COLORS.info }}>
              Consolidado: {fmtBRL(a.valor_consolidado || a.valorConsolidado)}
            </Text>
            <Text style={{ color: COLORS.muted, marginTop: 4 }}>
              Credores: {a.credores_incluidos || "não informado"}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Button
                title="Editar"
                variant="secondary"
                onPress={() => edit(a)}
              />
              <Button
                title="Excluir"
                variant="ghost"
                onPress={() => remove(a)}
              />
            </View>
          </Card>
        ))}
      </Section>
    </ScreenScroll>
  );
}
