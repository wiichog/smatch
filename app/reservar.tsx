/**
 * Reservar cancha (ticket #30). El jugador ve las canchas de su club, elige día y franja
 * libre, aparta y divide el costo; a los invitados sin cuenta les comparte un link de
 * WhatsApp. El cobro real queda para fase posterior (flag).
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { GlassCard } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { Button, Chip, Label, Muted } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, radius, spacing } from "@/theme";

type Slot = { start_time: string; end_time: string };
type Invite = { name: string; phone: string };

export default function ReservarScreen() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const [courts, setCourts] = useState<any[]>([]);
  const [courtId, setCourtId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [payNow, setPayNow] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.rentalCourts(token).then((r) => setCourts(r.courts ?? [])).catch(() => {});
  }, [token]);

  async function loadSlots() {
    if (!token || !courtId || !date) return;
    setLoadingSlots(true);
    setSlots([]);
    setSlot(null);
    setError(null);
    try {
      const r = await api.courtFreeSlots(token, courtId, date);
      setSlots(r.slots ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function book() {
    if (!token || !courtId || !slot) return;
    setBooking(true);
    setError(null);
    try {
      const r = await api.createReservation(token, {
        court: courtId,
        date,
        start_time: slot.start_time.slice(0, 5),
        end_time: slot.end_time.slice(0, 5),
        pay_method: payNow ? "online" : "online",
        pay_now: payNow,
        participants: invites
          .filter((i) => i.name.trim() || i.phone.trim())
          .map((i) => ({ invited_name: i.name.trim(), invited_phone: i.phone.trim() })),
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBooking(false);
    }
  }

  if (result) {
    return (
      <Screen title="¡Cancha apartada!">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <GlassCard strong style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Ionicons name="checkmark-circle" size={48} color={colors.highlight} />
            <Text style={styles.title}>
              {result.court_name} · {result.date}
            </Text>
            <Muted>
              {result.start_time?.slice(0, 5)}–{result.end_time?.slice(0, 5)} · ${result.total_amount} MXN
            </Muted>
          </GlassCard>

          {(result.invites ?? []).length > 0 && (
            <>
              <Label>Invita por WhatsApp</Label>
              {(result.invites ?? []).map((inv: any, i: number) => (
                <Button
                  key={i}
                  title="Compartir invitación"
                  variant="glass"
                  icon={<Ionicons name="logo-whatsapp" size={18} color={colors.highlight} />}
                  onPress={() => Linking.openURL(inv.whatsapp_url).catch(() => {})}
                />
              ))}
            </>
          )}

          <View style={{ marginTop: spacing.lg }}>
            <Button title="Listo" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen
      title="Reservar cancha"
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Label>Cancha</Label>
        {courts.length === 0 ? (
          <Muted>Tu club aún no tiene canchas para rentar.</Muted>
        ) : (
          <View style={styles.chipRow}>
            {courts.map((c) => (
              <Pressable key={c.id} onPress={() => setCourtId(c.id)}>
                <View style={[styles.courtChip, courtId === c.id && styles.courtChipOn]}>
                  <Text style={[styles.courtChipText, courtId === c.id && { color: colors.onPrimary }]}>
                    {c.name} · ${c.price_per_slot}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Label>Fecha (AAAA-MM-DD)</Label>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={date}
            onChangeText={setDate}
            placeholder="2026-07-10"
            placeholderTextColor={colors.textFaint}
          />
          <Button title="Ver horarios" variant="glass" onPress={loadSlots} disabled={!courtId || !date} />
        </View>

        {loadingSlots && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}
        {slots.length > 0 && (
          <>
            <Label>Horarios libres</Label>
            <View style={styles.chipRow}>
              {slots.map((s) => {
                const on = slot?.start_time === s.start_time;
                return (
                  <Pressable key={s.start_time} onPress={() => setSlot(s)}>
                    <View style={[styles.courtChip, on && styles.courtChipOn]}>
                      <Text style={[styles.courtChipText, on && { color: colors.onPrimary }]}>
                        {s.start_time.slice(0, 5)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {slot && (
          <>
            <Label>Con quién juegas (opcional)</Label>
            <Muted>El costo se divide entre tú y quienes agregues.</Muted>
            {invites.map((inv, i) => (
              <View key={i} style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={inv.name}
                  onChangeText={(t) => setInvites((a) => a.map((x, j) => (j === i ? { ...x, name: t } : x)))}
                  placeholder="Nombre"
                  placeholderTextColor={colors.textFaint}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={inv.phone}
                  onChangeText={(t) => setInvites((a) => a.map((x, j) => (j === i ? { ...x, phone: t } : x)))}
                  placeholder="WhatsApp"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                />
              </View>
            ))}
            <Pressable onPress={() => setInvites((a) => [...a, { name: "", phone: "" }])} style={styles.addRow}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addText}>Agregar jugador</Text>
            </Pressable>
          </>
        )}

        {slot && (
          <>
            <Label>Pago</Label>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable style={{ flex: 1 }} onPress={() => setPayNow(true)}>
                <View style={[styles.courtChip, styles.payChip, payNow && styles.courtChipOn]}>
                  <Text style={[styles.courtChipText, payNow && { color: colors.onPrimary }]}>Pagar ahora</Text>
                </View>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => setPayNow(false)}>
                <View style={[styles.courtChip, styles.payChip, !payNow && styles.courtChipOn]}>
                  <Text style={[styles.courtChipText, !payNow && { color: colors.onPrimary }]}>Pagar después</Text>
                </View>
              </Pressable>
            </View>
            {!payNow && <Muted>Si no pagas, la cancha se libera 2 horas antes del juego.</Muted>}
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {slot && (
          <View style={{ marginTop: spacing.lg }}>
            <Button title="Apartar cancha" onPress={book} loading={booking} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120, gap: spacing.sm },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 4 },
  courtChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  courtChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  payChip: { alignItems: "center" },
  courtChipText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  input: {
    minHeight: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  addText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
});
