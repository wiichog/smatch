/**
 * Historial (fase 2, 2026-10): jornada por jornada, con quién jugaste, contra quién,
 * cómo terminó cada partido y qué pasó al cerrar la jornada.
 *
 * Antes era una lista de «Jornada 4 · Pista 2 · 6-3»: sin liga, sin fecha y sin un solo
 * nombre, así que nadie recordaba de qué partido se trataba.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { Label, Muted, Pill } from "@/components/ui";
import { useHistory } from "@/hooks";
import type { HistoryRow } from "@/lib/api";
import { playedDay } from "@/lib/format";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Group = {
  key: string;
  roundId: number | null;
  roundClosed: boolean;
  league: string | null;
  roundNumber: number;
  courtNumber: number;
  scheduledAt: string | null;
  total: number;
  movement: HistoryRow["round_movement"];
  matches: HistoryRow[];
};

export default function HistoryScreen() {
  const { data, isLoading, refetch, isRefetching, isError, error } = useHistory();
  const groups = useMemo(() => groupByRound(data?.history ?? []), [data]);

  return (
    <Screen title="Historial" subtitle="Tus partidos, jornada por jornada">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : isError && !data ? (
          <LoadError error={error} onRetry={() => void refetch()} style={{ marginTop: spacing.md }} />
        ) : groups.length === 0 ? (
          <GlassCard style={styles.empty}>
            <Ionicons name="time-outline" size={38} color={colors.textMuted} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptyTitle}>Todavía sin partidos</Text>
            <Muted style={{ textAlign: "center" }}>
              Cuando tu club capture los marcadores de tu primera jornada, aquí verás cada partido.
            </Muted>
          </GlassCard>
        ) : (
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            {groups.map((g) => (
              <RoundCard key={g.key} group={g} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Una jornada: liga, fecha, pista, puntos del día, si subiste o bajaste, y sus partidos. */
function RoundCard({ group: g }: { group: Group }) {
  const router = useRouter();
  const tone = toneFor(g.total);
  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <Label>{[g.league, `Jornada ${g.roundNumber}`].filter(Boolean).join(" · ")}</Label>
          <Muted>{[playedDay(g.scheduledAt), `Pista ${g.courtNumber}`].filter(Boolean).join(" · ")}</Muted>
        </View>
        <View
          style={[styles.totalPill, { backgroundColor: alpha(tone, 0.16) }]}
          accessible
          accessibilityLabel={`${signed(g.total)} puntos en la jornada`}
        >
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.totalText, { color: tone }]}>
            {signed(g.total)} pts
          </Text>
        </View>
      </View>

      {g.movement && <Movement movement={g.movement} />}

      {g.matches.map((m) => (
        <View key={m.match_id}>
          <View style={styles.hairline} />
          <MatchLine row={m} />
        </View>
      ))}

      {g.roundClosed && g.roundId != null && (
        <Pressable
          onPress={() => router.push(`/round/${g.roundId}`)}
          hitSlop={6}
          style={styles.resultsLink}
          accessibilityRole="button"
          accessibilityLabel={`Ver los resultados de la jornada ${g.roundNumber}: todas las pistas`}
        >
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.resultsText}>
            Ver resultados de la jornada
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      )}

      <Muted style={styles.hint}>¿Un marcador está mal? Toca el partido para impugnarlo.</Muted>
    </GlassCard>
  );
}

/** «↑ Subiste a la Pista 1» — lo que pasó al cerrar la jornada. */
function Movement({ movement }: { movement: NonNullable<HistoryRow["round_movement"]> }) {
  const to = movement.to_court_number;
  const m =
    movement.direction === "up"
      ? { icon: "arrow-up" as const, color: colors.success, text: `Subiste a la Pista ${to}` }
      : movement.direction === "down"
        ? { icon: "arrow-down" as const, color: colors.danger, text: `Bajaste a la Pista ${to}` }
        : { icon: "remove" as const, color: colors.textMuted, text: `Te quedaste en la Pista ${to}` };
  return (
    <View style={styles.moveRow}>
      <Ionicons name={m.icon} size={14} color={m.color} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.moveText, { color: m.color }]}>
        {m.text}
      </Text>
    </View>
  );
}

