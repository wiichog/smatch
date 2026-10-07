/**
 * Modo club (fase 3, 2026-10): «Hoy en tu club» para el dueño o administrador.
 *
 * Antes la app le cerraba la puerta al staff («esta app es para jugadores»). Aquí ve,
 * desde el celular y en la cancha, lo que tiene que resolver: qué jornadas vienen y qué
 * lugares hay que cubrir porque alguien dijo «No voy», cuántos marcadores faltan,
 * jornadas en borrador sin publicar, impugnaciones abiertas y las reservas de hoy.
 * Solo lectura: para actuar (asignar suplente, capturar, publicar) abre el panel.
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
import { useClubToday } from "@/hooks";
import type { ClubToday } from "@/lib/api";
import { money, roundShort } from "@/lib/format";
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
          <RefreshControl refreshing={today.isRefetching} onRefresh={today.refetch} tintColor={colors.primary} colors={[colors.primary]} />
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
            Asignar suplentes, capturar marcadores y publicar jornadas se hace en el panel.
          </Muted>
          <Button title="Cerrar sesión" variant="glass" onPress={askSignOut} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Today({ data }: { data: ClubToday }) {
  const porCubrir = data.rounds.reduce((n, r) => n + r.needs_substitute.length, 0);
  let index = 0;
  const next = () => ++index;

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
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Label>{`${r.league} · Jornada ${r.number}`}</Label>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.when}>
                      {roundShort(r.scheduled_at) || "Sin fecha"}
                    </Text>
                  </View>
                  {r.in_play && <Pill label="En juego" tone="success" />}
                </View>
                <Muted>
                  {r.courts} {r.courts === 1 ? "pista" : "pistas"} · {r.players} jugadores
                  {r.declined ? ` · ${r.declined} no ${r.declined === 1 ? "va" : "van"}` : " · nadie ha avisado que falta"}
                </Muted>
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
              <Muted>
                {data.draft_rounds.map((d) => `${d.league} · J${d.number}`).join(", ")}. Los jugadores no las ven hasta
                que las publiques.
              </Muted>
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
                  <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle}>
                    {d.league} · J{d.round_number} · Pista {d.court_number} · Partido {d.match_number}
                  </Text>
                  <Muted>
                    {d.raised_by ? `${d.raised_by} propone ${d.proposed}` : `Propuesto: ${d.proposed}`}
                  </Muted>
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
                    <Pill
                      label={r.payment_status === "paid" ? "Pagada" : "Por cobrar"}
                      tone={r.payment_status === "paid" ? "success" : "neutral"}
                    />
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
  subText: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
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
