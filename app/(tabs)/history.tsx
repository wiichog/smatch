import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { Muted } from "@/components/ui";
import { useHistory } from "@/hooks";
import type { HistoryRow } from "@/lib/api";
import { alpha, colors, fonts, spacing } from "@/theme";

export default function HistoryScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useHistory();
  const rows = data?.history ?? [];

  return (
    <Screen title="Historial" subtitle="Tus partidos jugados">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : rows.length === 0 ? (
          <GlassCard style={{ marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.xl, gap: 8 }}>
            <Ionicons name="time-outline" size={38} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Todavía sin partidos</Text>
            <Muted style={{ textAlign: "center" }}>Aquí verás el resultado y los puntos de cada jornada.</Muted>
          </GlassCard>
        ) : (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            {rows.map((row: HistoryRow, i: number) => {
              const won = row.points_delta > 0;
              const lost = row.points_delta < 0;
              const tone = won ? colors.success : lost ? colors.danger : colors.textMuted;
              return (
                <GlassCard key={i}>
                  <View style={styles.row}>
                    <View style={[styles.tick, { backgroundColor: tone }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>
                        Jornada {row.round_number} · Cancha {row.court_number}
                      </Text>
                      <Muted>Partido {row.match_number}</Muted>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.score}>
                        {row.games_for} <Text style={styles.scoreSep}>-</Text> {row.games_against}
                      </Text>
                      <View style={[styles.deltaPill, { backgroundColor: alpha(tone, 0.16) }]}>
                        <Text style={{ color: tone, fontWeight: "800", fontSize: 12 }}>
                          {row.points_delta > 0 ? `+${row.points_delta}` : row.points_delta} pts
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => router.push(`/dispute/${row.match_id}`)}
                    style={styles.disputeRow}
                    accessibilityLabel="Impugnar marcador"
                  >
                    <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.disputeText}>¿Marcador incorrecto? Impugnar</Text>
                  </Pressable>
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  emptyTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  tick: { width: 4, height: 40, borderRadius: 2 },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  score: { fontSize: 22, fontFamily: fonts.display, color: colors.text },
  scoreSep: { color: colors.textFaint },
  deltaPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  disputeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  disputeText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
});
