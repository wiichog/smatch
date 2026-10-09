/**
 * Agenda del club (modo club, 2026-10): qué pasa en las canchas, un día a la vez.
 *
 * La misma fuente que el Calendario del panel (reservas, jornadas, clases, torneos y
 * canchas cerradas), acomodada para leerse de pie: la tira de días con cuántas cosas hay
 * en cada uno y, del día elegido, todo en orden de hora. Desde aquí se cobra una reserva
 * y se abre la hoja de una jornada. El Lector ve lo mismo sin botones.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ClubSwitcher } from "@/components/ClubSwitcher";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { Muted, Pill } from "@/components/ui";
import { useClubAgenda } from "@/hooks";
import type { AgendaItem } from "@/lib/api";
import { useChargeReservation } from "@/lib/clubCharge";
import { useClubOrg } from "@/lib/clubOrg";
import { capitalize, money, parseLocalDate, relativeDay, shortDayLabel } from "@/lib/format";
import { usePullRefresh } from "@/lib/pullRefresh";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing, TIGHT_FONT_SCALE } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const KIND: Record<string, { icon: IconName; color: string; label: string }> = {
  league: { icon: "trophy-outline", color: colors.primary, label: "Jornada" },
  reservation: { icon: "tennisball-outline", color: colors.highlight, label: "Reserva" },
  lesson: { icon: "school-outline", color: "#B98CFF", label: "Clase" },
  tournament: { icon: "medal-outline", color: colors.warning, label: "Torneo" },
  maintenance: { icon: "construct-outline", color: colors.ink400, label: "Mantenimiento" },
  blocked: { icon: "lock-closed-outline", color: colors.ink400, label: "Cancha cerrada" },
};

export default function ClubAgendaScreen() {
  const router = useRouter();
  const { orgId, membership, memberships, setOrgId } = useClubOrg();
  // `null` = hoy (lo decide el servidor, con la fecha del club).
  const [date, setDate] = useState<string | null>(null);
  // El aviso de una reserva abre la agenda de ESE club en ESE día.
  const params = useLocalSearchParams<{ date?: string; org?: string }>();
  useEffect(() => {
    if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) setDate(params.date);
  }, [params.date]);
  useEffect(() => {
    const club = memberships.find((m) => m.organization_id === Number(params.org));
    if (club) setOrgId(club.organization_id);
  }, [params.org, memberships, setOrgId]);
  const agenda = useClubAgenda(orgId, date);
  const pull = usePullRefresh(agenda.refetch);
  const charge = useChargeReservation(orgId);
  const data = agenda.data;
  const selected = date ?? data?.today ?? null;
  const day = parseLocalDate(selected);
  // Mientras llega el día nuevo se ve el anterior (placeholder): no se mezclan.
  const items = data && data.date === selected ? data.items : [];
  const switching = !!data && data.date !== selected;

  return (
    <Screen title="Agenda" subtitle={membership?.organization_name}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <ClubSwitcher />

        {data && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll} contentContainerStyle={styles.strip}>
            {data.days.map((d) => {
              const on = d.date === selected;
              const fecha = parseLocalDate(d.date);
              return (
                <Pressable
                  key={d.date}
                  onPress={() => setDate(d.date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${fecha ? capitalize(relativeDay(fecha)) : d.date}: ${
                    d.count ? `${d.count} ${d.count === 1 ? "cosa" : "cosas"}` : "nada agendado"
                  }`}
                  style={[styles.dayChip, on && styles.dayChipOn]}
                >
                  <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={[styles.dayLabel, on && styles.dayLabelOn]}>
                    {fecha ? shortDayLabel(fecha) : d.date}
                  </Text>
                  <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={[styles.dayCount, on && styles.dayLabelOn]}>
                    {d.count || "–"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {!!day && (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.dayTitle} accessibilityRole="header">
            {capitalize(relativeDay(day))}
          </Text>
        )}

        {agenda.isLoading || switching ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : agenda.isError && !data ? (
          <LoadError error={agenda.error} onRetry={() => void agenda.refetch()} />
        ) : items.length === 0 ? (
          <GlassCard style={styles.empty}>
            <Ionicons name="calendar-clear-outline" size={32} color={colors.textMuted} />
            <Muted style={{ textAlign: "center" }}>Nada agendado este día: ni reservas, ni jornadas, ni clases.</Muted>
          </GlassCard>
        ) : (
          <GlassCard style={styles.list}>
            {items.map((it, i) => (
              <View key={`${it.kind}-${it.id}-${it.start}`}>
                {i > 0 && <View style={styles.hairline} />}
                <AgendaRow
                  item={it}
                  onOpen={
                    it.kind === "league" && it.can_open && it.round_id
                      ? () => router.push({ pathname: "/club/round/[id]", params: { id: it.round_id! } })
                      : undefined
                  }
                  onCharge={
                    it.can_pay && it.id != null
                      ? () =>
                          charge.ask({
                            id: it.id!,
                            court: it.court,
                            start: it.start,
                            end: it.end,
                            customer: it.title,
                            total: it.total ?? "0",
                            payment_status: it.payment_status ?? "pending",
                          })
                      : undefined
                  }
                  chargeBusy={charge.busy}
                />
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </Screen>
  );
}

function AgendaRow({
  item,
  onOpen,
  onCharge,
  chargeBusy,
}: {
  item: AgendaItem;
  onOpen?: () => void;
  onCharge?: () => void;
  chargeBusy: boolean;
}) {
  const kind = KIND[item.kind] ?? { icon: "ellipse-outline" as IconName, color: colors.ink400, label: "" };
  const detail =
    item.kind === "reservation"
      ? [item.court, item.total ? money(item.total) : null].filter(Boolean).join(" · ")
      : [item.subtitle, item.court].filter(Boolean).join(" · ");
  // Con quién juega la reserva (los participantes), si no es solo quien la hizo.
  const people = item.kind === "reservation" && item.subtitle && item.subtitle !== item.title ? item.subtitle : "";

  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      style={({ pressed }) => [styles.row, pressed && onOpen ? { opacity: 0.6 } : null]}
      accessibilityRole={onOpen ? "button" : undefined}
      accessibilityLabel={`${item.start} a ${item.end}. ${kind.label}: ${item.title}. ${detail}`}
    >
      <View style={styles.timeCol}>
        <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.time}>
          {item.start}
        </Text>
        <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.timeEnd}>
          {item.end}
        </Text>
      </View>
      <View style={[styles.kindDot, { backgroundColor: alpha(kind.color, 0.16) }]}>
        <Ionicons name={kind.icon} size={16} color={kind.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.title}>
          {item.title}
        </Text>
        {!!detail && <Muted numberOfLines={1}>{detail}</Muted>}
        {!!people && (
          <Muted numberOfLines={1} style={{ fontSize: 12 }}>
            {people}
          </Muted>
        )}
      </View>
      {item.kind === "reservation" && item.payment_status ? (
        item.payment_status === "paid" ? (
          <Pill label="Pagada" tone="success" />
        ) : onCharge ? (
          <Pressable
            onPress={onCharge}
            disabled={chargeBusy}
            style={styles.payBtn}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Cobrar ${money(item.total)} de ${item.title}`}
          >
            <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.payText}>
              Cobrar
            </Text>
          </Pressable>
        ) : (
          <Pill label={item.payment_status === "refunded" ? "Reembolsada" : "Por cobrar"} tone="neutral" />
        )
      ) : onOpen ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Abajo deja libre la barra de pestañas flotante.
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 140, gap: spacing.sm },
  stripScroll: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  strip: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 4 },
  dayChip: {
    minWidth: 64,
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    gap: 2,
  },
  dayChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  dayCount: { color: colors.textMuted, fontSize: 15, fontFamily: fonts.displaySemi },
  dayLabelOn: { color: colors.onPrimary },
  dayTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.display, marginTop: spacing.sm },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  list: { paddingVertical: spacing.xs },
  hairline: { height: 1, backgroundColor: colors.glassBorder },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  timeCol: { width: 48, alignItems: "flex-start" },
  time: { color: colors.primary, fontSize: 15, fontFamily: fonts.displaySemi },
  timeEnd: { color: colors.textFaint, fontSize: 11, fontWeight: "600" },
  kindDot: { width: 30, height: 30, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 15, fontWeight: "700" },
  payBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.primary, 0.16),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.5),
  },
  payText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
});
