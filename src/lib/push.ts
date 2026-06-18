/**
 * Registro de push notifications (Firebase Cloud Messaging vía @react-native-firebase).
 * Pide permiso, obtiene el token FCM del dispositivo (Firebase lo enruta a APNs en iOS)
 * y lo manda al backend (`/api/v2/me/devices/`). En simulador o sin permiso devuelve null.
 * expo-notifications se mantiene solo para mostrar la notificación en primer plano.
 */
import messaging from "@react-native-firebase/messaging";
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

/** Token FCM del dispositivo. Firebase enruta a APNs en iOS. null sin permiso/simulador. */
export async function getFcmToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // no hay push en simulador
  const authStatus = await messaging().requestPermission();
  const granted =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!granted) return null;
  try {
    if (Platform.OS === "ios") {
      // En iOS hay que registrar con APNs antes de pedir el token FCM.
      await messaging().registerDeviceForRemoteMessages();
    }
    const token = await messaging().getToken();
    return token || null;
  } catch {
    return null;
  }
}

/** Registra el dispositivo (token FCM) en el backend. Best-effort, nunca lanza. */
export async function registerDevice(authToken: string): Promise<void> {
  try {
    const fcmToken = await getFcmToken();
    if (!fcmToken) return;
    await api.registerDevice(authToken, fcmToken, Platform.OS);
  } catch {
    // El push es best-effort: nunca rompe el arranque de la app.
  }
}
