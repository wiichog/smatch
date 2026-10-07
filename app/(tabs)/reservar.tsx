/**
 * Reservar cancha (ticket #30). El jugador elige día, cancha y horario libre, aparta y
 * divide el costo; a los invitados les avisa por WhatsApp. Se paga EN EL CLUB: la app
 * todavía no cobra con tarjeta, y ofrecer «pagar ahora» sin pedir una tarjeta dejaba la
 * reserva pendiente y el cron la cancelaba dos horas antes del juego.
 *
 * Es pestaña desde 2026-10 (antes una pantalla escondida en Perfil). La barra la esconde
 * si el club no renta canchas; la ruta sigue siendo `/reservar`.
 */
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { Button, Label, Muted } from "@/components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRentalCourts } from "@/hooks";
import { api, type FreeSlot } from "@/lib/api";
import { capitalize, duration, hhmm, isoDate, longDay, money, nextDays, shortDayLabel } from "@/lib/format";
import { TAB_BAR_HEIGHT, tabBarBottom } from "@/lib/tabBar";
import { useAuth } from "@/store/auth";
import { colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Invite = { name: string; phone: string };

// Dos semanas: lo que un club suele abrir para apartar, y cabe en una tira deslizable.
const DAYS_AHEAD = 14;

export default function ReservarScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuth((s) => s.token);
  const days = useMemo(() => nextDays(DAYS_AHEAD), []);
  const rental = useRentalCourts();
  const courts = rental.data?.courts ?? [];
  // Quien juega en dos clubes ve las canchas de los dos: con dos «Cancha 1» hay que
  // decir de qué club es cada una.
  const multiClub = new Set(courts.map((c) => c.organization_id ?? 0)).size > 1;
  const courtLabel = (c: { name: string; club?: string }) => (multiClub && c.club ? `${c.name} · ${c.club}` : c.name);
  const loadingCourts = rental.isLoading;
  const [courtId, setCourtId] = useState<number | null>(null);
  const [day, setDay] = useState<Date>(days[0]);
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [slot, setSlot] = useState<FreeSlot | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sube al apartar: vuelve a pedir los horarios (el que se apartó ya no está libre).
  const [reload, setReload] = useState(0);
  // Al elegir el PRIMER horario, la pantalla baja sola al resumen (precio y duración):
  // el resumen nace debajo de los horarios, fuera de la vista.
  const scrollRef = useRef<ScrollView>(null);
  const scrollToSummary = useRef(false);
  // El botón de apartar va fijo encima de la barra de pestañas: dentro del scroll se
  // quedaba debajo de ella en cuanto la pantalla crecía (al agregar jugadores).
  const insets = useSafeAreaInsets();
  const footerBottom = tabBarBottom(insets.bottom) + TAB_BAR_HEIGHT + spacing.sm;

  // La primera cancha va preseleccionada (con una sola no hay nada que elegir).
  const firstCourtId = courts[0]?.id ?? null;
  useEffect(() => {
    if (firstCourtId != null) setCourtId((id) => id ?? firstCourtId);
  }, [firstCourtId]);

  // Los horarios se cargan solos al cambiar día o cancha (antes había que teclear la
  // fecha y tocar «Ver horarios»). La guarda `alive` descarta la respuesta de un cambio
  // anterior si el jugador ya tocó otro día.
  const dayIso = isoDate(day);
  useEffect(() => {
    if (!token || !courtId) return;
    let alive = true;
    setLoadingSlots(true);
    setSlots([]);
    setSlot(null);
    setError(null);
    api
      .courtFreeSlots(token, courtId, dayIso)
      .then((r) => alive && setSlots(r.slots ?? []))
      .catch((e) => alive && setError((e as Error).message))
      .finally(() => alive && setLoadingSlots(false));
    return () => {
      alive = false;
    };
  }, [token, courtId, dayIso, reload]);

  const court = courts.find((c) => c.id === courtId);
  const price = slot?.price ?? court?.price_per_slot ?? null;
  const people = 1 + invites.filter((i) => i.name.trim() || i.phone.trim()).length;
  const perPerson = price != null && people > 1 ? Number(price) / people : null;

  async function book() {
    if (!token || !courtId || !slot) return;
    setBooking(true);
    setError(null);
    try {
      const r = await api.createReservation(token, {
        court: courtId,
        date: dayIso,
        start_time: hhmm(slot.start_time),
        end_time: hhmm(slot.end_time),
        pay_method: "venue",
        participants: invites
          .filter((i) => i.name.trim() || i.phone.trim())
          .map((i) => ({ invited_name: i.name.trim(), invited_phone: i.phone.trim(), pay_method: "venue" })),
      });
      void queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBooking(false);
    }
  }

  if (result) {
    const myShare = result.participants?.[0]?.share_amount ?? result.total_amount;
    const invited: { participant_id: number; whatsapp_url: string }[] = result.invites ?? [];
    const nameOf = (participantId: number) =>
      (result.participants ?? []).find((p: any) => p.id === participantId)?.invited_name || "tu invitado";
    return (
      <Screen title="¡Cancha apartada!">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <GlassCard strong style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title}>{result.court_name}</Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subtitle}>
              {capitalize(longDay(day))} · {hhmm(result.start_time)}–{hhmm(result.end_time)}
            </Text>
            <View style={styles.payNote}>
              <Ionicons name="cash-outline" size={18} color={colors.highlight} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.payNoteText}>Pagas {money(myShare)} en el club</Text>
            </View>
          </GlassCard>

          {invited.length > 0 && (
            <>
              <Label>Avisa a quienes juegan contigo</Label>
              <Muted>Les llega tu invitación con el día, la hora y su parte.</Muted>
              {invited.map((inv) => (
                <Button
                  key={inv.participant_id}
                  title={`Avisar a ${nameOf(inv.participant_id)}`}
                  variant="glass"
                  icon={<Ionicons name="logo-whatsapp" size={18} color={colors.highlight} />}
                  onPress={() => Linking.openURL(inv.whatsapp_url).catch(() => {})}
                />
              ))}
            </>
          )}

          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            {/* Es pestaña: «Listo» deja el formulario limpio para apartar otra. */}
            <Button
              title="Listo"
              onPress={() => {
                setResult(null);
                setSlot(null);
                setInvites([]);
                setReload((n) => n + 1);
              }}
            />
            <Button title="Ver mis reservas" variant="glass" onPress={() => router.push("/reservas")} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen
      title="Reservar"
      subtitle="Aparta una cancha y divide el costo"
      right={
        <Pressable
          onPress={() => router.push("/reservas")}
          hitSlop={10}
          style={styles.myLink}
          accessibilityRole="button"
          accessibilityLabel="Mis reservas"
        >
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.myLinkText}>Mis reservas</Text>
        </Pressable>
      }
    >
      <ScrollView
        ref={scrollRef}
        // Con el botón fijo abajo, el final de la lista necesita aire extra para no quedar
        // escondido detrás de él.
        contentContainerStyle={[styles.content, slot ? { paddingBottom: 120 + 72 } : null]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {loadingCourts ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : rental.isError && !rental.data ? (
          <LoadError error={rental.error} onRetry={() => void rental.refetch()} style={{ marginTop: spacing.md }} />
        ) : courts.length === 0 ? (
          <GlassCard style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Ionicons name="tennisball-outline" size={36} color={colors.textMuted} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title}>Tu club aún no renta canchas</Text>
            <Muted style={{ textAlign: "center" }}>Cuando abra la renta desde la app, aparecerán aquí.</Muted>
          </GlassCard>
        ) : (
          <>
            <Label>Día</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
              {days.map((d) => {
                const on = isoDate(d) === dayIso;
                return (
                  <Pressable key={isoDate(d)} onPress={() => setDay(d)} accessibilityState={{ selected: on }}>
                    <View style={[styles.chip, styles.dayChip, on && styles.chipOn]}>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.chipText, on && styles.chipTextOn]}>{shortDayLabel(d)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {courts.length > 1 && (
              <>
                <Label>Cancha</Label>
                <View style={styles.chipRow}>
                  {courts.map((c) => {
                    const on = courtId === c.id;
                    return (
                      <Pressable key={c.id} onPress={() => setCourtId(c.id)} accessibilityState={{ selected: on }}>
                        <View style={[styles.chip, on && styles.chipOn]}>
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.chipText, on && styles.chipTextOn]}>{courtLabel(c)}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            <Label>Horario</Label>
            {loadingSlots ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : slots.length === 0 ? (
              <Muted>
                No quedan horarios libres {shortDayLabel(day) === "Hoy" ? "hoy" : `el ${longDay(day)}`}
                {court ? ` en ${courtLabel(court)}` : ""}. Prueba otro día{courts.length > 1 ? " u otra cancha" : ""}.
              </Muted>
            ) : (
              <View style={styles.chipRow}>
                {slots.map((s) => {
                  const on = slot?.start_time === s.start_time;
                  return (
                    <Pressable
                      key={s.start_time}
                      onPress={() => {
                        if (!slot) scrollToSummary.current = true;
                        setSlot(s);
                      }}
                      accessibilityState={{ selected: on }}
                    >
                      <View style={[styles.chip, on && styles.chipOn]}>
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.chipText, on && styles.chipTextOn]}>{hhmm(s.start_time)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {slot && (
              <>
                {/* Resumen de lo que va a apartar: dónde, cuándo, cuánto dura y cuánto cuesta. */}
                <View
                  style={{ marginTop: spacing.md }}
                  onLayout={(e) => {
                    if (!scrollToSummary.current) return;
                    scrollToSummary.current = false;
                    scrollRef.current?.scrollTo({ y: Math.max(e.nativeEvent.layout.y - spacing.sm, 0), animated: true });
                  }}
                >
                <GlassCard strong style={{ gap: 4 }}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.summaryTitle}>
                    {court?.name} · {capitalize(longDay(day))}
                  </Text>
                  <Muted>
                    {hhmm(slot.start_time)}–{hhmm(slot.end_time)}
                    {duration(slot.start_time, slot.end_time) ? ` (${duration(slot.start_time, slot.end_time)})` : ""}
                  </Muted>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.price}>{money(price)}</Text>
                  {perPerson != null && (
                    <Muted>
                      Entre {people} personas: {money(perPerson)} cada quien
                    </Muted>
                  )}
                </GlassCard>
                </View>

                <Label>¿Con quién juegas? (opcional)</Label>
                <Muted>El costo se divide entre tú y quienes agregues. Les avisas por WhatsApp.</Muted>
                {invites.map((inv, i) => (
                  <View key={i} style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, alignItems: "center" }}>
                    <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={[styles.input, { flex: 1 }]}
                      value={inv.name}
                      onChangeText={(t) => setInvites((a) => a.map((x, j) => (j === i ? { ...x, name: t } : x)))}
                      placeholder="Nombre"
                      placeholderTextColor={colors.textFaint}
                    />
                    <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE}
                      style={[styles.input, { flex: 1 }]}
                      value={inv.phone}
                      onChangeText={(t) => setInvites((a) => a.map((x, j) => (j === i ? { ...x, phone: t } : x)))}
                      placeholder="WhatsApp"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="phone-pad"
                    />
                    <Pressable
                      onPress={() => setInvites((a) => a.filter((_, j) => j !== i))}
                      hitSlop={10}
                      accessibilityLabel="Quitar jugador"
                    >
                      <Ionicons name="close-circle" size={22} color={colors.textFaint} />
                    </Pressable>
                  </View>
                ))}
                {invites.length < 3 && (
                  <Pressable onPress={() => setInvites((a) => [...a, { name: "", phone: "" }])} style={styles.addRow}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.addText}>Agregar jugador</Text>
                  </Pressable>
                )}

                <View style={styles.payNote}>
                  <Ionicons name="cash-outline" size={18} color={colors.highlight} />
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.payNoteText}>Se paga en el club el día del juego.</Text>
                </View>
              </>
            )}

            {error && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.error}>{error}</Text>}
          </>
        )}
      </ScrollView>
      {slot && (
        <View style={[styles.footer, { bottom: footerBottom }]} pointerEvents="box-none">
          <Button title={`Apartar cancha · ${money(price)}`} onPress={book} loading={booking} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120, gap: spacing.sm },
  title: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  subtitle: { color: colors.textMuted, fontSize: 15 },
  summaryTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  price: { color: colors.primary, fontSize: 30, fontFamily: fonts.display, marginTop: 4 },
  dayStrip: { gap: spacing.sm, paddingVertical: 4, paddingRight: spacing.lg },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: 4 },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: "center",
  },
  dayChip: { minWidth: 64, alignItems: "center" },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  chipTextOn: { color: colors.onPrimary },
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
  payNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  payNoteText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  footer: { position: "absolute", left: spacing.lg, right: spacing.lg },
  myLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
  },
  myLinkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
});
