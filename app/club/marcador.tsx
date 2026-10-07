/**
 * Modo club (fase 3, 2026-10): capturar el marcador de un partido desde la cancha.
 *
 * Mismas reglas que el panel y el backend (`ResultInputSerializer`): de 0 a 7 games, sin
 * empates, y un 7 solo junto a un 6 o un 5. Se validan antes de enviar para que nadie
 * descubra la regla con un error. Al guardar ofrece el siguiente partido sin marcador:
 * en la cancha se capturan uno tras otro.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type RefObject, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/Toast";
import { Button, Muted } from "@/components/ui";
import { useClubActions, useRoundSheet } from "@/hooks";
import type { RoundSheet, SheetMatch } from "@/lib/api";
import { colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

const MAX_GAMES = 7;

/** Filtra no-dígitos, corta a un carácter e ignora la tecla si pasa de 7. */
function limitGames(value: string, prev: string): string {
  const digit = value.replace(/\D/g, "").slice(0, 1);
  if (digit !== "" && Number(digit) > MAX_GAMES) return prev;
  return digit;
}

/** El mismo texto que devuelve el backend, para que la regla se lea igual en todos lados. */
function scoreError(a: number, b: number): string | null {
  if (a === b) return "El marcador no puede quedar empatado; un equipo debe ganar en games.";
  if (Math.max(a, b) === MAX_GAMES && ![5, 6].includes(Math.min(a, b)))
    return "Un marcador de 7 solo es válido si el rival llegó a 6 o 5 games.";
  return null;
}

type Located = { match: SheetMatch; court: number };

function locate(data: RoundSheet | undefined, matchId: number | null): Located | null {
  for (const c of data?.courts ?? []) {
    const m = c.matches.find((x) => x.id === matchId);
    if (m) return { match: m, court: c.court_number };
  }
  return null;
}

/** El siguiente partido sin marcador, en orden de pista y partido (da la vuelta). */
function nextPending(data: RoundSheet | undefined, matchId: number): Located | null {
  const all = (data?.courts ?? []).flatMap((c) => c.matches.map((m) => ({ match: m, court: c.court_number })));
  const i = all.findIndex((x) => x.match.id === matchId);
  const ordered = [...all.slice(i + 1), ...all.slice(0, Math.max(i, 0))];
  return ordered.find((x) => !x.match.score) ?? null;
}

export default function CaptureScoreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ round: string; match: string }>();
  const roundId = Number(params.round) > 0 ? Number(params.round) : null;
  const matchId = Number(params.match) > 0 ? Number(params.match) : null;
  const sheet = useRoundSheet(roundId);
  const found = locate(sheet.data, matchId);

  return (
    <Screen
      title="Marcador"
      subtitle={found ? `Pista ${found.court} · Partido ${found.match.match_number}` : undefined}
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      {sheet.isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      ) : sheet.isError && !sheet.data ? (
        <View style={styles.content}>
          <LoadError error={sheet.error} onRetry={() => void sheet.refetch()} />
        </View>
      ) : !found || roundId == null ? (
        <View style={styles.content}>
          <Muted>No encontramos ese partido en la jornada.</Muted>
        </View>
      ) : !sheet.data?.round.accepts_results ? (
        <View style={styles.content}>
          <Muted>Esta jornada no acepta marcadores: hay que publicarla primero, y una cerrada ya no cambia.</Muted>
        </View>
      ) : (
        // La llave reinicia el formulario al pasar al siguiente partido.
        <CaptureForm key={found.match.id} roundId={roundId} located={found} data={sheet.data} />
      )}
    </Screen>
  );
}

