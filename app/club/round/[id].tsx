/**
 * Modo club (fase 3, 2026-10): la jornada vista desde la cancha.
 *
 * Pistas con sus cuatro jugadores —quién dijo «No voy» y quién juega de suplente— y sus
 * partidos con el marcador. Desde aquí el dueño o supervisor cubre un lugar, captura un
 * marcador o publica el borrador; el Lector la ve igual pero sin botones (`can_edit`).
 * Las acciones van a las mismas rutas del panel, con sus reglas: una pista con marcador
 * ya no cambia de alineación y solo una jornada publicada acepta marcadores.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/Toast";
import { Button, Muted, Pill } from "@/components/ui";
import { useClubActions, useRoundSheet } from "@/hooks";
import type { RoundSheet, SheetMatch } from "@/lib/api";
import { roundShort } from "@/lib/format";
import { usePullRefresh } from "@/lib/pullRefresh";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing, TIGHT_FONT_SCALE } from "@/theme";

type Court = RoundSheet["courts"][number];

export default function ClubRoundScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const roundId = Number(id) > 0 ? Number(id) : null;
  const sheet = useRoundSheet(roundId);
  const pull = usePullRefresh(sheet.refetch);
  const { publish } = useClubActions();
  const data = sheet.data;
  const rnd = data?.round;

  const total = data?.courts.reduce((n, c) => n + c.matches.length, 0) ?? 0;
  const captured = data?.courts.reduce((n, c) => n + c.matches.filter((m) => m.score).length, 0) ?? 0;
  const players = data?.courts.reduce((n, c) => n + c.players.length, 0) ?? 0;

  function askPublish() {
    if (!rnd) return;
    Alert.alert(
      `¿Publicar la jornada ${rnd.number}?`,
      `Los ${players} jugadores la verán en su app y les llegará el aviso con su pista. Después ya no se regenera.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Publicar",
          onPress: () =>
            publish.mutate(rnd.id, {
              onSuccess: () => toast.show("Jornada publicada: les llega el aviso con su pista."),
              onError: (e) => toast.show((e as Error).message || "No se pudo publicar.", "error"),
            }),
        },
      ]
    );
  }

  const editable = !!data?.can_edit;

  return (
    <Screen
      title={rnd ? `Jornada ${rnd.number}` : "Jornada"}
      subtitle={rnd ? [rnd.league, roundShort(rnd.scheduled_at)].filter(Boolean).join(" · ") : undefined}
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {sheet.isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : sheet.isError && !data ? (
          <LoadError error={sheet.error} onRetry={() => void sheet.refetch()} />
        ) : data && rnd ? (
          <>
            {rnd.status === "draft" ? (
              <GlassCard strong style={styles.banner}>
                <View style={styles.rowIcon}>
                  <Ionicons name="eye-off-outline" size={18} color={colors.warning} />
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.bannerTitle}>
                    Borrador
                  </Text>
                </View>
                <Muted>Los jugadores todavía no la ven. Revisa las pistas y publícala cuando esté lista.</Muted>
                {editable && <Button title="Publicar jornada" onPress={askPublish} loading={publish.isPending} />}
              </GlassCard>
            ) : rnd.status === "closed" ? (
              <GlassCard style={styles.banner}>
                <View style={styles.rowIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.bannerTitle}>
                    Jornada cerrada
                  </Text>
                </View>
                <Muted>Los marcadores y los movimientos ya quedaron.</Muted>
              </GlassCard>
            ) : (
              <GlassCard strong style={styles.banner}>
                <View style={styles.rowBetween}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.bannerTitle}>
                    {captured} de {total} marcadores
                  </Text>
                  {captured === total && total > 0 && <Pill label="Completa" tone="success" />}
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { flex: captured }]} />
                  <View style={{ flex: Math.max(total - captured, 0) }} />
                </View>
                {editable && captured < total && <Muted>Toca un partido para capturar su marcador.</Muted>}
              </GlassCard>
            )}

            {data.courts.map((c) => (
              <CourtCard
                key={c.court_number}
                court={c}
                canCover={editable && rnd.status !== "closed" && !c.locked}
                canCapture={editable && rnd.accepts_results}
                onCover={(slotId) => router.push({ pathname: "/club/suplente", params: { round: rnd.id, slot: slotId } })}
                onCapture={(m) => router.push({ pathname: "/club/marcador", params: { round: rnd.id, match: m.id } })}
              />
            ))}
            {!editable && <Muted style={{ textAlign: "center" }}>Tu acceso en este club es de solo lectura.</Muted>}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function CourtCard({
  court,
  canCover,
  canCapture,
  onCover,
  onCapture,
}: {
  court: Court;
  canCover: boolean;
  canCapture: boolean;
  onCover: (slotId: number) => void;
  onCapture: (m: SheetMatch) => void;
}) {
  const where = [
    court.physical_court_number ? `Cancha ${court.physical_court_number}` : null,
    court.time_slot,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <GlassCard style={styles.card}>
      <View style={styles.rowBetween}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.courtTitle}>
          PISTA {court.court_number}
        </Text>
        {!!where && <Muted>{where}</Muted>}
      </View>

      <View style={styles.players}>
        {court.players.map((p) => (
          <View key={p.slot_id} style={styles.player}>
            <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.pos}>
              {p.position}
            </Text>
            <Avatar name={p.name} uri={p.avatar_url} size={26} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[styles.name, p.declined && styles.nameOff]}>
                {p.name}
              </Text>
              {p.is_substitute && (
                <Muted numberOfLines={1}>{p.substitute_for ? `Suplente · cubre a ${p.substitute_for}` : "Suplente"}</Muted>
              )}
            </View>
            {p.declined &&
              (canCover ? (
                <Pressable
                  onPress={() => onCover(p.slot_id)}
                  style={styles.coverBtn}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Cubrir el lugar de ${p.name}`}
                >
                  <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.coverText}>
                    Cubrir
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.offBadge}>
                  <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.offText}>
                    No va
                  </Text>
                </View>
              ))}
          </View>
        ))}
      </View>

      {court.matches.length > 0 && <View style={styles.hairline} />}
      {court.matches.map((m) => (
        <MatchRow key={m.id} match={m} onPress={canCapture ? () => onCapture(m) : undefined} />
      ))}
    </GlassCard>
  );
}

/** Marcador como tablero: cada pareja en su renglón con sus games a la derecha. */
function MatchRow({ match, onPress }: { match: SheetMatch; onPress?: () => void }) {
  const s = match.score;
  const won1 = s ? s.team1_games > s.team2_games : false;
  const label = s
    ? `Partido ${match.match_number}: ${match.team1.join(" y ")} ${s.team1_games}, ${match.team2.join(" y ")} ${s.team2_games}`
    : `Partido ${match.match_number}: sin marcador`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.match, pressed && { opacity: 0.6 }]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? `${label}. Capturar marcador` : label}
    >
      <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.matchNo}>
        P{match.match_number}
      </Text>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <TeamLine names={match.team1} games={s?.team1_games} strong={!!s && won1} />
        <TeamLine names={match.team2} games={s?.team2_games} strong={!!s && !won1} />
        {match.dispute && (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.dispute} numberOfLines={2}>
            Impugnado: {match.dispute.raised_by ? `${match.dispute.raised_by} propone` : "proponen"} {match.dispute.proposed}
          </Text>
        )}
        {s?.is_auto && <Muted>Automático: dos suplentes contra dos titulares.</Muted>}
      </View>
      {onPress && (
        <Ionicons name={s ? "create-outline" : "add-circle"} size={20} color={s ? colors.textFaint : colors.primary} />
      )}
    </Pressable>
  );
}

