/**
 * Cerrar la jornada desde el celular (modo club, 2026-10), con la ruleta de desempates.
 *
 * Antes solo se cerraba en el panel. Aquí: qué va a pasar, cerrar (la MISMA ruta del
 * panel) y, si dos o más empatan en todo para subir o bajar, la ruleta. El servidor
 * sortea con azar criptográfico y la app solo anima el resultado que ya decidió: girar en
 * el celular no cambia la suerte. Al final, quién sube y quién baja; a cada jugador le
 * llega su resultado por push y correo, igual que al cerrar en el panel. Reabrir sigue
 * siendo del panel: deshace el ranking y es una decisión más pesada.
 */
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/Toast";
import { Button, Muted, Pill } from "@/components/ui";
import { useClubActions, useRoundSheet } from "@/hooks";
import { api, type CloseState, type PendingTiebreak, type RoundMovement, type SpinResult } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing, TIGHT_FONT_SCALE } from "@/theme";

export default function CloseRoundScreen() {
  const router = useRouter();
  const toast = useToast();
  const token = useAuth((s) => s.token);
  const { round } = useLocalSearchParams<{ round: string }>();
  const roundId = Number(round) > 0 ? Number(round) : null;
  const sheet = useRoundSheet(roundId);
  const { close } = useClubActions();
  const state = useQuery<CloseState>({
    queryKey: ["round-close", roundId],
    queryFn: () => api.roundMovements(token!, roundId!),
    enabled: !!token && roundId != null,
  });
  // Lo que respondió la última acción (cerrar o girar) manda sobre la lectura.
  const [override, setOverride] = useState<CloseState | null>(null);
  const current = override ?? state.data;
  const rnd = sheet.data?.round;
  const total = sheet.data?.courts.reduce((n, c) => n + c.matches.length, 0) ?? 0;
  const captured = sheet.data?.courts.reduce((n, c) => n + c.matches.filter((m) => m.score).length, 0) ?? 0;
  const editable = !!sheet.data?.can_edit;

  function askClose() {
    if (roundId == null || !rnd) return;
    Alert.alert(
      `¿Cerrar la jornada ${rnd.number}?`,
      "Se aplican los ascensos y descensos y a cada jugador le llega su resultado. Para cambiar algo después habrá que reabrirla desde el panel.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Cerrar jornada",
          onPress: () =>
            close.mutate(roundId, {
              onSuccess: (r) => {
                setOverride(r);
                if (r.status === "closed") toast.show("Jornada cerrada: a cada jugador le llega su resultado.");
              },
              onError: (e) => toast.show((e as Error).message || "No se pudo cerrar.", "error"),
            }),
        },
      ]
    );
  }

  return (
    <Screen
      title={current?.status === "closed" ? "Resultados" : "Cerrar jornada"}
      subtitle={rnd ? `${rnd.league} · Jornada ${rnd.number}` : undefined}
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state.isLoading || sheet.isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : (state.isError && !current) || (sheet.isError && !sheet.data) ? (
          <LoadError
            error={state.error ?? sheet.error}
            onRetry={() => {
              void state.refetch();
              void sheet.refetch();
            }}
          />
        ) : !current || !rnd ? null : current.status === "closed" ? (
          <Results movements={current.movements} onDone={() => router.back()} />
        ) : current.pending_tiebreaks.length > 0 ? (
          editable && roundId != null ? (
            <>
              <Muted>
                {current.pending_tiebreaks.length === 1
                  ? "Hay un empate que solo la ruleta puede decidir."
                  : `Hay ${current.pending_tiebreaks.length} empates que solo la ruleta puede decidir.`}
              </Muted>
              <Roulette
                key={current.pending_tiebreaks[0].draw_id}
                roundId={roundId}
                draw={current.pending_tiebreaks[0]}
                onNext={(r) =>
                  setOverride(
                    r.finalized
                      ? { status: "closed", pending_tiebreaks: [], movements: r.movements ?? [] }
                      : { status: "pending_tiebreaks", pending_tiebreaks: r.pending_tiebreaks, movements: [] }
                  )
                }
                onStale={() => {
                  setOverride(null);
                  void state.refetch();
                }}
              />
            </>
          ) : (
            <GlassCard>
              <Muted>Falta la ruleta de un empate para terminar de cerrarla. La tira el dueño o un supervisor.</Muted>
            </GlassCard>
          )
        ) : rnd.status === "draft" ? (
          <GlassCard>
            <Muted>Esta jornada sigue en borrador: primero hay que publicarla y capturar sus marcadores.</Muted>
          </GlassCard>
        ) : (
          <>
            <GlassCard strong style={styles.summary}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.big}>
                {captured} de {total}
              </Text>
              <Muted>marcadores capturados</Muted>
              <View style={styles.hairline} />
              <Bullet icon="swap-vertical" text="El mejor de cada pista sube y el peor baja (la de arriba no sube, la de abajo no baja)." />
              <Bullet icon="shuffle" text="Si dos empatan en todo, la ruleta decide." />
              <Bullet icon="notifications-outline" text="A cada jugador le llega su resultado al celular y por correo." />
            </GlassCard>
            {captured < total ? (
              <Muted style={{ textAlign: "center" }}>
                Faltan {total - captured} {total - captured === 1 ? "marcador" : "marcadores"} por capturar antes de cerrar.
              </Muted>
            ) : null}
            {editable ? (
              <Button
                title="Cerrar jornada"
                onPress={askClose}
                loading={close.isPending}
                disabled={captured < total || total === 0}
              />
            ) : (
              <Muted style={{ textAlign: "center" }}>Tu acceso en este club es de solo lectura.</Muted>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Bullet({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.bullet}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Muted style={{ flex: 1 }}>{text}</Muted>
    </View>
  );
}

/**
 * La ruleta de UN empate. El servidor elige (`spin`); aquí se anima: el resaltado da
 * tres vueltas cada vez más lento y se detiene en quien ya salió. Háptica en cada paso.
 */
function Roulette({
  roundId,
  draw,
  onNext,
  onStale,
}: {
  roundId: number;
  draw: PendingTiebreak;
  onNext: (r: SpinResult) => void;
  onStale: () => void;
}) {
  const toast = useToast();
  const { spin } = useClubActions();
  const [active, setActive] = useState<number | null>(null);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const up = draw.kind === "up";
  const destino = up ? draw.court_number - 1 : draw.court_number + 1;
  const chosenId = result ? (up ? result.draw.winner : result.draw.loser) : null;
  const chosenName = result ? (up ? result.draw.winner_name : result.draw.loser_name) : null;

  async function go() {
    setRolling(true);
    let r: SpinResult;
    try {
      r = await spin.mutateAsync({ roundId, drawId: draw.draw_id });
    } catch (e) {
      setRolling(false);
      toast.show((e as Error).message || "No se pudo girar. Intenta de nuevo.", "error");
      onStale(); // quizá ya la giró alguien más desde el panel
      return;
    }
    const n = draw.candidates.length;
    const target = Math.max(0, draw.candidates.findIndex((c) => c.player === (up ? r.draw.winner : r.draw.loser)));
    const steps = n * 3 + target + 1;
    let t = 0;
    for (let i = 0; i < steps; i++) {
      const progress = steps > 1 ? i / (steps - 1) : 1;
      t += 60 + Math.pow(progress, 2.2) * 340; // rápido al principio, lento al final
      timers.current.push(
        setTimeout(() => {
          setActive(i % n);
          void Haptics.selectionAsync().catch(() => {});
          if (i === steps - 1) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            setResult(r);
            setRolling(false);
            const name = up ? r.draw.winner_name : r.draw.loser_name;
            AccessibilityInfo.announceForAccessibility(
              `${up ? "Sube" : "Baja"} ${name ?? ""} a la pista ${up ? draw.court_number - 1 : draw.court_number + 1}`
            );
          }
        }, t)
      );
    }
  }

  return (
    <GlassCard strong style={styles.roulette}>
      <View style={styles.rouletteHead}>
        <Ionicons name="shuffle" size={18} color={colors.primary} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rouletteTitle}>
          Pista {draw.court_number}: ¿quién {up ? "sube" : "baja"}?
        </Text>
      </View>
      <Muted>
        Empataron en puntos, games y ranking. La ruleta decide quién {up ? "sube" : "baja"} a la pista {destino}.
      </Muted>
      <View style={styles.candidates}>
        {draw.candidates.map((c, i) => {
          const on = result ? c.player === chosenId : active === i;
          return (
            <View key={c.player} style={[styles.candidate, on && styles.candidateOn]}>
              <Avatar name={c.player_name} size={30} />
              <Text
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                numberOfLines={1}
                style={[styles.candidateName, on && { color: colors.text }]}
              >
                {c.player_name}
              </Text>
              {result && c.player === chosenId && <Pill label={up ? "Sube" : "Baja"} tone={up ? "primary" : "danger"} />}
            </View>
          );
        })}
      </View>
      {result ? (
        <>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.verdict}>
            {up ? "Sube" : "Baja"} {chosenName} a la pista {destino}.
          </Text>
          <Button
            title={result.finalized ? "Ver resultados" : "Siguiente empate"}
            onPress={() => onNext(result)}
          />
        </>
      ) : (
        <Button title={rolling ? "Girando…" : "Girar la ruleta"} onPress={go} loading={spin.isPending} disabled={rolling} />
      )}
    </GlassCard>
  );
}

