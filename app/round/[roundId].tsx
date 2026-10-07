/**
 * Resultados de una jornada cerrada (fase 2, 2026-10): todas las pistas, quién hizo
 * cuántos puntos, quién sube, baja o se queda, los marcadores y quién no jugó.
 *
 * Antes el jugador solo se enteraba de su propio movimiento por el push («Jornada 4
 * cerrada: subiste a la pista 1») y no veía qué pasó en las demás pistas. Se abre desde
 * ese push, desde el Historial y desde Ranking.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { Label, Muted, Pill } from "@/components/ui";
import { useRoundResults } from "@/hooks";
import { usePullRefresh } from "@/lib/pullRefresh";
import type { RoundMove, RoundResultPlayer, RoundResults } from "@/lib/api";
import { hhmm, playedDay } from "@/lib/format";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Court = RoundResults["courts"][number];
type Absent = RoundResults["absent"][number];
type Me =
  | { kind: "court"; court: Court; row: RoundResultPlayer }
  | { kind: "absent"; row: Absent }
  | null;

export default function RoundResultsScreen() {
  const router = useRouter();
  const { roundId } = useLocalSearchParams<{ roundId: string }>();
  const id = Number(roundId) > 0 ? Number(roundId) : null;
  const { data, isLoading, isError, error, refetch } = useRoundResults(id);
  const pull = usePullRefresh(refetch);

  const me = useMemo(() => findMe(data), [data]);
  const myCourt = me?.kind === "court" ? me.court.court_number : null;
  // Los partidos de tu pista se ven abiertos; los de las demás, a un toque.
  const [toggled, setToggled] = useState<Set<number>>(new Set());
  const isOpen = (n: number) => (toggled.has(n) ? n !== myCourt : n === myCourt);
  function toggle(n: number) {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  const scrollRef = useRef<ScrollView>(null);
  const myCourtY = useRef<number | null>(null);
  function goToMyCourt() {
    if (myCourtY.current == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(myCourtY.current - spacing.md, 0), animated: true });
  }

  const subtitle = data
    ? [data.round.league_name, playedDay(data.round.scheduled_at)].filter(Boolean).join(" · ")
    : undefined;

  return (
    <Screen
      title={data ? `Jornada ${data.round.number}` : "Resultados"}
      subtitle={subtitle}
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : isError && !data ? (
          <LoadError error={error} onRetry={() => void refetch()} style={{ marginTop: spacing.md }} />
        ) : data ? (
          <>
            {me && (
              <MyRound
                me={me}
                // Solo si tu pista queda más abajo: la primera ya se ve debajo de esta tarjeta.
                onGoToMyCourt={
                  me.kind === "court" && data.courts.length > 2 && myCourt !== data.courts[0]?.court_number
                    ? goToMyCourt
                    : null
                }
              />
            )}

            {data.courts.map((court) => {
              const mine = court.court_number === myCourt;
              return (
                <View
                  key={court.court_number}
                  style={styles.courtBlock}
                  onLayout={mine ? (e) => (myCourtY.current = e.nativeEvent.layout.y) : undefined}
                >
                  <CourtCard court={court} mine={mine} open={isOpen(court.court_number)} onToggle={() => toggle(court.court_number)} />
                </View>
              );
            })}

            {data.absent.length > 0 && (
              <>
                <SectionHeader title="No jugaron" count={data.absent.length} style={styles.section} />
                <GlassCard style={styles.list}>
                  {data.absent.map((a, i) => (
                    <View key={a.player_id}>
                      {i > 0 && <View style={styles.hairline} />}
                      <View style={[styles.line, a.is_me && styles.lineMe]}>
                        <Avatar name={a.name} uri={a.avatar_url} size={28} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[styles.name, a.is_me && styles.nameMe]}>
                            {a.name}
                          </Text>
                          <Muted numberOfLines={2}>{absentText(a.movement)}</Muted>
                        </View>
                        <MovePill move={a.movement} />
                      </View>
                    </View>
                  ))}
                </GlassCard>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** Tu jornada en una frase: cuántos puntos hiciste y qué pasó con tu pista. */
