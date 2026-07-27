import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuroraBackground } from "@/components/AuroraBackground";
import { Avatar } from "@/components/Avatar";
import { CourtBackdrop } from "@/components/CourtBackdrop";
import { GlassCard } from "@/components/Glass";
import { SectionHeader } from "@/components/SectionHeader";
import { Label, Muted } from "@/components/ui";
import { useDashboard, useNextRound } from "@/hooks";
import type { DashboardData, Direction } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { alpha, colors, fonts, radius, spacing } from "@/theme";

const TREND: Record<Direction, { symbol: string; color: string }> = {
  up: { symbol: "↑", color: colors.success },
  down: { symbol: "↓", color: colors.danger },
  stay: { symbol: "=", color: colors.textFaint },
};

type Enrolled = DashboardData["enrolled_leagues"][number];
type OpenTournament = DashboardData["open_tournaments"][number];
type NearbyLeague = DashboardData["nearby_leagues"][number];

export default function DashboardScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useDashboard();
  const nextRound = useNextRound();
  const round = nextRound.data?.next_round;
  const user = useAuth((s) => s.user);
  const firstName = user?.name?.split(" ")[0] ?? "";

  const enrolled = data?.enrolled_leagues ?? [];
  const openTournaments = data?.open_tournaments ?? [];
  const nearby = data?.nearby_leagues ?? [];

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
              refreshing={isRefetching || nextRound.isRefetching}
              onRefresh={() => {
                void refetch();
                void nextRound.refetch();
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Saludo personalizado + avatar */}
          <View style={styles.greetRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.overline} />
              <Text style={styles.greet}>
                <Text style={styles.greetLight}>Hola, </Text>
                <Text style={styles.greetName}>{firstName || "jugador"}</Text>
              </Text>
              <Muted style={{ marginTop: 2 }}>Tu resumen de hoy</Muted>
            </View>
            <Pressable onPress={() => router.push("/(tabs)/profile")}>
              <Avatar name={user?.name} uri={user?.avatar_url} size={48} ring />
            </Pressable>
          </View>

          {/* Hero: próxima jornada */}
          <GlassCard strong style={{ marginTop: spacing.lg }}>
            {nextRound.isLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : round ? (
              <View style={{ gap: spacing.sm }}>
                <View style={styles.rowBetween}>
                  <Label>Tu próxima jornada</Label>
                  <View style={styles.jornadaTag}>
                    <Text style={styles.jornadaTagText}>J{round.round_number}</Text>
                  </View>
                </View>
                <Text style={styles.heroLeague} numberOfLines={1}>{round.league}</Text>
                <View style={styles.heroStats}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroStatLabel}>CANCHA</Text>
                    <Text style={styles.heroStatValue}>{round.court_number}</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroStatLabel}>POSICIÓN</Text>
                    <Text style={styles.heroStatValue}>{round.position}</Text>
                  </View>
                  <View style={styles.heroDivider} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroStatLabel}>DISPONIBILIDAD</Text>
                    <Text style={[styles.heroAvail, availTone(round.availability)]}>
                      {availLabel(round.availability)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Sin jornada publicada</Text>
                  <Muted>Te avisamos cuando tu club publique la próxima.</Muted>
                </View>
              </View>
            )}
          </GlassCard>

          {isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <>
              {/* Tus ligas */}
              <SectionHeader index={1} title="Tus ligas" count={enrolled.length} style={styles.section} />
              {enrolled.length === 0 ? (
                <Muted>Aún no estás inscrito en ninguna liga.</Muted>
              ) : (
                <GlassCard style={{ gap: spacing.md }}>
                  {enrolled.map((l: Enrolled, i: number) => (
                    <View key={l.league_id}>
                      {i > 0 && <View style={styles.hairline} />}
                      <View style={styles.leagueRow}>
                        <View style={styles.posBadge}>
                          <Text style={styles.posBadgeText}>#{l.position}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{l.league_name}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <Muted>
                              {l.current_court_number != null ? `Cancha ${l.current_court_number}` : "Sin cancha"}
                              {l.remaining_rounds != null ? ` · ${l.remaining_rounds} jornadas` : ""}
                            </Muted>
                            {(l.trend ?? []).slice(-3).map((d: Direction, k: number) => {
                              const t = TREND[d] ?? TREND.stay;
                              return (
                                <Text key={k} style={{ color: t.color, fontWeight: "800", fontSize: 13 }}>
                                  {t.symbol}
                                </Text>
                              );
                            })}
                          </View>
                        </View>
                        <Text style={styles.points}>{l.points}</Text>
                      </View>
                    </View>
                  ))}
                </GlassCard>
              )}

              {/* Torneos abiertos */}
              <SectionHeader index={2} title="Torneos abiertos" count={openTournaments.length} style={styles.section} />
              {openTournaments.length === 0 ? (
                <Muted>No hay torneos abiertos a inscripción por ahora.</Muted>
              ) : (
                <GlassCard style={{ gap: spacing.md }}>
                  {openTournaments.map((t: OpenTournament, i: number) => (
                    <View key={t.id}>
                      {i > 0 && <View style={styles.hairline} />}
                      <View style={styles.leagueRow}>
                        <View style={styles.iconBadge}>
                          <Ionicons name="podium" size={16} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{t.name}</Text>
                          <Muted>Inscripción abierta</Muted>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                      </View>
                    </View>
                  ))}
                </GlassCard>
              )}

              {/* Ligas cerca de ti */}
              <SectionHeader index={3} title="Ligas cerca de ti" count={nearby.length} style={styles.section} />
              {nearby.length === 0 ? (
                <Muted>No encontramos ligas abiertas en tu zona.</Muted>
              ) : (
                <GlassCard style={{ gap: spacing.md }}>
                  {nearby.map((l: NearbyLeague, i: number) => (
                    <View key={l.league_id}>
                      {i > 0 && <View style={styles.hairline} />}
                      <View style={styles.leagueRow}>
                        <View style={styles.iconBadge}>
                          <Ionicons name="location" size={16} color={colors.highlight} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{l.league_name}</Text>
                          <Muted numberOfLines={1}>
                            {l.club}
                            {l.city ? ` · ${l.city}` : ""}
                          </Muted>
                        </View>
                      </View>
                    </View>
                  ))}
                </GlassCard>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function availLabel(a: "available" | "unavailable" | "pending") {
  return a === "available" ? "Voy" : a === "unavailable" ? "No voy" : "Pendiente";
}
function availTone(a: "available" | "unavailable" | "pending") {
  return { color: a === "available" ? colors.primary : a === "unavailable" ? colors.danger : colors.textMuted };
}

const styles = StyleSheet.create({
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
  heroStats: { flexDirection: "row", alignItems: "stretch", marginTop: spacing.sm },
  heroDivider: { width: 1, backgroundColor: colors.glassBorder, marginHorizontal: spacing.sm },
  heroStatLabel: { color: colors.textFaint, fontSize: 9, letterSpacing: 1.5, fontWeight: "700" },
  heroStatValue: { color: colors.text, fontSize: 24, fontFamily: fonts.display, marginTop: 2 },
  heroAvail: { fontSize: 18, fontFamily: fonts.display, marginTop: 4 },
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
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  points: { color: colors.text, fontSize: 26, fontFamily: fonts.display },
});
