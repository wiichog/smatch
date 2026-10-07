/**
 * Modo club (fase 3, 2026-10): «Hoy en tu club» para el dueño o administrador.
 *
 * Antes la app le cerraba la puerta al staff («esta app es para jugadores»). Aquí ve,
 * desde el celular y en la cancha, lo que tiene que resolver: qué jornadas vienen y qué
 * lugares hay que cubrir porque alguien dijo «No voy», cuántos marcadores faltan,
 * jornadas en borrador sin publicar, impugnaciones abiertas y las reservas de hoy.
 *
 * Y lo resuelve ahí mismo (si es dueño o supervisor; el Lector solo mira): cubrir un
 * lugar con suplente, capturar marcadores y publicar un borrador desde la hoja de la
 * jornada (`club/round/[id]`), y cobrar una reserva. Todo va a las mismas rutas del panel.
 */
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { Button, Label, Muted, Pill, SelectChip } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useClubActions, useClubToday } from "@/hooks";
import type { ClubToday, PayMethod } from "@/lib/api";
import { money, roundShort } from "@/lib/format";
import { usePullRefresh } from "@/lib/pullRefresh";
import { HOME_ROUTE } from "@/lib/routes";
import { clearPendingRoute } from "@/lib/notifications";
import { unregisterDevice } from "@/lib/push";
import { isClubOnly, useAuth } from "@/store/auth";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing } from "@/theme";

const PANEL_URL = "https://www.smatchapp.mx/portal/admin";

// Como los nombra el panel: el «admin» del club es el Supervisor (ticket #26).
const ROLE: Record<string, string> = { owner: "Dueño", admin: "Supervisor", viewer: "Lector" };