const MOVE = {
  up: { icon: "arrow-up" as const, color: colors.primary, label: "Sube" },
  down: { icon: "arrow-down" as const, color: colors.warning, label: "Baja" },
  stay: { icon: "remove" as const, color: colors.ink400, label: "Se queda" },
};

/** Quién sube, baja o se queda, pista por pista. */
function Results({ movements, onDone }: { movements: RoundMovement[]; onDone: () => void }) {
  const courts = new Map<number, RoundMovement[]>();
  for (const m of movements) {
    const list = courts.get(m.from_court_number) ?? [];
    list.push(m);
    courts.set(m.from_court_number, list);
  }
  const order = { up: 0, stay: 1, down: 2 } as const;
  return (
    <>
      <Muted>A cada jugador ya le llegó su resultado. La tabla de la liga ya se actualizó.</Muted>
      {[...courts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([court, list]) => (
          <GlassCard key={court} style={styles.card}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.courtTitle}>
              PISTA {court}
            </Text>
            {[...list]
              .sort((a, b) => order[a.direction] - order[b.direction] || b.round_points - a.round_points)
              .map((m) => {
                const mv = MOVE[m.direction] ?? MOVE.stay;
                return (
                  <View key={m.id} style={styles.moveRow}>
                    <View style={[styles.moveDot, { backgroundColor: alpha(mv.color, 0.16) }]}>
                      <Ionicons name={mv.icon} size={14} color={mv.color} />
                    </View>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.moveName}>
                      {m.player_name}
                    </Text>
                    <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={[styles.moveTo, { color: mv.color }]}>
                      {m.direction === "stay" ? `Pista ${m.to_court_number}` : `→ ${m.to_court_number}`}
                    </Text>
                    <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.movePts}>
                      {m.round_points > 0 ? `+${m.round_points}` : m.round_points}
                    </Text>
                  </View>
                );
              })}
          </GlassCard>
        ))}
      <Button title="Listo" onPress={onDone} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.md },
  summary: { gap: spacing.sm },
  big: { color: colors.text, fontSize: 34, fontFamily: fonts.display },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginVertical: spacing.xs },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  roulette: { gap: spacing.md },
  rouletteHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rouletteTitle: { color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 },
  candidates: { gap: spacing.sm },
  candidate: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  candidateOn: { borderColor: colors.primary, backgroundColor: alpha(colors.primary, 0.14) },
  candidateName: { flex: 1, color: colors.textMuted, fontSize: 16, fontWeight: "700" },
  verdict: { color: colors.text, fontSize: 18, fontFamily: fonts.display, textAlign: "center" },
  card: { gap: spacing.xs },
  courtTitle: { color: colors.primary, fontSize: 13, fontFamily: fonts.displaySemi, letterSpacing: 1.2 },
  moveRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 34 },
  moveDot: { width: 26, height: 26, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  moveName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  moveTo: { fontSize: 13, fontWeight: "800" },
  movePts: { width: 34, textAlign: "right", color: colors.textMuted, fontSize: 14, fontFamily: fonts.displaySemi },
});
