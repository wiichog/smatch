import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { SectionHeader } from "@/components/SectionHeader";
import { Screen } from "@/components/Screen";
import { Button, Chip, Label, Muted, Pill } from "@/components/ui";
import { useNextRound, useSetAvailability } from "@/hooks";
import type { PersonBrief } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, spacing } from "@/theme";

export default function JornadaScreen() {
  const { data, isLoading, refetch, isRefetching } = useNextRound();
  const availMut = useSetAvailability();
  const round = data?.next_round;
  const me = useAuth((s) => s.user?.name) ?? "";
  const isMe = (name?: string | null) => !!me && !!name && name.trim() === me.trim();

  return (
    <Screen title="Jornada" subtitle={round?.league ?? "Tu próxima jornada"}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : !round ? (
          <GlassCard style={{ marginTop: spacing.lg, alignItems: "center", paddingVertical: spacing.xl, gap: 8 }}>
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Sin jornada publicada</Text>
            <Muted style={{ textAlign: "center" }}>
              Cuando tu club publique la jornada, aparecerá aquí.
            </Muted>
          </GlassCard>
        ) : (
          <>
            {/* Hero: tu cancha */}
            <GlassCard strong style={{ marginTop: spacing.sm, alignItems: "center", gap: spacing.sm }}>
              <View style={styles.rowBetweenFull}>
                <Label>Tu cancha</Label>
                <Pill label={`Jornada ${round.round_number}`} tone="primary" />
              </View>
              <Text style={styles.courtNumber}>{round.court_number}</Text>
              <Chip label={`Posición ${round.position}`} color={colors.highlight} />

              {(round.courtmates?.length ?? 0) > 0 && (
                <View style={styles.matesBox}>
                  <Label>Compañeros de cancha</Label>
                  <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    {(round.courtmates ?? []).map(
                      (c: { name: string; position: string; avatar_url: string | null }) => (
                        <View key={c.position} style={styles.mateRow}>
                          <Avatar name={c.name} uri={c.avatar_url} size={38} />
                          <Text style={styles.mateName} numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Chip label={c.position} color={colors.textMuted} />
                        </View>
                      )
                    )}
                  </View>
                </View>
              )}
            </GlassCard>

            <SectionHeader index={1} title="Partidos" count={round.matches?.length ?? 0} style={styles.section} />
            {(round.matches ?? []).map(
              (m: { match_number: number; team_1: PersonBrief[]; team_2: PersonBrief[] }) => (
                <GlassCard key={m.match_number} style={{ marginBottom: spacing.md, gap: spacing.sm }}>
                  <Label>Partido {m.match_number}</Label>
                  <TeamRow players={m.team_1} isMe={isMe} />
                  <View style={styles.vsRow}>
                    <View style={styles.vsLine} />
                    <Text style={styles.vsText}>VS</Text>
                    <View style={styles.vsLine} />
                  </View>
                  <TeamRow players={m.team_2} isMe={isMe} />
                </GlassCard>
              )
            )}

            <SectionHeader index={2} title="¿Vas a jugar?" style={styles.section} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={round.availability === "available" ? "✓ Voy" : "Voy"}
                  variant={round.availability === "available" ? "primary" : "glass"}
                  loading={availMut.isPending}
                  onPress={() => availMut.mutate({ round: round.round_id, status: "available" })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title={round.availability === "unavailable" ? "✓ No voy" : "No voy"}
                  variant={round.availability === "unavailable" ? "ink" : "glass"}
                  loading={availMut.isPending}
                  onPress={() => availMut.mutate({ round: round.round_id, status: "unavailable" })}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Fila de un equipo de dobles: par de avatares + nombres (uno por línea, sin muro
 * de texto). El jugador actual se resalta con aro lima y etiqueta "Tú". */
function TeamRow({ players, isMe }: { players: PersonBrief[]; isMe: (n?: string | null) => boolean }) {
  const list = players ?? [];
  return (
    <View style={styles.teamRow}>
      <View style={{ flexDirection: "row" }}>
        {list.slice(0, 2).map((p, i) => (
          <View
            key={i}
            style={[
              i > 0 && { marginLeft: -14 },
              isMe(p?.name) && { borderRadius: 999, borderWidth: 2, borderColor: colors.primary },
            ]}
          >
            <Avatar name={p?.name} uri={p?.avatar_url} size={36} ring />
          </View>
        ))}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        {list.map((p, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[styles.playerName, isMe(p?.name) && { color: colors.primary }]} numberOfLines={1}>
              {p?.name}
            </Text>
            {isMe(p?.name) && <Chip label="Tú" color={colors.primary} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  emptyTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  rowBetweenFull: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
  },
  courtNumber: { color: colors.primary, fontSize: 68, fontWeight: "800", lineHeight: 74 },
  matesBox: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  mateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mateName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  teamRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  playerName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  vsRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  vsLine: { flex: 1, height: 1, backgroundColor: colors.glassBorder },
  vsText: { color: colors.textFaint, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
});
