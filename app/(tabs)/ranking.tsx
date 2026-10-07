/**
 * La tabla de la liga (fase 2, 2026-10).
 *
 * Antes esta pestaña solo decía «#13 · 0 pts»: el jugador no veía contra quién competía,
 * quién estaba en su pista ni a cuántos puntos tenía al de arriba. Ahora arriba va su
 * lugar, y abajo la liga entera pista por pista (así se juega: se sube y se baja de
 * pista) o por puntos, con su fila resaltada.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { Trend, trendLabel } from "@/components/Trend";
import { Label, Muted, Pill, SelectChip } from "@/components/ui";
import { useLeagueStandings, useRankings } from "@/hooks";
import type { LeagueStandings, Ranking, StandingRow } from "@/lib/api";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Mode = "courts" | "points";

export default function RankingScreen() {
  // `league_id` llega del push de cierre de jornada («subiste/bajaste de pista»): abre
  // directo esa liga, que el jugador puede tener varias.
  const { league_id } = useLocalSearchParams<{ league_id?: string }>();
  const pushed = Number(league_id) > 0 ? Number(league_id) : null;
  const rankings = useRankings();
  const leagues = rankings.data?.rankings ?? [];

  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => {
    if (pushed) setPicked(pushed);
  }, [pushed]);
  const selected =
    leagues.find((l) => l.league_id === picked)?.league_id ?? leagues[0]?.league_id ?? null;

  const standings = useLeagueStandings(selected);
  const [mode, setMode] = useState<Mode>("courts");

  // Dónde quedó tu pista (vista por pista) y tu fila (vista por puntos), para el atajo
  // «Ver mi pista / Ver mi lugar». Uno por vista: al cambiar de vista no se mezclan.
  const scrollRef = useRef<ScrollView>(null);
  const anchors = useRef<Record<Mode, number | null>>({ courts: null, points: null });
  function goToMe() {
    const y = anchors.current[mode];
    if (y == null) return;
    // Tu fila no pegada al borde: con aire arriba para ver quién va delante.
    const air = mode === "points" ? 160 : spacing.md;
    scrollRef.current?.scrollTo({ y: Math.max(y - air, 0), animated: true });
  }

  // Con ligas de dos clubes, el nombre solo no basta para distinguirlas.
  const severalClubs = new Set(leagues.map((l) => l.club ?? "")).size > 1;
  const chipLabel = (l: Ranking) => (severalClubs && l.club ? `${l.league_name} · ${l.club}` : l.league_name);

  return (
    <Screen title="Ranking" subtitle="La tabla de tu liga">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={rankings.isRefetching || standings.isRefetching}
            onRefresh={() => {
              void rankings.refetch();
              void standings.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {rankings.isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : rankings.isError && !rankings.data ? (
          <LoadError error={rankings.error} onRetry={() => void rankings.refetch()} style={{ marginTop: spacing.md }} />
        ) : leagues.length === 0 ? (
          <GlassCard style={styles.empty}>
            <Ionicons name="trophy-outline" size={38} color={colors.textMuted} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptyTitle}>Aún sin ranking</Text>
            <Muted style={{ textAlign: "center" }}>Cuando tu club te inscriba en una liga, aquí verás la tabla completa.</Muted>
          </GlassCard>
        ) : (
          <>
            {leagues.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsScroll}
                contentContainerStyle={styles.chips}
              >
                {leagues.map((l) => (
                  <SelectChip
                    key={l.league_id}
                    label={chipLabel(l)}
                    selected={l.league_id === selected}
                    onPress={() => setPicked(l.league_id)}
                  />
                ))}
              </ScrollView>
            )}

            {standings.isLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
            ) : standings.isError && !standings.data ? (
              <LoadError error={standings.error} onRetry={() => void standings.refetch()} style={{ marginTop: spacing.md }} />
            ) : standings.data ? (
              <Table
                data={standings.data}
                mode={mode}
                onMode={setMode}
                onAnchor={(m, y) => (anchors.current[m] = y)}
                onGoToMe={goToMe}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Tu lugar + el selector de vista + la tabla. Fragmento a propósito: las secciones
 *  quedan como hijas directas del ScrollView y su `onLayout` sirve para el scroll. */
