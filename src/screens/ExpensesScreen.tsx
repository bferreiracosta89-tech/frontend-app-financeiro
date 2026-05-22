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
  SwitchRow,
  ScreenHeader,
} from "../components/UI";
import { useFinanceStore, useMonthExpenses } from "../store/useStore";
import { COLORS, RADIUS, SPACING } from "../utils/theme";
import { fmtBRL, parseNumber, todayISO } from "../utils/format";
import type { Expense, PaymentMethod } from "../db/types";

const CATEGORIAS = [
  "Alimentação",
  "Transporte",
  "Lazer",
  "Saúde",
  "Casa",
  "Vestuário",
  "Educação",
  "Outros",
];
const FORMAS: PaymentMethod[] = [
  "Dinheiro",
  "Pix",
  "Débito",
  "Crédito",
  "Boleto",
  "Outro",
];

const empty: Expense = {
  data: todayISO(),
  descricao: "",
  categoria: "Alimentação",
  valor: 0,
  formaPagamento: "Pix",
  accountId: null,
  parcelado: false,
  qtdParcelas: 1,
  cardPurchaseId: null,
  observacao: "",
};

export default function ExpensesScreen() {
  const {
    expenses,
    accounts,
    addExpense,
    updateExpense,
    deleteExpense,
    addCardPurchase,
  } = useFinanceStore();
  const { total, porCategoria } = useMonthExpenses();
  const [editing, setEditing] = useState<Expense | null>(null);

  const accs = accounts;
  const filteredAccountsForPayment = (forma: string) => accs.filter((a: any) => {
    const tipo = String(a.tipo || "").toUpperCase();
    const isCard = tipo.includes("CARTAO") || tipo.includes("CARTÃO") || tipo.includes("CREDITO") || tipo.includes("CRÉDITO");
    if (forma === "Crédito") return isCard;
    if (forma === "Débito" || forma === "Pix") return !isCard;
    return true;
  });
  const cartoes = filteredAccountsForPayment("Crédito");

  const open = (e?: Expense) => setEditing(e ? { ...e } : { ...empty });

  const save = async () => {
    try {
      if (!editing) return;
      if (!editing.descricao.trim()) {
        Alert.alert("Atenção", "Informe a descrição");
        return;
      }
      if (["Crédito", "Débito", "Pix"].includes(editing.formaPagamento) && !editing.accountId) {
        Alert.alert("Atenção", "Selecione o banco/cartão da forma de pagamento.");
        return;
      }
      if (editing.parcelado && (!editing.qtdParcelas || editing.qtdParcelas <= 0 || !editing.valor)) {
        Alert.alert("Atenção", "Informe valor e quantidade de parcelas válidos.");
        return;
      }

      let cardPurchaseId = editing.cardPurchaseId;

      // Se foi compra parcelada no crédito, gera automaticamente um registro
      // em card_purchases vinculado à dívida do cartão (se houver uma dívida com o nome do cartão)
      if (
        editing.parcelado &&
        editing.formaPagamento === "Crédito" &&
        editing.accountId
      ) {
        const acc = accounts.find((a: any) => a.id === editing.accountId);
        const debt = useFinanceStore
          .getState()
          .debts.find((d: any) => d.credor === acc?.nome && d.tipo === "Cartão");
        if (debt) {
          const valorParcela =
            editing.qtdParcelas > 0
              ? editing.valor / editing.qtdParcelas
              : editing.valor;
          const ym = editing.data.slice(0, 7);
          const id = await addCardPurchase({
            debtId: debt.id!,
            descricao: editing.descricao,
            estabelecimento: "",
            dataCompra: editing.data,
            valorTotal: editing.valor,
            qtdParcelas: editing.qtdParcelas || 1,
            parcelasPagas: 0,
            valorParcela,
            primeiraParcela: ym,
            observacao: "Gerado a partir de gasto diário",
          });
          cardPurchaseId = id;
        }
      }

      const toSave = { ...editing, cardPurchaseId };
      if (toSave.id) await updateExpense(toSave.id, toSave);
      else await addExpense(toSave);
      setEditing(null);
    } catch (e: any) {
      console.log("ERRO AO SALVAR GASTO", e);
      Alert.alert("Erro ao salvar gasto", e?.message || "Falha desconhecida.");
    }
  };

  // Renderiza apenas os últimos 60 dias na lista
  const recentes = useMemo(() => {
    return [...expenses]
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""))
      .slice(0, 200);
  }, [expenses]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      edges={["top"]}
    >
      <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.md }}>
        <ScreenHeader title="Gastos" subtitle="Despesas do mês, banco/cartão e compras parceladas." right={<Button title="+ Novo" onPress={() => open()} />} />
      </View>

      <View style={{ paddingHorizontal: SPACING.md }}>
        <Card>
          <Text style={{ fontSize: 11, color: COLORS.muted }}>
            Total deste mês
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "700", color: COLORS.text }}>
            {fmtBRL(total)}
          </Text>
          {Object.entries(porCategoria).length > 0 && (
            <View style={{ marginTop: 8 }}>
              {Object.entries(porCategoria)
                .sort(([, a]: any, [, b]: any) => b - a)
                .map(([cat, val]) => (
                  <View
                    key={cat}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: COLORS.text }}>{cat}</Text>
                    <Text style={{ color: COLORS.muted }}>
                      {fmtBRL(val as number)}
                    </Text>
                  </View>
                ))}
            </View>
          )}
        </Card>
      </View>

      <FlatList
        data={recentes}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={{
          paddingHorizontal: SPACING.md,
          paddingBottom: SPACING.xl,
        }}
        ListEmptyComponent={
          <Text
            style={{ textAlign: "center", color: COLORS.muted, marginTop: 30 }}
          >
            Nenhum gasto cadastrado ainda.
          </Text>
        }
        renderItem={({ item }) => {
          const acc = accs.find((a) => a.id === item.accountId);
          return (
            <Card>
              <View style={{ flexDirection: "row" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: COLORS.text }}>
                    {item.descricao}
                  </Text>
                  <Text style={{ fontSize: 11, color: COLORS.muted }}>
                    {item.data} · {item.categoria} · {item.formaPagamento}
                    {acc ? ` · ${acc.nome}` : ""}
                    {item.parcelado ? ` · ${item.qtdParcelas}x` : ""}
                  </Text>
                </View>
                <Text style={{ fontWeight: "700", color: COLORS.danger }}>
                  -{fmtBRL(item.valor)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => open(item)}
                  style={{
                    flex: 1,
                    padding: 6,
                    borderRadius: RADIUS.sm,
                    backgroundColor: COLORS.infoBg,
                    marginRight: 4,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.info,
                      textAlign: "center",
                      fontSize: 13,
                    }}
                  >
                    Editar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert("Excluir", `Excluir "${item.descricao}"?`, [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Excluir",
                        style: "destructive",
                        onPress: async () => { await deleteExpense(item.id!); await useFinanceStore.getState().loadAll(); },
                      },
                    ]);
                  }}
                  style={{
                    flex: 1,
                    padding: 6,
                    borderRadius: RADIUS.sm,
                    backgroundColor: COLORS.dangerBg,
                    marginLeft: 4,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.danger,
                      textAlign: "center",
                      fontSize: 13,
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

      <Modal visible={!!editing} animationType="slide">
        <SafeAreaView
          style={{ flex: 1, backgroundColor: COLORS.bg }}
          edges={["top"]}
        >
          <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                marginBottom: SPACING.md,
                color: COLORS.text,
              }}
            >
              {editing?.id ? "Editar gasto" : "Novo gasto"}
            </Text>

            {editing && (
              <>
                <Field
                  label="Descrição"
                  value={editing.descricao}
                  onChangeText={(t) => setEditing({ ...editing, descricao: t })}
                  placeholder="Ex.: Padaria, mercado, gasolina..."
                />
                <Field
                  label="Data (AAAA-MM-DD)"
                  value={editing.data}
                  onChangeText={(t) => setEditing({ ...editing, data: t })}
                />
                <Field
                  label="Valor (R$)"
                  keyboardType="decimal-pad"
                  value={String(editing.valor || "")}
                  onChangeText={(t) =>
                    setEditing({ ...editing, valor: parseNumber(t) })
                  }
                />
                <ChoicePills
                  label="Categoria"
                  options={CATEGORIAS}
                  value={editing.categoria}
                  onChange={(v: string) =>
                    setEditing({ ...editing, categoria: v })
                  }
                />
                <ChoicePills
                  label="Forma de pagamento"
                  options={FORMAS}
                  value={editing.formaPagamento}
                  onChange={(v: PaymentMethod) =>
                    setEditing({ ...editing, formaPagamento: v })
                  }
                />

                {(editing.formaPagamento === "Crédito" ||
                  editing.formaPagamento === "Débito" ||
                  editing.formaPagamento === "Pix") &&
                  accs.length > 0 && (
                    <ChoicePills
                      label="Banco / cartão"
                      options={filteredAccountsForPayment(editing.formaPagamento).map((a) => a.nome)}
                      value={
                        accs.find((a) => a.id === editing.accountId)?.nome || ""
                      }
                      onChange={(nome) => {
                        const acc = filteredAccountsForPayment(editing.formaPagamento).find((a) => a.nome === nome);
                        setEditing({ ...editing, accountId: acc?.id || null });
                      }}
                    />
                  )}

                {editing.formaPagamento === "Crédito" && (
                  <>
                    <SwitchRow
                      label="Compra parcelada?"
                      value={editing.parcelado}
                      onChange={(v: boolean) =>
                        setEditing({ ...editing, parcelado: v })
                      }
                    />
                    {editing.parcelado && (
                      <Field
                        label="Quantidade de parcelas"
                        keyboardType="numeric"
                        value={String(editing.qtdParcelas || "")}
                        onChangeText={(t) =>
                          setEditing({
                            ...editing,
                            qtdParcelas: parseInt(t || "1", 10),
                          })
                        }
                      />
                    )}
                    {editing.parcelado && (
                      <Text
                        style={{
                          fontSize: 11,
                          color: COLORS.muted,
                          marginBottom: 8,
                        }}
                      >
                        Será criada uma compra parcelada no cartão selecionado.
                      </Text>
                    )}
                  </>
                )}

                <Field
                  label="Observação"
                  multiline
                  value={editing.observacao}
                  onChangeText={(t) =>
                    setEditing({ ...editing, observacao: t })
                  }
                />

                <View style={{ flexDirection: "row", marginTop: SPACING.md }}>
                  <View style={{ flex: 1, marginRight: 4 }}>
                    <Button
                      title="Cancelar"
                      variant="ghost"
                      onPress={() => setEditing(null)}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 4 }}>
                    <Button title="Salvar" onPress={save} />
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
