/**
 * Ruteo de push notifications: qué pantalla abre cada notificación al tocarla.
 *
 * El backend manda en `data` un `type` y los ids del contexto (`messaging/services/push.py`).
 * Aquí traducimos ese payload a una ruta de expo-router y la navegamos. Tres reglas que
 * vienen de la auditoría y conviene no perder:
 *
 *  1. **Expo serializa `data` a string.** `send_push` hace `{k: str(v)}`, así que
 *     `round_id` llega como `"88"`, no como `88`. Todo id se parsea aquí.
 *  2. **Sin sesión no se navega, se recuerda.** Si el push llega con la app cerrada y sin
 *     token, guardamos el destino y lo replayeamos después del login. Navegar antes solo
 *     rebota contra el guard de `(tabs)/_layout`.
 *  3. **Una notificación sin destino no inventa uno.** Un push informativo (cumpleaños,
 *     que además va dirigido al staff del club, no al jugador) deja al usuario donde
 *     estaba en vez de tirarlo a una pantalla al azar.
 */
import * as Notifications from "expo-notifications";
import { router, useRootNavigationState } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/store/auth";

/** `data` de un push. Todo llega como string porque Expo lo serializa así. */
export type PushData = Record<string, string | undefined> & { type?: string };

/** Destino resuelto: la ruta y los params ya parseados. */
export type PushRoute = { pathname: string; params?: Record<string, string> };

/** Convierte a número el id que Expo mandó como string. `undefined` si no es un id válido. */
function id(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : undefined;
}

/**
 * A dónde lleva cada tipo de push. `null` = informativa, no navega.
 *
 * Los tipos son los seis que emite hoy el backend (messaging/services/push.py). Un tipo
 * desconocido —una versión vieja de la app recibiendo un push nuevo— tampoco navega.
 */
export function routeFor(data: PushData | undefined | null): PushRoute | null {
  if (!data?.type) return null;
  const roundId = id(data.round_id);
  const leagueId = id(data.league_id);

  switch (data.type) {
    // Ya hay jornada / pronto juegas → la jornada CONCRETA que menciona el push.
    // Sin `round_id` (pushes viejos ya en cola) caemos a "la próxima" del servidor.
    case "round_published":
    case "round_reminder":
      return { pathname: "/(tabs)/jornada", params: roundId ? { round_id: roundId } : undefined };

    // Subiste/bajaste de cancha → el ranking, que es donde se ve el resultado.
    case "round_closed":
      return { pathname: "/(tabs)/ranking", params: leagueId ? { league_id: leagueId } : undefined };

    // Impugnación pendiente de tu voto → la lista de impugnaciones por votar, con la
    // del push resaltada (puede haber varias abiertas y de clubes distintos).
    // (NO a `/dispute/[matchId]`, que es la pantalla para LEVANTAR una impugnación.)
    case "score_dispute": {
      const disputeId = id(data.dispute_id);
      return { pathname: "/disputes", params: disputeId ? { dispute_id: disputeId } : undefined };
    }

    // El torneo arrancó → el dashboard, que es donde la app lista torneos.
    case "tournament_activated":
      return { pathname: "/(tabs)/dashboard" };

    // Cumpleaños: va dirigido al staff del club y esta app es del jugador. No hay
    // pantalla a la que llevar, así que no movemos al usuario de donde esté.
    case "player_birthday":
      return null;

    default:
      return null;
  }
}

/** Destino pendiente cuando el push llegó sin sesión iniciada (se replayea tras el login). */
let pendingRoute: PushRoute | null = null;

/**
 * Dedup a nivel de MÓDULO, no un `useRef`.
 *
 * El módulo nativo retiene la última respuesta mientras viva el proceso, así que
 * `useLastNotificationResponse` la vuelve a entregar en cada montaje. Con el dedup dentro
 * del componente, cualquier remount del layout raíz (retry del ErrorBoundary, recreación
 * de la Activity) re-navegaba a un push ya consumido.
 */