function Table({
  data,
  mode,
  onMode,
  onAnchor,
  onGoToMe,
}: {
  data: LeagueStandings;
  mode: Mode;
  onMode: (m: Mode) => void;
  onAnchor: (mode: Mode, y: number) => void;
  onGoToMe: () => void;
}) {
  const me = data.rows.find((r) => r.is_me) ?? null;
  const groups = useMemo(() => byCourt(data.rows), [data.rows]);
  // Vista por puntos: tu fila vive dentro de la tarjeta, así que su altura en la
  // pantalla es la de la tarjeta más la suya dentro de ella.
  const pointsCardY = useRef<number | null>(null);
  const myRowY = useRef<number | null>(null);
  function anchorPoints() {
    if (pointsCardY.current != null && myRowY.current != null) {
      onAnchor("points", pointsCardY.current + myRowY.current);
    }
  }
  // El atajo solo cuando hace falta: con dos pistas (o una lista corta) todo se ve.
  const goTo =
    me == null
      ? null
      : mode === "courts"
        ? me.court_number != null && groups.length > 2
          ? { label: "Ver mi pista", onPress: onGoToMe }
          : null
        : data.rows.length > 8
          ? { label: "Ver mi lugar", onPress: onGoToMe }
          : null;

  return (
    <>
      {me && (
        <MySpot data={data} me={me} goTo={goTo} />
      )}

      <View style={styles.modeRow}>
        <SelectChip label="Por pista" selected={mode === "courts"} onPress={() => onMode("courts")} />
        <SelectChip label="Por puntos" selected={mode === "points"} onPress={() => onMode("points")} />
      </View>

      {mode === "courts" ? (
        groups.map((g) => {
          const mine = me != null && g.court === me.court_number;
          return (
            <View
              key={String(g.court)}
              style={styles.courtBlock}
              onLayout={mine ? (e) => onAnchor("courts", e.nativeEvent.layout.y) : undefined}
            >
              <View style={styles.courtHead}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.courtTitle}>
                  {g.court != null ? `Pista ${g.court}` : "Sin pista asignada"}
                </Text>
                {mine && <Pill label="Tu pista" tone="primary" />}
              </View>
              <GlassCard strong={mine} style={styles.list}>
                {g.rows.map((r, i) => (
                  <View key={r.player_id}>
                    {i > 0 && <View style={styles.hairline} />}
                    <Line row={r} />
                  </View>
                ))}
              </GlassCard>
            </View>
          );
        })
      ) : (
        <View
          style={{ marginTop: spacing.md }}
          onLayout={(e) => {
            pointsCardY.current = e.nativeEvent.layout.y;
            anchorPoints();
          }}
        >
          <GlassCard style={styles.list}>
            {data.rows.map((r, i) => (
              <View
                key={r.player_id}
                onLayout={
                  r.is_me
                    ? (e) => {
                        myRowY.current = e.nativeEvent.layout.y;
                        anchorPoints();
                      }
                    : undefined
                }
              >
                {i > 0 && <View style={styles.hairline} />}
                <Line row={r} showCourt />
              </View>
            ))}
          </GlassCard>
        </View>
      )}
    </>
  );
}