export default function ClubScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user, signOut } = useAuth();
  const memberships = user?.memberships ?? [];
  const [orgId, setOrgId] = useState<number | null>(memberships[0]?.organization_id ?? null);
  const today = useClubToday(orgId);
  const pull = usePullRefresh(today.refetch);
  const data = today.data;
  const role = memberships.find((m) => m.organization_id === orgId)?.role;

  function askSignOut() {
    Alert.alert("¿Cerrar sesión?", "Tendrás que volver a entrar con tu correo y contraseña.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await unregisterDevice(token);
          signOut();
          clearPendingRoute();
          queryClient.clear();
          router.replace("/login");
        },
      },
    ]);
  }

  if (memberships.length === 0) {
    return (
      <Screen title="Tu club">
        <View style={styles.content}>
          <GlassCard>
            <Muted>Tu cuenta no administra ningún club.</Muted>
          </GlassCard>
          <Button title="Volver" onPress={() => router.replace(HOME_ROUTE)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      title="Hoy en tu club"
      subtitle={[data?.club.name, role ? ROLE[role] ?? role : null].filter(Boolean).join(" · ")}
      right={
        !isClubOnly(user) ? (
          <Pressable
            onPress={() => router.replace(HOME_ROUTE)}
            hitSlop={10}
            style={styles.modeBtn}
            accessibilityRole="button"
            accessibilityLabel="Cambiar a modo jugador"
          >
            <Ionicons name="tennisball" size={16} color={colors.primary} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.modeText}>Jugador</Text>
          </Pressable>
        ) : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {memberships.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
            {memberships.map((m) => (
              <SelectChip
                key={m.organization_id}
                label={m.organization_name}
                selected={m.organization_id === orgId}
                onPress={() => setOrgId(m.organization_id)}
              />
            ))}
          </ScrollView>
        )}

        {today.isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : today.isError && !data ? (
          <LoadError error={today.error} onRetry={() => void today.refetch()} />
        ) : data ? (
          <Today data={data} />
        ) : null}

        <View style={styles.footer}>
          <Button
            title="Abrir el panel completo"
            variant="glass"
            icon={<Ionicons name="open-outline" size={16} color={colors.text} />}
            onPress={() => Linking.openURL(PANEL_URL).catch(() => {})}
          />
          <Muted style={{ textAlign: "center" }}>
            Ligas, jugadores, torneos y caja se administran en el panel.
          </Muted>
          <Button title="Cerrar sesión" variant="glass" onPress={askSignOut} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const PAY_METHODS: { method: PayMethod; label: string }[] = [
  { method: "cash", label: "Efectivo" },
  { method: "card", label: "Tarjeta" },
  { method: "transfer", label: "Transferencia" },
];

function Today({ data }: { data: ClubToday }) {
  const router = useRouter();
  const toast = useToast();
  const { pay } = useClubActions();
  const canEdit = !!data.can_edit;
  const porCubrir = data.rounds.reduce((n, r) => n + r.needs_substitute.length, 0);
  let index = 0;
  const next = () => ++index;

  const openRound = (roundId: number) => router.push({ pathname: "/club/round/[id]", params: { id: roundId } });
  const cover = (roundId: number, slotId: number) =>
    router.push({ pathname: "/club/suplente", params: { round: roundId, slot: slotId } });

  function askPay(r: ClubToday["reservations"][number]) {
    // Con un pago parcial se cobra solo lo que falta: el total ya no es lo que entra.
    const partial = r.payment_status === "partial";
    Alert.alert(
      partial ? "Cobrar lo que falta" : `Cobrar ${money(r.total)}`,
      `${r.court} · ${r.start_time}–${r.end_time}${r.customer ? ` · ${r.customer}` : ""}. ${
        partial ? `Ya hay un pago parcial de los ${money(r.total)}; se cobra el resto` : "Se cobra completa"
      } y entra a la caja si está abierta.`,
      [
        ...PAY_METHODS.map((m) => ({
          text: m.label,
          onPress: () =>
            pay.mutate(
              { orgId: data.club.id, reservationId: r.id, method: m.method },
              {
                onSuccess: () => toast.show(`Cobrada en ${m.label.toLowerCase()}.`),
                onError: (e) => toast.show((e as Error).message || "No se pudo cobrar.", "error"),
              }
            ),
        })),
        { text: "Cancelar", style: "cancel" as const },
      ]
    );
  }

  return (
    <>
      {/* Lo urgente, de un vistazo: qué hay que resolver. Con 4 cifras va en 2×2: en
          una fila «IMPUGNACIONES» no cabe y se partía a la mitad de la palabra. */}
      <GlassCard strong style={styles.summary}>
        {summaryItems(data, porCubrir).map((item, _i, all) => (
          <Summary key={item.label} {...item} width={all.length === 4 ? "50%" : `${100 / all.length}%`} />
        ))}
      </GlassCard>

      {data.sections.leagues && (
        <>
          <SectionHeader index={next()} title="Jornadas" count={data.rounds.length} style={styles.section} />
          {data.rounds.length === 0 ? (
            <Muted>No hay jornadas publicadas en los próximos 7 días.</Muted>
          ) : (
            data.rounds.map((r) => (
              <GlassCard key={r.round_id} style={styles.card}>
                <Pressable
                  onPress={() => openRound(r.round_id)}
                  style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.league}, jornada ${r.number}. Ver pistas y marcadores`}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Label>{`${r.league} · Jornada ${r.number}`}</Label>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.when}>
                      {roundShort(r.scheduled_at) || "Sin fecha"}
                    </Text>
                  </View>
                  {r.in_play && <Pill label="En juego" tone="success" />}
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </Pressable>
                <Muted>{roundFacts(r)}</Muted>
                {r.needs_substitute.length > 0 && (
                  <View style={styles.subBox}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subTitle}>
                      Lugares por cubrir
                    </Text>
                    {r.needs_substitute.map((n) => (
                      <View key={n.slot_id} style={styles.subRow}>
                        <Ionicons name="alert-circle" size={14} color={colors.warning} />
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.subText} numberOfLines={1}>
                          Pista {n.court_number} · {n.position} — {n.player}
                        </Text>
                        {canEdit && (
                          <Pressable
                            onPress={() => cover(r.round_id, n.slot_id)}
                            style={styles.coverBtn}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`Cubrir el lugar de ${n.player}`}
                          >
                            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.coverText}>
                              Cubrir
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                )}
                {r.scores.total > 0 && (
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { flex: r.scores.captured }]} />
                      <View style={{ flex: Math.max(r.scores.total - r.scores.captured, 0) }} />
                    </View>
                    <Muted>
                      {r.scores.captured} de {r.scores.total} marcadores
                    </Muted>
                  </View>
                )}
              </GlassCard>
            ))
          )}

          {data.draft_rounds.length > 0 && (
            <GlassCard style={styles.card}>
              <View style={styles.rowIcon}>
                <Ionicons name="eye-off-outline" size={18} color={colors.warning} />
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle}>
                  {data.draft_rounds.length === 1 ? "1 jornada en borrador" : `${data.draft_rounds.length} jornadas en borrador`}
                </Text>
              </View>
              <Muted>Los jugadores no las ven hasta que las publiques.{canEdit ? " Revísala y publícala desde aquí." : ""}</Muted>
              {data.draft_rounds.map((d) => (
                <Pressable
                  key={d.round_id}
                  onPress={() => openRound(d.round_id)}
                  style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.league}, jornada ${d.number} en borrador. Revisar`}
                >
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.linkText}>
                    {d.league} · Jornada {d.number}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
              ))}
            </GlassCard>
          )}

          <SectionHeader index={next()} title="Impugnaciones abiertas" count={data.open_disputes.length} style={styles.section} />
          {data.open_disputes.length === 0 ? (
            <Muted>Ninguna. Todos los marcadores están en paz.</Muted>
          ) : (
            <GlassCard style={styles.list}>
              {data.open_disputes.map((d, i) => (
                <View key={d.id}>
                  {i > 0 && <View style={styles.hairline} />}
                  <Pressable
                    onPress={d.round_id ? () => openRound(d.round_id!) : undefined}
                    disabled={!d.round_id}
                    style={({ pressed }) => [styles.disputeRow, pressed && { opacity: 0.6 }]}
                    accessibilityRole={d.round_id ? "button" : undefined}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle}>
                        {d.league} · J{d.round_number} · Pista {d.court_number} · Partido {d.match_number}
                      </Text>
                      <Muted>
                        {d.raised_by ? `${d.raised_by} propone ${d.proposed}` : `Propuesto: ${d.proposed}`}. La deciden los
                        jugadores de la pista.
                      </Muted>
                    </View>
                    {!!d.round_id && <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />}
                  </Pressable>
                </View>
              ))}
            </GlassCard>
          )}
        </>
      )}

      {data.sections.rentals && (
        <>
          <SectionHeader index={next()} title="Reservas de hoy" count={data.reservations.length} style={styles.section} />
          {data.reservations.length === 0 ? (
            <Muted>Nadie ha reservado cancha hoy.</Muted>
          ) : (
            <GlassCard style={styles.list}>
              {data.reservations.map((r, i) => (
                <View key={r.id}>
                  {i > 0 && <View style={styles.hairline} />}
                  <View style={styles.resRow}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.resTime}>
                      {r.start_time}
                    </Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.rowTitle}>
                        {r.court}
                        {r.customer ? ` · ${r.customer}` : ""}
                      </Text>
                      <Muted>
                        {r.start_time}–{r.end_time} · {money(r.total)}
                      </Muted>
                    </View>
                    {r.payment_status === "paid" ? (
                      <Pill label="Pagada" tone="success" />
                    ) : canEdit && r.payment_status !== "refunded" ? (
                      <Pressable
                        onPress={() => askPay(r)}
                        style={styles.payBtn}
                        hitSlop={6}
                        disabled={pay.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={`Cobrar ${money(r.total)} de ${r.court} a las ${r.start_time}`}
                      >
                        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.payText}>
                          Cobrar
                        </Text>
                      </Pressable>
                    ) : (
                      <Pill label={r.payment_status === "refunded" ? "Reembolsada" : "Por cobrar"} tone="neutral" />
                    )}
                  </View>
                </View>
              ))}
            </GlassCard>
          )}
        </>
      )}

      {!data.sections.leagues && !data.sections.rentals && (
        <GlassCard>
          <Muted>Tu acceso en este club no incluye ligas ni reservas. Revisa tus permisos con el dueño.</Muted>
        </GlassCard>
      )}
      {data.club.is_demo && (
        <View style={styles.demo}>
          <Avatar name="Demo" size={18} />
          <Muted>Club de demostración: los datos son de prueba.</Muted>
        </View>
      )}
    </>
  );
}

