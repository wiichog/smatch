/**
 * Barra de pestañas flotante de vidrio (blur iOS): la pestaña activa se resalta con una
 * pastilla lima tenue; háptica de selección al cambiar. Respeta el safe-area.
 *
 * La comparten las pestañas del jugador (`app/(tabs)`) y las del modo club
 * (`app/club/(tabs)`, 2026-10): una sola barra, un solo comportamiento.
 */
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_HEIGHT, tabBarBottom } from "@/lib/tabBar";
import { alpha, colors, radius, TIGHT_FONT_SCALE } from "@/theme";

// Props del tabBar personalizado. Tipamos estructuralmente lo que usamos (state +
// navigation) en vez de depender de @react-navigation: en SDK 56 expo-router dejó de ser
// compatible con react-navigation, y tener el paquete instalado duplicaba la instancia de
// navegación → crash al montar los tabs.
export type FloatingTabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

type IconName = keyof typeof Ionicons.glyphMap;
export type TabSpec = { name: string; label: string; icon: IconName };

export function FloatingTabBar({ state, navigation, tabs }: FloatingTabBarProps & { tabs: TabSpec[] }) {
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
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.label}
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
