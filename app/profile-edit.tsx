/**
 * Editar mi perfil (ticket #26). El jugador actualiza su foto, contacto, dirección y
 * fecha de nacimiento. Pega a PATCH /api/v2/me/profile/ (no toca club/categoría/ranking).
 */
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Screen } from "@/components/Screen";
import { Button, Label, Muted } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { alpha, colors, radius, spacing } from "@/theme";

type Field = {
  key: string;
  label: string;
  placeholder?: string;
  keyboardType?: "default" | "phone-pad" | "email-address" | "number-pad";
};

const FIELDS: Field[] = [
  { key: "phone", label: "Celular / WhatsApp", keyboardType: "phone-pad", placeholder: "+52 55 1234 5678" },
  { key: "email", label: "Correo de contacto", keyboardType: "email-address" },
  { key: "birth_date", label: "Fecha de nacimiento", placeholder: "AAAA-MM-DD" },
  { key: "address_line", label: "Dirección" },
  { key: "city", label: "Ciudad" },
  { key: "state", label: "Estado" },
  { key: "postal_code", label: "Código postal", keyboardType: "number-pad" },
];

export default function ProfileEditScreen() {
  const router = useRouter();
  const { token, user, setSession } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .profile(token)
      .then((p) =>
        setForm({
          phone: p?.phone ?? "",
          email: p?.email ?? "",
          birth_date: p?.birth_date ?? "",
          address_line: p?.address_line ?? "",
          city: p?.city ?? "",
          state: p?.state ?? "",
          postal_code: p?.postal_code ?? "",
        })
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(form)) {
        // No mandar una fecha vacía (el backend la rechazaría como formato inválido).
        if (k === "birth_date" && !v.trim()) continue;
        fields[k] = v;
      }
      const updated = await api.updateProfile(token, fields, photoUri);
      if (user && updated?.avatar_url) {
        setSession(token, { ...user, avatar_url: updated.avatar_url });
      }
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const avatarSource = photoUri ?? user?.avatar_url ?? null;

  return (
    <Screen
      title="Editar perfil"
      right={
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Cerrar">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.photoRow}>
            <Pressable onPress={pickPhoto} style={styles.avatar} accessibilityLabel="Cambiar foto">
              {avatarSource ? (
                <Image source={{ uri: avatarSource }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={36} color={colors.textMuted} />
              )}
              <View style={styles.camBadge}>
                <Ionicons name="camera" size={14} color={colors.onPrimary} />
              </View>
            </Pressable>
            <Muted>Toca la foto para cambiarla</Muted>
          </View>

          {FIELDS.map((f) => (
            <View key={f.key} style={styles.field}>
              <Label>{f.label}</Label>
              <TextInput
                style={styles.input}
                value={form[f.key] ?? ""}
                onChangeText={(t) => setForm((s) => ({ ...s, [f.key]: t }))}
                placeholder={f.placeholder}
                placeholderTextColor={colors.textFaint}
                keyboardType={f.keyboardType ?? "default"}
                autoCapitalize={f.key === "email" ? "none" : "sentences"}
              />
            </View>
          ))}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={{ marginTop: spacing.md }}>
            <Button title="Guardar cambios" onPress={save} loading={saving} disabled={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 120,
    gap: spacing.md,
  },
  photoRow: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  camBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: 6 },
  input: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },
  error: { color: colors.danger, fontSize: 13 },
});
