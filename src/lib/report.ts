/**
 * Captura de contexto y cola offline del reporter de la app.
 *
 * - `captureContext()` reúne versión/build, plataforma/SO, modelo del dispositivo y la
 *   ruta actual para adjuntarlos automáticamente al reporte.
 * - Cola offline: si el envío falla (sin red), el reporte se guarda en SecureStore y se
 *   reintenta al abrir la app o al enviar el siguiente. Los reportes en cola no llevan
 *   imagen (solo texto + metadata) para no exceder el almacenamiento seguro.
 */
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { api } from "./api";

const QUEUE_KEY = "smatch-bug-queue";
const MAX_QUEUE = 10;

export interface ReportPayload {
  description: string;
  app_version?: string;
  build_number?: string;
  platform?: string;
  os_version?: string;
  device_model?: string;
  screen?: string;
  stack_trace?: string;
  client_context?: Record<string, unknown>;
}

/** Metadata del dispositivo/app que se adjunta automáticamente. */
export function captureContext(screen: string): Omit<ReportPayload, "description"> {
  const cfg = Constants.expoConfig;
  const build =
    Platform.OS === "ios"
      ? cfg?.ios?.buildNumber
      : String(cfg?.android?.versionCode ?? "");
  const model = [Device.brand, Device.modelName].filter(Boolean).join(" ");
  return {
    app_version: cfg?.version ?? "",
    build_number: build ?? "",
    platform: Platform.OS === "ios" ? "ios" : "android",
    os_version: `${Device.osName ?? Platform.OS} ${Device.osVersion ?? ""}`.trim(),
    device_model: model,
    screen,
    client_context: {
      expoRuntime: cfg?.runtimeVersion ?? cfg?.sdkVersion ?? null,
      isDevice: Device.isDevice,
      deviceType: Device.deviceType ?? null,
      appOwnership: Constants.appOwnership ?? null,
    },
  };
}

// --- Cola offline --------------------------------------------------- #
async function readQueue(): Promise<ReportPayload[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as ReportPayload[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: ReportPayload[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
  } catch {
    // Si no cabe, descartamos silenciosamente: un reporte no debe romper la app.
  }
}

/** Encola un reporte para reintento posterior (sin imagen). */
export async function enqueueReport(payload: ReportPayload): Promise<void> {
  const queue = await readQueue();
  queue.push(payload);
  await writeQueue(queue);
}

/**
 * Intenta enviar los reportes en cola. Best-effort: los que fallan se vuelven a
 * guardar. Nunca lanza. Se llama al abrir la app y tras cada envío exitoso.
 */
export async function flushQueue(token: string): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;
  const pending: ReportPayload[] = [];
  for (const item of queue) {
    try {
      await api.reportBug(token, item);
    } catch {
      pending.push(item); // sigue sin red → se conserva
    }
  }
  await writeQueue(pending);
}
