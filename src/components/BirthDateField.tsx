/**
 * Fecha de nacimiento con ruedas de día, mes y año (2026-10).
 *
 * Antes era un campo de texto libre «dd/mm/aaaa»: el teclado numérico no trae «/», cada
 * quien la escribía distinto y el error llegaba hasta guardar. Aquí no se teclea nada:
 * se gira día, mes y año en una hoja de vidrio (la misma del reporte de problemas).
 *
 * JS puro a propósito: un selector nativo pide recompilar la app. La rueda es un
 * ScrollView que se asienta en cada renglón; con VoiceOver cada columna es «ajustable»
 * (deslizar arriba/abajo cambia el valor).
 */
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { alpha, colors, fonts, MAX_FONT_SCALE, radius, spacing, TIGHT_FONT_SCALE } from "@/theme";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const ROW = 44;
const VISIBLE = 5; // dos arriba, el elegido y dos abajo
const FIRST_YEAR = 1920;
/** Sin fecha guardada la rueda arranca aquí, no en 1920 ni en el año actual. */
const DEFAULT_YEAR = 1990;

type Ymd = { y: number; m: number; d: number }; // m: 1-12

function parseIso(iso?: string | null): Ymd | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return r ? { y: Number(r[1]), m: Number(r[2]), d: Number(r[3]) } : null;
}

