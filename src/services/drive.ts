export async function getDriveToken() { return null; }
export async function ensureDriveAccessTokenInteractive() {
  throw new Error('Backup Google Drive desativado nesta versão estabilizada.');
}
export async function backupToDrive() {
  throw new Error('Backup Google Drive desativado nesta versão estabilizada.');
}
export async function maybeDailyBackup() { return; }
