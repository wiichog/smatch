/**
 * Registro de push notifications (Expo). Pide permiso, obtiene el Expo push token
 * y lo manda al backend (`/api/v2/me/devices/`). En simulador devuelve null.
 */
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "./api";

// Mostrar la notificación aunque la app esté en primer plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // no hay push en simulador
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    return data;
  } catch {
    return null;
  }
}

/** Registra el dispositivo en el backend. Silencioso si no hay token o permiso. */
export async function registerDevice(authToken: string): Promise<void> {
  try {
    const expoToken = await getExpoPushToken();
    if (!expoToken) return;
    await api.registerDevice(authToken, expoToken, Platform.OS);
  } catch {
    // El push es best-effort: nunca rompe el arranque de la app.
  }
}
