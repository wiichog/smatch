/**
 * Cerrar sesión EN ESTE TELÉFONO (2026-10).
 *
 * La app entra con un token propio del teléfono (`login` con `client: "app"`), así que
 * cerrar sesión ya lo borra en el backend sin sacar al panel ni a los otros teléfonos.
 * Antes solo se olvidaba el token aquí y seguía vivo en el servidor.
 */
import type { QueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { clearPendingRoute } from "@/lib/notifications";
import { unregisterDevice } from "@/lib/push";
import { useAuth } from "@/store/auth";

let ending = false;

/** ¿Se está cerrando la sesión a propósito? El 401 de esos segundos no es «expiró». */
export function isEndingSession() {
  return ending;
}

export async function endSession(queryClient: QueryClient): Promise<void> {
  const { token, session } = useAuth.getState();
  ending = true;
  try {
    // Suelta el dispositivo ANTES de tirar el token: si no, este teléfono sigue
    // recibiendo los push de quien acaba de salir.
    await unregisterDevice(token);
    // Solo el token propio de este teléfono se borra en el backend: el compartido es el
    // mismo del panel (sesión vieja o backend anterior) y borrarlo lo sacaría también.
    if (token && session === "device") {
      // Con techo: `fetch` en React Native no trae timeout. Sin red se cierra igual
      // aquí, y el token queda como cualquier sesión olvidada (el backend poda las viejas).
      const techo = new Promise<void>((resolve) => setTimeout(resolve, 4000));
      await Promise.race([api.logout(token).catch(() => {}), techo]);
    }
  } finally {
    useAuth.getState().signOut();
    // El destino de un push pendiente era de quien acaba de salir: no puede replayearse
    // cuando entre otra persona en este teléfono.
    clearPendingRoute();
    // Y la caché: las queryKeys no llevan el id del jugador, así que el siguiente en
    // entrar vería la jornada y el ranking del anterior.
    queryClient.clear();
    ending = false;
  }
}