let handledId: string | null = null;

export function consumePendingRoute(): PushRoute | null {
  const route = pendingRoute;
  pendingRoute = null;
  return route;
}

/** Olvida el destino pendiente. Se llama al cerrar sesión: es de quien lo recibió. */
export function clearPendingRoute() {
  pendingRoute = null;
}

function isTab(pathname: string) {
  return pathname.startsWith("/(tabs)");
}

function navigate(route: PushRoute) {
  const href = { pathname: route.pathname as never, params: route.params };
  if (isTab(route.pathname)) {
    // Primero cierra lo que haya apilado encima de las pestañas (Impugnaciones, Editar
    // perfil, Reservar…). Sin esto, la navegación diverge en el stack RAÍZ —compara la
    // pantalla apilada contra `(tabs)`— y monta un SEGUNDO navegador de pestañas: dos
    // tab bars, doble registro de dispositivo y el botón atrás en bucle.
    if (router.canDismiss()) router.dismissAll();
    // `replace` y nunca `push`: en arranque en frío el stack raíz aún está en
    // `app/index.tsx` y un `push` apilaría las pestañas encima en vez de sustituirlo.
    router.replace(href);
    return;
  }
  // Fuera de las pestañas basta `navigate`: apila la pantalla y deja la vuelta atrás.
  router.navigate(href);
}

/**
 * Entra a la app tras el login, directo al destino del push si lo hubo.
 *
 * UNA sola navegación hacia `(tabs)`: `replace("/(tabs)")` seguido de otra navegación a
 * `(tabs)/…` en el mismo tick se despacha en el mismo lote, y al convertir la segunda la
 * ruta recién creada aún no tiene estado anidado → diverge en el stack RAÍZ y duplica el
 * navegador de pestañas.
 */
export function enterAppAfterLogin() {
  const route = consumePendingRoute();
  // Destino dentro de las pestañas: se resuelve en el propio `replace`, sin una segunda
  // navegación que duplicaría el navegador.
  if (route && isTab(route.pathname)) {
    navigate(route);
    return;
  }
  router.replace("/(tabs)");
  // Fuera de las pestañas (p. ej. `/disputes`) sí son dos rutas distintas: la segunda
  // diverge por nombre y apila la pantalla correcta, con vuelta atrás a la app.
  if (route) navigate(route);
}

/**
 * Escucha los taps en notificaciones y navega. Se monta UNA vez, en el layout raíz.
 *
 * `useLastNotificationResponse` cubre los dos arranques: la notificación que abrió la app
 * estando cerrada (cold start) y las que se tocan con la app viva. Como el hook retiene
 * la última respuesta y vuelve a entregarla en cada re-render, deduplicamos por el
 * identifier de la notificación.
 */
export function useNotificationRouting() {
  const response = Notifications.useLastNotificationResponse();
  const token = useAuth((s) => s.token);
  const hydrated = useAuth((s) => s.hydrated);
  // `undefined` mientras el navegador raíz no está montado. En arranque en frío el push
  // llega antes que el Stack; navegar ahí se pierde.
  const navReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    if (!response || !navReady) return;
    // Esperamos a saber si hay sesión: sin hidratar no podemos decidir entre navegar
    // y encolar, y equivocarse aquí pierde el destino del push.
    if (!hydrated) return;

    const identifier = response.notification.request.identifier;
    if (handledId === identifier) return;

    const data = response.notification.request.content.data as PushData | undefined;
    const route = routeFor(data);
    handledId = identifier;
    // Suelta la respuesta que retiene el módulo nativo: si no, sigue viva todo el
    // proceso y un remount volvería a llevarnos a un push ya atendido.
    Notifications.clearLastNotificationResponse();
    if (!route) return;

    if (!token) {
      pendingRoute = route; // se replayea al terminar el login
      return;
    }
    navigate(route);
  }, [response, token, hydrated, navReady]);
}
