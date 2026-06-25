import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card, H1, Muted } from "@/components/ui";
import { useHistory } from "@/hooks";
import type { HistoryRow } from "@/lib/api";
import { colors, spacing } from "@/theme";

export default function HistoryScreen() {
  const { data, isLoading } = useHistory();
  const rows = data?.history ?? [];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <H1>Historial</H1>
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.ink400} />
        ) : rows.length === 0 ? (
          <Muted>Todavía no tienes partidos jugados.</Muted>
        ) : (
          rows.map((row: HistoryRow, i: number) => {
            const won = row.points_delta > 0;
            return (
              <Card key={i} style={{ marginTop: spacing.sm }}>
                <View style={styles.row}>
                  <View>
                    <Text style={styles.title}>
                      Jornada {row.round_number} · Cancha {row.court_number}
                    </Text>
                    <Muted>Partido {row.match_number}</Muted>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.score}>
                      {row.games_for} - {row.games_against}
                    </Text>
                    <Text style={[styles.delta, { color: won ? colors.highlight : colors.danger }]}>
                      {row.points_delta > 0 ? `+${row.points_delta}` : row.points_delta}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  score: { fontSize: 20, fontWeight: "800", color: colors.text },
  delta: { fontSize: 14, fontWeight: "700" },
});
