/**
 * Impugnar el marcador de un partido (ticket #32). El jugador propone el marcador que
 * considera correcto; se avisa a los demás de su pista para que voten.
 *
 * El formulario habla desde el lado del jugador («Ustedes / Rivales») y enseña el
 * marcador capturado. Antes pedía «Equipo 1 / Equipo 2» sin decir quién era quién: el
 * historial muestra el marcador desde tu lado (5–6) y el backend lo guarda por lado
 * absoluto, así que quien jugó de equipo 2 proponía el marcador al revés sin notarlo.
 */
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { Button, Label, Muted } from "@/components/ui";
import { useHistory } from "@/hooks";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, MAX_FONT_SCALE, radius, spacing } from "@/theme";

/**
 * Ticket #67: un set de pádel no pasa de 7 (7-6 o 6-7 es el tope). El backend ya lo
 * rechaza en `leagues/services/disputes.py`; aquí simplemente no dejamos teclearlo,
 * para que el jugador no descubra el límite con un error después de enviar.
 */
const MAX_GAMES = 7;

/** Filtra no-dígitos, corta a un carácter e ignora la tecla si pasa de 7. */
function limitGames(value: string, prev: string): string {
  const digit = value.replace(/\D/g, "").slice(0, 1);
  if (digit !== "" && Number(digit) > MAX_GAMES) return prev;
  return digit;
}

export default function DisputeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const token = useAuth((s) => s.token);
  // El partido sale del historial (ya en caché: esta pantalla se abre desde ahí).
  const history = useHistory();
  const row = history.data?.history.find((r) => r.match_id === Number(matchId)) ?? null;
  // Sin lado conocido (backend anterior) los campos son «Equipo 1 / Equipo 2» tal cual.
  const side = row?.my_side ?? null;

  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const secondRef = useRef<TextInput>(null);

  const labels = side ? ["Ustedes", "Rivales"] : ["Equipo 1", "Equipo 2"];
  const rivals = (row?.opponents ?? []).map((o) => o.name).filter(Boolean);

  async function submit() {
    if (!token || first === "" || second === "") return;
    Keyboard.dismiss();
    const a = Number(first);
    const b = Number(second);
    if (side && row && a === row.games_for && b === row.games_against) {
      setError("Ese es el marcador que ya está capturado. Propón el que debió quedar.");
      return;
    }
    // Del lado del jugador al lado absoluto que guarda el backend.
    const [team1, team2] = side === 2 ? [b, a] : [a, b];
    setSending(true);
    setError(null);
    try {
      await api.raiseDispute(token, Number(matchId), team1, team2);
      // El historial pinta «Impugnación abierta» en este partido.
      void qc.invalidateQueries({ queryKey: ["history"] });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen
      title="Impugnar marcador"
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      {/* Tocar fuera de los marcadores cierra el teclado: el numérico de iOS no trae
          tecla para cerrarse, y una barra «Listo» encima (InputAccessoryView) no se pega
          al teclado con la arquitectura nueva de RN 0.85 — salía suelta al fondo. */}
      <Pressable style={[styles.content, { flex: 1 }]} onPress={Keyboard.dismiss} accessible={false}>
        {done ? (
          <GlassCard strong style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Ionicons name="checkmark-circle" size={48} color={colors.highlight} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title}>Impugnación enviada</Text>
            <Muted style={{ textAlign: "center" }}>
              Avisamos a los demás jugadores de tu pista para que voten. Si todos aprueban, se
              corrige el marcador.
            </Muted>
            <Button title="Listo" onPress={() => router.back()} />
          </GlassCard>
        ) : history.isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : (
          <>
            {row && (
              <GlassCard style={{ gap: spacing.xs }}>
                <Label>
                  {[row.league_name, `Jornada ${row.round_number}`, `Partido ${row.match_number}`]
                    .filter(Boolean)
                    .join(" · ")}
                </Label>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.captured}>
                  Marcador capturado: {row.games_for}–{row.games_against}
                </Text>
                {row.partner && (
                  <Muted>
                    Ustedes: tú y {row.partner.name}
                  </Muted>
                )}
                {rivals.length > 0 && <Muted>Rivales: {rivals.join(" y ")}</Muted>}
              </GlassCard>
            )}
            <Muted>
              Propón el marcador que debió quedar. Los demás jugadores de tu pista tendrán que
              aprobarlo.
            </Muted>
            <View style={styles.scoreRow}>
              <View style={{ flex: 1 }}>
                <Label>{labels[0]}</Label>
                <TextInput
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={styles.score}
                  value={first}
                  onChangeText={(v) => {
                    const next = limitGames(v, first);
                    setFirst(next);
                    // Un dígito y listo: salta solo al marcador del otro equipo.
                    if (next !== "") secondRef.current?.focus();
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel={`Games de ${labels[0].toLowerCase()}`}
                />
              </View>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.dash}>–</Text>
              <View style={{ flex: 1 }}>
                <Label>{labels[1]}</Label>
                <TextInput
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  ref={secondRef}
                  style={styles.score}
                  value={second}
                  onChangeText={(v) => {
                    const next = limitGames(v, second);
                    setSecond(next);
                    // Con los dos marcadores puestos ya no hay nada que teclear: el teclado
                    // se va y deja ver «Enviar impugnación».
                    if (next !== "" && first !== "") Keyboard.dismiss();
                  }}
                  keyboardType="number-pad"
                  maxLength={1}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel={`Games de ${labels[1].toLowerCase()}`}
                />
              </View>
            </View>
            {error && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.error}>{error}</Text>}
            <Button title="Enviar impugnación" onPress={submit} loading={sending} disabled={first === "" || second === ""} />
          </>
        )}
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  captured: { color: colors.text, fontSize: 16, fontWeight: "700" },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  dash: { color: colors.textMuted, fontSize: 28, fontWeight: "800", paddingBottom: 8 },
  score: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    color: colors.text,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
  },
  error: { color: colors.danger, fontSize: 13 },
});
