import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { Muted } from "@/components/ui";
import { useRankings } from "@/hooks";
import type { Ranking } from "@/lib/api";
import { alpha, colors, fonts, radius, spacing } from "@/theme";

export default function RankingScreen() {
  const { data, isLoading, refetch, isRefetching } = useRankings();
  // `league_id` llega desde el push de cierre de jornada: resaltamos esa liga para que
  // se vea de inmediato de cuál hablaba la notificación (el jugador puede tener varias).
  const { league_id } = useLocalSearchParams<{ league_id?: string }>();
  const highlighted = Number(league_id) > 0 ? Number(league_id) : null;
  const rankings = data?.rankings ?? [];

  return (
    <Screen title="Ranking" subtitle="Tu posición por liga">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : rankings.length === 0 ? (
          <GlassCard style={{ marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.xl, gap: 8 }}>
            <Ionicons name="trophy-outline" size={38} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Aún sin ranking</Text>
            <Muted style={{ textAlign: "center" }}>Cuando juegues tu primera jornada verás tu posición aquí.</Muted>
          </GlassCard>
        ) : (
          <GlassCard style={{ marginTop: spacing.sm, gap: spacing.md }}>
            {rankings.map((r: Ranking, i: number) => {
              const top = r.position === 1;
              return (
                <View key={r.league_id}>
                  {i > 0 && <View style={styles.hairline} />}
                  <View style={[styles.row, r.league_id === highlighted && styles.rowHighlight]}>
                    <View style={[styles.posBadge, top && styles.posBadgeTop]}>
                      <Text style={[styles.posBadgeText, top && { color: colors.onPrimary }]}>#{r.position}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.league} numberOfLines={1}>{r.league_name}</Text>
                      {r.current_court_number != null && <Muted>Cancha {r.current_court_number}</Muted>}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.points}>{r.points}</Text>
                      <Text style={styles.ptsLabel}>PTS</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </GlassCard>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  emptyTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  // Liga a la que apuntaba el push: pastilla lima tenue, el mismo acento del tab activo.
  rowHighlight: {
    backgroundColor: alpha(colors.primary, 0.1),
    borderRadius: radius.md,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  posBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.primary, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  posBadgeTop: { backgroundColor: colors.primary },
  posBadgeText: { color: colors.primary, fontWeight: "800", fontSize: 15 },
  league: { fontSize: 16, fontWeight: "700", color: colors.text },
  points: { fontSize: 26, fontFamily: fonts.display, color: colors.text },
  ptsLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textFaint, fontWeight: "700" },
});
