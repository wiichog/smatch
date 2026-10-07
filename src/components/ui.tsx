import * as Haptics from "expo-haptics";
import { ReactNode, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing, TIGHT_FONT_SCALE } from "@/theme";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ink" | "outline" | "glass";
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "ink"
        ? colors.ink900
        : variant === "glass"
          ? colors.glassStrong
          : "transparent";
  const fg =
    variant === "primary" ? colors.onPrimary : variant === "outline" ? colors.text : colors.text;

  const springTo = (to: number, bounce = 0) =>
    Animated.spring(scale, { toValue: to, speed: 40, bounciness: bounce, useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      onPressIn={() => springTo(0.97)}
      onPressOut={() => springTo(1, 6)}
      disabled={disabled || loading}
    >
      <Animated.View
        style={[
          styles.btn,
          { backgroundColor: bg, opacity: disabled ? 0.5 : 1, transform: [{ scale }] },
          (variant === "outline" || variant === "glass") && {
            borderWidth: 1,
            borderColor: colors.glassBorder,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <View style={styles.btnInner}>
            {icon}
            <Text style={[styles.btnText, { color: fg }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>{title}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "primary" | "danger";
}) {
  const map = {
    neutral: { bg: "rgba(255,255,255,0.10)", fg: "rgba(255,255,255,0.75)" },
    success: { bg: alpha(colors.highlight, 0.16), fg: colors.highlight },
    primary: { bg: alpha(colors.primary, 0.16), fg: colors.primary },
    danger: { bg: alpha(colors.danger, 0.16), fg: colors.danger },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg }]}>
      <Text style={{ color: map.fg, fontSize: 12, fontWeight: "800" }} maxFontSizeMultiplier={TIGHT_FONT_SCALE}>{label}</Text>
    </View>
  );
}

/** Chip de estado: punto/etiqueta a un color arbitrario (roles, estados). */
export function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: alpha(color, 0.16) }]}>
      <Text style={{ color, fontSize: 11, fontWeight: "700" }} maxFontSizeMultiplier={TIGHT_FONT_SCALE}>{label}</Text>
    </View>
  );
}

/** Overline en MAYÚSCULAS con tracking — etiqueta de campo/dato. */
/**
 * Opción elegible en forma de pastilla (día, cancha, liga…): lima cuando está elegida.
 * Mismo look que los chips de Reservar.
 */
export function SelectChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!selected) void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View style={[styles.selectChip, selected && styles.selectChipOn]}>
        <Text
          maxFontSizeMultiplier={TIGHT_FONT_SCALE}
          numberOfLines={1}
          style={[styles.selectChipText, selected && styles.selectChipTextOn]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Control segmentado de 2–3 vistas («Tabla | Mis partidos»): una pastilla de vidrio
 * con la opción elegida en lima. Para cambiar de VISTA dentro de una pantalla; para
 * elegir un valor (día, cancha, liga) va `SelectChip`.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.segment, on && styles.segmentOn]}
            onPress={() => {
              if (on) return;
              void Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <Text
              maxFontSizeMultiplier={TIGHT_FONT_SCALE}
              numberOfLines={1}
              style={[styles.segmentText, on && styles.segmentTextOn]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>{children}</Text>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1} maxFontSizeMultiplier={MAX_FONT_SCALE}>{children}</Text>;
}

export function Muted({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={[styles.muted, style]} numberOfLines={numberOfLines} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: "row",
    padding: 3,
    gap: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
  },
  segment: { flex: 1, minHeight: 36, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: colors.primary },
  segmentText: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  segmentTextOn: { color: colors.onPrimary },
  selectChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: "center",
  },
  selectChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectChipText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  selectChipTextOn: { color: colors.onPrimary },
  btn: {
    minHeight: 54,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { fontSize: 16, fontWeight: "700", fontFamily: fonts.displaySemi },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textMuted,
    fontWeight: "700",
  },
  h1: { fontSize: 30, fontFamily: fonts.display, letterSpacing: -0.5, color: colors.text },
  muted: { color: colors.textMuted, fontSize: 14 },
});
