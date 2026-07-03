import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card, H1, Muted, Pill } from "@/components/ui";
import { useDashboard } from "@/hooks";
import type { DashboardData, Direction } from "@/lib/api";
import { colors, spacing } from "@/theme";

const TREND: Record<Direction, { symbol: string; color: string }> = {
  up: { symbol: "↑", color: colors.highlight },
  down: { symbol: "↓", color: colors.danger },
  stay: { symbol: "=", color: colors.ink400 },
};

type Enrolled = DashboardData["enrolled_leagues"][number];
type OpenTournament = DashboardData["open_tournaments"][number];
type NearbyLeague = DashboardData["nearby_leagues"][number];

export default function DashboardScreen() {
  const { data, isLoading } = useDashboard();
  const enrolled = data?.enrolled_leagues ?? [];
  const openTournaments = data?.open_tournaments ?? [];
  const nearby = data?.nearby_leagues ?? [];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <H1>Inicio</H1>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.ink400} />
        ) : (
          <>
            <Text style={styles.section}>Tus ligas</Text>
            {enrolled.length === 0 ? (
              <Muted>Aún no estás inscrito en ninguna liga.</Muted>
            ) : (
              enrolled.map((l: Enrolled) => (
                <Card key={l.league_id} style={{ marginTop: spacing.md }}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{l.league_name}</Text>
                      <Muted>
                        {l.current_court_number != null ? `Pista ${l.current_court_number}` : "Sin pista"}
                        {l.remaining_rounds != null ? ` · ${l.remaining_rounds} jornadas restantes` : ""}
                      </Muted>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={styles.points}>{l.points}</Text>
                      <Pill label={`#${l.position}`} tone="primary" />
                    </View>
                  </View>
                  {l.trend.length > 0 && (
                    <View style={styles.trend}>
                      <Muted>Últimas jornadas:</Muted>
                      {l.trend.map((d: Direction, i: number) => (
                        <Text key={i} style={[styles.trendSymbol, { color: TREND[d].color }]}>
                          {TREND[d].symbol}
                        </Text>
                      ))}
                    </View>
                  )}
                </Card>
              ))
            )}

            <Text style={styles.section}>Torneos abiertos</Text>
            {openTournaments.length === 0 ? (
              <Muted>No hay torneos abiertos a inscripción por ahora.</Muted>
            ) : (
              openTournaments.map((t: OpenTournament) => (
                <Card key={t.id} style={{ marginTop: spacing.md }}>
                  <Text style={styles.title}>{t.name}</Text>
                  <Muted>Inscripción abierta</Muted>
                </Card>
              ))
            )}

            <Text style={styles.section}>Ligas cerca de ti</Text>
            {nearby.length === 0 ? (
              <Muted>No encontramos ligas abiertas en tu zona.</Muted>
            ) : (
              nearby.map((l: NearbyLeague) => (
                <Card key={l.league_id} style={{ marginTop: spacing.md }}>
                  <Text style={styles.title}>{l.league_name}</Text>
                  <Muted>
                    {l.club}
                    {l.city ? ` · ${l.city}` : ""}
                  </Muted>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  section: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.ink400,
  },
  row: { flexDirection: "row", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  points: { fontSize: 28, fontWeight: "800", color: colors.text },
  trend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  trendSymbol: { fontSize: 18, fontWeight: "800" },
});
