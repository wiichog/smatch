import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { Muted } from "@/components/ui";
import type { CoveredRound } from "@/lib/api";
import { roundShort } from "@/lib/format";
import { alpha, colors, MAX_FONT_SCALE, radius, spacing } from "@/theme";

/**
 * «Te cubre X»: una jornada donde el club puso a un suplente en tu lugar (2026-10).
 * Antes esa jornada simplemente desaparecía de la app del titular, sin explicación.
 */
export function CoveredNotice({ covered, style }: { covered: CoveredRound[]; style?: object }) {
  if (covered.length === 0) return null;
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {covered.map((c) => {
        const when = [roundShort(c.scheduled_at), `Pista ${c.court_number}`].filter(Boolean).join(" · ");
        return (
          <GlassCard key={c.round_id} style={styles.card}>
            <View style={styles.icon}>
              <Ionicons name="swap-horizontal" size={18} color={colors.highlight} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title} numberOfLines={2}>
                Te cubre {c.substitute}
              </Text>
              <Muted numberOfLines={2}>
                {c.league} · Jornada {c.round_number}
                {when ? ` · ${when}` : ""}
              </Muted>
              <Muted style={styles.note}>Tu club lo puso en tu lugar; tu pista se te guarda.</Muted>
            </View>
          </GlassCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.highlight, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 15, fontWeight: "700" },
  note: { fontSize: 12 },
});