/** «6.º de 12 · 70 pts · Pista 2» y qué le falta para subir. */
function MySpot({
  data,
  me,
  goTo,
}: {
  data: LeagueStandings;
  me: StandingRow;
  goTo: { label: string; onPress: () => void } | null;
}) {
  const router = useRouter();
  const { league, rows } = data;
  const above = rows.filter((r) => r.points > me.points);
  const next = above[above.length - 1]; // el más cercano por arriba
  const tiedFirst = rows.filter((r) => r.position === 1).length > 1;

  let line: string;
  if (league.rounds_closed === 0) {
    line = "La liga aún no arranca: los puntos se mueven al cerrar la primera jornada.";
  } else if (me.position === 1) {
    line = tiedFirst ? "Compartes el primer lugar." : "Vas en primer lugar.";
  } else if (next) {
    const gap = next.points - me.points;
    line = `Estás a ${gap} ${gap === 1 ? "punto" : "puntos"} del ${next.position}.º lugar.`;
  } else {
    line = "";
  }

  const last = me.trend[0];
  const lastMove =
    last === "up"
      ? "En la última jornada subiste de pista."
      : last === "down"
        ? "En la última jornada bajaste de pista."
        : last === "stay"
          ? "En la última jornada te quedaste en tu pista."
          : null;

  const meta = [
    league.last_closed_round != null ? `Jornada ${league.last_closed_round} cerrada` : null,
    league.remaining_rounds != null
      ? `faltan ${league.remaining_rounds} ${league.remaining_rounds === 1 ? "jornada" : "jornadas"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <GlassCard strong style={styles.spot}>
      <Label>Tu lugar · {league.name}</Label>
      <View style={styles.spotRow}>
        <View style={styles.spotPosBox} accessible accessibilityLabel={`${me.position}.º lugar de ${rows.length}`}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.spotPos}>
            {me.position}.º
          </Text>
          <Muted>de {rows.length}</Muted>
        </View>
        <View style={styles.spotStat}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.spotStatValue}>{me.points}</Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.spotStatLabel}>PUNTOS</Text>
        </View>
        <View style={styles.spotStat}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.spotStatValue}>{me.court_number ?? "—"}</Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.spotStatLabel}>PISTA</Text>
        </View>
      </View>
      {!!line && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.spotLine}>{line}</Text>}
      {lastMove && (
        <View style={styles.moveRow}>
          <Trend trend={me.trend} />
          <Muted style={{ flexShrink: 1 }}>{lastMove}</Muted>
        </View>
      )}
      {!!meta && <Muted>{meta}</Muted>}
      {(goTo || league.last_closed_round_id) && (
        <View style={styles.links}>
          {goTo && (
            <Pressable onPress={goTo.onPress} hitSlop={8} style={styles.goRow} accessibilityRole="button">
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.goText}>{goTo.label}</Text>
              <Ionicons name="arrow-down" size={14} color={colors.primary} />
            </Pressable>
          )}
          {league.last_closed_round_id != null && (
            <Pressable
              onPress={() => router.push(`/round/${league.last_closed_round_id}`)}
              hitSlop={8}
              style={styles.goRow}
              accessibilityRole="button"
              accessibilityLabel={`Resultados de la jornada ${league.last_closed_round}`}
            >
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.goText}>
                Resultados J{league.last_closed_round}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Pressable>
          )}
        </View>
      )}
    </GlassCard>
  );
}

/** Una fila de la tabla: lugar, foto, nombre, tendencia y puntos. */
function Line({ row, showCourt }: { row: StandingRow; showCourt?: boolean }) {
  const label = [
    `${row.position}.º lugar`,
    row.is_me ? `${row.name}, tú` : row.name,
    `${row.points} ${row.points === 1 ? "punto" : "puntos"}`,
    showCourt ? (row.court_number != null ? `pista ${row.court_number}` : "sin pista") : null,
    trendLabel(row.trend, row.is_me ? "you" : "they") || null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={[styles.line, row.is_me && styles.lineMe]} accessible accessibilityLabel={label}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.pos, row.position === 1 && { color: colors.primary }]}>
        {row.position}
      </Text>
      <Avatar
        name={row.name}
        uri={row.avatar_url}
        size={32}
        style={row.is_me ? { borderWidth: 2, borderColor: colors.primary } : undefined}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          numberOfLines={1}
          style={[styles.name, row.is_me && { color: colors.primary }]}
        >
          {row.name}
        </Text>
        {(showCourt || row.is_me) && (
          <Muted numberOfLines={1}>
            {[row.is_me ? "Tú" : null, showCourt ? (row.court_number != null ? `Pista ${row.court_number}` : "Sin pista") : null]
              .filter(Boolean)
              .join(" · ")}
          </Muted>
        )}
      </View>
      <Trend trend={row.trend} person={row.is_me ? "you" : "they"} size={12} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.pts}>
        {row.points}
      </Text>
    </View>
  );
}

/** Agrupa por pista actual: 1, 2, 3… y «sin pista» al final. Dentro, por puntos. */
function byCourt(rows: StandingRow[]): { court: number | null; rows: StandingRow[] }[] {
  const groups = new Map<number | null, StandingRow[]>();
  for (const r of rows) {
    const k = r.court_number ?? null;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.keys()]
    .sort((a, b) => (a == null ? 1 : b == null ? -1 : a - b))
    .map((court) => ({ court, rows: groups.get(court)! }));
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  empty: { marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.xl, gap: 8 },
  emptyTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  // Las pastillas de liga corren de borde a borde aunque el contenido tenga margen.
  chipsScroll: { marginHorizontal: -spacing.lg, marginBottom: spacing.md },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  spot: { gap: spacing.sm },
  spotRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.lg },
  spotPosBox: { flex: 1 },
  spotPos: { fontSize: 44, lineHeight: 48, fontFamily: fonts.display, color: colors.primary },
  spotStat: { alignItems: "flex-end" },
  spotStatValue: { fontSize: 24, fontFamily: fonts.display, color: colors.text },
  spotStatLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textFaint, fontWeight: "700" },
  spotLine: { color: colors.text, fontSize: 15, fontWeight: "600" },
  moveRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  links: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg, rowGap: spacing.xs, marginTop: 2 },
  goRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  goText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  modeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  courtBlock: { marginTop: spacing.lg, gap: spacing.sm },
  courtHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  courtTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.displaySemi },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginVertical: spacing.xs },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 4,
  },
  // Tu fila: pastilla lima tenue, el mismo acento de la pestaña activa.
  lineMe: {
    backgroundColor: alpha(colors.primary, 0.1),
    borderRadius: radius.md,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  pos: { width: 24, textAlign: "center", color: colors.textMuted, fontSize: 14, fontWeight: "800" },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  pts: {
    minWidth: 36,
    textAlign: "right",
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.display,
    fontVariant: ["tabular-nums"],
  },
});
