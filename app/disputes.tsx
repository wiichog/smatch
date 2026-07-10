/**
 * Impugnaciones por votar (ticket #32). Muestra las disputas abiertas de las pistas del
 * jugador; aprueba/rechaza. Si todos aprueban, el backend corrige el marcador.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { Button, Label, Muted } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, spacing } from "@/theme";

export default function DisputesScreen() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    api
      .myDisputes(token)
      .then((r) => setDisputes(r.disputes ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function vote(id: number, approve: boolean) {
    if (!token) return;
    setVotingId(id);
    try {
      await api.voteDispute(token, id, approve);
      load();
    } catch {
      // el backend valida; recargamos de todos modos
    } finally {
      setVotingId(null);
    }
  }

  return (
    <Screen
      title="Impugnaciones"
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : disputes.length === 0 ? (
          <GlassCard style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Ionicons name="checkmark-done" size={40} color={colors.textMuted} />
            <Muted style={{ textAlign: "center" }}>No tienes impugnaciones por votar.</Muted>
          </GlassCard>
        ) : (
          disputes.map((d) => (
            <GlassCard key={d.id} style={{ gap: spacing.sm, marginBottom: spacing.md }}>
              <Label>
                {d.league} · Jornada {d.round_number}
              </Label>
              <View style={styles.scores}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Muted>Actual</Muted>
                  <Text style={styles.scoreText}>
                    {d.current ? `${d.current.team1}–${d.current.team2}` : "—"}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Muted>Propuesto</Muted>
                  <Text style={[styles.scoreText, { color: colors.primary }]}>
                    {d.proposed.team1}–{d.proposed.team2}
                  </Text>
                </View>
              </View>
              {d.already_voted ? (
                <Muted>Ya votaste. Esperando a los demás.</Muted>
              ) : d.raised_by_me ? (
                <Muted>Tú levantaste esta impugnación.</Muted>
              ) : (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Aprobar" onPress={() => vote(d.id, true)} loading={votingId === d.id} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Rechazar" variant="glass" onPress={() => vote(d.id, false)} loading={votingId === d.id} />
                  </View>
                </View>
              )}
            </GlassCard>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  scores: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  scoreText: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 2 },
});
