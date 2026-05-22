import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

export async function exportToXlsx(data?: any): Promise<string> {
  const uri =
    FileSystem.documentDirectory + "restauracao-financeira-export.json";

  await FileSystem.writeAsStringAsync(
    uri,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        data,
      },
      null,
      2,
    ),
  );

  return uri;
}

export async function shareExportedFile(path: string) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path);
  }
}
