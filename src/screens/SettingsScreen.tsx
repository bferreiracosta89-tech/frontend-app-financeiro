import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";

import { useFinanceStore } from "../store/useStore";
import {
  ActionTile,
  Button,
  Card,
  ScreenHeader,
  ScreenScroll,
  Section,
} from "../components/UI";
import { COLORS, SPACING } from "../utils/theme";
import { exportToXlsx } from "../utils/xlsx";
import { exportEncrypted, importEncrypted } from "../utils/backup";
import { syncNow, getLastSyncDate } from "../services/sync";
import { setToken } from "../services/api";

export default function SettingsScreen({ navigation }: any) {
  const store = useFinanceStore();
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getLastSyncDate()
      .then(setLastSync)
      .catch(() => setLastSync(null));
  }, []);

  const wrap = (fn: () => Promise<void>) => async () => {
    if (busy) return;

    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Falha");
    } finally {
      setBusy(false);
    }
  };

  const handleSync = wrap(async () => {
    await syncNow();
    setLastSync(await getLastSyncDate());
    Alert.alert("Pronto", "Sincronização concluída.");
  });

  const handleExportXlsx = wrap(async () => {
    const path = await exportToXlsx(store);

    if (path && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(path);
    }
  });

  const handleExportBackup = wrap(async () => {
    const path = await exportEncrypted(store);

    if (path && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(path);
    }
  });

  const handleImportBackup = wrap(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
    await importEncrypted(content);
    await store.loadAll();

    Alert.alert("Pronto", "Backup restaurado.");
  });

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair? Você precisará logar novamente.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await setToken(null);
          (globalThis as any).__CRF_SET_AUTH__?.(false);
        },
      },
    ]);
  };

  const go = (screen: string) => navigation?.navigate?.(screen);

  return (
    <ScreenScroll contentStyle={{ paddingTop: 0 }}>
      <ScreenHeader
        title="Mais opções"
        subtitle="Menu organizado para operação, relatórios, jurídico, usuários e sincronização."
      />

      <Section title="Sincronização">
        <Card>
          <Text style={s.label}>
            Última sincronização:{" "}
            {lastSync ? new Date(lastSync).toLocaleString("pt-BR") : "nunca"}
          </Text>
          <Text style={s.help}>
            Sincronização automática a cada 5 minutos quando o app está aberto.
          </Text>
          <View style={s.action}>
            <Button
              title={busy ? "Aguarde..." : "Sincronizar agora"}
              onPress={handleSync}
              full
            />
          </View>
        </Card>
      </Section>

      <Section title="Exportar e restaurar">
        <Card>
          <Button
            title={busy ? "Aguarde..." : "Exportar planilha (.xlsx)"}
            onPress={handleExportXlsx}
            full
          />
          <Button
            title={busy ? "Aguarde..." : "Exportar backup criptografado (.crf)"}
            variant="secondary"
            onPress={handleExportBackup}
            full
          />
          <Button
            title={busy ? "Aguarde..." : "Importar backup"}
            variant="ghost"
            onPress={handleImportBackup}
            full
          />
        </Card>
      </Section>

      <Section title="Sessão">
        <Card>
          <Button
            title="Sair da conta"
            variant="danger"
            onPress={handleLogout}
            full
          />
        </Card>
      </Section>
    </ScreenScroll>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 14, color: COLORS.text, fontWeight: "700" },
  help: { fontSize: 12, color: COLORS.muted, marginTop: 4, lineHeight: 18 },
  action: { marginTop: SPACING.md },
});
