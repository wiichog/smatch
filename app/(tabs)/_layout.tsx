import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Redirect, Tabs, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppErrorFallback } from "@/components/AppErrorFallback";
import { useRentalCourts } from "@/hooks";
import { api } from "@/lib/api";
import { registerDevice } from "@/lib/push";
import { TAB_BAR_HEIGHT, tabBarBottom } from "@/lib/tabBar";
import { useAuth } from "@/store/auth";
import { alpha, colors, radius, TIGHT_FONT_SCALE } from "@/theme";

/** Red de seguridad por-pestaña: un throw en una pantalla de tab cae aquí, no tumba la app. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorFallback error={props.error} retry={props.retry} />;
}

// Inicio (dashboard) es la pestaña de arranque del grupo.
// La pestaña de jornada vive en `jornada.tsx`, no en `index.tsx`: como `(tabs)` es un
// grupo (no aparece en la URL), un `index.tsx` aquí chocaría con `app/index.tsx` por la
// ruta `/` y no habría href estable al que mandar un deep link de push.
export const unstable_settings = { initialRouteName: "dashboard" };

// Props del tabBar personalizado. Tipamos estructuralmente lo que usamos (state +
// navigation) en vez de depender de @react-navigation: en SDK 56 expo-router dejó de ser
// compatible con react-navigation, y tener el paquete instalado duplicaba la instancia de
// navegación → crash al montar los tabs.
type FloatingTabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

type IconName = keyof typeof Ionicons.glyphMap;
type Tab = { name: string; label: string; icon: IconName };
// Fase 2 (2026-10): Ranking + Historial se juntaron en «Liga» (la ruta sigue siendo
// `ranking`) para darle su pestaña a Reservar, que antes vivía escondida en Perfil.
const TABS: Tab[] = [
  { name: "dashboard", label: "Inicio", icon: "home" },
  { name: "jornada", label: "Jornada", icon: "tennisball" },
  { name: "ranking", label: "Liga", icon: "trophy" },
  { name: "reservar", label: "Reservar", icon: "calendar" },
  { name: "profile", label: "Perfil", icon: "person" },
];

/** Barra de pestañas flotante de vidrio (blur iOS): la pestaña activa se resalta con
 * una pastilla lima tenue; háptica de selección al cambiar. Respeta el safe-area. */
function FloatingTabBar({ state, navigation, tabs }: FloatingTabBarProps & { tabs: Tab[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: tabBarBottom(insets.bottom) }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="dark" style={styles.bar}>
        <View style={styles.overlay} />
        <View style={styles.row}>
          {tabs.map((tab) => {
            const idx = state.routes.findIndex((r: { name: string }) => r.name === tab.name);
            const active = state.index === idx;
            return (
              <Pressable
                key={tab.name}
                style={styles.tab}
                hitSlop={6}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => {});
                  navigation.navigate(tab.name);
                }}
              >
                <View style={[styles.pill, active && styles.pillActive]}>
                  <Ionicons
                    name={active ? tab.icon : (`${tab.icon}-outline` as IconName)}
                    size={22}
                    color={active ? colors.primary : colors.textMuted}
                  />
                </View>
                <Text
                  style={[styles.label, { color: active ? colors.primary : colors.textFaint }]}
                  maxFontSizeMultiplier={TIGHT_FONT_SCALE}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

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

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14, height: TAB_BAR_HEIGHT },
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: "#000000",
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(colors.ink900, 0.72),
  },
  row: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", height: "100%", gap: 2 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  pillActive: { backgroundColor: alpha(colors.primary, 0.14) },
  label: { fontSize: 10, fontWeight: "700" },
});
