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

/** Token NATIVO del dispositivo (FCM en Android / APNs en iOS vía Firebase). */
export async function getDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // no hay push en simulador
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === "string" ? token.data : null;
  } catch {
    return null;
  }
}

/** Registra el dispositivo (token FCM) en el backend. Best-effort, nunca lanza. */
export async function registerDevice(authToken: string): Promise<void> {
  try {
    const fcmToken = await getDevicePushToken();
    if (!fcmToken) return;
    await api.registerDevice(authToken, fcmToken, Platform.OS);
  } catch {
    // El push es best-effort: nunca rompe el arranque de la app.
  }
}
