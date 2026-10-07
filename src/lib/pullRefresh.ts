import { useState } from "react";

/**
 * «Jalar para refrescar» que gira SOLO mientras dura el jalón de la persona.
 *
 * Con `refreshing={isRefetching}` el spinner salía también en cada recarga de fondo —al
 * volver de capturar un marcador, al regresar a la app, después de confirmar «Voy»— y
 * empujaba la pantalla hacia abajo sin que nadie lo hubiera pedido.
 */
export function usePullRefresh(refresh: () => Promise<unknown> | void) {
  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }
  return { refreshing, onRefresh };
}
