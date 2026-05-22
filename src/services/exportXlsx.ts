import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";

function num(v: any) {
  return Number(v || 0);
}

export async function exportToXlsx(payload: any): Promise<void> {
  const wb = XLSX.utils.book_new();
  const income = payload.income || {};
  const minExist = payload.minExist || {};
  const debts = payload.debts || [];
  const cardPurchases = payload.cardPurchases || [];
  const negotiations = payload.negotiations || [];
  const expenses = payload.expenses || [];
  const payments = payload.payments || [];

  const totalMinE = [
    "alimentacao",
    "transporte",
    "agua",
    "energia",
    "internet",
    "saude",
    "outros",
    "reserva",
  ].reduce((a, k) => a + num(minExist[k]), 0);
  const previsto = debts
    .filter(
      (d: any) =>
        !["QUITADO", "CANCELADO"].includes(
          String(d.status || "").toUpperCase(),
        ),
    )
    .reduce((a: any, d: any) => a + num(d.parcela), 0);
  const pago = payments
    .filter((p: any) => p.tipo !== "NAO_PAGO")
    .reduce((a: any, p: any) => a + num(p.valor_pago ?? p.valorPago), 0);

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["CONTROLE DE RESTAURAÇÃO FINANCEIRA"],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      [],
      ["Renda bruta", num(income.bruto)],
      ["Renda líquida", num(income.liquido)],
      ["Mínimo existencial", totalMinE],
      ["Previsto em parcelas", previsto],
      ["Pago registrado", pago],
      ["Gap financeiro", Math.max(0, previsto - pago)],
    ]),
    "Resumo",
  );

  const dividasAOA = [
    ["Credor", "Tipo", "Status", "Saldo", "Valor total", "Parcela", "Qtd parcelas", "Pagas", "Vencimento", "Observação"],
    ...debts.map((d: any) => [d.credor, d.tipo, d.status, num(d.total ?? d.valor_total), num(d.valor_total ?? d.valorTotal), num(d.parcela), num(d.qtd_parcelas ?? d.qtdParcelas), num(d.parcelas_pagas ?? d.parcelasPagas), d.vencimento, d.observacao]),
  ];
  const pagamentosAOA = [
    ["Dívida", "Competência", "Tipo", "Data", "Valor pago", "Juros", "Desconto", "Observação"],
    ...payments.map((p: any) => {
      const debt = debts.find((d: any) => String(d.id) === String(p.debt_id ?? p.debtId));
      return [debt?.credor || "", p.competencia, p.tipo, p.data_pagamento ?? p.dataPagamento, num(p.valor_pago ?? p.valorPago), num(p.juros), num(p.desconto), p.observacao];
    }),
  ];
  const gastosAOA = [
    ["Data", "Descrição", "Categoria", "Valor", "Forma", "Banco/Cartão", "Parcelado", "Qtd parcelas", "Observação"],
    ...expenses.map((e: any) => [e.data, e.descricao, e.categoria, num(e.valor), e.forma_pagamento ?? e.formaPagamento, e.account_id ?? e.accountId, e.parcelado ? "SIM" : "NÃO", num(e.qtd_parcelas ?? e.qtdParcelas), e.observacao]),
  ];
  const cartoesAOA = [
    ["Dívida/Cartão", "Descrição", "Estabelecimento", "Data", "Valor total", "Qtd parcelas", "Pagas", "Valor parcela", "Primeira parcela", "Observação"],
    ...cardPurchases.map((c: any) => {
      const debt = debts.find((d: any) => String(d.id) === String(c.debt_id ?? c.debtId));
      return [debt?.credor || "", c.descricao, c.estabelecimento, c.data_compra ?? c.dataCompra, num(c.valor_total ?? c.valorTotal), num(c.qtd_parcelas ?? c.qtdParcelas), num(c.parcelas_pagas ?? c.parcelasPagas), num(c.valor_parcela ?? c.valorParcela), c.primeira_parcela ?? c.primeiraParcela, c.observacao];
    }),
  ];
  const negociacoesAOA = [
    ["Dívida", "Credor", "Data", "Canal", "Valor acordado", "Nova parcela", "Qtd parcelas", "Pagas", "Aceito", "Próxima ação"],
    ...negotiations.map((n: any) => {
      const debt = debts.find((d: any) => String(d.id) === String(n.debt_id ?? n.debtId));
      return [debt?.credor || "", n.credor, n.data, n.canal, num(n.valor_acordado ?? n.valorAcordado), num(n.nova_parcela ?? n.novaParcela), num(n.qtd_parcelas ?? n.qtdParcelas), num(n.parcelas_pagas ?? n.parcelasPagas), n.aceito ? "SIM" : "NÃO", n.proxima_acao ?? n.proximaAcao];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dividasAOA), "Dívidas");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pagamentosAOA), "Pagamentos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gastosAOA), "Gastos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cartoesAOA), "Cartões");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(negociacoesAOA), "Negociações");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["IRPF - Dívidas e Ônus Reais"],
      ["Credor", "Saldo", "Parcela", "Status"],
      ...debts.map((d: any) => [
        d.credor,
        num(d.total),
        num(d.parcela),
        d.status,
      ]),
    ]),
    "IRPF",
  );

  const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  const uri =
    FileSystem.documentDirectory +
    `restauracao-financeira-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, wbout, { encoding: "base64" });
  if (await Sharing.isAvailableAsync())
    await Sharing.shareAsync(uri, {
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
}