function roundFacts(r: ClubToday["rounds"][number]): string {
  const parts = [`${r.courts} ${r.courts === 1 ? "pista" : "pistas"}`, `${r.players} jugadores`];
  if (r.declined) parts.push(`${r.declined} no ${r.declined === 1 ? "va" : "van"}`);
  if (r.substitutes) parts.push(`${r.substitutes} ${r.substitutes === 1 ? "suplente" : "suplentes"}`);
  if (!r.declined && !r.substitutes) parts.push("nadie ha avisado que falta");
  return parts.join(" · ");
}

type SummaryItem = { value: number; label: string; hint?: string; tone?: string };

function summaryItems(data: ClubToday, porCubrir: number): SummaryItem[] {
  const items: SummaryItem[] = [
    { value: data.rounds.length, label: data.rounds.length === 1 ? "JORNADA" : "JORNADAS", hint: "7 días" },
    { value: porCubrir, label: "POR CUBRIR", tone: porCubrir ? colors.warning : undefined },
    {
      value: data.open_disputes.length,
      label: "IMPUGNACIONES",
      tone: data.open_disputes.length ? colors.warning : undefined,
    },
  ];
  if (data.sections.rentals) items.push({ value: data.reservations.length, label: "RESERVAS HOY" });
  return items;
}

