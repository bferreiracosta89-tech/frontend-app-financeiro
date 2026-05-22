import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Card,
  ChoicePills,
  Field,
  Section,
  Stat,
  ScreenHeader,
} from "../components/UI";
import { ProgressBar } from "../components/Charts";
import { useCreditAvailability, useFinanceStore } from "../store/useStore";
import { COLORS, RADIUS, SPACING } from "../utils/theme";
import { fmtBRL, parseNumber } from "../utils/format";
import type { Account, AccountKind } from "../db/types";

type AccountForm = Account & {
  usado?: number;
  disponivel?: number;
  limite_total?: number;
  dia_fechamento?: number;
  dia_vencimento?: number;
};

const empty: AccountForm = {
  nome: "",
  tipo: "CARTAO_CREDITO",
  limiteTotal: 0,
  diaFechamento: 0,
  diaVencimento: 0,
  observacao: "",
};

function toNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeAccount(a: any): AccountForm {
  return {
    ...empty,
    ...a,
    id: a?.id,
    nome: String(a?.nome ?? ""),
    tipo: (a?.tipo || "CARTAO_CREDITO") as AccountKind,
    limiteTotal: toNumber(a?.limiteTotal ?? a?.limite_total),
    diaFechamento: toNumber(a?.diaFechamento ?? a?.dia_fechamento),
    diaVencimento: toNumber(a?.diaVencimento ?? a?.dia_vencimento),
    observacao: String(a?.observacao ?? ""),
  };
}

function cleanPayload(a: AccountForm): Account {
  return {
    ...(a.id ? { id: a.id } : {}),
    nome: String(a.nome || "").trim(),
    tipo: (a.tipo || "CARTAO_CREDITO") as AccountKind,
    limiteTotal: toNumber(a.limiteTotal),
    diaFechamento: toNumber(a.diaFechamento),
    diaVencimento: toNumber(a.diaVencimento),
    observacao: String(a.observacao || ""),
  } as Account;
}

