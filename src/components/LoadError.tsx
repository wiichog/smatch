import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text } from "react-native";

import { GlassCard } from "@/components/Glass";
import { Button, Muted } from "@/components/ui";
import { OFFLINE_MESSAGE } from "@/lib/api";
import { colors, spacing } from "@/theme";

/**
 * «No pudimos cargar» con su botón de reintento.
 *
 * Existe para que un fallo de red NO se pinte como un estado vacío: sin esto, sin
 * conexión la app decía «Aún no estás inscrito en ninguna liga» y «Sin jornada
 * publicada», que es mentirle al jugador sobre su propia liga.
 */
export function LoadError({
  error,
  onRetry,
  style,
}: {
  error?: unknown;
  onRetry: () => void;
  style?: object;
}) {
  const message = (error as Error | undefined)?.message || OFFLINE_MESSAGE;
  return (
    <GlassCard style={{ ...styles.card, ...(style ?? {}) }}>
      <Ionicons name="cloud-offline-outline" size={34} color={colors.textMuted} />
      <Text style={styles.title}>No pudimos cargar tu información</Text>
      <Muted style={{ textAlign: "center" }}>{message}</Muted>
      <Button title="Reintentar" variant="glass" onPress={onRetry} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  title: { color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
});
