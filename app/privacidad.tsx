/**
 * Tu bitácora y quién la lee (2026-10, decisión de JL).
 *
 * La bitácora (comentario, experiencia y foto de cada jornada) es del jugador. Un club
 * solo la lee si se lo permites: aquí llegan sus solicitudes —también por push— y aquí
 * se quita el permiso cuando quieras. Al club le llega un correo con lo que decidas.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { useToast } from "@/components/Toast";
import { Button, Muted } from "@/components/ui";
import { useFeedbackAccess } from "@/hooks";
import type { FeedbackAccessRequest } from "@/lib/api";
import { playedDay } from "@/lib/format";
import { usePullRefresh } from "@/lib/pullRefresh";
import { colors, MAX_FONT_SCALE, spacing } from "@/theme";

export default function PrivacyScreen() {
  const router = useRouter();
  const toast = useToast();
  const { list, decide } = useFeedbackAccess();
  const pull = usePullRefresh(list.refetch);
  const requests = list.data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");

  function act(r: FeedbackAccessRequest, decision: "approve" | "reject" | "revoke") {
    const done = {
      approve: `${r.club} ya puede leer tu bitácora.`,
      reject: `Listo: ${r.club} no la leerá.`,
      revoke: `${r.club} ya no puede leer tu bitácora.`,
    }[decision];
    decide.mutate(
      { id: r.id, decision },
      {
        onSuccess: () => toast.show(done),
        onError: (e) => toast.show((e as Error).message || "No se pudo guardar. Intenta de nuevo.", "error"),
      }
    );
  }

  function askRevoke(r: FeedbackAccessRequest) {
    Alert.alert(`¿Quitarle el permiso a ${r.club}?`, "Dejará de ver tu bitácora desde ahora.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Quitar permiso", style: "destructive", onPress: () => act(r, "revoke") },
    ]);
  }

  return (
    <Screen
      title="Tu bitácora"
      subtitle="Quién puede leerla"
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
        <View style={styles.intro}>
          <Ionicons name="lock-closed" size={18} color={colors.primary} />
          <Muted style={{ flex: 1 }}>
            Lo que escribes de cada jornada es tuyo. Tu club solo lo lee si le das permiso, y puedes quitárselo cuando
            quieras.
          </Muted>
        </View>

        {list.isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : list.isError && !list.data ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : requests.length === 0 ? (
          <GlassCard>
            <Muted>Ningún club ha pedido leer tu bitácora.</Muted>
          </GlassCard>
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <SectionHeader title="Te lo piden" count={pending.length} style={styles.section} />
                {pending.map((r) => (
                  <GlassCard key={r.id} strong style={styles.card}>
                    <ClubLine r={r} when={`Lo pidió ${dayPhrase(r.requested_at)}`} />
                    {!!r.message && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.message}>«{r.message}»</Text>}
                    <View style={styles.buttons}>
                      <View style={{ flex: 1 }}>
                        <Button title="No permitir" variant="glass" onPress={() => act(r, "reject")} disabled={decide.isPending} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button title="Permitir" onPress={() => act(r, "approve")} loading={decide.isPending} />
                      </View>
                    </View>
                  </GlassCard>
                ))}
              </>
            )}
            {approved.length > 0 && (
              <>
                <SectionHeader title="Pueden leerla" count={approved.length} style={styles.section} />
                {approved.map((r) => (
                  <GlassCard key={r.id} style={styles.card}>
                    <ClubLine
                      r={r}
                      when={r.responded_at ? `Le diste permiso ${dayPhrase(r.responded_at)}` : "Tiene permiso"}
                    />
                    <Button title="Quitar permiso" variant="glass" onPress={() => askRevoke(r)} disabled={decide.isPending} />
                  </GlassCard>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** «hoy», «ayer» o «el mié 7 oct»: se lee bien después de «Lo pidió». */
function dayPhrase(iso: string): string {
  const d = playedDay(iso);
  if (!d) return "";
  return d === "Hoy" || d === "Ayer" ? d.toLowerCase() : `el ${d.toLowerCase()}`;
}

function ClubLine({ r, when }: { r: FeedbackAccessRequest; when: string }) {
  return (
    <View style={styles.clubLine}>
      <Avatar name={r.club} uri={r.logo_url} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1} style={styles.club}>
          {r.club}
        </Text>
        <Muted>{when}</Muted>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 80, gap: spacing.sm },
  intro: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", marginBottom: spacing.xs },
  section: { marginTop: spacing.md },
  card: { gap: spacing.sm },
  clubLine: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  club: { color: colors.text, fontSize: 16, fontWeight: "800" },
  message: { color: colors.text, fontSize: 15, fontStyle: "italic" },
  buttons: { flexDirection: "row", gap: spacing.sm },
});
