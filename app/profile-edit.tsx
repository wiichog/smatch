/**
 * Editar mi perfil (ticket #26). El jugador actualiza su foto, contacto, dirección y
 * fecha de nacimiento. Pega a PATCH /api/v2/me/profile/ (no toca club/categoría/ranking).
 */
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
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
  { key: "birth_date", label: "Fecha de nacimiento", placeholder: "AAAA-MM-DD (o dd/mm/aaaa)" },
  { key: "address_line", label: "Dirección" },
  { key: "city", label: "Ciudad" },
  { key: "state", label: "Estado" },
  { key: "postal_code", label: "Código postal", keyboardType: "number-pad" },
];

/**
 * Normaliza la fecha de nacimiento a ISO `YYYY-MM-DD` antes de enviarla al backend
 * (`DateField`, que rechaza cualquier otro formato con 400). Acepta lo que ya viene ISO
 * y los formatos comunes dd/mm/aaaa y dd-mm-aaaa. Vacío → no enviar (sin error).
 * Inválido → error inline y NO se manda (para no abortar el guardado de lo demás).
 */
function normalizeBirthDate(raw: string): { value?: string; error?: string } {
  const s = (raw ?? "").trim();
  if (!s) return {};
  let y: number, mo: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (iso) {
    y = Number(iso[1]);
    mo = Number(iso[2]);
    d = Number(iso[3]);
  } else if (dmy) {
    d = Number(dmy[1]);
    mo = Number(dmy[2]);
    y = Number(dmy[3]);
  } else {
    return { error: "Usa el formato AAAA-MM-DD." };
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const valid =
    dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  const currentYear = new Date().getFullYear();
  if (!valid || y < 1900 || y > currentYear) return { error: "Fecha inválida." };
  const pad = (n: number) => String(n).padStart(2, "0");
  return { value: `${y}-${pad(mo)}-${pad(d)}` };
}

/** Valida el correo del lado del cliente. Vacío → no enviar; inválido → error inline. */
function normalizeEmail(raw: string): { value?: string; error?: string } {
  const s = (raw ?? "").trim();
  if (!s) return {};
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  return ok ? { value: s } : { error: "Correo inválido." };
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { token, user, setSession } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{ name?: string | null; type?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      // Guarda fileName/mimeType del asset para armar un multipart robusto (ticket #33).
      setPhotoMeta({ name: asset.fileName, type: asset.mimeType });
    }
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);

    // Validación defensiva del lado del cliente (ticket #36): un dato textual malo
    // (fecha o correo) NUNCA debe abortar el guardado de la foto ni del resto.
    const nextFieldErrors: Record<string, string> = {};
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      if (k === "birth_date") {
        const r = normalizeBirthDate(v);
        if (r.error) nextFieldErrors.birth_date = r.error;
        else if (r.value) fields.birth_date = r.value; // vacío → no se envía
        continue;
      }
      if (k === "email") {
        const r = normalizeEmail(v);
        if (r.error) nextFieldErrors.email = r.error;
        else if (r.value) fields.email = r.value; // vacío → no se envía
        continue;
      }
      fields[k] = v;
    }
    setFieldErrors(nextFieldErrors);

    try {
      const updated = await api.updateProfile(token, fields, photoUri, photoMeta ?? undefined);
      if (user && updated?.avatar_url) {
        setSession(token, { ...user, avatar_url: updated.avatar_url });
      }
      // Refresca los avatares servidos por react-query (compañeros/rivales, dashboard,
      // próxima jornada) tras actualizar la foto/perfil (ticket #33).
      queryClient.invalidateQueries();
      if (Object.keys(nextFieldErrors).length > 0) {
        // Guardamos lo válido (incl. la foto), pero dejamos el error marcado por campo.
        setError("Guardamos tu foto y los campos válidos. Revisa los campos marcados.");
      } else {
        router.back();
      }
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
              {/* El clip circular envuelve SOLO la foto: así el badge de cámara no se
                  recorta al salir del borde del círculo (ticket #37). */}
              <View style={styles.avatarClip}>
                {avatarSource ? (
                  <Image source={{ uri: avatarSource }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={36} color={colors.textMuted} />
                )}
              </View>
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
                style={[styles.input, fieldErrors[f.key] ? styles.inputError : null]}
                value={form[f.key] ?? ""}
                onChangeText={(t) => {
                  setForm((s) => ({ ...s, [f.key]: t }));
                  // Limpia el error inline en cuanto el usuario corrige el campo.
                  if (fieldErrors[f.key]) setFieldErrors((e) => ({ ...e, [f.key]: "" }));
                }}
                placeholder={f.placeholder}
                placeholderTextColor={colors.textFaint}
                keyboardType={f.keyboardType ?? "default"}
                autoCapitalize={f.key === "email" ? "none" : "sentences"}
              />
              {fieldErrors[f.key] ? <Text style={styles.error}>{fieldErrors[f.key]}</Text> : null}
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
    // Contenedor exterior SIN overflow:hidden → deja ver el badge de cámara completo.
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarClip: {
    // Círculo visible que recorta la foto (el overflow vive aquí, no en el contenedor).
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
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13 },
});
