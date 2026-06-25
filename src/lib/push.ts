/**
 * Registro de push notifications con EXPO PUSH (no Firebase nativo).
 *
 * La app obtiene un Expo push token (ExponentPushToken[...]) con expo-notifications y
 * lo registra en el backend (/api/v2/me/devices/). El backend envía vía la API de Expo
 * Push, que rutea a APNs (iOS) y FCM (Android). NO usamos @react-native-firebase ni
 * getDevicePushTokenAsync() (ese da el token APNs crudo, que Expo/FCM rechazan con
 * InvalidProviderToken/InvalidArgument).
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { api } from "./api";

// Mostrar la notificación aunque la app esté en primer plano.
// (En Expo SDK 51 el campo es `shouldShowAlert`; en SDK 53+ se separa en
//  shouldShowBanner/shouldShowList. Mantener shouldShowAlert mientras estemos en 51.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Obtiene el Expo push token del dispositivo. null en simulador o sin permiso. */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // no hay push en simulador
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return token || null;
}

/** Registra el dispositivo (Expo push token) en el backend. Best-effort, nunca lanza. */
export async function registerDevice(authToken: string): Promise<void> {
  try {
    const pushToken = await getExpoPushToken();
    if (!pushToken) return;
    await api.registerDevice(authToken, pushToken, Platform.OS);
  } catch {
    // Silencioso: Expo Go / simulador / sin permiso nunca rompe el arranque de la app.
  }
}
