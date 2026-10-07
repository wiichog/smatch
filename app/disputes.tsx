/**
 * Impugnaciones (ticket #32). Las abiertas de las pistas del jugador, para que vote, y
 * las resueltas recientes, para que sepa cómo terminaron. Si todos los de la pista
 * aprueban, el backend corrige el marcador; un solo «rechazar» la descarta.
 *
 * Cada tarjeta dice de qué partido se trata (pista, partido, quién contra quién) y quién
 * la levantó: con solo «Jornada 4 · 6–3 → 6–4» nadie sabía qué estaba aprobando.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { SectionHeader } from "@/components/SectionHeader";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/Toast";
import { Button, Label, Muted, Pill } from "@/components/ui";
import { api, type DisputeRow } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, MAX_FONT_SCALE, spacing } from "@/theme";

export default function DisputesScreen() {
  const router = useRouter();
  const toast = useToast();
  // `dispute_id` llega del push: resalta cuál de las abiertas es la que te avisaron.
  const { dispute_id } = useLocalSearchParams<{ dispute_id?: string }>();
  const highlighted = Number(dispute_id) > 0 ? Number(dispute_id) : null;
  const token = useAuth((s) => s.token);
  const [open, setOpen] = useState<DisputeRow[]>([]);
  const [recent, setRecent] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [votingId, setVotingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api.myDisputes(token);
      setOpen(r.disputes ?? []);
      setRecent(r.recent ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function vote(d: DisputeRow, approve: boolean) {
    if (!token) return;
    setVotingId(d.id);
    try {
      const r = await api.voteDispute(token, d.id, approve);
      toast.show(
        !approve
          ? "Rechazaste la impugnación: el marcador se queda como estaba."
          : r.status === "applied"
            ? "Todos aprobaron: el marcador ya se corrigió."
            : "Voto registrado. Falta que voten los demás."
      );
      await load();
    } catch (e) {
      toast.show((e as Error).message || "No se pudo registrar tu voto.", "error");
    } finally {
      setVotingId(null);
    }
  }

  function askReject(d: DisputeRow) {
    Alert.alert(
      "¿Rechazar la impugnación?",
      "Con un solo rechazo el marcador se queda como está y la impugnación se cierra.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Rechazar", style: "destructive", onPress: () => void vote(d, false) },
      ]
    );
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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : loadError && open.length === 0 && recent.length === 0 ? (
          <LoadError error={loadError} onRetry={() => void load()} style={{ marginTop: spacing.md }} />
        ) : (
          <>
            <SectionHeader index={1} title="Abiertas" count={open.length} style={styles.section} />
            {open.length === 0 ? (
              <GlassCard style={styles.empty}>
                <Ionicons name="checkmark-done" size={36} color={colors.textMuted} />
                <Muted style={{ textAlign: "center" }}>No hay impugnaciones abiertas en tus partidos.</Muted>
              </GlassCard>
            ) : (
              open.map((d) => (
                <GlassCard
                  key={d.id}
                  strong={d.id === highlighted}
                  style={{
                    gap: spacing.sm,
                    marginBottom: spacing.md,
                    ...(d.id === highlighted ? styles.highlighted : null),
                  }}
                >
                  <MatchHeader d={d} />
                  <Scores d={d} />
                  {!!d.raised_by && (
                    <Muted>{d.raised_by_me ? "Tú propusiste este marcador." : `Lo propuso ${d.raised_by}.`}</Muted>
                  )}
                  {d.votes && (
                    <Muted>
                      Lleva {d.votes.approved} de {d.votes.needed} votos. Se corrige si todos los de la pista
                      aprueban.
                    </Muted>
                  )}
                  {d.round_closed && (
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.warn}>
                      La jornada ya cerró: si se aprueba se corrige el marcador, pero el ranking lo revisa tu
                      club.
                    </Text>
                  )}
                  {d.already_voted || d.raised_by_me ? (
                    <View style={styles.waitRow}>
                      <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                      <Muted>Ya votaste. Esperando a los demás.</Muted>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", gap: spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <Button title="Aprobar" onPress={() => void vote(d, true)} loading={votingId === d.id} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button title="Rechazar" variant="glass" onPress={() => askReject(d)} disabled={votingId === d.id} />
                      </View>
                    </View>
                  )}
                </GlassCard>
              ))
            )}

            {recent.length > 0 && (
              <>
                <SectionHeader index={2} title="Resueltas recientemente" count={recent.length} style={styles.section} />
                {recent.map((d) => (
                  <GlassCard key={d.id} style={{ gap: spacing.sm, marginBottom: spacing.md, opacity: 0.85 }}>
                    <MatchHeader d={d} />
                    {d.status === "applied" ? (
                      <View style={styles.waitRow}>
                        <Pill label="Corregido" tone="success" />
                        <Muted>
                          Quedó {d.proposed.team1}–{d.proposed.team2}.
                        </Muted>
                      </View>
                    ) : (
                      <View style={styles.waitRow}>
                        <Pill label="Rechazada" tone="danger" />
                        <Muted>
                          Se quedó {d.current ? `${d.current.team1}–${d.current.team2}` : "el marcador original"}.
                        </Muted>
                      </View>
                    )}
                  </GlassCard>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** «Liga · Jornada 4 · Pista 1 · Partido 2» y quién jugaba contra quién. */
function MatchHeader({ d }: { d: DisputeRow }) {
  const where = [
    d.league,
    `Jornada ${d.round_number}`,
    d.court_number != null ? `Pista ${d.court_number}` : null,
    d.match_number != null ? `Partido ${d.match_number}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const t1 = (d.team_1 ?? []).filter(Boolean).join(" y ");
  const t2 = (d.team_2 ?? []).filter(Boolean).join(" y ");
  return (
    <View style={{ gap: 4 }}>
      <Label>{where}</Label>
      {!!t1 && !!t2 && (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.teams}>
          {t1} <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.vs}>vs</Text> {t2}
        </Text>
      )}
    </View>
  );
}

function Scores({ d }: { d: DisputeRow }) {
  return (
    <View style={styles.scores}>
      <View style={{ alignItems: "center", flex: 1 }}>
        <Muted>Marcador actual</Muted>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.scoreText}>{d.current ? `${d.current.team1}–${d.current.team2}` : "—"}</Text>
      </View>
      <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
      <View style={{ alignItems: "center", flex: 1 }}>
        <Muted>Propuesto</Muted>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.scoreText, { color: colors.primary }]}>
          {d.proposed.team1}–{d.proposed.team2}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  section: { marginTop: spacing.md, marginBottom: spacing.sm },
  // La impugnación que traía el push: borde lima, el acento de la marca.
  highlighted: { borderColor: colors.primary, borderWidth: 1 },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  teams: { color: colors.text, fontSize: 15, fontWeight: "700", lineHeight: 21 },
  vs: { color: colors.textFaint, fontWeight: "800", fontSize: 12 },
  scores: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  scoreText: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 2 },
  waitRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  warn: { color: colors.warning, fontSize: 13, lineHeight: 18 },
});