function Summary({ value, label, hint, tone, width }: SummaryItem & { width: `${number}%` }) {
  return (
    <View
      style={[styles.sumItem, { width }]}
      accessible
      accessibilityLabel={`${value} ${label.toLowerCase()}${hint ? `, ${hint}` : ""}`}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.sumValue, tone ? { color: tone } : null]}>
        {value}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2} style={styles.sumLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 60, gap: spacing.sm },
  chipsScroll: { marginHorizontal: -spacing.lg },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  modeBtn: {
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
  modeText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  summary: { flexDirection: "row", flexWrap: "wrap", rowGap: spacing.md },
  sumItem: { gap: 2, paddingRight: spacing.sm },
  sumValue: { color: colors.text, fontSize: 26, fontFamily: fonts.display },
  sumLabel: { color: colors.textFaint, fontSize: 9, letterSpacing: 1.1, fontWeight: "700" },
  section: { marginTop: spacing.md },
  card: { gap: spacing.xs },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  when: { color: colors.text, fontSize: 17, fontWeight: "800" },
  subBox: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.warning, 0.1),
    gap: 4,
  },
  subTitle: { color: colors.warning, fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  subText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  coverBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.warning, 0.18),
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.5),
  },
  coverText: { color: colors.warning, fontSize: 13, fontWeight: "800" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  linkText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  disputeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  payBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.primary, 0.16),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.5),
  },
  payText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  progressRow: { gap: 4, marginTop: spacing.xs },
  progressTrack: { flexDirection: "row", height: 6, borderRadius: radius.full, overflow: "hidden", backgroundColor: colors.glassStrong },
  progressFill: { backgroundColor: colors.primary },
  rowIcon: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginVertical: spacing.xs },
  resRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  resTime: { width: 48, color: colors.primary, fontSize: 15, fontFamily: fonts.displaySemi },
  footer: { marginTop: spacing.xl, gap: spacing.sm },
  demo: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
});