function toIso({ y, m, d }: Ymd): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${pad(m)}-${pad(d)}`;
}

function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** «3 de enero de 1978». */
export function longBirthDate(iso?: string | null): string {
  const v = parseIso(iso);
  return v ? `${v.d} de ${MONTHS[v.m - 1]} de ${v.y}` : "";
}

export function BirthDateField({
  value,
  onChange,
  error,
}: {
  /** ISO `YYYY-MM-DD` o "" si no hay fecha. */
  value: string;
  onChange: (iso: string) => void;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const label = longBirthDate(value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, error ? styles.fieldError : null]}
        accessibilityRole="button"
        accessibilityLabel={label ? `Fecha de nacimiento: ${label}` : "Fecha de nacimiento, sin capturar"}
        accessibilityHint="Abre el selector de fecha"
      >
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.fieldText, !label && styles.placeholder]}
          numberOfLines={1}
        >
          {label || "Elige tu fecha"}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
      </Pressable>
      {open && (
        <DateSheet
          initial={parseIso(value)}
          onClose={() => setOpen(false)}
          onDone={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function DateSheet({
  initial,
  onClose,
  onDone,
}: {
  initial: Ymd | null;
  onClose: () => void;
  onDone: (iso: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const lastYear = new Date().getFullYear() - 3; // nadie de 2 años juega una liga
  const [y, setY] = useState(Math.min(Math.max(initial?.y ?? DEFAULT_YEAR, FIRST_YEAR), lastYear));
  const [m, setM] = useState(initial?.m ?? 1);
  const [d, setD] = useState(initial?.d ?? 1);

  const years = useMemo(() => {
    const out: string[] = [];
    for (let i = FIRST_YEAR; i <= lastYear; i++) out.push(String(i));
    return out;
  }, [lastYear]);
  const max = daysIn(y, m);
  const days = useMemo(() => Array.from({ length: max }, (_, i) => String(i + 1)), [max]);

  // 31 de enero → febrero: el día se recorta al último del mes, no se desborda a marzo.
  useEffect(() => {
    if (d > max) setD(max);
  }, [d, max]);
  const day = Math.min(d, max);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar sin cambiar" />
        <BlurView intensity={44} tint="dark" style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.sheetOverlay} />
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title} accessibilityRole="header">
              Fecha de nacimiento
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.wheels}>
            {/* La banda del renglón elegido, detrás de las tres ruedas. */}
            <View pointerEvents="none" style={styles.band} />
            <Wheel label="Día" items={days} index={day - 1} onChange={(i) => setD(i + 1)} flex={0.7} />
            <Wheel label="Mes" items={MONTHS} index={m - 1} onChange={(i) => setM(i + 1)} flex={1.5} />
            <Wheel label="Año" items={years} index={y - FIRST_YEAR} onChange={(i) => setY(FIRST_YEAR + i)} flex={1} />
          </View>

          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.preview}>
            {longBirthDate(toIso({ y, m, d: day }))}
          </Text>
          <Button title="Listo" onPress={() => onDone(toIso({ y, m, d: day }))} />
        </BlurView>
      </View>
    </Modal>
  );
}

/** Una columna que gira y se asienta en un renglón. */
function Wheel({
  label,
  items,
  index,
  onChange,
  flex,
}: {
  label: string;
  items: string[];
  index: number;
  onChange: (i: number) => void;
  flex: number;
}) {
  const ref = useRef<ScrollView>(null);
  const [current, setCurrent] = useState(index);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lo último que la propia rueda reportó. Si `index` llega distinto, cambió por fuera
  // (el día que se recorta al pasar a un mes más corto) y hay que girar hasta él; si es
  // el mismo, la rueda ya está ahí y moverla cortaría su animación.
  const reported = useRef(index);

  useEffect(() => {
    if (index !== reported.current) ref.current?.scrollTo({ y: index * ROW, animated: false });
    reported.current = index;
    setCurrent(index);
  }, [index]);
  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  const at = (y: number) => Math.max(0, Math.min(items.length - 1, Math.round(y / ROW)));
  const pick = (i: number) => {
    setCurrent(i);
    if (i !== reported.current) {
      reported.current = i;
      onChange(i);
    }
  };
  const settle = (y: number) => pick(at(y));
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setCurrent(at(e.nativeEvent.contentOffset.y));
  // Soltar sin impulso no siempre dispara el fin de la inercia: se asienta igual, salvo
  // que la inercia arranque (entonces manda `onMomentumScrollEnd`).
  const onEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => settle(y), 120);
  };

  return (
    <View
      style={{ flex, height: ROW * VISIBLE }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[current] }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const next = current + (e.nativeEvent.actionName === "increment" ? 1 : -1);
        if (next < 0 || next >= items.length) return;
        ref.current?.scrollTo({ y: next * ROW, animated: true });
        pick(next);
      }}
    >
      <ScrollView
        ref={ref}
        // Arranca en el valor actual (en Android `contentOffset` no siempre se respeta).
        onLayout={() => ref.current?.scrollTo({ y: reported.current * ROW, animated: false })}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ROW * 2 }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollEndDrag={onEndDrag}
        onMomentumScrollBegin={() => {
          if (settleTimer.current) clearTimeout(settleTimer.current);
        }}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
      >
        {items.map((it, i) => (
          <Pressable
            key={it}
            style={styles.row}
            onPress={() => {
              ref.current?.scrollTo({ y: i * ROW, animated: true });
              pick(i);
            }}
            importantForAccessibility="no"
          >
            <Text
              maxFontSizeMultiplier={TIGHT_FONT_SCALE}
              style={[styles.rowText, i === current && styles.rowTextOn]}
              numberOfLines={1}
            >
              {it}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  fieldError: { borderColor: colors.danger },
  fieldText: { flex: 1, color: colors.text, fontSize: 15 },
  placeholder: { color: colors.textFaint },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: "hidden",
    padding: spacing.lg,
    gap: spacing.md,
  },
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
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.display, letterSpacing: -0.3 },
  wheels: { flexDirection: "row", gap: spacing.sm },
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: ROW * 2,
    height: ROW,
    borderRadius: radius.md,
    backgroundColor: alpha(colors.primary, 0.1),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.35),
  },
  row: { height: ROW, alignItems: "center", justifyContent: "center" },
  rowText: { color: colors.textFaint, fontSize: 17, fontVariant: ["tabular-nums"] },
  rowTextOn: { color: colors.text, fontWeight: "700" },
  preview: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
});
