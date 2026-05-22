import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getDb, wipeAll } from "../db/database";

async function deriveKey(senha: string): Promise<Uint8Array> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    senha,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hash.substring(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

function xorEncrypt(text: string, key: Uint8Array): string {
  const out: number[] = [];

  for (let i = 0; i < text.length; i++) {
    out.push(text.charCodeAt(i) ^ key[i % key.length]);
  }

  let bin = "";
  for (const c of out) bin += String.fromCharCode(c & 0xff);

  return globalThis.btoa(bin);
}

function xorDecrypt(b64: string, key: Uint8Array): string {
  const bin = globalThis.atob(b64);
  let out = "";

  for (let i = 0; i < bin.length; i++) {
    out += String.fromCharCode(bin.charCodeAt(i) ^ key[i % key.length]);
  }

  return out;
}

export async function exportBackup(senha: string): Promise<void> {
  const db = await getDb();

  const tables = [
    "income",
    "min_existencial",
    "debts",
    "card_purchases",
    "negotiations",
    "legal_plan",
    "reminders",
    "accounts",
    "expenses",
    "payments",
  ];

  const dump: Record<string, any[]> = {};

  for (const table of tables) {
    dump[table] = (await db.getAllAsync(`SELECT * FROM ${table}`)) as any[];
  }

  const payload = JSON.stringify({
    version: 2,
    generatedAt: new Date().toISOString(),
    data: dump,
  });

  const key = await deriveKey(senha);
  const encrypted = xorEncrypt(payload, key);

  const filename = `backup-financas-${new Date()
    .toISOString()
    .slice(0, 10)}.crf`;

  const uri = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, encrypted);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/octet-stream",
      dialogTitle: "Backup criptografado",
    });
  }
}

export async function importBackup(
  senha: string,
): Promise<{ ok: boolean; message: string }> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });

  if (pick.canceled || !pick.assets?.length) {
    return { ok: false, message: "Importação cancelada." };
  }

  const uri = pick.assets[0].uri;
  const encrypted = await FileSystem.readAsStringAsync(uri);

  let parsed: any;

  try {
    const key = await deriveKey(senha);
    const decrypted = xorDecrypt(encrypted, key);
    parsed = JSON.parse(decrypted);
  } catch {
    return { ok: false, message: "Senha incorreta ou arquivo inválido." };
  }

  if (!parsed?.data) {
    return { ok: false, message: "Arquivo de backup malformado." };
  }

  await wipeAll();

  const db = await getDb();

  for (const [table, rows] of Object.entries(
    parsed.data as Record<string, any[]>,
  )) {
    for (const row of rows) {
      const cols = Object.keys(row);
      const placeholders = cols.map(() => "?").join(",");

      await db.runAsync(
        `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})`,
        cols.map((c) => row[c]),
      );
    }
  }

  return { ok: true, message: "Backup restaurado com sucesso." };
}
