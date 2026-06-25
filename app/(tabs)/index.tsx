import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "@/components/Logo";
import { Button, Card, H1, Muted, Pill } from "@/components/ui";
import { useNextRound, useSetAvailability } from "@/hooks";
import { colors, radius, spacing } from "@/theme";

export default function JornadaScreen() {
  const { data, isLoading, refetch, isRefetching } = useNextRound();
  const availMut = useSetAvailability();
  const round = data?.next_round;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={styles.brandBar}>
          <Logo size={26} dark />
        </View>
        <H1>Tu próxima jornada</H1>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.ink400} />
        ) : !round ? (
          <Card style={{ marginTop: spacing.lg, alignItems: "center", paddingVertical: spacing.xl }}>
            <Ionicons name="calendar-outline" size={40} color={colors.ink400} />
            <Text style={{ fontWeight: "700", marginTop: spacing.sm, color: colors.text }}>Sin jornada publicada</Text>
            <Muted>Cuando tu club publique la jornada, aparecerá aquí.</Muted>
          </Card>
        ) : (
          <>
            <Card style={{ marginTop: spacing.lg }}>
              <View style={styles.rowBetween}>
                <Text style={styles.league}>{round.league}</Text>
                <Pill label={`Jornada ${round.round_number}`} tone="primary" />
              </View>
              <View style={styles.courtBox}>
                <Text style={styles.courtLabel}>TU CANCHA</Text>
                <Text style={styles.courtNumber}>{round.court_number}</Text>
                <Pill label={`Posición ${round.position}`} tone="success" />
              </View>
              <Muted>Compañeros de cancha</Muted>
              <View style={{ gap: 6, marginTop: 6 }}>
                {round.courtmates.map((c: { name: string; position: string }) => (
                  <Text key={c.position} style={styles.mate}>
                    {c.position} · {c.name}
                  </Text>
                ))}
              </View>
            </Card>

            <Text style={styles.section}>Partidos</Text>
            {round.matches.map(
              (m: { match_number: number; team_1: string[]; team_2: string[] }) => (
              <Card key={m.match_number} style={{ marginBottom: spacing.sm }}>
                <Muted>Partido {m.match_number}</Muted>
                <Text style={styles.team}>{m.team_1.join(" / ")}</Text>
                <Text style={styles.vs}>vs</Text>
                <Text style={styles.team}>{m.team_2.join(" / ")}</Text>
              </Card>
            ))}

            <Text style={styles.section}>¿Vas a jugar?</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={round.availability === "available" ? "✓ Voy" : "Voy"}
                  variant={round.availability === "available" ? "primary" : "outline"}
                  loading={availMut.isPending}
                  onPress={() => availMut.mutate({ round: round.round_id, status: "available" })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={round.availability === "unavailable" ? "✓ No voy" : "No voy"}
                  variant="outline"
                  loading={availMut.isPending}
                  onPress={() => availMut.mutate({ round: round.round_id, status: "unavailable" })}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  brandBar: { marginBottom: spacing.md },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  league: { fontSize: 16, fontWeight: "700", color: colors.text },
  courtBox: {
    backgroundColor: colors.ink900,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    paddingVertical: spacing.lg,
    marginVertical: spacing.md,
    gap: 4,
  },
  courtLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: 1, fontWeight: "700" },
  courtNumber: { color: colors.primary, fontSize: 56, fontWeight: "800", lineHeight: 60 },
  mate: { color: "rgba(255,255,255,0.72)", fontSize: 15, fontWeight: "500" },
  section: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  team: { fontSize: 15, fontWeight: "600", color: colors.text, textAlign: "center" },
  vs: { textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 12, marginVertical: 2 },
});
