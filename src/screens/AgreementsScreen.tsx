import React, { useEffect, useMemo, useState } from "react";
import { Alert, Text } from "react-native";
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
import { fmtBRL } from "../utils/format";

import { getDb } from "../db/database";
import { useFinanceStore } from "../store/useStore";
import {
  listAgreements,
  saveAgreement,
  deleteAgreement,
} from "../services/priority3";

const empty = {
  tipo: "EXTRAJUDICIAL",
  status: "SIMULACAO",
  data_acordo: "",
  debt_id: null as number | null,
  debt_credor: "",
  valor_original: 0,
  valor_acordado: 0,
  desconto: 0,
  nova_parcela: 0,
  qtd_parcelas: 0,
  parcelas_pagas: 0,
  primeiro_vencimento: "",
  canal: "",
  homologado: false,
  substitui_divida: true,
  observacao: "",
};

export default function AgreementsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(empty);
  const [debts, setDebts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setItems(await listAgreements());
    const db = await getDb();

    try {
      setDebts(
        (await db.getAllAsync(
          'SELECT * FROM debts WHERE deleted_at IS NULL OR deleted_at = "" ORDER BY credor ASC',
        )) as any[],
      );
    } catch {
      setDebts(
        (await db.getAllAsync(
          "SELECT * FROM debts ORDER BY credor ASC",
        )) as any[],
      );
    }
  };

  useEffect(() => {
    load().catch((e: any) =>
      Alert.alert("Erro", e?.message || "Falha ao carregar acordos"),
    );
  }, []);

  const economy = useMemo(
    () =>
      Math.max(
        0,
        Number(form.valor_original || 0) - Number(form.valor_acordado || 0),
      ),
    [form.valor_original, form.valor_acordado],
  );

  const selectDebt = (id: string) => {
    if (!id) {
      setForm({ ...form, debt_id: null, debt_credor: "" });
      return;
    }

    const d = debts.find((x) => String(x.id) === String(id));

    setForm({
      ...form,
      debt_id: d?.id || null,
      debt_credor: d?.credor || "",
      valor_original: Number(d?.total || d?.valor_total || 0),
      nova_parcela: Number(d?.parcela || 0),
    });
  };

  const save = async () => {
    if (!form.debt_id) {
      Alert.alert(
        "Atenção",
        "Selecione uma dívida cadastrada para vincular o acordo.",
      );
      return;
    }

    setSaving(true);

    try {
      await saveAgreement({
        ...form,
        desconto: economy,
      });
      await useFinanceStore.getState().loadAll();
      setForm(empty);
      await load();
      Alert.alert("Pronto", "Acordo salvo e pronto para sincronização.");
    } catch (e: any) {
      Alert.alert("Erro ao salvar acordo", e?.message || "Falha desconhecida");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenScroll>
      <Section title="Novo acordo / renegociação">
        <Card>
          <Text style={{ color: COLORS.muted, marginBottom: 8 }}>
            Selecione uma dívida cadastrada. O credor será vinculado
            automaticamente.
          </Text>

          <ChoicePills
            label="Dívida"
            value={String(form.debt_id || "")}
            options={["", ...debts.map((d) => String(d.id))]}
            onChange={selectDebt}
          />

          <Text style={{ color: COLORS.muted, marginBottom: 12 }}>
            Credor vinculado: {form.debt_credor || "nenhuma dívida selecionada"}
          </Text>

          <ChoicePills
            label="Tipo"
            value={form.tipo}
            options={["EXTRAJUDICIAL", "ADMINISTRATIVO", "JUDICIAL"]}
            onChange={(v: string) => setForm({ ...form, tipo: v })}
          />

          <ChoicePills
            label="Status"
            value={form.status}
            options={[
              "SIMULACAO",
              "PROPOSTO",
              "ACEITO",
              "ATIVO",
              "QUITADO",
              "CANCELADO",
            ]}
            onChange={(v: string) => setForm({ ...form, status: v })}
          />

          <DateField
            label="Data do acordo"
            value={form.data_acordo}
            onChange={(v: string) => setForm({ ...form, data_acordo: v })}
          />

          <MoneyField
            label="Valor original"
            value={form.valor_original}
            onChange={(n: number) => setForm({ ...form, valor_original: n })}
          />

          <MoneyField
            label="Valor acordado"
            value={form.valor_acordado}
            onChange={(n: number) =>
              setForm({
                ...form,
                valor_acordado: n,
                desconto: Math.max(0, Number(form.valor_original || 0) - n),
              })
            }
          />

          <MoneyField
            label="Nova parcela"
            value={form.nova_parcela}
            onChange={(n: number) => setForm({ ...form, nova_parcela: n })}
          />

          <Field
            label="Quantidade de parcelas"
            value={form.qtd_parcelas}
            keyboardType="numeric"
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
            label="Canal"
            value={form.canal}
            onChangeText={(v: string) => setForm({ ...form, canal: v })}
            placeholder="Telefone, app, gerente, PROCON..."
          />

          <SwitchRow
            label="Homologado/finalizado"
            value={!!form.homologado}
            onChange={(v: boolean) => setForm({ ...form, homologado: v })}
          />

          <SwitchRow
            label="Substitui a dívida no cálculo"
            value={!!form.substitui_divida}
            onChange={(v: boolean) => setForm({ ...form, substitui_divida: v })}
          />

          <Field
            label="Observação"
            value={form.observacao}
            multiline
            onChangeText={(v: string) => setForm({ ...form, observacao: v })}
          />

          <Card style={{ backgroundColor: COLORS.infoBg }}>
            <Text style={{ color: COLORS.info, fontWeight: "800" }}>
              Economia estimada: {fmtBRL(economy)}
            </Text>
          </Card>

          <Button
            title={saving ? "Salvando..." : "Salvar acordo"}
            onPress={save}
            disabled={saving}
            full
          />
        </Card>
      </Section>

      <Section title="Acordos cadastrados">
        {items.map((a) => (
          <Card key={a.id}>
            <Text style={{ fontWeight: "800", color: COLORS.text }}>
              {a.debt_credor || a.debtCredor || "Credor não informado"}
            </Text>
            <Text style={{ color: COLORS.muted }}>
              {a.status} · {fmtBRL(a.nova_parcela || a.novaParcela)} / mês ·{" "}
              {a.qtd_parcelas || a.qtdParcelas || 0} parcelas
            </Text>
            <Text style={{ color: COLORS.success, marginTop: 4 }}>
              Desconto: {fmtBRL(a.desconto)}
            </Text>
            <Button
              title="Editar"
              variant="secondary"
              onPress={() => setForm(a)}
            />

            <Button
              title="Excluir"
              variant="danger"
              onPress={async () => {
                Alert.alert("Excluir acordo", "Deseja excluir este acordo?", [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                      await deleteAgreement(a.id);
                      await useFinanceStore.getState().loadAll();
                      await load();
                    },
                  },
                ]);
              }}
            />
          </Card>
        ))}
      </Section>
    </ScreenScroll>
  );
}