function MyRound({ me, onGoToMyCourt }: { me: NonNullable<Me>; onGoToMyCourt: (() => void) | null }) {
  let headline: string;
  let tone: string = colors.text;
  let detail: string | null = null;

  if (me.kind === "absent") {
    headline = "No jugaste esta jornada";
    detail = absentText(me.row.movement);
  } else if (me.row.is_substitute) {
    headline = `Jugaste de suplente en la Pista ${me.court.court_number}`;
    detail = `${me.row.substitute_for ? `Cubriste a ${me.row.substitute_for}. ` : ""}Tus puntos cuentan; la pista sigue siendo suya.`;
  } else {
    const m = me.row.movement;
    if (m?.direction === "up") {
      headline = `Subiste a la Pista ${m.to_court_number}`;
      tone = colors.success;
    } else if (m?.direction === "down") {
      headline = `Bajaste a la Pista ${m.to_court_number}`;
      tone = colors.danger;
    } else {
      headline = `Te quedaste en la Pista ${me.court.court_number}`;
    }
    if (m?.by_draw) detail = "Hubo empate y se resolvió por sorteo.";
  }

  return (
    <GlassCard strong style={styles.mine}>
      <Label>Tu jornada</Label>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.headline, { color: tone }]}>
        {headline}
      </Text>
      {me.kind === "court" && (
        <Muted>
          Hiciste {signed(me.row.round_points)} {Math.abs(me.row.round_points) === 1 ? "punto" : "puntos"} en la Pista{" "}
          {me.court.court_number}.
        </Muted>
      )}
      {!!detail && <Muted>{detail}</Muted>}
      {onGoToMyCourt && (
        <Pressable onPress={onGoToMyCourt} hitSlop={8} style={styles.linkRow} accessibilityRole="button">
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.link}>Ver mi pista</Text>
          <Ionicons name="arrow-down" size={14} color={colors.primary} />
        </Pressable>
      )}
    </GlassCard>
  );
}

/** Una pista: sus 4 jugadores por puntos de la jornada, quién sube o baja, y sus partidos. */
function CourtCard({
  court,
  mine,
  open,
  onToggle,
}: {
  court: Court;
  mine: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const where = [
    court.physical_court_number != null ? `Cancha ${court.physical_court_number}` : null,
    hhmm(court.time_slot) || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <View style={styles.courtHead}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.courtTitle}>
          Pista {court.court_number}
        </Text>
        {mine && <Pill label="Tu pista" tone="primary" />}
        {!!where && <Muted style={{ marginLeft: "auto" }}>{where}</Muted>}
      </View>
      <GlassCard strong={mine} style={styles.list}>
        {court.players.map((p, i) => (
          <View key={p.player_id}>
            {i > 0 && <View style={styles.hairline} />}
            <PlayerLine row={p} />
          </View>
        ))}

        {court.matches.length > 0 && (
          <>
            <View style={styles.hairline} />
            <Pressable
              onPress={onToggle}
              hitSlop={6}
              style={styles.linkRow}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
            >
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.toggle}>
                {open ? "Ocultar partidos" : `Ver los ${court.matches.length} partidos`}
              </Text>
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
            </Pressable>
            {open &&
              court.matches.map((m) => <MatchLine key={m.match_number} match={m} />)}
          </>
        )}
      </GlassCard>
    </>
  );
}

function PlayerLine({ row }: { row: RoundResultPlayer }) {
  const label = [
    row.is_me ? `${row.name}, tú` : row.name,
    row.is_substitute ? `suplente${row.substitute_for ? ` de ${row.substitute_for}` : ""}` : null,
    `${signed(row.round_points)} puntos en la jornada`,
    row.movement ? moveWord(row.movement) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <View style={[styles.line, row.is_me && styles.lineMe]} accessible accessibilityLabel={label}>
      <Avatar
        name={row.name}
        uri={row.avatar_url}
        size={28}
        style={row.is_me ? { borderWidth: 2, borderColor: colors.primary } : undefined}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[styles.name, row.is_me && styles.nameMe]}>
          {row.name}
        </Text>
        {row.is_substitute && (
          <Muted numberOfLines={1}>Suplente{row.substitute_for ? ` de ${row.substitute_for}` : ""}</Muted>
        )}
      </View>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.pts, { color: toneFor(row.round_points) }]}>
        {signed(row.round_points)}
      </Text>
      {row.movement ? <MovePill move={row.movement} /> : <View style={styles.pillSpacer} />}
    </View>
  );
}

