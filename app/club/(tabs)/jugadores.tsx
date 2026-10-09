/**
 * Jugadores del club (modo club, 2026-10): encontrar a alguien en la cancha.
 *
 * Buscar por nombre (sin importar acentos) o por teléfono, y abrir su ficha para llamarle
 * o escribirle por WhatsApp. El padrón completo (altas, import, CRM) sigue en el panel.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { ClubSwitcher } from "@/components/ClubSwitcher";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { Muted, Segmented } from "@/components/ui";
import { useClubPlayers } from "@/hooks";
import type { ClubPlayerRow } from "@/lib/api";
import { useClubOrg } from "@/lib/clubOrg";
import { usePullRefresh } from "@/lib/pullRefresh";
import { colors, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Scope = "active" | "all";
const SCOPES: { value: Scope; label: string }[] = [
  { value: "active", label: "Activos" },
  { value: "all", label: "Todos" },
];

export default function ClubPlayersScreen() {
  const router = useRouter();
  const { orgId, membership } = useClubOrg();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("active");
  // Se busca al dejar de teclear, no con cada letra.
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const players = useClubPlayers(orgId, q, scope);
  const pull = usePullRefresh(players.refetch);
  const data = players.data;
  const list = data?.players ?? [];

  return (
    <Screen title="Jugadores" subtitle={membership?.organization_name}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <ClubSwitcher />
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={styles.search}
            value={text}
            onChangeText={setText}
            placeholder="Nombre o teléfono"
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar jugador por nombre o teléfono"
          />
          {!!text && (
            <Pressable onPress={() => setText("")} hitSlop={10} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          )}
        </View>
        <Segmented options={SCOPES} value={scope} onChange={setScope} />

        {players.isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : players.isError && !data ? (
          <LoadError error={players.error} onRetry={() => void players.refetch()} />
        ) : list.length === 0 ? (
          <GlassCard style={styles.empty}>
            <Ionicons name="person-outline" size={30} color={colors.textMuted} />
            <Muted style={{ textAlign: "center" }}>
              {q ? `Nadie coincide con «${q}».` : "Tu club todavía no tiene jugadores."}
            </Muted>
          </GlassCard>
        ) : (
          <>
            <Muted>
              {q
                ? `${data!.count} ${data!.count === 1 ? "coincide" : "coinciden"}`
                : `${data!.count} ${data!.count === 1 ? "jugador" : "jugadores"}`}
            </Muted>
            <GlassCard style={styles.list}>
              {list.map((p, i) => (
                <View key={p.id}>
                  {i > 0 && <View style={styles.hairline} />}
                  <PlayerRow
                    player={p}
                    onPress={() => router.push({ pathname: "/club/jugador/[id]", params: { id: p.id } })}
                  />
                </View>
              ))}
            </GlassCard>
            {data?.next_offset != null && (
              <Muted style={{ textAlign: "center" }}>Hay más: escribe parte del nombre para encontrarlo.</Muted>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PlayerRow({ player, onPress }: { player: ClubPlayerRow; onPress: () => void }) {
  const liga = player.leagues[0];
  const detail = [
    player.category,
    liga ? `${liga.league}${liga.court ? ` · pista ${liga.court}` : ""}` : null,
    player.leagues.length > 1 ? `+${player.leagues.length - 1}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={`${player.name}${detail ? `, ${detail}` : ""}. Ver ficha`}
    >
      <Avatar name={player.name} uri={player.avatar_url} size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          numberOfLines={1}
          style={[styles.name, !player.is_active && { color: colors.textMuted }]}
        >
          {player.name}
        </Text>
        {!!detail && <Muted numberOfLines={1}>{detail}</Muted>}
      </View>
      {!player.is_active ? (
        <Muted style={styles.tag}>Inactivo</Muted>
      ) : !player.has_app ? (
        <Muted style={styles.tag}>Sin app</Muted>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Abajo deja libre la barra de pestañas flotante.
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 140, gap: spacing.sm },
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
  search: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: spacing.sm },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  list: { paddingVertical: spacing.xs },
  hairline: { height: 1, backgroundColor: colors.glassBorder },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: "700" },
  tag: { fontSize: 12 },
});
