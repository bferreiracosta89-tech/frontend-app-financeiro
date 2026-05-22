import * as FileSystem from "expo-file-system";

const BACKUP_FILE = "restauracao-financeira-backup.crf";

export async function exportEncrypted(data?: any): Promise<string> {
  const uri = FileSystem.documentDirectory + BACKUP_FILE;

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };

  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));

  return uri;
}

export async function importEncrypted(content: string): Promise<any> {
  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Arquivo de backup inválido.");
  }
}
