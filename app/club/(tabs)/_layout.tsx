/**
 * Pestañas del modo club (2026-10): Hoy · Agenda · Jugadores · Más.
 *
 * Antes el modo club era una sola pantalla («Hoy») con todo abajo. Ahora el dueño o
 * supervisor tiene la agenda del día y a sus jugadores a un toque, con la misma barra
 * flotante que el jugador. Agenda y Jugadores salen según lo que el panel le enseña a
 * esta membresía (`sections` del «Hoy»): sin Calendario no hay Agenda, sin Jugadores no
 * hay padrón. Las pantallas apiladas (hoja de la jornada, cubrir, marcador, cierre,
 * ficha) siguen fuera del grupo, encima de las pestañas.
 */
import { Redirect, Tabs, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";

import { AppErrorFallback } from "@/components/AppErrorFallback";
import { FloatingTabBar, type TabSpec } from "@/components/FloatingTabBar";
import { useClubToday } from "@/hooks";
import { useClubOrg } from "@/lib/clubOrg";
import { registerAccountDevice } from "@/lib/push";
import { useAuth } from "@/store/auth";

/** Red de seguridad por pestaña: un throw en una pantalla cae aquí, no tumba la app. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorFallback error={props.error} retry={props.retry} />;
}

export const unstable_settings = { initialRouteName: "index" };

const TABS: TabSpec[] = [
  { name: "index", label: "Hoy", icon: "today" },
  { name: "agenda", label: "Agenda", icon: "calendar" },
  { name: "jugadores", label: "Jugadores", icon: "people" },
  { name: "mas", label: "Más", icon: "ellipsis-horizontal-circle" },
];

export default function ClubTabsLayout() {
  const token = useAuth((s) => s.token);
  const { orgId } = useClubOrg();
  // El teléfono, con la cuenta: los avisos del club (no voy, impugnaciones, reservas)
  // llegan aunque esta persona no tenga ficha de jugador.
  useEffect(() => {
    if (token) void registerAccountDevice(token);
  }, [token]);
  const sections = useClubToday(orgId).data?.sections;
  // Mientras no se sabe, no se muestran: aparecer tarde es menos raro que desaparecer.
  const tabs = TABS.filter((t) =>
    t.name === "agenda" ? !!sections?.calendar : t.name === "jugadores" ? !!sections?.players : true
  );

  if (!token) return <Redirect href="/login" />;
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false, animation: "shift" }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="agenda" />
      <Tabs.Screen name="jugadores" />
      <Tabs.Screen name="mas" />
    </Tabs>
  );
}
