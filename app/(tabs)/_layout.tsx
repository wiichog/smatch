import { Redirect, Tabs, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";

import { AppErrorFallback } from "@/components/AppErrorFallback";
import { FloatingTabBar, type TabSpec } from "@/components/FloatingTabBar";
import { useRentalCourts } from "@/hooks";
import { api } from "@/lib/api";
import { registerDevice } from "@/lib/push";
import { isClubOnly, useAuth } from "@/store/auth";

/** Red de seguridad por-pestaña: un throw en una pantalla de tab cae aquí, no tumba la app. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorFallback error={props.error} retry={props.retry} />;
}

// Inicio (dashboard) es la pestaña de arranque del grupo.
// La pestaña de jornada vive en `jornada.tsx`, no en `index.tsx`: como `(tabs)` es un
// grupo (no aparece en la URL), un `index.tsx` aquí chocaría con `app/index.tsx` por la
// ruta `/` y no habría href estable al que mandar un deep link de push.
export const unstable_settings = { initialRouteName: "dashboard" };

// Fase 2 (2026-10): Ranking + Historial se juntaron en «Liga» (la ruta sigue siendo
// `ranking`) para darle su pestaña a Reservar, que antes vivía escondida en Perfil.
const TABS: TabSpec[] = [
  { name: "dashboard", label: "Inicio", icon: "home" },
  { name: "jornada", label: "Jornada", icon: "tennisball" },
  { name: "ranking", label: "Liga", icon: "trophy" },
  { name: "reservar", label: "Reservar", icon: "calendar" },
  { name: "profile", label: "Perfil", icon: "person" },
];

export default function TabsLayout() {
  const token = useAuth((s) => s.token);
  // «Reservar» solo si el club renta canchas desde la app (con el módulo apagado el
  // backend manda la lista vacía). Mientras no se sabe, no se muestra: aparecer tarde
  // es menos raro que desaparecer.
  const rental = useRentalCourts();
  const rents = (rental.data?.courts.length ?? 0) > 0;
  const tabs = rents ? TABS : TABS.filter((t) => t.name !== "reservar");

  // Registrar el dispositivo para push cuando hay sesión (best-effort).
  useEffect(() => {
    if (token) registerDevice(token);
  }, [token]);

  // Nombre y foto frescos del jugador. La sesión guardada es una foto del login: las de
  // antes del arreglo del backend traen el CORREO como nombre («Hola, diego@…»), y una
  // foto cambiada desde el panel no llegaba hasta volver a entrar. Best-effort: sin red
  // se queda lo guardado.
  useEffect(() => {
    if (!token) return;
    api
      .profile(token)
      .then((p) => {
        const { user, setSession } = useAuth.getState();
        if (!user || useAuth.getState().token !== token) return;
        const name = (p?.full_name ?? "").trim() || user.name;
        const avatar_url = p?.avatar_url ?? user.avatar_url ?? null;
        if (name !== user.name || avatar_url !== user.avatar_url) {
          setSession(token, { ...user, name, avatar_url });
        }
      })
      .catch(() => {});
  }, [token]);

  if (!token) return <Redirect href="/login" />;
  // Staff sin jugador: las pestañas son del jugador (todas piden un Player vinculado).
  if (isClubOnly(useAuth.getState().user)) return <Redirect href="/club" />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} tabs={tabs} />}
      screenOptions={{ headerShown: false, animation: "shift" }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="jornada" />
      <Tabs.Screen name="ranking" />
      <Tabs.Screen name="reservar" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
