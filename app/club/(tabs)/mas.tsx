/**
 * «Más» del modo club (2026-10): lo que no es de todos los días.
 *
 * Qué avisos te llegan, volver al modo jugador (si juegas), sumarte como jugador de tu
 * club (el dueño que también juega), abrir el panel completo y cerrar sesión. Antes todo
 * esto colgaba al fondo del «Hoy», debajo de las reservas.
 */
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ClubSwitcher } from "@/components/ClubSwitcher";
import { GlassCard } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/Toast";
import { Button, Muted } from "@/components/ui";
import { useClubToday } from "@/hooks";
import { api } from "@/lib/api";
import { ROLE_LABEL, useClubOrg } from "@/lib/clubOrg";
import { HOME_ROUTE } from "@/lib/routes";
import { endSession } from "@/lib/session";
import { isClubOnly, toAuthUser, useAuth } from "@/store/auth";
import { colors, MAX_FONT_SCALE, radius, spacing } from "@/theme";

const PANEL_URL = "https://www.smatchapp.mx/portal/admin";

type IconName = keyof typeof Ionicons.glyphMap;

export default function ClubMoreScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);
  const { orgId, membership } = useClubOrg();
  const data = useClubToday(orgId).data;

  function askSignOut() {
    Alert.alert("¿Cerrar sesión?", "Tendrás que volver a entrar con tu correo y contraseña.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await endSession(queryClient);
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <Screen
      title="Más"
      subtitle={[membership?.organization_name, membership ? ROLE_LABEL[membership.role] ?? membership.role : null]
        .filter(Boolean)
        .join(" · ")}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <ClubSwitcher />

        <GlassCard style={styles.list}>
          <Row
            icon="notifications-outline"
            title="Avisos"
            hint="Elige qué avisos te llegan al celular."
            onPress={() => router.push("/avisos")}
          />
          {!isClubOnly(user) && (
            <>
              <View style={styles.hairline} />
              <Row
                icon="tennisball-outline"
                title="Modo jugador"
                hint="Tu jornada, tu liga y tus números."
                onPress={() => router.replace(HOME_ROUTE)}
              />
            </>
          )}
          <View style={styles.hairline} />
          <Row
            icon="open-outline"
            title="Abrir el panel completo"
            hint="Ligas, jugadores, torneos y caja se administran ahí."
            onPress={() => Linking.openURL(PANEL_URL).catch(() => {})}
          />
        </GlassCard>

        {data && orgId != null && data.can_edit && !data.club.is_demo && !playsIn(user, orgId) && (
          <JoinAsPlayerCard key={orgId} orgId={orgId} clubName={data.club.name} />
        )}

        <View style={styles.footer}>
          {!!user?.email && <Muted style={{ textAlign: "center" }}>Entraste como {user.email}</Muted>}
          <Button title="Cerrar sesión" variant="glass" onPress={askSignOut} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, title, hint, onPress }: { icon: IconName; title: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle}>
          {title}
        </Text>
        <Muted>{hint}</Muted>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

/** ¿Ya juega en este club? Sin `player_orgs` (sesión de antes de 2026-10) no se sabe en
 *  cuál juega, así que solo se ofrece a quien no juega en ninguno. */
function playsIn(user: ReturnType<typeof useAuth.getState>["user"], orgId: number): boolean {
  if (user?.player_orgs) return user.player_orgs.includes(orgId);
  return (user?.players_count ?? 0) > 0;
}

/**
 * El dueño o supervisor que también juega (2026-10): se suma como jugador de su club con
 * esta misma cuenta, sin invitación ni otra contraseña. Antes no había forma: su correo
 * ya era una cuenta y la invitación de jugador se negaba.
 */
function JoinAsPlayerCard({ orgId, clubName }: { orgId: number; clubName: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { token, user, setSession } = useAuth();
  const looksLikeName = !!user?.name && !user.name.includes("@");
  const [name, setName] = useState(looksLikeName ? user!.name : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await api.joinAsPlayer(token, orgId, name.trim());
      // La sesión se relee para que la app sepa que ya juega (y le ofrezca el modo jugador).
      const me = await api.me(token);
      setSession(token, toAuthUser(me.user));
      void queryClient.invalidateQueries();
      toast.show(`¡Listo! Ya eres jugador de ${clubName}. Cambia de modo con «Modo jugador».`);
    } catch (e) {
      setError((e as Error).message || "No se pudo. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard style={styles.joinCard}>
      <View style={styles.rowIcon}>
        <Ionicons name="tennisball" size={18} color={colors.primary} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.rowTitle}>
          ¿También juegas en {clubName}?
        </Text>
      </View>
      <Muted>
        Súmate como jugador con esta misma cuenta: verás tu jornada, tu liga y tus números, sin otra cuenta ni
        invitación.
      </Muted>
      <TextInput
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={styles.input}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="Tu nombre como jugador"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="words"
        returnKeyType="go"
        onSubmitEditing={() => name.trim().length >= 3 && !busy && void join()}
        accessibilityLabel="Tu nombre como jugador"
      />
      {!!error && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.error}>{error}</Text>}
      <Button title="Sumarme como jugador" onPress={join} loading={busy} disabled={name.trim().length < 3} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  // Abajo deja libre la barra de pestañas flotante.
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 140, gap: spacing.md },
  list: { paddingVertical: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  rowIcon: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  hairline: { height: 1, backgroundColor: colors.glassBorder },
  joinCard: { gap: spacing.sm },
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
  error: { color: colors.danger, fontSize: 13 },
  footer: { marginTop: spacing.md, gap: spacing.sm },
});
