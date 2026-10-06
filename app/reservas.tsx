/**
 * Mis reservas: lo que el jugador apartó (o en lo que lo agregaron), con cuánto le toca
 * pagar y la opción de cancelar. Antes no existía: quien apartaba no tenía dónde volver a
 * ver su reserva ni cómo soltarla si ya no iba.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { SectionHeader } from "@/components/SectionHeader";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/Toast";
import { Button, Muted, Pill } from "@/components/ui";
import { useCancelReservation, useMyReservations } from "@/hooks";
import type { MyReservation } from "@/lib/api";
import { capitalize, hhmm, money, parseLocalDate, relativeDay, shortDate } from "@/lib/format";
import { colors, spacing } from "@/theme";

export default function ReservasScreen() {
  const router = useRouter();
  const toast = useToast();
  const { data, isLoading, refetch, isRefetching, error } = useMyReservations();
  const cancel = useCancelReservation();
  const upcoming = data?.upcoming ?? [];
  const past = data?.past ?? [];

  function askCancel(r: MyReservation) {
    const day = parseLocalDate(r.date);
    Alert.alert(
      "¿Cancelar la reserva?",
      `${r.court_name}, ${day ? relativeDay(day) : r.date} a las ${hhmm(r.start_time)}. La cancha queda libre para alguien más.`,
      [
        { text: "No, mantenerla", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: () =>
            cancel.mutate(r.id, {
              onSuccess: () => toast.show("Reserva cancelada."),
              onError: (e) => toast.show((e as Error).message || "No se pudo cancelar.", "error"),
            }),
        },
      ]
    );
  }

  return (
    <Screen
      title="Mis reservas"
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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : error ? (
          <GlassCard style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
            <Muted style={{ textAlign: "center" }}>{(error as Error).message}</Muted>
            <Button title="Reintentar" variant="glass" onPress={() => void refetch()} />
          </GlassCard>
        ) : (
          <>
            <SectionHeader index={1} title="Próximas" count={upcoming.length} style={styles.section} />
            {upcoming.length === 0 ? (
              <GlassCard style={styles.empty}>
                <Ionicons name="tennisball-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No tienes reservas próximas</Text>
                <Button title="Reservar cancha" onPress={() => router.replace("/reservar")} />
              </GlassCard>
            ) : (
              upcoming.map((r) => (
                <ReservationCard
                  key={r.id}
                  r={r}
                  cancelling={cancel.isPending && cancel.variables === r.id}
                  onCancel={() => askCancel(r)}
                />
              ))
            )}

            {past.length > 0 && (
              <>
                <SectionHeader index={2} title="Anteriores" count={past.length} style={styles.section} />
                {past.map((r) => (
                  <ReservationCard key={r.id} r={r} past />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function ReservationCard({
  r,
  past,
  cancelling,
  onCancel,
}: {
  r: MyReservation;
  past?: boolean;
  cancelling?: boolean;
  onCancel?: () => void;
}) {
  const day = parseLocalDate(r.date);
  const others = (r.participants ?? []).filter((p) => !p.is_me && p.name).map((p) => p.name);
  return (
    <GlassCard style={{ marginBottom: spacing.md, gap: spacing.sm, opacity: past ? 0.75 : 1 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>
          {day ? capitalize(past ? shortDate(day) : relativeDay(day)) : r.date} · {hhmm(r.start_time)}–{hhmm(r.end_time)}
        </Text>
        <StatusPill r={r} />
      </View>
      <Muted>
        {r.court_name} · {r.club}
      </Muted>
      {others.length > 0 && <Muted>Con {others.join(", ")}</Muted>}
      {!past && <PayLine r={r} />}
      {!past && r.booked_by_me && (
        r.can_cancel ? (
          <Button title="Cancelar reserva" variant="glass" onPress={onCancel ?? (() => {})} loading={cancelling} />
        ) : r.cancel_blocked_reason ? (
          <Muted style={{ fontSize: 13 }}>{r.cancel_blocked_reason}</Muted>
        ) : null
      )}
    </GlassCard>
  );
}

function StatusPill({ r }: { r: MyReservation }) {
  if (r.status === "cancelled") return <Pill label="Cancelada" tone="danger" />;
  if (r.status === "no_show") return <Pill label="No se presentó" tone="danger" />;
  if (r.status === "completed") return <Pill label="Jugada" tone="neutral" />;
  if (r.status === "confirmed") return <Pill label="Confirmada" tone="success" />;
  return <Pill label="Por confirmar" tone="neutral" />;
}

/** Cuánto le toca pagar a este jugador y dónde, en palabras. */
function PayLine({ r }: { r: MyReservation }) {
  if (r.my_pay_status === "paid" || r.payment_status === "paid") {
    return (
      <View style={styles.payRow}>
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <Text style={styles.payText}>Pagada</Text>
      </View>
    );
  }
  if (!r.my_share) return null;
  return (
    <View style={styles.payRow}>
      <Ionicons name="cash-outline" size={16} color={colors.highlight} />
      <Text style={styles.payText}>
        {r.my_pay_method === "venue" ? `Pagas ${money(r.my_share)} en el club` : `Tu parte: ${money(r.my_share)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  cardTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "800" },
  payRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  payText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
});