export default function AccountsScreen() {
  const { addAccount, updateAccount, deleteAccount, cardPurchases, debts, expenses } =
    useFinanceStore();
  const { detalhe } = useCreditAvailability();

  const [editing, setEditing] = useState<AccountForm | null>(null);
  const [saving, setSaving] = useState(false);

  const detalheReal = useMemo(() => {
    const lista = Array.isArray(detalhe) ? detalhe : [];
    const allDebts = Array.isArray(debts) ? debts : [];
    const allPurchases = Array.isArray(cardPurchases) ? cardPurchases : [];
    const allExpenses = Array.isArray(expenses) ? expenses : [];

    return lista.map((raw: any) => {
      const acc = normalizeAccount(raw);
      let usado = toNumber(raw?.usado);

      const gastosDaConta = allExpenses.filter((e: any) => String(e?.account_id ?? e?.accountId ?? '') === String(acc.id ?? ''));
      usado += gastosDaConta.reduce((total: number, e: any) => total + toNumber(e?.valor), 0);

      if (acc.tipo === "CARTAO_CREDITO") {
        const debt = allDebts.find(
          (d: any) =>
            String(d?.credor || "") === acc.nome &&
            String(d?.tipo || "") === "Cartão",
        );

        if (debt) {
          const compras = allPurchases.filter(
            (c: any) => String(c?.debtId ?? c?.debt_id) === String(debt.id),
          );

          usado += compras.reduce((total: number, c: any) => {
            const valorParcela = toNumber(c?.valorParcela ?? c?.valor_parcela);
            const qtdParcelas = toNumber(c?.qtdParcelas ?? c?.qtd_parcelas);
            const parcelasPagas = toNumber(
              c?.parcelasPagas ?? c?.parcelas_pagas,
            );
            return (
              total + valorParcela * Math.max(0, qtdParcelas - parcelasPagas)
            );
          }, 0);
        }
      }

      return {
        ...acc,
        usado,
        disponivel: Math.max(0, toNumber(acc.limiteTotal) - usado),
      };
    });
  }, [detalhe, debts, cardPurchases, expenses]);

  const limiteGeral = detalheReal.reduce(
    (total: number, item: any) => total + toNumber(item.limiteTotal),
    0,
  );
  const usadoGeral = detalheReal.reduce(
    (total: number, item: any) => total + toNumber(item.usado),
    0,
  );
  const dispGeral = Math.max(0, limiteGeral - usadoGeral);

  const open = (account?: AccountForm) => {
    setEditing(account ? normalizeAccount(account) : { ...empty });
  };

  const close = () => {
    if (saving) return;
    setEditing(null);
  };

  const save = async () => {
    try {
      if (!editing || saving) return;

      const payload = cleanPayload(editing);

      if (!payload.nome) {
        Alert.alert("Atenção", "Informe o nome do banco/cartão.");
        return;
      }

      if (payload.limiteTotal < 0) {
        Alert.alert("Atenção", "O limite não pode ser negativo.");
        return;
      }

      setSaving(true);

      if (payload.id) {
        await updateAccount(payload.id, payload);
      } else {
        await addAccount(payload);
      }

      setEditing(null);
    } catch (e: any) {
      console.log("ERRO AO SALVAR CONTA", e);
      Alert.alert("Erro ao salvar conta", e?.message || "Falha desconhecida.");
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: AccountForm) => {
    if (!item.id) return;

    Alert.alert("Excluir conta", `Excluir "${item.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAccount(item.id!);
          } catch (e: any) {
            Alert.alert("Erro ao excluir", e?.message || "Falha desconhecida.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      edges={["top"]}
    >
      <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.md }}>
        <ScreenHeader title="Contas e limites" subtitle="Bancos, cartões, crédito usado e disponível." right={<Button title="+ Nova" onPress={() => open()} />} />
      </View>

      <FlatList
        data={detalheReal}
        keyExtractor={(item, index) => String(item.id ?? item.nome ?? index)}
        contentContainerStyle={{
          paddingHorizontal: SPACING.md,
          paddingBottom: SPACING.xl,
        }}
        ListHeaderComponent={
          <Card>
            <Text
              style={{
                fontWeight: "700",
                color: COLORS.text,
                marginBottom: 12,
              }}
            >
              Crédito disponível
            </Text>

            <View style={{ gap: 8 }}>
              <Stat
                label="Limite total"
                value={fmtBRL(limiteGeral)}
                color={COLORS.info}
              />
              <Stat
                label="Usado"
                value={fmtBRL(usadoGeral)}
                color={COLORS.danger}
              />
              <Stat
                label="Disponível"
                value={fmtBRL(dispGeral)}
                color={COLORS.success}
              />
            </View>
          </Card>
        }
        ListEmptyComponent={
          <Text
            style={{ textAlign: "center", color: COLORS.muted, marginTop: 30 }}
          >
            Nenhuma conta cadastrada.
          </Text>
        }
        renderItem={({ item }) => {
          const limite = toNumber(item.limiteTotal);
          const usado = toNumber(item.usado);
          const percentual = limite > 0 ? usado / limite : 0;

          return (
            <Card>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: COLORS.text }}>
                    {item.nome || "Conta sem nome"}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}
                  >
                    {item.tipo === "CARTAO_CREDITO"
                      ? "Cartão de crédito"
                      : "Conta corrente / cheque especial"}
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 11, color: COLORS.muted }}>
                    Disponível
                  </Text>
                  <Text style={{ fontWeight: "700", color: COLORS.text }}>
                    {fmtBRL(toNumber(item.disponivel))}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 12 }}>
                <ProgressBar
                  value={usado}
                  max={limite || 1}
                  color={
                    percentual > 0.8
                      ? COLORS.danger
                      : percentual > 0.5
                        ? COLORS.warning
                        : COLORS.success
                  }
                  label={`Usado ${fmtBRL(usado)} de ${fmtBRL(limite)}`}
                />
              </View>

              {item.tipo === "CARTAO_CREDITO" && (
                <Text
                  style={{ color: COLORS.muted, fontSize: 12, marginTop: 8 }}
                >
                  Fecha dia {item.diaFechamento || "-"} • vence dia{" "}
                  {item.diaVencimento || "-"}
                </Text>
              )}

              <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => open(item)}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: RADIUS.sm,
                    backgroundColor: COLORS.infoBg,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.info,
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    Editar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => remove(item)}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: RADIUS.sm,
                    backgroundColor: COLORS.dangerBg,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.danger,
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    Excluir
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        }}
      />

      <Modal
        visible={!!editing}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={close}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: COLORS.bg }}
          edges={["top"]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: SPACING.md,
              paddingBottom: SPACING.xl,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                marginBottom: SPACING.md,
                color: COLORS.text,
              }}
            >
              {editing?.id ? "Editar conta" : "Nova conta"}
            </Text>

            {editing && (
              <>
                <Section title="Dados da conta">
                  <Card>
                    <Field
                      label="Nome do banco/cartão"
                      value={editing.nome}
                      onChangeText={(t) => setEditing({ ...editing, nome: t })}
                      placeholder="Ex.: Nubank, Itaú Conta..."
                    />

                    <ChoicePills
                      label="Tipo"
                      options={["CARTAO_CREDITO", "CONTA_CORRENTE"]}
                      value={editing.tipo}
                      onChange={(v: AccountKind) =>
                        setEditing({ ...editing, tipo: v })
                      }
                    />

                    <Field
                      label={
                        editing.tipo === "CARTAO_CREDITO"
                          ? "Limite do cartão (R$)"
                          : "Limite cheque especial (R$)"
                      }
                      keyboardType="decimal-pad"
                      value={
                        editing.limiteTotal ? String(editing.limiteTotal) : ""
                      }
                      onChangeText={(t) =>
                        setEditing({ ...editing, limiteTotal: parseNumber(t) })
                      }
                    />

                    {editing.tipo === "CARTAO_CREDITO" && (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Field
                            label="Fechamento"
                            keyboardType="numeric"
                            value={
                              editing.diaFechamento
                                ? String(editing.diaFechamento)
                                : ""
                            }
                            onChangeText={(t) =>
                              setEditing({
                                ...editing,
                                diaFechamento: parseInt(t || "0", 10),
                              })
                            }
                          />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Field
                            label="Vencimento"
                            keyboardType="numeric"
                            value={
                              editing.diaVencimento
                                ? String(editing.diaVencimento)
                                : ""
                            }
                            onChangeText={(t) =>
                              setEditing({
                                ...editing,
                                diaVencimento: parseInt(t || "0", 10),
                              })
                            }
                          />
                        </View>
                      </View>
                    )}

                    <Field
                      label="Observação"
                      multiline
                      value={editing.observacao}
                      onChangeText={(t) =>
                        setEditing({ ...editing, observacao: t })
                      }
                    />
                  </Card>
                </Section>

                <View
                  style={{
                    flexDirection: "row",
                    marginTop: SPACING.md,
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Button title="Cancelar" variant="ghost" onPress={close} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Button
                      title={saving ? "Salvando..." : "Salvar"}
                      onPress={save}
                    />
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
