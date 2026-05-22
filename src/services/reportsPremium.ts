import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

function num(v: any) {
  return Number(v || 0);
}

function brl(v: any) {
  return num(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function esc(v: any) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function exportDefensoriaPdf(data: any) {
  const debts = data?.debts || [];
  const payments = data?.payments || [];
  const agreements = data?.agreements || [];

  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; margin-top: 22px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
        th, td { border: 1px solid #E5E7EB; padding: 6px; text-align: left; }
        th { background: #F3F4F6; }
        .muted { color: #6B7280; font-size: 11px; }
      </style>
    </head>
    <body>
      <h1>Relatório de Repactuação de Dívidas</h1>
      <p class="muted">Gerado em ${new Date().toLocaleString("pt-BR")}</p>

      <h2>Dívidas</h2>
      <table>
        <tr><th>Credor</th><th>Total</th><th>Parcela</th><th>Status</th></tr>
        ${debts
          .map(
            (d: any) => `
          <tr>
            <td>${esc(d.credor)}</td>
            <td>${brl(d.total)}</td>
            <td>${brl(d.parcela)}</td>
            <td>${esc(d.status)}</td>
          </tr>
        `,
          )
          .join("")}
      </table>

      <h2>Pagamentos</h2>
      <table>
        <tr><th>Competência</th><th>Tipo</th><th>Valor</th><th>Observação</th></tr>
        ${payments
          .map(
            (p: any) => `
          <tr>
            <td>${esc(p.competencia)}</td>
            <td>${esc(p.tipo)}</td>
            <td>${brl(p.valor_pago ?? p.valorPago)}</td>
            <td>${esc(p.observacao)}</td>
          </tr>
        `,
          )
          .join("")}
      </table>

      <h2>Acordos</h2>
      <table>
        <tr><th>Credor</th><th>Status</th><th>Valor acordado</th><th>Parcela</th></tr>
        ${agreements
          .map(
            (a: any) => `
          <tr>
            <td>${esc(a.debt_credor ?? a.debtCredor)}</td>
            <td>${esc(a.status)}</td>
            <td>${brl(a.valor_acordado ?? a.valorAcordado)}</td>
            <td>${brl(a.nova_parcela ?? a.novaParcela)}</td>
          </tr>
        `,
          )
          .join("")}
      </table>
    </body>
  </html>`;

  const result = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Compartilhar PDF",
    });
  }
  return result.uri;
}

export async function exportIrpfPdf(data: any) {
  const ano = data?.ano || new Date().getFullYear();

  const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #111827; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin-top: 22px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; }
        .muted { color: #6B7280; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        td { border: 1px solid #E5E7EB; padding: 8px; font-size: 12px; }
        td:first-child { background: #F9FAFB; font-weight: bold; width: 45%; }
        .obs { white-space: pre-wrap; line-height: 1.45; }
      </style>
    </head>
    <body>
      <h1>Relatório IRPF - Controle de Restauração Financeira</h1>
      <p class="muted">Ano-base ${esc(ano)} · Gerado em ${new Date().toLocaleString("pt-BR")}</p>

      <h2>Resumo declaratório</h2>
      <table>
        <tr><td>Rendimentos estimados</td><td>${brl(data?.rendimentos)}</td></tr>
        <tr><td>Dívidas declaráveis</td><td>${brl(data?.dividas_declaraveis ?? data?.dividasDeclaraveis)}</td></tr>
        <tr><td>Pagamentos efetuados</td><td>${brl(data?.pagamentos_efetuados ?? data?.pagamentosEfetuados)}</td></tr>
        <tr><td>Juros pagos</td><td>${brl(data?.juros_pagos ?? data?.jurosPagos)}</td></tr>
        <tr><td>Descontos obtidos</td><td>${brl(data?.descontos_obtidos ?? data?.descontosObtidos)}</td></tr>
      </table>

      <h2>Bancos/Credores</h2>
      <p>${esc(data?.bancos || "Não informado")}</p>

      <h2>Observações</h2>
      <p class="obs">${esc(data?.observacao || "Sem observações.")}</p>
    </body>
  </html>`;

  const result = await Print.printToFileAsync({ html });

  // Garante extensão PDF amigável em alguns Androids.
  const finalUri = FileSystem.documentDirectory + `irpf-restauracao-${ano}.pdf`;

  try {
    await FileSystem.copyAsync({ from: result.uri, to: finalUri });
  } catch {
    // Se o copy falhar, compartilha o uri original gerado pelo expo-print.
  }

  const uri = finalUri || result.uri;

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Compartilhar PDF IRPF",
    });
  }

  return uri;
}

// Mantido apenas para backup/legado. Relatório oficial agora é PDF.
export async function exportIrpfJson(data: any) {
  const uri =
    FileSystem.documentDirectory +
    `irpf-restauracao-${new Date().getFullYear()}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  return uri;
}
