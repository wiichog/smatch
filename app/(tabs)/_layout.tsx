import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Redirect, Tabs } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { registerDevice } from "@/lib/push";
import { useAuth } from "@/store/auth";
import { alpha, colors, radius } from "@/theme";

// Inicio (dashboard) es la pestaña de arranque del grupo.
export const unstable_settings = { initialRouteName: "dashboard" };

type IconName = keyof typeof Ionicons.glyphMap;
const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: "dashboard", label: "Inicio", icon: "home" },
  { name: "index", label: "Jornada", icon: "tennisball" },
  { name: "ranking", label: "Ranking", icon: "trophy" },
  { name: "history", label: "Historial", icon: "time" },
  { name: "profile", label: "Perfil", icon: "person" },
];

/** Barra de pestañas flotante de vidrio (blur iOS): la pestaña activa se resalta con
 * una pastilla lima tenue; háptica de selección al cambiar. Respeta el safe-area. */
function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: (insets.bottom || 10) + 6 }]} pointerEvents="box-none">
      <BlurView intensity={40} tint="dark" style={styles.bar}>
        <View style={styles.overlay} />
        <View style={styles.row}>
          {TABS.map((tab) => {
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
                <Text style={[styles.label, { color: active ? colors.primary : colors.textFaint }]}>
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

  // Registrar el dispositivo para push cuando hay sesión (best-effort).
  useEffect(() => {
    if (token) registerDevice(token);
  }, [token]);

  if (!token) return <Redirect href="/login" />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: "shift" }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="ranking" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14, height: 66 },
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
