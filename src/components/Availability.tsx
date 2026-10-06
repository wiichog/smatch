import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useToast } from "@/components/Toast";
import { useSetAvailability } from "@/hooks";
import { alpha, colors, fonts, radius, spacing } from "@/theme";

type Availability = "available" | "unavailable" | "pending";

/**
 * «¿Vas a jugar?» con sus dos respuestas. Vive en Inicio y en Jornada: es LA acción que
 * el club necesita del jugador cada semana, así que va donde se ve primero y no al fondo
 * de la pantalla.
 *
 * El estado se distingue a simple vista: «Voy» elegido es lima, «No voy» elegido es rojo,
 * y «pendiente» lo dice con palabras. Cada cambio se confirma con un aviso, porque
 * «No voy» además le manda un correo al club.
 */
export function AvailabilityPicker({
  roundId,
  availability,
}: {
  roundId: number;
  availability?: Availability | null;
}) {
  const mut = useSetAvailability();
  const toast = useToast();
  const [sending, setSending] = useState<Availability | null>(null);
  const current: Availability = availability ?? "pending";

  function choose(next: Exclude<Availability, "pending">) {
    if (mut.isPending || next === current) return;
    void Haptics.selectionAsync().catch(() => {});
    setSending(next);
    mut.mutate(
      { round: roundId, status: next },
      {
        onSuccess: () =>
          toast.show(next === "available" ? "Listo, confirmaste que vas." : "Avisamos a tu club que no vas."),
        onError: (e) => toast.show((e as Error).message || "No se pudo guardar. Intenta de nuevo.", "error"),
        onSettled: () => setSending(null),
      }
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {current === "pending" && (
        <View style={styles.pendingRow}>
          <Ionicons name="time-outline" size={16} color={colors.warning} />
          <Text style={styles.pendingText}>Aún no confirmas si vas a jugar.</Text>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Choice
          label="Voy"
          icon="checkmark"
          selected={current === "available"}
          tone="go"
          loading={sending === "available"}
          onPress={() => choose("available")}
        />
        <Choice
          label="No voy"
          icon="close"
          selected={current === "unavailable"}
          tone="skip"
          loading={sending === "unavailable"}
          onPress={() => choose("unavailable")}
        />
      </View>
    </View>
  );
}

function Choice({
  label,
  icon,
  selected,
  tone,
  loading,
  onPress,
}: {
  label: string;
  icon: "checkmark" | "close";
  selected: boolean;
  tone: "go" | "skip";
  loading: boolean;
  onPress: () => void;
}) {
  const on =
    tone === "go"
      ? { bg: colors.primary, border: colors.primary, fg: colors.onPrimary }
      : { bg: alpha(colors.danger, 0.18), border: colors.danger, fg: colors.danger };
  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={selected ? `${label}, elegido` : label}
    >
      <View
        style={[
          styles.choice,
          selected
            ? { backgroundColor: on.bg, borderColor: on.border }
            : { backgroundColor: colors.glassStrong, borderColor: colors.glassBorder },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={selected ? on.fg : colors.text} />
        ) : (
          <>
            {selected && <Ionicons name={icon} size={18} color={on.fg} />}
            <Text style={[styles.choiceText, { color: selected ? on.fg : colors.text }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pendingText: { color: colors.warning, fontSize: 14, fontWeight: "600" },
  choice: {
    minHeight: 52,
    borderRadius: radius.full,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  choiceText: { fontSize: 16, fontWeight: "700", fontFamily: fonts.displaySemi },
});
