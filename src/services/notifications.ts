import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("vencimentos", {
      name: "Vencimentos de dívidas",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/** Agenda notificação mensal recorrente no dia X (1..28). Retorna o ID local. */
export async function scheduleMonthlyReminder(
  titulo: string,
  body: string,
  diaDoMes: number,
  hora = 9,
  minuto = 0,
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: titulo, body, sound: true },
    trigger: {
      day: Math.min(Math.max(diaDoMes, 1), 28),
      hour: hora,
      minute: minuto,
      repeats: true,
    } as any,
  });
  return id;
}

export async function cancelReminder(notificationId: string) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    /* já cancelada */
  }
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
