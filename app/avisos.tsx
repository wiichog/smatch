/**
 * Qué avisos te llegan al celular (2026-10).
 *
 * Por persona y en todos sus teléfonos (se guarda en el servidor, no en este celular).
 * Cada quien ve lo que le aplica: los avisos de jugador si juega en algún club, los del
 * club si es dueño o supervisor. Lo importante no se puede apagar: la jornada publicada,
 * los cambios de alineación, la impugnación que espera tu voto y la bitácora que te piden.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { useToast } from "@/components/Toast";
import { Muted } from "@/components/ui";
import { usePushPreferences } from "@/hooks";
import type { PushCategory } from "@/lib/api";
import { alpha, colors, MAX_FONT_SCALE, spacing } from "@/theme";

const GROUPS: { key: PushCategory["group"]; title: string }[] = [
  { key: "player", title: "Como jugador" },
  { key: "staff", title: "Como club" },
];

export default function PushPreferencesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { list, toggle } = usePushPreferences();
  const categories = list.data?.categories ?? [];

  function change(c: PushCategory, enabled: boolean) {
    toggle.mutate(
      { key: c.key, enabled },
      { onError: (e) => toast.show((e as Error).message || "No se pudo guardar. Intenta de nuevo.", "error") }
    );
  }

  return (
    <Screen
      title="Avisos"
      subtitle="Qué te llega al celular"
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {list.isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : list.isError && !list.data ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <>
            {GROUPS.map((g) => {
              const items = categories.filter((c) => c.group === g.key);
              if (items.length === 0) return null;
              return (
                <View key={g.key} style={{ gap: spacing.sm }}>
                  <SectionHeader title={g.title} style={styles.section} />
                  <GlassCard style={styles.list}>
                    {items.map((c, i) => (
                      <View key={c.key}>
                        {i > 0 && <View style={styles.hairline} />}
                        <View style={styles.row}>
                          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title}>
                              {c.label}
                            </Text>
                            <Muted>{c.description}</Muted>
                          </View>
                          <Switch
                            value={c.enabled}
                            onValueChange={(v) => change(c, v)}
                            trackColor={{ false: colors.ink700, true: alpha(colors.primary, 0.6) }}
                            thumbColor={c.enabled ? colors.primary : colors.ink200}
                            ios_backgroundColor={colors.ink700}
                            accessibilityLabel={c.label}
                            accessibilityHint={c.description}
                          />
                        </View>
                      </View>
                    ))}
                  </GlassCard>
                </View>
              );
            })}
            {categories.some((c) => c.group === "player") && (
              <View style={styles.note}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                <Muted style={{ flex: 1 }}>
                  Siempre te llegan la jornada publicada, los cambios de alineación, la impugnación que espera tu voto y
                  cuando un club pide leer tu bitácora.
                </Muted>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.md },
  section: { marginTop: spacing.sm },
  list: { paddingVertical: spacing.xs },
  hairline: { height: 1, backgroundColor: colors.glassBorder },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  title: { color: colors.text, fontSize: 15, fontWeight: "700" },
  note: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.sm },
});