/** Un partido: con quién, contra quién, el marcador y los puntos. Tocarlo lo impugna. */
function MatchLine({ row }: { row: HistoryRow }) {
  const router = useRouter();
  const result = row.result ?? (row.games_for > row.games_against ? "win" : row.games_for < row.games_against ? "loss" : "draw");
  const scoreColor = result === "win" ? colors.success : result === "loss" ? colors.danger : colors.textMuted;
  const resultWord = result === "win" ? "Ganaste" : result === "loss" ? "Perdiste" : "Empate";
  const rivals = (row.opponents ?? []).map((o) => o.name).filter(Boolean);

  const label = [
    `Partido ${row.match_number}`,
    row.partner ? `con ${row.partner.name}` : null,
    rivals.length ? `contra ${rivals.join(" y ")}` : null,
    `${resultWord} ${row.games_for} a ${row.games_against}`,
    `${signed(row.points_delta)} puntos`,
    row.open_dispute_id ? "impugnación abierta" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      onPress={() =>
        row.open_dispute_id
          ? router.push(`/disputes?dispute_id=${row.open_dispute_id}`)
          : router.push(`/dispute/${row.match_id}`)
      }
      style={({ pressed }) => [styles.match, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={row.open_dispute_id ? "Abre la impugnación" : "Abre la impugnación del marcador"}
    >
      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.matchLabel}>
          PARTIDO {row.match_number}
        </Text>
        {row.partner ? (
          <View style={styles.people}>
            <Avatar name={row.partner.name} uri={row.partner.avatar_url} size={22} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.partner}>
              Con {row.partner.name}
            </Text>
          </View>
        ) : null}
        {rivals.length > 0 && (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2} style={styles.rivals}>
            vs {rivals.join(" y ")}
          </Text>
        )}
        {!!row.open_dispute_id && (
          <View style={{ alignSelf: "flex-start" }}>
            <Pill label="Impugnación abierta" tone="neutral" />
          </View>
        )}
      </View>
      <View style={styles.scoreBox}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.score, { color: scoreColor }]}>
          {row.games_for}–{row.games_against}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.delta, { color: toneFor(row.points_delta) }]}>
          {signed(row.points_delta)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Agrupa los partidos por jornada conservando el orden del backend (la jornada más
 * reciente primero). Sin `round_id` (backend anterior) agrupa por liga + número.
 */
function groupByRound(rows: HistoryRow[]): Group[] {
  const groups: Group[] = [];
  const index = new Map<string, Group>();
  for (const r of rows) {
    const key = r.round_id != null ? `r${r.round_id}` : `l${r.league_id ?? 0}-n${r.round_number}`;
    let g = index.get(key);
    if (!g) {
      g = {
        key,
        roundId: r.round_id ?? null,
        roundClosed: r.round_closed ?? false,
        league: r.league_name ?? null,
        roundNumber: r.round_number,
        courtNumber: r.court_number,
        scheduledAt: r.scheduled_at ?? null,
        total: 0,
        movement: r.round_movement ?? null,
        matches: [],
      };
      index.set(key, g);
      groups.push(g);
    }
    g.total += r.points_delta;
    g.matches.push(r);
  }
  for (const g of groups) g.matches.sort((a, b) => a.match_number - b.match_number);
  return groups;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function toneFor(n: number): string {
  return n > 0 ? colors.success : n < 0 ? colors.danger : colors.textMuted;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  empty: { marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.xl, gap: 8 },
  emptyTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  card: { gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  totalPill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  totalText: { fontWeight: "800", fontSize: 13 },
  moveRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  moveText: { fontSize: 13, fontWeight: "700" },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginBottom: spacing.sm },
  match: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  matchLabel: { color: colors.textFaint, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  people: { flexDirection: "row", alignItems: "center", gap: 6 },
  partner: { flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  rivals: { color: colors.textMuted, fontSize: 13 },
  scoreBox: { alignItems: "flex-end", gap: 2 },
  score: { fontSize: 22, fontFamily: fonts.display, fontVariant: ["tabular-nums"] },
  delta: { fontSize: 12, fontWeight: "800" },
  hint: { fontSize: 12, marginTop: spacing.xs },
  resultsLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: spacing.xs },
  resultsText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
