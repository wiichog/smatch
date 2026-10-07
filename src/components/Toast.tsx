import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { alpha, colors, glassShadow, MAX_FONT_SCALE, radius, spacing } from "@/theme";

type Tone = "success" | "info" | "error";
type ToastState = { id: number; message: string; tone: Tone } | null;

const ToastContext = createContext<{ show: (message: string, tone?: Tone) => void }>({
  // No-op por defecto: una pantalla fuera del provider (fallback de error) no truena.
  show: () => {},
});

/** `const toast = useToast(); toast.show("Guardado")`. */
export function useToast() {
  return useContext(ToastContext);
}

const ICON: Record<Tone, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { name: "checkmark-circle", color: colors.primary },
  info: { name: "information-circle", color: colors.highlight },
  error: { name: "alert-circle", color: colors.danger },
};

/**
 * Aviso breve de vidrio arriba de la pantalla: confirma que algo se guardó o falló sin
 * bloquear (un `Alert` obliga a tocar «OK» por cada acción). Uno a la vez; el nuevo
 * reemplaza al anterior.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: Tone = "success") => {
    if (tone === "error") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
    if (timer.current) clearTimeout(timer.current);
    // Un error se queda más: hay que leerlo y entender qué hacer; un «Guardado» se entiende de un vistazo.
    const visibleMs = toast.tone === "error" ? 4500 : 2600;
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
        setToast((t) => (t?.id === toast.id ? null : t))
      );
    }, visibleMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, anim]);

  const icon = toast ? ICON[toast.tone] : ICON.success;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.wrap,
            {
              top: insets.top + spacing.sm,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            },
          ]}
        >
          <BlurView intensity={50} tint="dark" style={styles.blur}>
            <View style={styles.row}>
              <Ionicons name={icon.name} size={20} color={icon.color} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.text}>{toast.message}</Text>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.lg,
    ...glassShadow,
  },
  blur: { borderRadius: radius.lg, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: alpha(colors.ink800, 0.7),
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.lg,
  },
  text: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
});
