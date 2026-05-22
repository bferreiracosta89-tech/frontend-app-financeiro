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
import { useRoute, useNavigation } from "@react-navigation/native";
import { Button, Card, Field, Section } from "../components/UI";
import { ProgressBar } from "../components/Charts";
import { useFinanceStore } from "../store/useStore";
import { COLORS, RADIUS, SPACING } from "../utils/theme";
import { fmtBRL, parseNumber, todayISO } from "../utils/format";
import type { CardPurchase } from "../db/types";

const empty: CardPurchase = {
  debtId: 0,
  descricao: "",
  estabelecimento: "",
  dataCompra: todayISO(),
  valorTotal: 0,
  qtdParcelas: 1,
  parcelasPagas: 0,
  valorParcela: 0,
  primeiraParcela: "",
  observacao: "",
};

export default function CardPurchasesScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const debtId = route?.params?.debtId ? Number(route.params.debtId) : null;
  if (!debtId) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Selecione uma dívida antes de lançar compras no cartão.</Text>
      </View>
    );
  }
  const {
    debts,
    cardPurchases,
    addCardPurchase,
    updateCardPurchase,
    deleteCardPurchase,
  } = useFinanceStore();
  const card = debts.find((d) => d.id === debtId);
  const purchases = useMemo(
    () =>
      cardPurchases
        .filter((c: any) => c.debtId === debtId)
        .sort((a: any, b: any) =>
          (b.dataCompra || "").localeCompare(a.dataCompra || ""),
        ),
    [cardPurchases, debtId],
  );
  const [editing, setEditing] = useState<CardPurchase | null>(null);

  const totalPendente = purchases.reduce(
    (a: number, c: any) =>
      a + c.valorParcela * Math.max(0, c.qtdParcelas - c.parcelasPagas),
    0,
  );

  const open = (c?: CardPurchase) =>
    setEditing(c ? { ...c } : { ...empty, debtId });

  const save = async () => {
    try {
      if (!editing) return;
      if (!editing.descricao.trim()) {
        Alert.alert("Atenção", "Informe a descrição");
        return;
      }
      // Auto-calcula valor da parcela se vazio
      if (!editing.valorParcela && editing.valorTotal && editing.qtdParcelas) {
        editing.valorParcela = editing.valorTotal / editing.qtdParcelas;
      }
      if (editing.id) await updateCardPurchase(editing.id, editing);
      else await addCardPurchase(editing);
      setEditing(null);
    } catch (e: any) {
      console.log("ERRO AO SALVAR COMPRA", e);
      Alert.alert("Erro ao salvar compra", e?.message || "Falha desconhecida.");
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      edges={["top"]}
    >
      <View
        style={{
          padding: SPACING.md,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginRight: 12 }}
        >
          <Text style={{ color: COLORS.info, fontSize: 16 }}>← Voltar</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.text }}>
            {card?.credor || "Cartão"}
          </Text>
          <Text style={{ fontSize: 12, color: COLORS.muted }}>
            Compras parceladas
          </Text>
        </View>
        <Button title="+ Nova" onPress={() => open()} />
      </View>

      <View style={{ paddingHorizontal: SPACING.md }}>
        <Card>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: COLORS.muted }}>
                Compras ativas
              </Text>
              <Text
                style={{ fontSize: 18, fontWeight: "700", color: COLORS.text }}
              >
                {purchases.length}
              </Text>
            </View>
            <View style={{ flex: 2 }}>
              <Text style={{ fontSize: 11, color: COLORS.muted }}>
                Saldo restante das parcelas
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: COLORS.danger,
                }}
              >
                {fmtBRL(totalPendente)}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <FlatList
        data={purchases}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{
          paddingHorizontal: SPACING.md,
          paddingBottom: SPACING.xl,
        }}
        ListEmptyComponent={
          <Text
            style={{ textAlign: "center", color: COLORS.muted, marginTop: 30 }}
          >
            Nenhuma compra parcelada cadastrada para este cartão ainda.
          </Text>
        }
        renderItem={({ item }) => (
          <Card>
            <Text
              style={{ fontWeight: "700", fontSize: 15, color: COLORS.text }}
            >
              {item.descricao}
            </Text>
            {item.estabelecimento ? (
              <Text style={{ fontSize: 12, color: COLORS.muted }}>
                {item.estabelecimento}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: COLORS.muted }}>
                  Parcela
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: COLORS.text,
                  }}
                >
                  {fmtBRL(item.valorParcela)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: COLORS.muted }}>Total</Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: COLORS.text,
                  }}
                >
                  {fmtBRL(item.valorTotal)}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 10 }}>
              <ProgressBar
                value={item.parcelasPagas}
                max={item.qtdParcelas}
                label={`Parcelas`}
                color={COLORS.success}
              />
            </View>

            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => open(item)}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: RADIUS.sm,
                  backgroundColor: COLORS.infoBg,
                  marginRight: 4,
                }}
              >
                <Text
                  style={{
                    color: COLORS.info,
                    textAlign: "center",
                    fontWeight: "600",
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
                      onPress: () => deleteCardPurchase(item.id!),
                    },
                  ]);
                }}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: RADIUS.sm,
                  backgroundColor: COLORS.dangerBg,
                  marginLeft: 4,
                }}
              >
                <Text
                  style={{
                    color: COLORS.danger,
                    textAlign: "center",
                    fontWeight: "600",
                  }}
                >
                  Excluir
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
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
              {editing?.id ? "Editar compra" : "Nova compra parcelada"}
            </Text>

            {editing && (
              <>
                <Field
                  label="Descrição"
                  value={editing.descricao}
                  onChangeText={(t) => setEditing({ ...editing, descricao: t })}
                  placeholder="Ex.: Geladeira Magazine X"
                />
                <Field
                  label="Estabelecimento"
                  value={editing.estabelecimento}
                  onChangeText={(t) =>
                    setEditing({ ...editing, estabelecimento: t })
                  }
                />
                <Field
                  label="Data da compra (AAAA-MM-DD)"
                  value={editing.dataCompra}
                  onChangeText={(t) =>
                    setEditing({ ...editing, dataCompra: t })
                  }
                />
                <Field
                  label="Valor total (R$)"
                  keyboardType="decimal-pad"
                  value={String(editing.valorTotal || "")}
                  onChangeText={(t) =>
                    setEditing({ ...editing, valorTotal: parseNumber(t) })
                  }
                />
                <View style={{ flexDirection: "row" }}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Field
                      label="Qtd parcelas"
                      keyboardType="numeric"
                      value={String(editing.qtdParcelas || "")}
                      onChangeText={(t) =>
                        setEditing({
                          ...editing,
                          qtdParcelas: parseInt(t || "0", 10),
                        })
                      }
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Field
                      label="Parcelas pagas"
                      keyboardType="numeric"
                      value={String(editing.parcelasPagas || "")}
                      onChangeText={(t) =>
                        setEditing({
                          ...editing,
                          parcelasPagas: parseInt(t || "0", 10),
                        })
                      }
                    />
                  </View>
                </View>
                <Field
                  label="Valor da parcela (R$) — opcional, calculado automaticamente"
                  keyboardType="decimal-pad"
                  value={String(editing.valorParcela || "")}
                  onChangeText={(t) =>
                    setEditing({ ...editing, valorParcela: parseNumber(t) })
                  }
                />
                <Field
                  label="Primeira parcela (AAAA-MM)"
                  value={editing.primeiraParcela}
                  onChangeText={(t) =>
                    setEditing({ ...editing, primeiraParcela: t })
                  }
                />
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
