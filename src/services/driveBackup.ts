export async function backupToGoogleDrive() {
  throw new Error("Backup Google Drive desativado nesta versão estabilizada. Use exportação local por enquanto.");
}

export async function listGoogleDriveBackups() {
  return { files: [] };
}
