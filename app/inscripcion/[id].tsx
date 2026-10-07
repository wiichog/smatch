/**
 * Inscribirse a un torneo con tu pareja (2026-10). Reglas de JL:
 * - la pareja puede ser cualquiera, de preferencia del club (por eso el buscador va
 *   primero y «Otra persona» es la segunda opción);
 * - se paga en el club;
 * - queda inscrita directo (el club se entera por correo y tu pareja por push).
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/Toast";
import { Button, Label, Muted, Segmented, SelectChip } from "@/components/ui";
import { useTournament, useTournamentEnrollment, useTournamentPartners } from "@/hooks";
import type { EnrollResult, TournamentPartner } from "@/lib/api";
import { alpha, colors, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Mode = "club" | "outside";

const MODES: { value: Mode; label: string }[] = [
  { value: "club", label: "Del club" },
  { value: "outside", label: "Otra persona" },
];

export default function EnrollScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tid = Number(id) > 0 ? Number(id) : null;
  const detail = useTournament(tid);
  const { enroll } = useTournamentEnrollment(tid);

  const categories = (detail.data?.categories ?? []).filter((c) => !c.is_mine);
  const [category, setCategory] = useState<number | null>(null);
  // Con una sola categoría disponible no hay nada que elegir.
  const firstOpen = categories.find((c) => !c.is_full)?.id ?? null;
  useEffect(() => {
    if (category == null && firstOpen != null && categories.length === 1) setCategory(firstOpen);
  }, [category, firstOpen, categories.length]);

  const [mode, setMode] = useState<Mode>("club");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(h);
  }, [query]);
  const partners = useTournamentPartners(mode === "club" ? tid : null, debounced, category);
  const [partner, setPartner] = useState<TournamentPartner | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<EnrollResult | null>(null);

  const t = detail.data?.tournament;
  const phoneDigits = phone.replace(/\D/g, "");
  const ready =
    category != null && (mode === "club" ? partner != null : name.trim().length >= 3 && phoneDigits.length >= 10);

  async function submit() {
    if (!ready || category == null) return;
    setError(null);
    try {
      const res = await enroll.mutateAsync(
        mode === "club"
          ? { category, partner_id: partner!.player_id }
          : { category, partner_name: name.trim(), partner_phone: phoneDigits }
      );
      toast.show("¡Quedaron inscritos!");
      setDone(res);
    } catch (e) {
      setError((e as Error).message || "No se pudo inscribir. Intenta de nuevo.");
    }
  }

  if (done) {
    return (
      <Screen title="¡Inscritos!" subtitle={t?.name}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <GlassCard strong style={styles.doneCard}>
            <Ionicons name="trophy" size={44} color={colors.primary} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.doneTitle}>
              {done.category} · con {done.partner}
            </Text>
            <View style={styles.payNote}>
              <Ionicons name="cash-outline" size={18} color={colors.highlight} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.payText}>La inscripción se paga en el club.</Text>
            </View>
            <Muted style={{ textAlign: "center" }}>
              Tu club ya lo sabe. {done.partner_in_club ? "Si tu pareja tiene la app, le llegó un aviso." : ""}
            </Muted>
          </GlassCard>
          {!!done.whatsapp_url && (
            <Button
              title={`Avisar a ${done.partner.split(" ")[0]} por WhatsApp`}
              variant="glass"
              icon={<Ionicons name="logo-whatsapp" size={18} color={colors.highlight} />}
              onPress={() => Linking.openURL(done.whatsapp_url!).catch(() => {})}
            />
          )}
          <Button title="Listo" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen
      title="Inscribirme"
      subtitle={t?.name}
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {detail.isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : detail.isError && !detail.data ? (
          <LoadError error={detail.error} onRetry={() => void detail.refetch()} />
        ) : !t?.enrollment_open ? (
          <GlassCard>
            <Muted>Las inscripciones de este torneo no están abiertas en la app. Habla con tu club.</Muted>
          </GlassCard>
        ) : categories.length === 0 ? (
          <GlassCard>
            <Muted>Ya estás inscrito en todas las categorías de este torneo.</Muted>
          </GlassCard>
        ) : (
          <>
            <Label>Categoría</Label>
            <View style={styles.chipRow}>
              {categories.map((c) => (
                <SelectChip
                  key={c.id}
                  label={c.is_full ? `${c.name} · sin cupo` : c.name}
                  selected={category === c.id}
                  onPress={() => {
                    if (c.is_full) {
                      toast.show("Ya no hay cupo en esa categoría.", "info");
                      return;
                    }
                    setCategory(c.id);
                    setPartner(null);
                  }}
                />
              ))}
            </View>

            <Label>Tu pareja</Label>
            <Segmented options={MODES} value={mode} onChange={(m) => setMode(m)} />

            {mode === "club" ? (
              <>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color={colors.textFaint} />
                  <TextInput
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                    style={styles.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Busca por nombre"
                    placeholderTextColor={colors.textFaint}
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                </View>
                {partners.isLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
                ) : (partners.data?.players ?? []).length === 0 ? (
                  <Muted>
                    {debounced
                      ? `No encontramos a «${debounced}» en tu club. Si no es del club, usa «Otra persona».`
                      : "No hay más jugadores en tu club."}
                  </Muted>
                ) : (
                  <GlassCard style={styles.list}>
                    {(partners.data?.players ?? []).map((p, i) => {
                      const on = partner?.player_id === p.player_id;
                      return (
                        <View key={p.player_id}>
                          {i > 0 && <View style={styles.hairline} />}
                          <Pressable
                            onPress={() => p.available && setPartner(p)}
                            disabled={!p.available}
                            style={[styles.person, on && styles.personOn, !p.available && { opacity: 0.45 }]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on, disabled: !p.available }}
                            accessibilityLabel={`${p.name}${p.available ? "" : ", ya inscrito en esta categoría"}`}
                          >
                            <Avatar name={p.name} uri={p.avatar_url} size={32} />
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.personName}>
                                {p.name}
                              </Text>
                              {(!!p.category || !p.available) && (
                                <Muted numberOfLines={1}>
                                  {p.available ? p.category : "Ya está inscrito en esta categoría"}
                                </Muted>
                              )}
                            </View>
                            {on && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                          </Pressable>
                        </View>
                      );
                    })}
                  </GlassCard>
                )}
              </>
            ) : (
              <>
                <Muted>Si no es del club, lo damos de alta con su WhatsApp para que tu club lo tenga.</Muted>
                <TextInput
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Nombre completo"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="words"
                />
                <TextInput
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="WhatsApp (10 dígitos)"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                />
              </>
            )}

            <View style={styles.payNote}>
              <Ionicons name="cash-outline" size={18} color={colors.highlight} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.payText}>La inscripción se paga en el club.</Text>
            </View>
            {error && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.error}>{error}</Text>}
            <Button
              title={
                mode === "club" && partner
                  ? `Inscribirnos · con ${partner.name.split(" ")[0]}`
                  : "Inscribirnos"
              }
              onPress={submit}
              loading={enroll.isPending}
              disabled={!ready}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120, gap: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: spacing.sm },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginVertical: spacing.xs },
  person: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  personOn: {
    backgroundColor: alpha(colors.primary, 0.1),
    borderRadius: radius.md,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  personName: { color: colors.text, fontSize: 15, fontWeight: "700" },
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
  payNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  payText: { color: colors.text, fontSize: 15, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 13 },
  doneCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  doneTitle: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
});
