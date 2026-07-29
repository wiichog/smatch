import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useBugReport } from "@/components/BugReport";
import { GlassCard, GlassPressable } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { Button, Muted } from "@/components/ui";
import { api } from "@/lib/api";
import { clearPendingRoute } from "@/lib/notifications";
import { unregisterDevice } from "@/lib/push";
import { useAuth } from "@/store/auth";
import { alpha, colors, radius, spacing } from "@/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user, setSession, signOut } = useAuth();
  const bugReport = useBugReport();
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
          <Text style={styles.name}>{user?.name}</Text>
          <Muted>{user?.email}</Muted>
          <Muted style={{ fontSize: 12 }}>Toca tu foto para cambiarla</Muted>
          {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
        </GlassCard>

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
            <Text style={styles.reportTitle}>Editar perfil</Text>
            <Muted>Tu foto, contacto, dirección y datos generales.</Muted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </GlassPressable>

        {/* Reservar cancha */}
        <GlassPressable
          onPress={() => router.push("/reservar")}
          style={styles.reportRow}
          accessibilityLabel="Reservar cancha"
        >
          <View style={styles.reportIcon}>
            <Ionicons name="tennisball" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Reservar cancha</Text>
            <Muted>Aparta una cancha y divide el costo con tus amigos.</Muted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
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
            <Text style={styles.reportTitle}>Impugnaciones</Text>
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
            <Text style={styles.reportTitle}>Reportar un problema</Text>
            <Muted>¿Algo falló? Cuéntanos (o sacude el teléfono).</Muted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </GlassPressable>

        <View style={{ marginTop: spacing.xl }}>
          <Button
            title="Cerrar sesión"
            variant="glass"
            onPress={async () => {
              // Suelta el dispositivo ANTES de tirar el token: si no, este teléfono
              // sigue recibiendo los push del jugador que acaba de salir.
              await unregisterDevice(token);
              signOut();
              // El destino de un push pendiente era de quien acaba de salir: no puede
              // replayearse cuando entre otra persona en este teléfono.
              clearPendingRoute();
              // Y borra la caché: las queryKeys no llevan el id del jugador, así que
              // el siguiente en entrar vería la jornada y el ranking del anterior.
              queryClient.clear();
              router.replace("/login");
            }}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  name: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: spacing.sm },
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
  reportRow: {
    marginTop: spacing.xl,
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
});
