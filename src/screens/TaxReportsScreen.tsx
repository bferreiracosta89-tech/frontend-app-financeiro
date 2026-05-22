import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import {
  Button,
  Card,
  Field,
  MoneyField,
  ScreenScroll,
  Section,
} from "../components/UI";
import { COLORS } from "../utils/theme";
import { fmtBRL } from "../utils/format";
import {
  buildTaxReport,
  listTaxReports,
  saveTaxReport,
  updateTaxReport,
  deleteTaxReport,
} from "../services/priority3";
import { exportIrpfPdf } from "../services/reportsPremium";

export default function TaxReportsScreen() {
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [report, setReport] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => setItems(await listTaxReports());

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const gerar = async () => {
    try {
      setBusy(true);
      const r = await buildTaxReport(
        parseInt(ano, 10) || new Date().getFullYear(),
      );
      setReport(r);
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao gerar prévia do IRPF.");
    } finally {
      setBusy(false);
    }
  };

  const salvar = async () => {
    if (!report) return;

    try {
      setBusy(true);
      if (report.id) await updateTaxReport(report.id, report);
      else await saveTaxReport(report);
      const refreshed = await listTaxReports();
      setItems(refreshed);
      setReport(null);
      Alert.alert("Pronto", "Relatório IRPF salvo e listado abaixo.");
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const exportarPdfAtual = async () => {
    if (!report) {
      Alert.alert("Atenção", "Gere a prévia do IRPF antes de exportar.");
      return;
    }

    try {
      setBusy(true);
      await exportIrpfPdf(report);
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao exportar PDF do IRPF.");
    } finally {
      setBusy(false);
    }
  };

  const editarSalvo = (r: any) => {
    setReport({
      ...r,
      dividas_declaraveis: r.dividas_declaraveis ?? r.dividasDeclaraveis ?? 0,
      pagamentos_efetuados: r.pagamentos_efetuados ?? r.pagamentosEfetuados ?? 0,
      juros_pagos: r.juros_pagos ?? r.jurosPagos ?? 0,
      descontos_obtidos: r.descontos_obtidos ?? r.descontosObtidos ?? 0,
    });
    setAno(String(r.ano || new Date().getFullYear()));
  };

  const excluirSalvo = async (r: any) => {
    Alert.alert("Excluir IRPF", `Excluir relatório ano-base ${r.ano}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: async () => {
        try { setBusy(true); await deleteTaxReport(r.id); await load(); }
        catch (e: any) { Alert.alert("Erro", e?.message || "Falha ao excluir IRPF."); }
        finally { setBusy(false); }
      }},
    ]);
  };


  const exportarPdfSalvo = async (r: any) => {
    try {
      setBusy(true);
      await exportIrpfPdf(r);
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha ao exportar PDF do IRPF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenScroll>
      <Section title="Relatório IRPF">
        <Card>
          <Field
            label="Ano-base"
            value={ano}
            keyboardType="numeric"
            onChangeText={setAno}
          />

          <Button
            title={busy ? "Aguarde..." : "Gerar prévia automática"}
            onPress={gerar}
            full
          />

          {report && (
            <>
              <MoneyField
                label="Rendimentos estimados"
                value={report.rendimentos}
                onChange={(n: number) =>
                  setReport({ ...report, rendimentos: n })
                }
              />

              <MoneyField
                label="Dívidas declaráveis"
                value={report.dividas_declaraveis}
                onChange={(n: number) =>
                  setReport({ ...report, dividas_declaraveis: n })
                }
              />

              <MoneyField
                label="Pagamentos efetuados"
                value={report.pagamentos_efetuados}
                onChange={(n: number) =>
                  setReport({ ...report, pagamentos_efetuados: n })
                }
              />

              <MoneyField
                label="Juros pagos"
                value={report.juros_pagos}
                onChange={(n: number) =>
                  setReport({ ...report, juros_pagos: n })
                }
              />

              <MoneyField
                label="Descontos obtidos"
                value={report.descontos_obtidos}
                onChange={(n: number) =>
                  setReport({ ...report, descontos_obtidos: n })
                }
              />

              <Field
                label="Bancos/credores"
                value={report.bancos}
                multiline
                onChangeText={(v: string) =>
                  setReport({ ...report, bancos: v })
                }
              />

              <Field
                label="Observação"
                value={report.observacao || ""}
                multiline
                onChangeText={(v: string) =>
                  setReport({ ...report, observacao: v })
                }
              />

              <View style={{ gap: 8 }}>
                <Button
                  title={busy ? "Aguarde..." : "Salvar relatório IRPF"}
                  variant="secondary"
                  onPress={salvar}
                  full
                />

                <Button
                  title={busy ? "Aguarde..." : "Exportar PDF IRPF"}
                  variant="ghost"
                  onPress={exportarPdfAtual}
                  full
                />
              </View>
            </>
          )}
        </Card>
      </Section>

      <Section title="Relatórios salvos">
        {items.length === 0 && (
          <Card>
            <Text style={{ color: COLORS.muted }}>
              Nenhum relatório IRPF salvo ainda.
            </Text>
          </Card>
        )}

        {items.map((r) => (
          <Card key={r.id}>
            <Text style={{ fontWeight: "800", color: COLORS.text }}>
              Ano-base {r.ano}
            </Text>
            <Text style={{ color: COLORS.muted, marginTop: 4 }}>
              Pagamentos:{" "}
              {fmtBRL(r.pagamentos_efetuados || r.pagamentosEfetuados)} ·
              Dívidas: {fmtBRL(r.dividas_declaraveis || r.dividasDeclaraveis)}
            </Text>

            <View style={{ marginTop: 10 }}>
              <Button
                title={busy ? "Aguarde..." : "Exportar PDF"}
                variant="secondary"
                onPress={() => exportarPdfSalvo(r)}
                full
              />
              <Button title="Editar" variant="ghost" onPress={() => editarSalvo(r)} full />
              <Button title="Excluir" variant="danger" onPress={() => excluirSalvo(r)} full />
            </View>
          </Card>
        ))}
      </Section>
    </ScreenScroll>
  );
}
