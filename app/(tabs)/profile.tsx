import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useBugReport } from "@/components/BugReport";
import { GlassCard, GlassPressable } from "@/components/Glass";
import { PlayerStatsCard } from "@/components/PlayerStats";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { Button, Label, Muted } from "@/components/ui";
import { useFeedbackAccess, useMyStats } from "@/hooks";
import { api } from "@/lib/api";
import { endSession } from "@/lib/session";
import { useAuth } from "@/store/auth";
import { alpha, colors, MAX_FONT_SCALE, radius, spacing } from "@/theme";

/**
 * Páginas legales y de soporte, que viven en el web. Apple exige que la política de
 * privacidad y la solicitud de borrado de cuenta se alcancen DESDE DENTRO de la app
 * (Guideline 5.1.1), no solo desde la ficha de la tienda.
 */
const LEGAL_LINKS: {
  title: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  url: string;
}[] = [
  {
    title: "Política de privacidad",
    hint: "Qué datos guardamos y para qué los usamos.",
    icon: "shield-checkmark",
    url: "https://www.smatchapp.mx/privacidad",
  },
  {
    title: "Soporte",
    hint: "¿Necesitas ayuda? Escríbenos.",
    icon: "help-buoy",
    url: "https://www.smatchapp.mx/soporte",
  },
  {
    title: "Eliminar mi cuenta",
    hint: "Solicita borrar tu cuenta y tus datos.",
    icon: "trash",
    url: "https://www.smatchapp.mx/eliminar-cuenta",
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user, setSession } = useAuth();
  const bugReport = useBugReport();
  const stats = useMyStats();
  const access = useFeedbackAccess().list;
  const pendingAccess = (access.data?.requests ?? []).filter((r) => r.status === "pending").length;
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Actualizar la foto INLINE desde el tab Perfil (ticket #34): solo foto, sin tocar el
  // resto de campos. Reutiliza api.updateProfile + refresco (setSession + invalidate).
  async function changePhoto() {
    if (!token || uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPhotoError(null);
    setUploading(true);
    try {
      const updated = await api.updateProfile(token, {}, asset.uri, {
        name: asset.fileName,
        type: asset.mimeType,
      });
      if (user && updated?.avatar_url) {
        setSession(token, { ...user, avatar_url: updated.avatar_url });
      }
      queryClient.invalidateQueries();
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen title="Perfil">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero del jugador */}
        <GlassCard strong style={{ marginTop: spacing.sm, alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm }}>
          <Pressable
            onPress={changePhoto}
            disabled={uploading}
            accessibilityLabel="Cambiar foto"
            style={styles.avatarWrap}
          >
            <Avatar name={user?.name} uri={user?.avatar_url} size={88} ring />
            {uploading ? (
              <View style={styles.avatarLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
            <View style={styles.camBadge}>
              <Ionicons name="camera" size={14} color={colors.onPrimary} />
            </View>
          </Pressable>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.name}>{user?.name}</Text>
          {/* En qué club juega, con su categoría y rama (uno por club). */}
          {(stats.data?.clubs ?? []).map((c) => (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} key={c.club} style={styles.club}>
              {[c.club, c.category, c.branch].filter(Boolean).join(" · ")}
            </Text>
          ))}
          {/* Si la sesión no trae nombre, `name` ES el correo: no se repite debajo. */}
          {!!user?.email && user.email !== user?.name && <Muted>{user.email}</Muted>}
          <Muted style={{ fontSize: 12 }}>Toca tu foto para cambiarla</Muted>
          {photoError ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.error}>{photoError}</Text> : null}
        </GlassCard>

        {/* Tus números: partidos, % de victorias, racha, forma, subidas y bajadas. */}
        <SectionHeader title="Tus números" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }} />
        <PlayerStatsCard
          stats={stats.data}
          loading={stats.isLoading}
          failed={stats.isError}
          onRetry={() => void stats.refetch()}
        />

        {/* Acciones del jugador: una lista, no tarjetas sueltas — 8 pt entre filas. */}
        <View style={styles.actions}>
          {/* Editar perfil */}
          <GlassPressable
            onPress={() => router.push("/profile-edit")}
            style={styles.reportRow}
            accessibilityLabel="Editar perfil"
          >
            <View style={styles.reportIcon}>
              <Ionicons name="person-circle" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.reportTitle}>Editar perfil</Text>
              <Muted>Tu foto, contacto, dirección y datos generales.</Muted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </GlassPressable>

          {/* Modo club: solo si la cuenta es staff de algún club (fase 3, 2026-10). */}
          {(user?.memberships?.length ?? 0) > 0 && (
            <GlassPressable
              onPress={() => router.push("/club")}
              style={styles.reportRow}
              accessibilityLabel="Modo club"
            >
              <View style={styles.reportIcon}>
                <Ionicons name="business" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.reportTitle}>Modo club</Text>
                <Muted>Hoy en {user?.memberships?.[0]?.organization_name ?? "tu club"}: jornadas, faltas y reservas.</Muted>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </GlassPressable>
          )}

          {/* Mis reservas: lo apartado, cuánto toca pagar y cancelar */}
          <GlassPressable
            onPress={() => router.push("/reservas")}
            style={styles.reportRow}
            accessibilityLabel="Mis reservas"
          >
            <View style={styles.reportIcon}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.reportTitle}>Mis reservas</Text>
              <Muted>Tus canchas apartadas, lo que pagas y cancelar.</Muted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </GlassPressable>

          {/* Tu bitácora: qué clubes pidieron leerla y quién tiene permiso (2026-10). */}
          <GlassPressable
            onPress={() => router.push("/privacidad")}
            style={styles.reportRow}
            accessibilityLabel={
              pendingAccess > 0 ? `Tu bitácora, ${pendingAccess} solicitud por responder` : "Tu bitácora"
            }
          >
            <View style={styles.reportIcon}>
              <Ionicons name="lock-closed" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.reportTitle}>Tu bitácora</Text>
              <Muted>
                {pendingAccess > 0
                  ? `${pendingAccess === 1 ? "Un club pide" : `${pendingAccess} clubes piden`} leerla: tú decides.`
                  : "Es tuya: un club solo la lee si le das permiso."}
              </Muted>
            </View>
            {pendingAccess > 0 ? (
              <View style={styles.badge}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.badgeText}>{pendingAccess}</Text>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            )}
          </GlassPressable>

          {/* Impugnaciones por votar */}
          <GlassPressable
            onPress={() => router.push("/disputes")}
            style={styles.reportRow}
            accessibilityLabel="Impugnaciones"
          >
            <View style={styles.reportIcon}>
              <Ionicons name="flag" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.reportTitle}>Impugnaciones</Text>
              <Muted>Vota los marcadores impugnados de tus partidos.</Muted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </GlassPressable>

          {/* Reportar un problema */}
          <GlassPressable onPress={bugReport.open} style={styles.reportRow} accessibilityLabel="Reportar un problema">
            <View style={styles.reportIcon}>
              <Ionicons name="bug" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.reportTitle}>Reportar un problema</Text>
              <Muted>¿Algo falló? Cuéntanos (o sacude el teléfono).</Muted>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </GlassPressable>
        </View>

        {/* Ayuda y legal — abren el web en el navegador del sistema */}
        <View style={styles.legalHead}>
          <Label>Ayuda y legal</Label>
        </View>
        {LEGAL_LINKS.map((link) => (
          <GlassPressable
            key={link.url}
            onPress={() => {
              // Best-effort: si el teléfono no puede abrir el navegador, no rompemos la
              // pantalla de perfil por un enlace.
              Linking.openURL(link.url).catch(() => {});
            }}
            style={styles.legalRow}
            // El `open-outline` avisa en pantalla que la fila sale de la app; con lector
            // de pantalla el icono no se anuncia, así que va en el label.
            accessibilityLabel={`${link.title}. Se abre en el navegador.`}
          >
            <View style={styles.reportIcon}>
              <Ionicons name={link.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.reportTitle}>{link.title}</Text>
              <Muted>{link.hint}</Muted>
            </View>
            <Ionicons name="open-outline" size={16} color={colors.textFaint} />
          </GlassPressable>
        ))}

        <View style={{ marginTop: spacing.xl }}>
          <Button
            title="Cerrar sesión"
            variant="glass"
            onPress={() =>
              // Confirmación: el botón queda al final del scroll, donde un toque de más
              // al deslizar te sacaba de la app sin preguntar.
              Alert.alert("¿Cerrar sesión?", "Dejarás de recibir avisos de tu jornada en este teléfono.", [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Cerrar sesión",
                  style: "destructive",
                  onPress: async () => {
                    // Suelta el dispositivo, borra el token de ESTE teléfono en el backend
                    // (el panel sigue abierto) y limpia caché y push pendiente.
                    await endSession(queryClient);
                    router.replace("/login");
                  },
                },
              ])
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  name: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: spacing.sm },
  club: { color: colors.primary, fontSize: 14, fontWeight: "700", textAlign: "center" },
  avatarWrap: { width: 88, height: 88, alignItems: "center", justifyContent: "center" },
  avatarLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.ink900, 0.45),
    alignItems: "center",
    justifyContent: "center",
  },
  camBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs, textAlign: "center" },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  // El grupo legal va más apretado que las filas de acción: son enlaces de referencia,
  // no destinos principales del perfil.
  legalHead: { marginTop: spacing.xl, marginBottom: spacing.xs, paddingHorizontal: spacing.xs },
  legalRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.primary, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  reportTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warning,
  },
  badgeText: { color: colors.ink900, fontSize: 12, fontWeight: "800" },
});
