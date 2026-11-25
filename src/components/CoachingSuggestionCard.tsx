import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";

import { GlassCard } from "@/components/Glass";
import { useToast } from "@/components/Toast";
import { Button, Muted, SelectChip } from "@/components/ui";
import type { CoachingCoach, CoachingSlot, CoachingSuggestion } from "@/lib/api";
import { hhmm, parseLocalDate, shortDayLabel } from "@/lib/format";
import { alpha, colors, MAX_FONT_SCALE, radius, spacing } from "@/theme";

/** Horarios de un coach, sin huecos: el índice elegido apunta a ESTA lista. */
function slotsOf(c: CoachingCoach): CoachingSlot[] {
  return (Array.isArray(c?.slots) ? c.slots : []).filter((s): s is CoachingSlot => !!s && !!s.date);
}

/** «Mañana 10:00» / «Jue 26 18:00» para la pastilla y el botón. */
function slotLabel(s: CoachingSlot): string {
  const day = parseLocalDate(s?.date);
  return [day ? shortDayLabel(day) : "", hhmm(s?.start)].filter(Boolean).join(" ");
}

/**
 * Ticket #108: el jugador lleva dos semanas o más bajando de cancha (jugando, no por
 * faltar) y su club da clases. Le sugerimos una con los coaches del club y sus horarios
 * libres. Hoy el jugador no agenda clases desde la app, así que la acción es escribirle
 * al club por WhatsApp con el coach y el horario ya en el mensaje (el enlace lo arma el
 * backend). Sin teléfono del club, solo se muestra la información.
 *
 * Defensivo: todo campo puede faltar (backend anterior o dato a medias) y entonces la
 * tarjeta se encoge o no aparece, nunca truena.
 */
export function CoachingSuggestionCard({ data, style }: { data?: CoachingSuggestion | null; style?: object }) {
  const toast = useToast();
  const [picked, setPicked] = useState<{ coachId: number; index: number } | null>(null);

  const coaches: CoachingCoach[] = (Array.isArray(data?.coaches) ? data.coaches : []).filter(
    (c) => c && c.id != null
  );
  if (!data?.suggest || coaches.length === 0) return null;

  const rounds = Number(data.rounds_down) || 0;
  const title =
    rounds >= 2 ? `Llevas ${rounds} jornadas bajando de cancha` : "Vienes bajando de cancha";
  const league = data.league?.name?.trim();
  const club = (data.contact?.club ?? data.league?.club ?? "").trim();
  const courts =
    data.from_court != null && data.current_court != null
      ? `Pasaste de la pista ${data.from_court} a la ${data.current_court}.`
      : "";
  const intro = [
    league ? `En ${league}.` : "",
    courts,
    `Le pasa a todos: una clase con un coach de ${club || "tu club"} te ayuda a pulir lo que más te está costando. Elige un horario libre y apártalo con el club.`,
  ]
    .filter(Boolean)
    .join(" ");

  const pickedCoach = picked ? coaches.find((c) => c.id === picked.coachId) : undefined;
  const pickedSlot = pickedCoach && picked ? slotsOf(pickedCoach)[picked.index] : undefined;
  // Con horario elegido, el mensaje lleva coach y hora; si no, se le escribe al club.
  const url = pickedSlot?.whatsapp_url || data.contact?.whatsapp_url || null;
  const anyLink = !!data.contact?.whatsapp_url || coaches.some((c) => !!c.whatsapp_url);

  const open = (link: string | null | undefined) => {
    if (!link) return;
    Linking.openURL(link).catch(() => toast.show("No se pudo abrir WhatsApp.", "error"));
  };

  return (
    <GlassCard style={{ gap: spacing.md, ...(style as object) }}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons name="school" size={18} color={colors.highlight} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.overline}>
            UNA CLASE PUEDE AYUDARTE
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.title}>
            {title}
          </Text>
        </View>
      </View>
      <Muted>{intro}</Muted>

      <View style={{ gap: spacing.md }}>
        {coaches.map((c) => {
          const slots = slotsOf(c);
          const name = c.full_name?.trim() || "Coach";
          return (
            <View key={c.id} style={{ gap: spacing.sm }}>
              <View style={styles.coachRow}>
                <Ionicons name="person-circle-outline" size={18} color={colors.textMuted} />
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.coachName} numberOfLines={1}>
                  {name}
                </Text>
                {!!c.specialty?.trim() && (
                  <Muted numberOfLines={1} style={{ flexShrink: 1 }}>
                    · {c.specialty.trim()}
                  </Muted>
                )}
              </View>
              {slots.length > 0 ? (
                <View style={styles.slots}>
                  {slots.map((s, i) => {
                    const label = slotLabel(s);
                    const selected = picked?.coachId === c.id && picked.index === i;
                    return (
                      <SelectChip
                        key={`${s.date}-${s.start}-${i}`}
                        label={label || "Horario"}
                        selected={selected}
                        onPress={() => setPicked(selected ? null : { coachId: c.id, index: i })}
                      />
                    );
                  })}
                </View>
              ) : (
                <Muted style={styles.small}>Sin horarios libres esta semana: pregunta en el club.</Muted>
              )}
            </View>
          );
        })}
      </View>

      {anyLink ? (
        <Button
          variant={pickedSlot ? "primary" : "glass"}
          title={
            pickedSlot && pickedCoach
              ? `Apartar con ${pickedCoach.full_name?.trim().split(" ")[0] || "el coach"} · ${slotLabel(pickedSlot)}`
              : "Escribir al club por WhatsApp"
          }
          icon={
            <Ionicons
              name="logo-whatsapp"
              size={18}
              color={pickedSlot ? colors.onPrimary : colors.highlight}
            />
          }
          disabled={!url}
          onPress={() => open(url)}
        />
      ) : (
        <Muted style={styles.small}>
          Para apartarla, pídela en recepción{club ? ` de ${club}` : ""}.
        </Muted>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: alpha(colors.highlight, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  overline: { color: colors.highlight, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  coachRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  coachName: { color: colors.text, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  small: { fontSize: 13 },
});
