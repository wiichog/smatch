/**
 * Modo club (fase 3, 2026-10): cubrir el lugar de quien dijo «No voy».
 *
 * Los sugeridos vienen en el orden del motor de jornadas: su misma categoría primero y
 * luego ranking parecido (los de la liga antes que los de fuera). Se busca por nombre a
 * cualquiera activo del club. Con la jornada publicada, el backend les avisa por push al
 * suplente y a quien sale, y por correo al suplente; en borrador se enteran al publicar.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/Toast";
import { Muted } from "@/components/ui";
import { useClubActions, useSubstituteCandidates } from "@/hooks";
import type { SubstituteCandidates } from "@/lib/api";
import { colors, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Candidate = SubstituteCandidates["candidates"][number];

export default function CoverSpotScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ round: string; slot: string }>();
  const roundId = Number(params.round) > 0 ? Number(params.round) : null;
  const slotId = Number(params.slot) > 0 ? Number(params.slot) : null;

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(h);
  }, [query]);

  const list = useSubstituteCandidates(roundId, slotId, debounced);
  const { substitute } = useClubActions();
  const slot = list.data?.slot;
  const candidates = list.data?.candidates ?? [];

  function choose(c: Candidate) {
    if (!slot || roundId == null || slotId == null) return;
    Alert.alert(
      `¿${c.name} cubre a ${slot.player}?`,
      `Juega en la pista ${slot.court_number} y se rehacen los partidos de esa pista. ${
        list.data?.round_status === "draft"
          ? "Se entera cuando publiques la jornada."
          : "Le avisamos por push y correo, y a quien sale también."
      }`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () =>
            substitute.mutate(
              { roundId, slotId, substituteId: c.player_id },
              {
                onSuccess: () => {
                  toast.show(`${c.name.split(" ")[0]} cubre la pista ${slot.court_number}.`);
                  router.back();
                },
                onError: (e) => toast.show((e as Error).message || "No se pudo asignar.", "error"),
              }
            ),
        },
      ]
    );
  }

  return (
    <Screen
      title="Cubrir lugar"
      subtitle={slot ? `Pista ${slot.court_number} · ${slot.position} · ${slot.player}` : undefined}
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
        {slot && (
          <Muted>
            {slot.player} avisó que no va. Primero van los de {slot.category ? `su categoría (${slot.category})` : "su categoría"} y
            nivel parecido en la liga.
          </Muted>
        )}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Busca a alguien del club"
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {list.isLoading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
        ) : list.isError && !list.data ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : candidates.length === 0 ? (
          <Muted>
            {debounced
              ? `No encontramos a «${debounced}» entre los que pueden jugar (activos, fuera de esta jornada y sin «No voy»).`
              : "No hay nadie más disponible en el club para esta jornada."}
          </Muted>
        ) : (
          <GlassCard style={styles.list}>
            {candidates.map((c, i) => (
              <View key={c.player_id}>
                {i > 0 && <View style={styles.hairline} />}
                <Pressable
                  onPress={() => choose(c)}
                  disabled={substitute.isPending}
                  style={({ pressed }) => [styles.person, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, ${detail(c)}`}
                >
                  <Avatar name={c.name} uri={c.avatar_url} size={34} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.personName}>
                      {c.name}
                    </Text>
                    <Muted numberOfLines={1}>{detail(c)}</Muted>
                  </View>
                  {c.same_category && <Ionicons name="checkmark-circle-outline" size={18} color={colors.highlight} />}
                </Pressable>
              </View>
            ))}
          </GlassCard>
        )}
      </ScrollView>
    </Screen>
  );
}

function detail(c: Candidate): string {
  const liga = c.in_league ? `En la liga · ${c.points ?? 0} pts` : "Fuera de la liga";
  return [c.category, liga].filter(Boolean).join(" · ");
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.sm },
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
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: spacing.sm },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  hairline: { height: 1, backgroundColor: colors.glassBorder, marginVertical: spacing.xs },
  person: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  personName: { color: colors.text, fontSize: 15, fontWeight: "700" },
});
