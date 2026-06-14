import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card, H1, Muted, Pill } from "@/components/ui";
import { useRankings } from "@/hooks";
import type { Ranking } from "@/lib/api";
import { colors, spacing } from "@/theme";

export default function RankingScreen() {
  const { data, isLoading } = useRankings();
  const rankings = data?.rankings ?? [];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <H1>Tu ranking</H1>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.ink400} />
        ) : rankings.length === 0 ? (
          <Muted>Aún no participas en ninguna liga.</Muted>
        ) : (
          rankings.map((r: Ranking) => (
            <Card key={r.league_id} style={{ marginTop: spacing.md }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.league}>{r.league_name}</Text>
                  {r.current_court_number != null && (
                    <Muted>Cancha {r.current_court_number}</Muted>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.points}>{r.points}</Text>
                  <Pill label={`#${r.position}`} tone="primary" />
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg },
  row: { flexDirection: "row", alignItems: "center" },
  league: { fontSize: 16, fontWeight: "700", color: colors.ink900 },
  points: { fontSize: 32, fontWeight: "800", color: colors.ink900 },
});
