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

// Mostrar la notificación aunque la app esté en primer plano (API de Expo SDK 53+).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
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

/**
 * Suelta el dispositivo al cerrar sesión. Best-effort, nunca lanza.
 *
 * Sin esto, un teléfono prestado sigue recibiendo los push del jugador anterior: el
 * token vive en el backend hasta que otra cuenta lo reclame con un login.
 */
export async function unregisterDevice(authToken: string | null): Promise<void> {
  if (!authToken) return;
  const soltar = (async () => {
    // Sin pedir permisos: si nunca se otorgaron no hay token que soltar.
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    const pushToken = await getExpoPushToken();
    if (!pushToken) return;
    await api.unregisterDevice(authToken, pushToken);
  })();
  // Con techo: `fetch` en React Native no trae timeout, y esto está en el camino del
  // botón de cerrar sesión. Si la red no contesta, se cierra igual — el token se
  // reasigna solo cuando otra cuenta entre desde este teléfono.
  const techo = new Promise<void>((resolve) => setTimeout(resolve, 4000));
  await Promise.race([soltar.catch(() => {}), techo]);
}
