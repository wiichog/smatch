/**
 * Impugnar el marcador de un partido (ticket #32). El jugador propone el marcador que
 * considera correcto; se avisa a los demás de su pista para que voten.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { Button, Label, Muted } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, radius, spacing } from "@/theme";

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
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const token = useAuth((s) => s.token);
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!token || t1 === "" || t2 === "") return;
    setSending(true);
    setError(null);
    try {
      await api.raiseDispute(token, Number(matchId), Number(t1), Number(t2));
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
      <View style={styles.content}>
        {done ? (
          <GlassCard strong style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Ionicons name="checkmark-circle" size={48} color={colors.highlight} />
            <Text style={styles.title}>Impugnación enviada</Text>
            <Muted style={{ textAlign: "center" }}>
              Avisamos a los demás jugadores de tu pista para que voten. Si todos aprueban, se
              corrige el marcador.
            </Muted>
            <Button title="Listo" onPress={() => router.back()} />
          </GlassCard>
        ) : (
          <>
            <Muted>
              Propón el marcador que consideras correcto. Los demás jugadores de tu pista deberán
              aprobarlo.
            </Muted>
            <View style={styles.scoreRow}>
              <View style={{ flex: 1 }}>
                <Label>Equipo 1</Label>
                <TextInput
                  style={styles.score}
                  value={t1}
                  onChangeText={(v) => setT1((prev) => limitGames(v, prev))}
                  keyboardType="number-pad"
                  maxLength={1}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                />
              </View>
              <Text style={styles.dash}>–</Text>
              <View style={{ flex: 1 }}>
                <Label>Equipo 2</Label>
                <TextInput
                  style={styles.score}
                  value={t2}
                  onChangeText={(v) => setT2((prev) => limitGames(v, prev))}
                  keyboardType="number-pad"
                  maxLength={1}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                />
              </View>
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <Button title="Enviar impugnación" onPress={submit} loading={sending} disabled={t1 === "" || t2 === ""} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
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
