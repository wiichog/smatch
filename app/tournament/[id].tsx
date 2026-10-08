/**
 * Detalle de un torneo (fase 2, 2026-10): cuándo y a qué horas se juega, sus
 * categorías con cupo, tu pareja y tus partidos con marcador.
 *
 * Antes la fila del torneo en Inicio no llevaba a ningún lado, y quien estaba inscrito
 * por su club en un torneo «solo del club» no lo veía en la app. La inscripción desde
 * la app todavía no existe (es por pareja y faltan sus reglas): aquí se dice con quién.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { useToast } from "@/components/Toast";
import { Button, Label, Muted, Pill } from "@/components/ui";
import { useTournament, useTournamentEnrollment } from "@/hooks";
import { usePullRefresh } from "@/lib/pullRefresh";
import type { TournamentDetail } from "@/lib/api";
import { capitalize, hhmm, longDay, parseLocalDate, shortDate } from "@/lib/format";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Match = TournamentDetail["matches"][number];

const STATUS: Record<TournamentDetail["tournament"]["status"], { label: string; tone: "primary" | "success" | "neutral" }> = {
  draft: { label: "Inscripciones", tone: "primary" },
  active: { label: "En curso", tone: "success" },
  finished: { label: "Terminado", tone: "neutral" },
};

export default function TournamentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tid = Number(id) > 0 ? Number(id) : null;
  const { data, isLoading, isError, error, refetch } = useTournament(tid);
  const pull = usePullRefresh(refetch);
  const t = data?.tournament;
  const toast = useToast();
  const { withdraw } = useTournamentEnrollment(tid);

  function askWithdraw(pairId: number, category: string) {
    Alert.alert("¿Cancelar la inscripción?", `Dejan de estar inscritos en ${category}. Tu pareja y tu club reciben aviso.`, [
      { text: "No, mantenerla", style: "cancel" },
      {
        text: "Sí, cancelar",
        style: "destructive",
        onPress: () =>
          withdraw.mutate(pairId, {
            onSuccess: () => toast.show("Cancelaste la inscripción."),
            onError: (e) => toast.show((e as Error).message || "No se pudo cancelar.", "error"),
          }),
      },
    ]);
  }

  return (
    <Screen
      title="Torneo"
      subtitle={t?.club}
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
          <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : isError && !data ? (
          <LoadError error={error} onRetry={() => void refetch()} style={{ marginTop: spacing.md }} />
        ) : data && t ? (
          <>
            <GlassCard strong style={styles.hero}>
              <View style={styles.heroTop}>
                {t.logo_url ? (
                  <Avatar name={t.club} uri={t.logo_url} size={44} />
                ) : (
                  <View style={styles.trophy}>
                    <Ionicons name="podium" size={20} color={colors.primary} />
                  </View>
                )}
                <Pill label={STATUS[t.status]?.label ?? t.status} tone={STATUS[t.status]?.tone ?? "neutral"} />
              </View>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.name}>
                {t.name}
              </Text>
              <Muted>{t.format_label}</Muted>
              <Dates t={t} />
            </GlassCard>

            {/* Tu lugar en el torneo, o cómo entrar. */}
            <GlassCard style={styles.mine}>
              {data.enrolled ? (
                <>
                  <Label>{(data.my_entries?.length ?? 0) > 1 ? "Tus inscripciones" : "Tu inscripción"}</Label>
                  {(data.my_entries ?? [{ pair_id: 0, category: data.my_category ?? "Inscrito", partner: data.partner ?? "", can_withdraw: false }]).map((e) => (
                    <View key={e.pair_id} style={styles.entryRow}>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.mineTitle, { flex: 1 }]}>
                        {e.category}
                        {e.partner ? ` · con ${e.partner}` : ""}
                      </Text>
                      {/* En cuanto el club siembra los grupos (el push «Grupos listos» abre aquí). */}
                      {!!e.group && <Pill label={`Grupo ${e.group}`} tone="primary" />}
                      {e.can_withdraw && (
                        <Pressable
                          onPress={() => askWithdraw(e.pair_id, e.category)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Cancelar la inscripción en ${e.category}`}
                        >
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.withdraw}>Cancelar</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                  {t.enrollment_open && <Muted>La inscripción se paga en el club.</Muted>}
                </>
              ) : t.enrollment_open ? (
                <>
                  <Label>¿Quieres jugarlo?</Label>
                  <Muted>Inscríbete con tu pareja: quedan inscritos al momento y se paga en el club.</Muted>
                </>
              ) : (
                <>
                  <Label>¿Quieres jugarlo?</Label>
                  <Muted>
                    {t.status === "draft"
                      ? "La inscripción de este torneo la hace tu club: avísale con quién juegas y en qué categoría."
                      : "Las inscripciones de este torneo ya cerraron."}
                  </Muted>
                </>
              )}
              {t.enrollment_open && (data.categories ?? []).some((c) => !c.is_mine) && (
                <View style={{ marginTop: spacing.sm }}>
                  <Button
                    title={data.enrolled ? "Inscribirme en otra categoría" : "Inscribirme"}
                    variant={data.enrolled ? "glass" : "primary"}
                    onPress={() => router.push(`/inscripcion/${t.id}`)}
                  />
                </View>
              )}
            </GlassCard>

            {data.matches.length > 0 && (
              <>
                <SectionHeader index={1} title="Tus partidos" count={data.matches.length} style={styles.section} />
                <GlassCard style={styles.list}>
                  {data.matches.map((m, i) => (
                    <View key={m.id}>
                      {i > 0 && <View style={styles.hairline} />}
                      <MatchRow m={m} />
                    </View>
                  ))}
                </GlassCard>
              </>
            )}

            {data.categories.length > 0 && (
              <>
                <SectionHeader
                  index={data.matches.length > 0 ? 2 : 1}
                  title="Categorías"
                  count={data.categories.length}
                  style={styles.section}
                />
                <GlassCard style={styles.list}>
                  {data.categories.map((c, i) => (
                    <View key={c.id}>
                      {i > 0 && <View style={styles.hairline} />}
                      <View style={styles.catRow}>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.catName, c.is_mine && { color: colors.primary }]}>
                          {c.name}
                        </Text>
                        {c.is_mine && <Pill label="Tu categoría" tone="primary" />}
                        <Muted style={{ marginLeft: "auto" }}>
                          {`${c.registered_pairs} ${c.registered_pairs === 1 ? "pareja" : "parejas"}`}
                          {c.max_pairs ? ` · cupo ${c.max_pairs}` : ""}
                        </Muted>
                      </View>
                    </View>
                  ))}
                </GlassCard>
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** Días y horarios: «Sábado 17 y domingo 18 de octubre · 09:00 a 18:00». */
function Dates({ t }: { t: TournamentDetail["tournament"] }) {
  const days = t.days.map((d) => parseLocalDate(d)).filter((d): d is Date => !!d);
  const start = parseLocalDate(t.starts_on);
  let when = "";
  if (days.length === 1) when = capitalize(longDay(days[0]));
  else if (days.length > 1) when = `${days.length} días: ${days.map((d) => shortDate(d)).join(", ")}`;
  else if (start) when = `Empieza el ${longDay(start)}`;
  const slots = t.time_slots.map((s) => hhmm(s)).filter(Boolean);
  const hours = slots.length > 1 ? `de ${slots[0]} a ${slots[slots.length - 1]}` : slots[0] ?? "";
  if (!when && !hours) return <Muted>Fechas por confirmar</Muted>;
  return (
    <View style={styles.datesRow}>
      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.datesText}>
        {[when, hours].filter(Boolean).join(" · ")}
      </Text>
    </View>
  );
}

function MatchRow({ m }: { m: Match }) {
  const played = m.result != null;
  const tone = m.result === "win" ? colors.success : m.result === "loss" ? colors.danger : colors.textMuted;
  const day = parseLocalDate(m.date);
  const when = [day ? capitalize(shortDate(day)) : null, m.start_time, m.court].filter(Boolean).join(" · ");
  return (
    <View
      style={styles.match}
      accessible
      accessibilityLabel={[
        m.stage_label,
        m.partner ? `con ${m.partner}` : null,
        m.rivals.length ? `contra ${m.rivals.join(" y ")}` : null,
        played ? `${m.games_for} a ${m.games_against}` : "por jugar",
        when || null,
      ]
        .filter(Boolean)
        .join(", ")}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.stage}>
          {m.stage_label.toUpperCase()}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2} style={styles.rivals}>
          vs {m.rivals.join(" y ") || "por definir"}
        </Text>
        {!!when && <Muted numberOfLines={1}>{when}</Muted>}
      </View>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.score, { color: played ? tone : colors.textFaint }]}>
        {played ? `${m.games_for}–${m.games_against}` : "—"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120, gap: spacing.md },
  hero: { gap: spacing.xs },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  trophy: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.primary, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: colors.text, fontSize: 24, fontFamily: fonts.displaySemi },
  datesRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.xs },
  datesText: { flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  mine: { gap: spacing.xs },
  mineTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  entryRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  withdraw: { color: colors.danger, fontSize: 14, fontWeight: "700" },
  section: { marginTop: spacing.sm },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginVertical: spacing.xs },
  match: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 4 },
  stage: { color: colors.textFaint, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  rivals: { color: colors.text, fontSize: 15, fontWeight: "700" },
  score: { fontSize: 22, fontFamily: fonts.display, fontVariant: ["tabular-nums"] },
  catRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  catName: { color: colors.text, fontSize: 15, fontWeight: "700" },
});