function MatchLine({ match }: { match: Court["matches"][number] }) {
  const s = match.score;
  const t1Won = s != null && s.team1 > s.team2;
  const t2Won = s != null && s.team2 > s.team1;
  return (
    <View
      style={styles.match}
      accessible
      accessibilityLabel={`Partido ${match.match_number}: ${match.team_1.join(" y ")} ${s ? `${s.team1} a ${s.team2}` : "sin marcador"} contra ${match.team_2.join(" y ")}`}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.matchNo}>P{match.match_number}</Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2} style={[styles.team, t1Won && styles.teamWon]}>
        {match.team_1.join(" y ")}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.score}>
        {s ? `${s.team1}–${s.team2}` : "—"}
      </Text>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        numberOfLines={2}
        style={[styles.team, { textAlign: "right" }, t2Won && styles.teamWon]}
      >
        {match.team_2.join(" y ")}
      </Text>
    </View>
  );
}

/** «Sube» / «Baja» / «Se queda», con su color. */
function MovePill({ move }: { move: RoundMove }) {
  const m =
    move.direction === "up"
      ? { label: "Sube", tone: colors.success, icon: "arrow-up" as const }
      : move.direction === "down"
        ? { label: "Baja", tone: colors.danger, icon: "arrow-down" as const }
        : { label: "Se queda", tone: colors.textMuted, icon: "remove" as const };
  return (
    <View style={[styles.move, { backgroundColor: alpha(m.tone, 0.14) }]}>
      <Ionicons name={m.icon} size={11} color={m.tone} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.moveText, { color: m.tone }]}>
        {m.label}
      </Text>
    </View>
  );
}

/** El motivo del cierre para quien no jugó, dicho con «pista» como en el resto de la app. */
function absentText(move: RoundMove): string {
  const r = move.reason ?? "";
  if (r.startsWith("Ausente con suplente")) return "Su suplente le cuidó la pista.";
  if (r.includes("baja automática")) return `Sin suplente: baja a la Pista ${move.to_court_number}.`;
  const penalty = /Ausente sin suplente:\s*(.+)$/.exec(r);
  if (penalty) return `Sin suplente: ${penalty[1]}`;
  return r;
}

function moveWord(move: RoundMove): string {
  return move.direction === "up"
    ? `sube a la pista ${move.to_court_number}`
    : move.direction === "down"
      ? `baja a la pista ${move.to_court_number}`
      : "se queda en su pista";
}

function findMe(data: RoundResults | undefined): Me {
  if (!data) return null;
  for (const court of data.courts) {
    const row = court.players.find((p) => p.is_me);
    if (row) return { kind: "court", court, row };
  }
  const absent = data.absent.find((a) => a.is_me);
  return absent ? { kind: "absent", row: absent } : null;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function toneFor(n: number): string {
  return n > 0 ? colors.success : n < 0 ? colors.danger : colors.textMuted;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  mine: { gap: spacing.xs },
  headline: { fontSize: 20, fontFamily: fonts.displaySemi },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 2 },
  link: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  courtBlock: { marginTop: spacing.lg, gap: spacing.sm },
  courtHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  courtTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.displaySemi },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginVertical: spacing.xs },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  lineMe: {
    backgroundColor: alpha(colors.primary, 0.1),
    borderRadius: radius.md,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  nameMe: { color: colors.primary },
  pts: { minWidth: 32, textAlign: "right", fontSize: 15, fontWeight: "800", fontVariant: ["tabular-nums"] },
  move: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 76,
    justifyContent: "center",
  },
  // El suplente no tiene movimiento: el hueco alinea sus puntos con los demás.
  pillSpacer: { minWidth: 76 },
  moveText: { fontSize: 11, fontWeight: "800" },
  toggle: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  match: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  matchNo: { width: 22, color: colors.textFaint, fontSize: 11, fontWeight: "800" },
  team: { flex: 1, color: colors.textMuted, fontSize: 13 },
  teamWon: { color: colors.text, fontWeight: "700" },
  score: { color: colors.text, fontSize: 15, fontFamily: fonts.display, fontVariant: ["tabular-nums"] },
});
