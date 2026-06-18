/**
 * Registro de push notifications (Expo Push). Pide permiso, obtiene el Expo push
 * token y lo manda al backend (`/api/v2/me/devices/`). Expo enruta a APNs (iOS) y
 * FCM (Android), así que un solo token sirve para ambas plataformas. En simulador
 * o sin permiso devuelve null.
 */
import Constants from "expo-constants";
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

/** Expo push token (`ExponentPushToken[...]`). null en simulador o sin permiso. */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // no hay push en simulador
  let status = (await Notifications.getPermissionsAsync()).status;
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;
  try {
    // El projectId lo inyecta EAS en app.json (extra.eas.projectId) tras `eas init`.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data ?? null;
  } catch {
    return null;
  }
}

/** Registra el dispositivo (Expo push token) en el backend. Best-effort, nunca lanza. */
export async function registerDevice(authToken: string): Promise<void> {
  try {
    const expoToken = await getExpoPushToken();
    if (!expoToken) return;
    await api.registerDevice(authToken, expoToken, Platform.OS);
  } catch {
    // El push es best-effort: nunca rompe el arranque de la app.
  }
}
