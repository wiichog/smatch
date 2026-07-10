/**
 * Reporter de errores de la app (superficie de cliente → SOLO reporta).
 *
 * Provee un contexto global para abrir el modal de reporte desde cualquier pantalla
 * (p. ej. el ícono 🐞 de Perfil) y además escucha "shake-to-report": al sacudir el
 * teléfono se abre el reporte. Captura el contexto automáticamente, permite adjuntar
 * una captura de pantalla y encola el envío si no hay red. El triage NO vive aquí:
 * eso es exclusivo de la consola del superadmin en el panel web.
 */
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Accelerometer } from "expo-sensors";
import * as ImagePicker from "expo-image-picker";
import { usePathname } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { captureContext, enqueueReport, flushQueue } from "@/lib/report";
import { useAuth } from "@/store/auth";
import { alpha, colors, fonts, radius, spacing } from "@/theme";

interface BugReportContextValue {
  open: () => void;
}

const BugReportContext = createContext<BugReportContextValue>({ open: () => {} });

/** Hook para abrir el reporte desde cualquier pantalla (ej. el botón de Perfil). */
export function useBugReport() {
  return useContext(BugReportContext);
}

const SHAKE_THRESHOLD = 1.8; // magnitud en g (reposo ≈ 1)
const SHAKE_COOLDOWN_MS = 1500;

export function BugReportProvider({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const pathname = usePathname();

  const [visible, setVisible] = useState(false);
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setDone(false);
    setQueued(false);
    setError(null);
    setVisible(true);
  }, []);

  function reset() {
    setVisible(false);
    setDescription("");
    setImageUri(null);
    setSending(false);
    setDone(false);
    setQueued(false);
    setError(null);
  }

  // Reintenta enviar lo que quedó en cola al montar (o al cambiar de sesión).
  useEffect(() => {
    if (token) flushQueue(token);
  }, [token]);

  // Shake-to-report: solo con sesión iniciada (el reporte exige jugador vinculado).
  const lastShake = useRef(0);
  useEffect(() => {
    if (!token) return;
    Accelerometer.setUpdateInterval(200);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > SHAKE_THRESHOLD && now - lastShake.current > SHAKE_COOLDOWN_MS) {
        lastShake.current = now;
        if (!visible) open();
      }
    });
    return () => sub.remove();
  }, [token, visible, open]);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  }

  async function submit() {
    if (!token || !description.trim()) return;
    setSending(true);
    setError(null);
    const payload = { ...captureContext(pathname), description: description.trim() };
    try {
      await api.reportBug(token, payload, imageUri);
      flushQueue(token); // aprovecha para vaciar pendientes
      setDone(true);
    } catch {
      // Sin red o error del servidor: encola (sin imagen) y confirma de todos modos.
      await enqueueReport(payload);
      setDone(true);
      setQueued(true);
    } finally {
      setSending(false);
    }
    // NOTA (preparado, sin implementar): cuando el ticket se resuelva, el backend
    // avisará al jugador (push vía support/services/notify.py). Nada que hacer aquí.
  }

  return (
    <BugReportContext.Provider value={{ open }}>
      {children}

      <Modal visible={visible} transparent animationType="slide" onRequestClose={reset}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.backdrop}
        >
          <BlurView intensity={44} tint="dark" style={styles.sheet}>
            <View style={styles.sheetOverlay} />
            <View style={styles.grabber} />
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Ionicons name="bug" size={20} color={colors.primary} />
                <Text style={styles.title}>Reportar un problema</Text>
              </View>
              <Pressable onPress={reset} hitSlop={12} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {done ? (
              <View style={styles.doneBox}>
                <Ionicons name="checkmark-circle" size={48} color={colors.highlight} />
                <Text style={styles.doneTitle}>¡Gracias por avisar!</Text>
                <Text style={styles.doneText}>
                  {queued
                    ? "Guardamos tu reporte y lo enviaremos cuando haya conexión."
                    : "Recibimos tu reporte. Nuestro equipo lo revisará."}
                </Text>
                <Button title="Listo" onPress={reset} />
              </View>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.label}>¿Qué pasó?</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Cuéntanos qué esperabas y qué ocurrió…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  value={description}
                  onChangeText={setDescription}
                />

                <Pressable onPress={pickImage} style={styles.attachRow}>
                  <Ionicons name="image-outline" size={18} color={colors.primary} />
                  <Text style={styles.attachText}>
                    {imageUri ? "Cambiar captura" : "Adjuntar captura (opcional)"}
                  </Text>
                </Pressable>
                {imageUri && <Image source={{ uri: imageUri }} style={styles.thumb} />}

                <Text style={styles.hint}>
                  Adjuntamos automáticamente tu versión de la app y el modelo del equipo.
                </Text>

                {error && <Text style={styles.error}>{error}</Text>}

                <Button
                  title="Enviar reporte"
                  onPress={submit}
                  loading={sending}
                  disabled={!description.trim()}
                />
              </ScrollView>
            )}
          </BlurView>
        </KeyboardAvoidingView>
      </Modal>
    </BugReportContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: "hidden",
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    // Nunca cubrir toda la pantalla: deja el contenido desplazable cuando sube el teclado.
    maxHeight: "88%",
  },
  scroll: { flexShrink: 1 },
  scrollContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  sheetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(colors.ink900, 0.82),
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glassBorder,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.display, letterSpacing: -0.3 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  input: {
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    color: colors.text,
    padding: spacing.md,
    textAlignVertical: "top",
    fontSize: 15,
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  attachText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  error: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm },
  doneBox: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  doneTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  doneText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
