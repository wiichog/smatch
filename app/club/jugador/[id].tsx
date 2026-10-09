/**
 * Ficha de un jugador para la cancha (modo club, 2026-10).
 *
 * Lo que se necesita de pie: llamarle o escribirle (WhatsApp ya con el 52 de México), en
 * qué liga y pista va, su próxima jornada y si dijo que va, cómo le fue en las últimas y
 * si tiene reservas por pagar. Editarlo sigue siendo cosa del panel.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { useToast } from "@/components/Toast";
import { Muted, Pill } from "@/components/ui";
import { useClubPlayerCard } from "@/hooks";
import type { ClubPlayerCard } from "@/lib/api";
import { useClubOrg } from "@/lib/clubOrg";
import { parseLocalDate, playedDay, roundShort, shortDate } from "@/lib/format";
import { usePullRefresh } from "@/lib/pullRefresh";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing, TIGHT_FONT_SCALE } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const MOVE: Record<string, { icon: IconName; color: string; verb: string }> = {
  up: { icon: "arrow-up", color: colors.primary, verb: "subió a la pista" },
  down: { icon: "arrow-down", color: colors.warning, verb: "bajó a la pista" },
  stay: { icon: "remove", color: colors.ink400, verb: "se quedó en la pista" },
};

export default function ClubPlayerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = Number(id) > 0 ? Number(id) : null;
  const { orgId } = useClubOrg();
  const card = useClubPlayerCard(orgId, playerId);
  const pull = usePullRefresh(card.refetch);
  const p = card.data;

  return (
    <Screen
      title="Jugador"
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
          <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {card.isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : card.isError && !p ? (
          <LoadError error={card.error} onRetry={() => void card.refetch()} />
        ) : p ? (
          <Ficha p={p} onOpenRound={(roundId) => router.push({ pathname: "/club/round/[id]", params: { id: roundId } })} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Ficha({ p, onOpenRound }: { p: ClubPlayerCard; onOpenRound: (roundId: number) => void }) {
  const toast = useToast();
  const open = (url: string | null, nope: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => toast.show(nope, "error"));
  };
  const chips = [p.category, p.branch].filter(Boolean) as string[];
  const nr = p.next_round;

  return (
    <>
      <GlassCard strong style={styles.header}>
        <Avatar name={p.name} uri={p.avatar_url} size={72} ring />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.name} accessibilityRole="header">
          {p.name}
        </Text>
        <View style={styles.chips}>
          {chips.map((c) => (
            <Pill key={c} label={c} tone="neutral" />
          ))}
          {!p.is_active && <Pill label="Inactivo" tone="danger" />}
          <Pill label={p.has_app ? "Usa la app" : "Sin la app"} tone={p.has_app ? "success" : "neutral"} />
        </View>
        {!!p.birthday && <Muted>🎂 Cumple el {p.birthday}</Muted>}

        <View style={styles.actions}>
          <Action
            icon="call"
            label="Llamar"
            disabled={!p.contact.call_url}
            onPress={() => open(p.contact.call_url, "Este teléfono no puede hacer llamadas.")}
          />
          <Action
            icon="logo-whatsapp"
            label="WhatsApp"
            disabled={!p.contact.whatsapp_url}
            onPress={() => open(p.contact.whatsapp_url, "No se pudo abrir WhatsApp.")}
          />
          <Action
            icon="mail"
            label="Correo"
            disabled={!p.contact.email}
            onPress={() => open(p.contact.email ? `mailto:${p.contact.email}` : null, "No hay app de correo.")}
          />
        </View>
        {!p.contact.phone && !p.contact.email && (
          <Muted style={{ textAlign: "center" }}>No tiene teléfono ni correo capturados: agrégalos desde el panel.</Muted>
        )}
      </GlassCard>

      <SectionHeader title="Próxima jornada" style={styles.section} />
      {nr ? (
        <GlassCard style={styles.card}>
          <Pressable
            onPress={() => onOpenRound(nr.round_id)}
            style={({ pressed }) => [styles.rowBetween, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={`${nr.league}, jornada ${nr.number}. Abrir la hoja`}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle}>
                {nr.league} · Jornada {nr.number}
              </Text>
              <Muted>
                {[roundShort(nr.scheduled_at), `Pista ${nr.court_number} (${nr.position})`].filter(Boolean).join(" · ")}
              </Muted>
              {nr.is_substitute && <Muted>Juega de suplente{nr.substitute_for ? ` por ${nr.substitute_for}` : ""}.</Muted>}
            </View>
            <Pill
              label={nr.availability === "unavailable" ? "No va" : nr.availability === "available" ? "Va" : "Sin confirmar"}
              tone={nr.availability === "unavailable" ? "danger" : nr.availability === "available" ? "success" : "neutral"}
            />
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>
        </GlassCard>
      ) : (
        <Muted>No tiene jornada publicada en los próximos días.</Muted>
      )}

      <SectionHeader title="Ligas" count={p.leagues.length} style={styles.section} />
      {p.leagues.length === 0 ? (
        <Muted>No juega en ninguna liga del club.</Muted>
      ) : (
        <GlassCard style={styles.list}>
          {p.leagues.map((l, i) => (
            <View key={l.league_id}>
              {i > 0 && <View style={styles.hairline} />}
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.rowTitle}>
                    {l.league}
                  </Text>
                  <Muted>
                    {[l.court ? `Pista ${l.court}` : null, `${l.place}.º lugar`, l.active ? null : "liga terminada"]
                      .filter(Boolean)
                      .join(" · ")}
                  </Muted>
                </View>
                <View style={styles.points}>
                  <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.pointsValue}>
                    {l.points}
                  </Text>
                  <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.pointsLabel}>
                    PTS
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </GlassCard>
      )}

      {p.recent.length > 0 && (
        <>
          <SectionHeader title="Últimas jornadas" style={styles.section} />
          <GlassCard style={styles.list}>
            {p.recent.map((m, i) => {
              const mv = MOVE[m.direction] ?? MOVE.stay;
              return (
                <View key={`${m.round_id}`}>
                  {i > 0 && <View style={styles.hairline} />}
                  <View style={styles.rowBetween}>
                    <View style={[styles.moveDot, { backgroundColor: alpha(mv.color, 0.16) }]}>
                      <Ionicons name={mv.icon} size={14} color={mv.color} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.rowTitle}>
                        {m.league} · Jornada {m.number}
                      </Text>
                      <Muted>
                        {capitalizeFirst(`${mv.verb} ${m.to_court}`)}
                        {m.closed_at ? ` · ${playedDay(m.closed_at)}` : ""}
                      </Muted>
                    </View>
                    <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={[styles.delta, m.points < 0 && { color: colors.warning }]}>
                      {m.points > 0 ? `+${m.points}` : m.points}
                    </Text>
                  </View>
                </View>
              );
            })}
          </GlassCard>
        </>
      )}

      {p.reservations && (p.reservations.upcoming > 0 || p.reservations.unpaid > 0 || p.reservations.last_date) && (
        <>
          <SectionHeader title="Reservas" style={styles.section} />
          <GlassCard style={styles.card}>
            <Muted>
              {[
                p.reservations.upcoming
                  ? `${p.reservations.upcoming} ${p.reservations.upcoming === 1 ? "próxima" : "próximas"}`
                  : "Sin reservas próximas",
                p.reservations.unpaid ? `${p.reservations.unpaid} sin pagar` : null,
                p.reservations.last_date ? `última el ${shortDate(parseLocalDate(p.reservations.last_date)!)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Muted>
          </GlassCard>
        </>
      )}
    </>
  );
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Action({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, disabled && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.onPrimary} />
      </View>
      <Text maxFontSizeMultiplier={TIGHT_FONT_SCALE} style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.sm },
  header: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  name: { color: colors.text, fontSize: 22, fontFamily: fonts.display, textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xs },
  actions: { flexDirection: "row", justifyContent: "center", gap: spacing.xl, marginTop: spacing.sm },
  action: { alignItems: "center", gap: 6, minWidth: 64 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },
  section: { marginTop: spacing.md },
  card: { gap: spacing.xs },
  list: { paddingVertical: spacing.xs },
  hairline: { height: 1, backgroundColor: colors.glassBorder },
  rowBetween: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  points: { alignItems: "flex-end" },
  pointsValue: { color: colors.primary, fontSize: 20, fontFamily: fonts.display },
  pointsLabel: { color: colors.textFaint, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  moveDot: { width: 28, height: 28, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  delta: { color: colors.text, fontSize: 15, fontFamily: fonts.displaySemi },
});
