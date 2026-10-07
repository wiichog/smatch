import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { Muted } from "@/components/ui";
import type { PlayerStats as Stats } from "@/lib/api";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Result = Stats["last_results"][number];

const RESULT: Record<Result, { letter: string; color: string; one: string; many: string }> = {
  win: { letter: "G", color: colors.success, one: "victoria", many: "victorias" },
  draw: { letter: "E", color: colors.textMuted, one: "empate", many: "empates" },
  loss: { letter: "P", color: colors.danger, one: "derrota", many: "derrotas" },
};

/**
 * «Tus números» en el Perfil (fase 2, 2026-10): partidos, porcentaje de victorias, racha,
 * la forma reciente y cuántas veces subiste o bajaste de pista. De todos tus clubes.
 *
 * Si falla la carga no tumba el Perfil: queda un aviso con reintento dentro de la tarjeta.
 */
export function PlayerStatsCard({
  stats,
  loading,
  failed,
  onRetry,
}: {
  stats?: Stats;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  if (loading && !stats) {
    return (
      <GlassCard style={styles.card}>
        <ActivityIndicator color={colors.primary} />
      </GlassCard>
    );
  }
  if (failed && !stats) {
    return (
      <GlassCard style={styles.card}>
        <Muted>No pudimos cargar tus números.</Muted>
        <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.retry}>Reintentar</Text>
        </Pressable>
      </GlassCard>
    );
  }
  if (!stats) return null;

  if (stats.matches === 0) {
    return (
      <GlassCard style={styles.card}>
        <Muted>Cuando juegues tu primera jornada, aquí verás tus partidos, tu porcentaje de victorias y tu racha.</Muted>
      </GlassCard>
    );
  }

  // Una «racha» de 1 no dice nada: entonces el recuadro muestra tu mejor racha.
  const streak = stats.streak && stats.streak.count >= 2 ? stats.streak : null;
  // La forma, como línea de tiempo: la más vieja a la izquierda, la última a la derecha.
  const form = [...stats.last_results].reverse();

  return (
    <GlassCard style={styles.card}>
      <View style={styles.tiles}>
        <Tile value={String(stats.matches)} label={stats.matches === 1 ? "PARTIDO" : "PARTIDOS"} />
        <Tile
          value={stats.win_rate != null ? `${stats.win_rate}%` : "—"}
          label="GANADOS"
          tone={colors.primary}
        />
        {streak ? (
          <Tile value={String(streak.count)} label={streakLabel(streak.kind)} tone={RESULT[streak.kind].color} />
        ) : (
          <Tile value={String(stats.best_win_streak)} label="MEJOR RACHA" />
        )}
      </View>

      <View
        style={styles.bar}
        accessible
        accessibilityLabel={`${stats.wins} ganados, ${stats.draws} empatados, ${stats.losses} perdidos`}
      >
        {stats.wins > 0 && <View style={{ flex: stats.wins, backgroundColor: colors.success }} />}
        {stats.draws > 0 && <View style={{ flex: stats.draws, backgroundColor: alpha(colors.text, 0.3) }} />}
        {stats.losses > 0 && <View style={{ flex: stats.losses, backgroundColor: colors.danger }} />}
      </View>
      <Muted>
        {stats.wins} {stats.wins === 1 ? "ganado" : "ganados"} · {stats.draws}{" "}
        {stats.draws === 1 ? "empate" : "empates"} · {stats.losses} {stats.losses === 1 ? "perdido" : "perdidos"}
      </Muted>

      <View style={styles.hairline} />

      <View style={styles.row}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowLabel}>Últimos partidos</Text>
        <View
          style={styles.form}
          accessible
          accessibilityLabel={`Últimos partidos, del más viejo al más reciente: ${form.map((r) => RESULT[r].one).join(", ")}`}
        >
          {form.map((r, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: alpha(RESULT[r].color, 0.18), borderColor: RESULT[r].color }]}>
              <Text maxFontSizeMultiplier={1} style={[styles.dotText, { color: RESULT[r].color }]}>
                {RESULT[r].letter}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {streak && (
        <Line
          label="Mejor racha"
          value={`${stats.best_win_streak} ${stats.best_win_streak === 1 ? "victoria" : "victorias"}`}
        />
      )}
      <Line label="Games" value={`${stats.games_for} a favor · ${stats.games_against} en contra`} />
      <Line
        label="Pistas"
        value={`${stats.moves.up} ${stats.moves.up === 1 ? "subida" : "subidas"} · ${stats.moves.down} ${
          stats.moves.down === 1 ? "bajada" : "bajadas"
        }`}
      />
    </GlassCard>
  );
}

/** «VICTORIAS SEGUIDAS», «DERROTAS SEGUIDAS», «EMPATES SEGUIDOS». */
function streakLabel(kind: Result): string {
  return `${RESULT[kind].many.toUpperCase()} ${kind === "draw" ? "SEGUIDOS" : "SEGUIDAS"}`;
}

function Tile({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${value} ${label.toLowerCase()}`}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.tileValue, tone ? { color: tone } : null]}>
        {value}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2} style={styles.tileLabel}>
        {label}
      </Text>
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowLabel}>{label}</Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  retry: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  tiles: { flexDirection: "row", gap: spacing.sm },
  tile: { flex: 1, gap: 2 },
  tileValue: { color: colors.text, fontSize: 28, fontFamily: fonts.display },
  tileLabel: { color: colors.textFaint, fontSize: 9, letterSpacing: 1.2, fontWeight: "700" },
  bar: {
    flexDirection: "row",
    height: 8,
    borderRadius: radius.full,
    overflow: "hidden",
    gap: 2,
    marginTop: spacing.xs,
  },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginVertical: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  rowLabel: { color: colors.textMuted, fontSize: 14 },
  rowValue: { flexShrink: 1, textAlign: "right", color: colors.text, fontSize: 14, fontWeight: "700" },
  form: { flexDirection: "row", gap: 6 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: { fontSize: 11, fontWeight: "800" },
});
