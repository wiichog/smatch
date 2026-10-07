import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/AuroraBackground";
import { AvailabilityPicker } from "@/components/Availability";
import { Avatar } from "@/components/Avatar";
import { CourtBackdrop } from "@/components/CourtBackdrop";
import { GlassCard, GlassPressable } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { SectionHeader } from "@/components/SectionHeader";
import { Trend } from "@/components/Trend";
import { Label, Muted } from "@/components/ui";
import { useDashboard, useMyReservations, useNextRound } from "@/hooks";
import type { DashboardData, MyReservation } from "@/lib/api";
import { capitalize, hhmm, money, monthShort, parseLocalDate, relativeDay, roundShort, roundWhen } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Enrolled = DashboardData["enrolled_leagues"][number];
type OpenTournament = DashboardData["open_tournaments"][number];
type NearbyLeague = DashboardData["nearby_leagues"][number];

export default function DashboardScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching, isError, error } = useDashboard();
  const nextRound = useNextRound();
  const reservations = useMyReservations();
  const round = nextRound.data?.next_round;
  const user = useAuth((s) => s.user);
  const firstName = user?.name?.split(" ")[0] ?? "";

  const enrolled = data?.enrolled_leagues ?? [];
  const openTournaments = data?.open_tournaments ?? [];
  const nearby = data?.nearby_leagues ?? [];
  // Solo las dos más cercanas: el inicio es un resumen, la lista completa vive en «Mis reservas».
  const upcomingReservations = (reservations.data?.upcoming ?? []).slice(0, 2);

  const when = roundWhen(round?.scheduled_at, round?.time_slot);
  const whenText = [when.day, when.time].filter(Boolean).join(" · ");
  // Sin datos y con error = no se pudo cargar. Se dice eso, en vez de pintar «Sin jornada
  // publicada» y «no estás inscrito» como si fuera verdad.
  const loadFailed = (isError && !data) || (nextRound.isError && !nextRound.data);
  const retryAll = () => {
    void refetch();
    void nextRound.refetch();
    void reservations.refetch();
  };

  // Las secciones vacías no se pintan («No hay torneos (0)» ocupaba media pantalla sin
  // decir nada); la numeración 01/02/03 sigue el orden de las que SÍ aparecen.
  const sections: string[] = ["leagues"];
  if (upcomingReservations.length > 0) sections.push("reservations");
  if (openTournaments.length > 0) sections.push("tournaments");
  if (nearby.length > 0) sections.push("nearby");
  const indexOf = (key: string) => sections.indexOf(key) + 1;

  return (
    <View style={{ flex: 1 }}>
      <AuroraBackground />
      {/* Cabecera con identidad: la cancha se insinúa detrás del saludo y se disuelve
          antes de llegar a las tarjetas (intensidad baja, decorativo puro). */}
      <CourtBackdrop intensity={0.45} height={300} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching || nextRound.isRefetching || reservations.isRefetching}
              onRefresh={retryAll}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Saludo personalizado + avatar */}
          <View style={styles.greetRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.overline} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.greet}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.greetLight}>Hola, </Text>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.greetName}>{firstName || "jugador"}</Text>
              </Text>
              <Muted style={{ marginTop: 2 }}>Tu resumen de hoy</Muted>
            </View>
            <Pressable onPress={() => router.push("/(tabs)/profile")} accessibilityLabel="Ir a tu perfil">
              <Avatar name={user?.name} uri={user?.avatar_url} size={48} ring />
            </Pressable>
          </View>

          {/* Hero: próxima jornada. Se toca para ver partidos y compañeros. */}
          {loadFailed ? (
            <LoadError error={error ?? nextRound.error} onRetry={retryAll} style={{ marginTop: spacing.lg }} />
          ) : nextRound.isLoading ? (
            <GlassCard strong style={{ marginTop: spacing.lg }}>
              <ActivityIndicator color={colors.primary} />
            </GlassCard>
          ) : round ? (
            <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
              <GlassPressable
                strong
                onPress={() => router.push("/(tabs)/jornada")}
                accessibilityLabel="Ver tu jornada"
                style={{ gap: spacing.sm }}
              >
                <View style={styles.rowBetween}>
                  <Label>Tu próxima jornada</Label>
                  <View style={styles.jornadaTag}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.jornadaTagText}>J{round.round_number}</Text>
                  </View>
                </View>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroLeague} numberOfLines={1}>{round.league}</Text>
                {!!whenText && (
                  <View style={styles.whenRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.whenText}>{whenText}</Text>
                  </View>
                )}
                <View style={styles.heroStats}>
                  <View style={{ flex: 1 }}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroStatLabel}>PISTA</Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroStatValue}>{round.court_number}</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={{ flex: 1 }}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroStatLabel}>POSICIÓN</Text>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroStatValue}>{round.position}</Text>
                  </View>
                  {!!round.physical_court_number && (
                    <>
                      <View style={styles.heroDivider} />
                      <View style={{ flex: 1 }}>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroStatLabel}>CANCHA</Text>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroStatValue}>{round.physical_court_number}</Text>
                      </View>
                    </>
                  )}
                </View>
                <View style={styles.heroLink}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.heroLinkText}>Ver partidos y compañeros</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </View>
              </GlassPressable>
              {round.status === "published" && (
                <AvailabilityPicker roundId={round.round_id} availability={round.availability} />
              )}
              {/* Las otras ligas del jugador: antes su jornada no aparecía en ningún lado. */}
              {(nextRound.data?.upcoming ?? [])
                .filter((u) => u.round_id !== round.round_id)
                .map((u) => {
                  const pending = u.availability === "pending";
                  const when = [roundShort(u.scheduled_at, u.time_slot), `Pista ${u.court_number}`]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <GlassPressable
                      key={u.round_id}
                      onPress={() =>
                        router.navigate({ pathname: "/(tabs)/jornada", params: { round_id: String(u.round_id) } })
                      }
                      accessibilityLabel={`También juegas ${u.league}: ${when}${pending ? ". Falta confirmar si vas" : ""}`}
                      style={styles.alsoRow}
                    >
                      <View style={styles.alsoIcon}>
                        <Ionicons name="tennisball" size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.alsoLabel}>TAMBIÉN JUEGAS</Text>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle} numberOfLines={1}>
                          {u.league}
                        </Text>
                        <Muted numberOfLines={1}>{when}</Muted>
                        {pending && (
                          <View style={styles.alsoPending}>
                            <Ionicons name="time-outline" size={14} color={colors.warning} />
                            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.alsoPendingText}>
                              Falta confirmar si vas
                            </Text>
                          </View>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                    </GlassPressable>
                  );
                })}
            </View>
          ) : (
            <GlassCard strong style={{ marginTop: spacing.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle}>Sin jornada publicada</Text>
                  <Muted>Te avisamos cuando tu club publique la próxima.</Muted>
                </View>
              </View>
            </GlassCard>
          )}

          {loadFailed ? null : isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <>
              {/* Tus ligas */}
              <SectionHeader index={indexOf("leagues")} title="Tus ligas" count={enrolled.length} style={styles.section} />
              {enrolled.length === 0 ? (
                <Muted>Aún no estás inscrito en ninguna liga.</Muted>
              ) : (
                <GlassCard style={{ gap: spacing.md }}>
                  {enrolled.map((l: Enrolled, i: number) => (
                    <View key={l.league_id}>
                      {i > 0 && <View style={styles.hairline} />}
                      {/* La fila abre la tabla completa de esa liga en Ranking. */}
                      <Pressable
                        style={styles.leagueRow}
                        onPress={() =>
                          router.navigate({
                            pathname: "/(tabs)/ranking",
                            params: { league_id: String(l.league_id), view: "table" },
                          })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${l.league_name}: lugar ${l.position}, ${l.points} puntos. Ver la tabla de la liga`}
                      >
                        <View style={styles.posBadge}>
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.posBadgeText}>#{l.position}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            {/* Logo del club (ticket #77): sin foto, Avatar cae a iniciales. */}
                            <Avatar name={l.league_name} uri={l.logo_url} size={18} />
                            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{l.league_name}</Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                            {/* Encoge y corta el texto, no las flechas: sin flexShrink, con letra
                                grande empujaba la tendencia encima de «PTS». */}
                            <Muted numberOfLines={1} style={{ flexShrink: 1 }}>
                              {l.current_court_number != null ? `Pista ${l.current_court_number}` : "Sin pista"}
                              {l.remaining_rounds != null ? ` · faltan ${l.remaining_rounds} jornadas` : ""}
                            </Muted>
                            <Trend trend={l.trend} />
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.points}>{l.points}</Text>
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.pointsLabel}>PTS</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                      </Pressable>
                    </View>
                  ))}
                </GlassCard>
              )}

              {/* Próximas reservas de cancha */}
              {upcomingReservations.length > 0 && (
                <>
                  <SectionHeader
                    index={indexOf("reservations")}
                    title="Tus reservas"
                    count={reservations.data?.upcoming.length ?? 0}
                    style={styles.section}
                  />
                  <GlassPressable
                    onPress={() => router.push("/reservas")}
                    accessibilityLabel="Ver mis reservas"
                    style={{ gap: spacing.md }}
                  >
                    {upcomingReservations.map((r: MyReservation, i: number) => (
                      <View key={r.id}>
                        {i > 0 && <View style={styles.hairline} />}
                        <ReservationLine r={r} />
                      </View>
                    ))}
                  </GlassPressable>
                </>
              )}

              {/* Torneos del club */}
              {openTournaments.length > 0 && (
                <>
                  <SectionHeader
                    index={indexOf("tournaments")}
                    title="Torneos de tu club"
                    count={openTournaments.length}
                    style={styles.section}
                  />
                  <GlassCard style={{ gap: spacing.md }}>
                    {openTournaments.map((t: OpenTournament, i: number) => (
                      <View key={t.id}>
                        {i > 0 && <View style={styles.hairline} />}
                        <View style={styles.leagueRow}>
                          {/* Logo del club (ticket #77); sin logo, cae al ícono genérico. */}
                          {t.logo_url ? (
                            <Avatar name={t.name} uri={t.logo_url} size={42} />
                          ) : (
                            <View style={styles.iconBadge}>
                              <Ionicons name="podium" size={16} color={colors.primary} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle} numberOfLines={1}>{t.name}</Text>
                            {/* Sin flecha: todavía no hay pantalla de torneo. Mientras
                                tanto se dice lo que sí se sabe y dónde inscribirse. */}
                            <Muted>{tournamentLine(t)}</Muted>
                          </View>
                        </View>
                      </View>
                    ))}
                  </GlassCard>
                </>
              )}

              {/* Ligas cerca de ti */}
              {nearby.length > 0 && (
                <>
                  <SectionHeader
                    index={indexOf("nearby")}
                    title="Ligas cerca de ti"
                    count={nearby.length}
                    style={styles.section}
                  />
                  <GlassCard style={{ gap: spacing.md }}>
                    {nearby.map((l: NearbyLeague, i: number) => (
                      <View key={l.league_id}>
                        {i > 0 && <View style={styles.hairline} />}
                        <View style={styles.leagueRow}>
                          {/* Logo del club (ticket #77); sin logo, cae al ícono genérico. */}
                          {l.logo_url ? (
                            <Avatar name={l.club} uri={l.logo_url} size={42} />
                          ) : (
                            <View style={styles.iconBadge}>
                              <Ionicons name="location" size={16} color={colors.highlight} />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle} numberOfLines={1}>{l.league_name}</Text>
                            <Muted numberOfLines={1}>
                              {l.club}
                              {l.city ? ` · ${l.city}` : ""}
                            </Muted>
                          </View>
                        </View>
                      </View>
                    ))}
                  </GlassCard>
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/** «Empieza el sábado 12 de octubre · Inscríbete con tu club» / «En curso». */
function tournamentLine(t: OpenTournament): string {
  if (t.status === "active") return "En curso";
  const start = parseLocalDate(t.starts_on);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let when = "Próximamente";
  if (start && start >= today) {
    const rel = relativeDay(start);
    when = rel === "hoy" || rel === "mañana" ? `Empieza ${rel}` : `Empieza el ${rel}`;
  }
  return `${when} · Inscríbete con tu club`;
}

/** Una reserva en una línea: «Mañana · 19:00 — Cancha 1 · pagas $600 en el club». */
function ReservationLine({ r }: { r: MyReservation }) {
  const day = parseLocalDate(r.date);
  const dayText = day ? capitalize(relativeDay(day)) : r.date;
  const pay =
    r.my_pay_status === "paid"
      ? "pagada"
      : r.my_share && r.my_pay_method === "venue"
        ? `pagas ${money(r.my_share)} en el club`
        : "";
  return (
    <View style={styles.leagueRow}>
      <View style={styles.dateBadge}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.dateBadgeDay}>{day ? day.getDate() : ""}</Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.dateBadgeMonth}>{day ? monthShort(day) : ""}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle} numberOfLines={1}>
          {dayText} · {hhmm(r.start_time)}
        </Text>
        <Muted numberOfLines={1}>
          {r.court_name}
          {pay ? ` · ${pay}` : ""}
        </Muted>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </View>
  );
}

const styles = StyleSheet.create({
  alsoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  alsoIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.primary, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  alsoLabel: { color: colors.textFaint, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  alsoPending: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  alsoPendingText: { color: colors.warning, fontSize: 13, fontWeight: "600" },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 },
  greetRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  overline: { width: 28, height: 3, borderRadius: 2, backgroundColor: colors.primary, marginBottom: 10 },
  greet: { fontSize: 28, letterSpacing: -0.5 },
  greetLight: { fontFamily: fonts.displayLight, color: colors.textMuted },
  greetName: { fontFamily: fonts.display, color: colors.text },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  jornadaTag: {
    backgroundColor: alpha(colors.primary, 0.16),
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  jornadaTagText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  heroLeague: { color: colors.text, fontSize: 20, fontFamily: fonts.display, letterSpacing: -0.3 },
  whenRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  whenText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  heroStats: { flexDirection: "row", alignItems: "stretch", marginTop: spacing.xs },
  heroDivider: { width: 1, backgroundColor: colors.glassBorder, marginHorizontal: spacing.sm },
  heroStatLabel: { color: colors.textFaint, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  heroStatValue: { color: colors.text, fontSize: 24, fontFamily: fonts.display, marginTop: 2 },
  heroLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  heroLinkText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  leagueRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginBottom: spacing.md },
  posBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.primary, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  posBadgeText: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.white, 0.06),
    alignItems: "center",
    justifyContent: "center",
  },
  dateBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.highlight, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  dateBadgeDay: { color: colors.highlight, fontWeight: "800", fontSize: 16, lineHeight: 18 },
  dateBadgeMonth: { color: colors.highlight, fontWeight: "700", fontSize: 10, textTransform: "uppercase" },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  points: { color: colors.text, fontSize: 26, fontFamily: fonts.display },
  pointsLabel: { color: colors.textFaint, fontSize: 9, letterSpacing: 1.5, fontWeight: "700" },
});
