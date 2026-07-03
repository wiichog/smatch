import { BlurView } from "expo-blur";
import { useRef, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { colors, glassShadow, radius, spacing } from "@/theme";

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
  return (
    <View style={[styles.shadow, style?.marginBottom ? { marginBottom: style.marginBottom } : null]}>
      <BlurView intensity={strong ? 48 : 32} tint="dark" style={styles.blur}>
        <View style={[styles.tint, strong ? styles.tintStrong : null, style]}>{children}</View>
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
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  strong?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.975, speed: 40, bounciness: 0, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, speed: 24, bounciness: 7, useNativeDriver: true }).start();
  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={[styles.shadow, { transform: [{ scale }] }]}>
        <BlurView intensity={strong ? 48 : 32} tint="dark" style={styles.blur}>
          <View style={[styles.tint, strong ? styles.tintStrong : null, style]}>{children}</View>
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
