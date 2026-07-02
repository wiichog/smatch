import { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { colors, radius, spacing } from "@/theme";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ink" | "outline";
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg =
    variant === "primary" ? colors.primary : variant === "ink" ? colors.ink900 : "transparent";
  const fg = variant === "primary" ? colors.ink900 : variant === "ink" ? colors.textInverse : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "outline" && { borderWidth: 1, borderColor: colors.cardBorder },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "primary" }) {
  const map = {
    neutral: { bg: "rgba(255,255,255,0.10)", fg: "rgba(255,255,255,0.75)" },
    success: { bg: colors.highlightSoft, fg: colors.highlight700 },
    primary: { bg: "#EEFFC0", fg: "#455D00" },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: map.bg }]}>
      <Text style={{ color: map.fg, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  btnText: { fontSize: 16, fontWeight: "700" },
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
    paddingVertical: 3,
  },
  h1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, color: colors.text },
  muted: { color: colors.textMuted, fontSize: 14 },
});
