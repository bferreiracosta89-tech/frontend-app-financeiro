import * as Notifications from "expo-notifications";
import { getDb } from "../db/database";

export async function detectMissingPaymentRecords(competencia: string) {
  const db = await getDb();

  const debts = (await db.getAllAsync(`
    SELECT * FROM debts
    WHERE COALESCE(status,'PAGAR') NOT IN ('QUITADO','PAGO','CANCELADO')
  `)) as any[];

  const missing: any[] = [];

  for (const d of debts) {
    const found = await db.getFirstAsync(
      `SELECT id FROM payments
       WHERE debt_id=? AND competencia=? AND tipo IN ('PARCELA','NAO_PAGO','PARCIAL','LIQUIDACAO')
       LIMIT 1`,
      [d.id, competencia],
    );

    if (!found) missing.push(d);
  }

  return missing;
}

export async function notifyMissingPayments(competencia: string) {
  const missing = await detectMissingPaymentRecords(competencia);

  if (missing.length === 0) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Pagamentos sem registro",
      body: `${missing.length} dívida(s) sem PARCELA ou NÃO PAGO em ${competencia}.`,
    },
    trigger: null,
  });
}