function CaptureForm({ roundId, located, data }: { roundId: number; located: Located; data: RoundSheet }) {
  const router = useRouter();
  const toast = useToast();
  const { capture } = useClubActions();
  const { match } = located;
  const [first, setFirst] = useState(match.score ? String(match.score.team1_games) : "");
  const [second, setSecond] = useState(match.score ? String(match.score.team2_games) : "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ a: number; b: number } | null>(null);
  const secondRef = useRef<TextInput>(null);

  async function save() {
    if (first === "" || second === "") return;
    Keyboard.dismiss();
    const a = Number(first);
    const b = Number(second);
    const problem = scoreError(a, b);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      await capture.mutateAsync({ matchId: match.id, team1: a, team2: b });
      toast.show("Marcador guardado.");
      setSaved({ a, b });
    } catch (e) {
      setError((e as Error).message || "No se pudo guardar. Intenta de nuevo.");
    }
  }

  if (saved) {
    const next = nextPending(data, match.id);
    const winners = saved.a > saved.b ? match.team1 : match.team2;
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <GlassCard strong style={styles.doneCard}>
          <Ionicons name="checkmark-circle" size={44} color={colors.primary} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.doneScore}>
            {saved.a}–{saved.b}
          </Text>
          <Muted style={{ textAlign: "center" }}>Ganan {winners.join(" y ")}.</Muted>
        </GlassCard>
        {next ? (
          <Button
            title={`Siguiente: pista ${next.court} · partido ${next.match.match_number}`}
            onPress={() => router.replace({ pathname: "/club/marcador", params: { round: roundId, match: next.match.id } })}
          />
        ) : (
          <Muted style={{ textAlign: "center" }}>Ya no quedan partidos sin marcador en esta jornada.</Muted>
        )}
        <Button title="Volver a la jornada" variant="glass" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <GlassCard style={styles.card}>
        <TeamInput
          names={match.team1}
          value={first}
          onChange={(v) => {
            const next = limitGames(v, first);
            setFirst(next);
            // Corregir el número deja atrás el aviso del intento anterior.
            setError(null);
            // Un dígito y listo: salta solo al marcador de la otra pareja.
            if (next !== "") secondRef.current?.focus();
          }}
          autoFocus={!match.score}
        />
        <View style={styles.hairline} />
        <TeamInput
          inputRef={secondRef}
          names={match.team2}
          value={second}
          onChange={(v) => {
            const next = limitGames(v, second);
            setSecond(next);
            setError(null);
            if (next !== "" && first !== "") Keyboard.dismiss();
          }}
        />
      </GlassCard>
      {match.dispute && (
        <Muted>
          Impugnación abierta: {match.dispute.raised_by || "un jugador"} propone {match.dispute.proposed}. La deciden los
          jugadores de la pista con su voto.
        </Muted>
      )}
      {error && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.error}>{error}</Text>}
      <Button
        title={match.score ? "Corregir marcador" : "Guardar marcador"}
        onPress={save}
        loading={capture.isPending}
        disabled={first === "" || second === ""}
      />
    </ScrollView>
  );
}

function TeamInput({
  names,
  value,
  onChange,
  inputRef,
  autoFocus,
}: {
  names: string[];
  value: string;
  onChange: (v: string) => void;
  inputRef?: RefObject<TextInput | null>;
  autoFocus?: boolean;
}) {
  const label = names.join(" y ");
  return (
    <View style={styles.teamRow}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {names.map((n) => (
          <Text key={n} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.teamName}>
            {n}
          </Text>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={styles.score}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={1}
        placeholder="0"
        placeholderTextColor={colors.textFaint}
        autoFocus={autoFocus}
        selectTextOnFocus
        accessibilityLabel={`Games de ${label}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 60, gap: spacing.md },
  card: { gap: spacing.md },
  hairline: { height: 1, backgroundColor: colors.glassBorder },
  teamRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  teamName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  score: {
    width: 72,
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    color: colors.text,
    textAlign: "center",
    fontSize: 30,
    fontFamily: fonts.display,
  },
  error: { color: colors.danger, fontSize: 13 },
  doneCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  doneScore: { color: colors.text, fontSize: 40, fontFamily: fonts.display },
});