function TeamLine({ names, games, strong }: { names: string[]; games?: number; strong: boolean }) {
  return (
    <View style={styles.teamLine}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={[styles.team, strong && styles.teamWon]}>
        {names.join(" y ")}
      </Text>
      <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={[styles.games, strong && styles.gamesWon]}>
        {games ?? "–"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 60, gap: spacing.sm },
  banner: { gap: spacing.sm },
  bannerTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  rowIcon: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  progressTrack: { flexDirection: "row", height: 6, borderRadius: radius.full, overflow: "hidden", backgroundColor: colors.glassStrong },
  progressFill: { backgroundColor: colors.primary },
  card: { gap: spacing.sm },
  courtTitle: { color: colors.primary, fontSize: 13, fontFamily: fonts.displaySemi, letterSpacing: 1.2 },
  // Los cuatro de la pista van juntos: sus nombres se repiten en los partidos de abajo.
  players: { gap: 2 },
  player: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 32 },
  pos: { width: 16, color: colors.textFaint, fontSize: 12, fontWeight: "800" },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  nameOff: { color: colors.textMuted, textDecorationLine: "line-through" },
  coverBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.warning, 0.18),
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.5),
  },
  coverText: { color: colors.warning, fontSize: 13, fontWeight: "800" },
  offBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, backgroundColor: alpha(colors.warning, 0.14) },
  offText: { color: colors.warning, fontSize: 12, fontWeight: "800" },
  hairline: { height: 1, backgroundColor: colors.glassBorder },
  match: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  matchNo: { width: 22, color: colors.textFaint, fontSize: 12, fontWeight: "800" },
  teamLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  team: { flex: 1, color: colors.textMuted, fontSize: 14 },
  teamWon: { color: colors.text, fontWeight: "700" },
  games: { width: 18, textAlign: "right", color: colors.textMuted, fontSize: 16, fontFamily: fonts.displaySemi },
  gamesWon: { color: colors.text },
  dispute: { color: colors.warning, fontSize: 12, fontWeight: "700" },
});
