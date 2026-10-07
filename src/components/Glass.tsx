import { BlurView } from "expo-blur";
import { useRef, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { colors, glassShadow, radius, spacing } from "@/theme";

/**
 * Los márgenes van en la envoltura, no dentro del vidrio: aplicados al tinte, el blur
 * se estiraba hasta cubrirlos y asomaba como un escalón de vidrio arriba o abajo del
 * borde de la tarjeta.
 */
const MARGIN_KEYS = new Set([
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginStart",
  "marginEnd",
  "marginHorizontal",
  "marginVertical",
]);

function splitMargins(style?: ViewStyle): { outer: ViewStyle; inner: ViewStyle } {
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(style ?? {})) {
    (MARGIN_KEYS.has(key) ? outer : inner)[key] = value;
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

/**
 * Tarjeta de "liquid glass" sobre grafito (alineada a la landing y a houselive):
 * superficie esmerilada oscura (blur iOS), borde luminoso sutil y sombra profunda.
 * `strong` sube la opacidad para cabeceras/hero.
 */
export function GlassCard({
  children,
  style,
  strong,
}: {
  children: ReactNode;
  style?: ViewStyle;
  strong?: boolean;
}) {
  const { outer, inner } = splitMargins(style);
  return (
    <View style={[styles.shadow, outer]}>
      <BlurView intensity={strong ? 48 : 32} tint="dark" style={styles.blur}>
        <View style={[styles.tint, strong ? styles.tintStrong : null, inner]}>{children}</View>
      </BlurView>
    </View>
  );
}

/** Vidrio presionable (tarjetas que navegan o ejecutan acciones).
 * Feedback físico: resorte de escala al presionar (sin cambio seco). */
export function GlassPressable({
  children,
  onPress,
  style,
  strong,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  strong?: boolean;
  accessibilityLabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.975, speed: 40, bounciness: 0, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, speed: 24, bounciness: 7, useNativeDriver: true }).start();
  const { outer, inner } = splitMargins(style);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={outer}
    >
      <Animated.View style={[styles.shadow, { transform: [{ scale }] }]}>
        <BlurView intensity={strong ? 48 : 32} tint="dark" style={styles.blur}>
          <View style={[styles.tint, strong ? styles.tintStrong : null, inner]}>{children}</View>
        </BlurView>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.lg, ...glassShadow },
  blur: { borderRadius: radius.lg, overflow: "hidden" },
  tint: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tintStrong: { backgroundColor: colors.glassStrong },
});
