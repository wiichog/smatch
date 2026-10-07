import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AvailabilityPicker } from "@/components/Availability";
import { Avatar } from "@/components/Avatar";
import { CourtBackdrop } from "@/components/CourtBackdrop";
import { GlassCard } from "@/components/Glass";
import { LoadError } from "@/components/LoadError";
import { SectionHeader } from "@/components/SectionHeader";
import { Screen } from "@/components/Screen";
import { SponsorBanner } from "@/components/SponsorBanner";
import { useToast } from "@/components/Toast";
import { Button, Chip, Label, Muted, Pill, SelectChip } from "@/components/ui";
import { useNextRound } from "@/hooks";
import { api, type PersonBrief } from "@/lib/api";
import { roundWhen } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { colors, MAX_FONT_SCALE, radius, spacing } from "@/theme";

export default function JornadaScreen() {
  // `round_id` dice qué jornada mostrar: la pone un push (jornada publicada /
  // recordatorio), el renglón «También juegas» de Inicio o las pastillas de liga. Sin él,
  // la que el servidor cree próxima. Es la ÚNICA fuente de verdad: con un estado local
  // aparte, volver a tocar desde Inicio la liga que ya venía en la ruta no cambiaba
  // nada y la pantalla se quedaba en la liga que el jugador había elegido después.
  const router = useRouter();
  const { round_id } = useLocalSearchParams<{ round_id?: string }>();
  const roundId = Number(round_id) > 0 ? Number(round_id) : undefined;
  const { data, isLoading, refetch, isRefetching, isError, error } = useNextRound(roundId);
  // Las ligas del selector salen de la consulta por defecto (la misma de Inicio): trae
  // siempre la lista completa y no parpadea mientras carga la jornada elegida.
  const all = useNextRound();
  const upcoming = all.data?.upcoming ?? data?.upcoming ?? [];
  const severalClubs = new Set(upcoming.map((u) => u.club)).size > 1;
  const round = data?.next_round;
  const me = useAuth((s) => s.user?.name) ?? "";
  const isMe = (name?: string | null) => !!me && !!name && name.trim() === me.trim();
  // Cuándo y dónde: lo PRIMERO que necesita quien va a jugar, y no aparecía en ningún lado.
  const when = roundWhen(round?.scheduled_at, round?.time_slot);
  const whenText = [when.day, when.time].filter(Boolean).join(" · ");
  const published = round?.status === "published";
  // Numeración 01/02/03 seguida aunque «¿Vas a jugar?» no aparezca (jornada cerrada).
  const matchesIndex = published ? 2 : 1;
  const started =
    round?.status === "closed" ||
    (!!round?.scheduled_at && new Date(round.scheduled_at).getTime() <= Date.now());

  return (
    <Screen title="Jornada" subtitle={round?.league ?? "Tu próxima jornada"}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
              void all.refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Quien juega en dos ligas elige cuál ver; el punto ámbar marca dónde falta
            decir si va. Antes solo aparecía la más próxima y la otra no se veía nunca. */}
        {upcoming.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
          >
            {upcoming.map((u) => (
              <SelectChip
                key={u.round_id}
                label={severalClubs ? `${u.league} · ${u.club}` : u.league}
                selected={u.round_id === round?.round_id}
                onPress={() => router.setParams({ round_id: String(u.round_id) })}
                dot={u.availability === "pending"}
                dotLabel="falta confirmar si vas"
              />
            ))}
          </ScrollView>
        )}

        <SponsorBanner />

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : isError && !data ? (
          <LoadError error={error} onRetry={() => void refetch()} style={{ marginTop: spacing.lg }} />
        ) : !round ? (
          <GlassCard style={styles.emptyCard}>
            {/* Motivo de cancha nocturna: llena el vacío sin robarle protagonismo al mensaje */}
            <CourtBackdrop />
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.emptyTitle}>Sin jornada publicada</Text>
            <Muted style={{ textAlign: "center" }}>
              Cuando tu club publique la jornada, aparecerá aquí.
            </Muted>
          </GlassCard>
        ) : (
          <>
            {/* Hero: tu pista, y cuándo y dónde se juega */}
            <GlassCard strong style={{ marginTop: spacing.sm, alignItems: "center", gap: spacing.sm }}>
              <View style={styles.rowBetweenFull}>
                <Label>Tu pista</Label>
                <Pill
                  label={round.status === "closed" ? `Jornada ${round.round_number} · cerrada` : `Jornada ${round.round_number}`}
                  tone={round.status === "closed" ? "neutral" : "primary"}
                />
              </View>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.courtNumber}>{round.court_number}</Text>
              <Chip label={`Posición ${round.position}`} color={colors.highlight} />
              {(!!whenText || !!round.physical_court_number) && (
                <View style={styles.whereBox}>
                  {!!whenText && (
                    <View style={styles.whereRow}>
                      <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.whereText}>{whenText}</Text>
                    </View>
                  )}
                  {!!round.physical_court_number && (
                    <View style={styles.whereRow}>
                      <Ionicons name="location-outline" size={18} color={colors.primary} />
                      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.whereText}>Cancha {round.physical_court_number} del club</Text>
                    </View>
                  )}
                </View>
              )}

              {(round.courtmates?.length ?? 0) > 0 && (
                <View style={styles.matesBox}>
                  <Label>Compañeros de pista</Label>
                  <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    {(round.courtmates ?? []).map(
                      (c: { name: string; position: string; avatar_url: string | null }) => (
                        <View key={c.position} style={styles.mateRow}>
                          <Avatar name={c.name} uri={c.avatar_url} size={38} />
                          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.mateName} numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Chip label={c.position} color={colors.textMuted} />
                        </View>
                      )
                    )}
                  </View>
                </View>
              )}
            </GlassCard>

            {/* Solo mientras la jornada siga viva: un deep link del push de cierre abre
                una jornada CLOSED, y ahí "No voy" mandaría un correo al club por un
                partido ya jugado. Va ARRIBA de los partidos: es lo que el club necesita
                del jugador, y al fondo de la pantalla nadie llegaba a verlo. */}
            {published && (
              <>
                <SectionHeader index={1} title="¿Vas a jugar?" style={styles.section} />
                <AvailabilityPicker roundId={round.round_id} availability={round.availability} />
              </>
            )}

            <SectionHeader
              index={matchesIndex}
              title="Partidos"
              count={round.matches?.length ?? 0}
              style={styles.section}
            />
            {(round.matches ?? []).map(
              (m: { match_number: number; team_1: PersonBrief[]; team_2: PersonBrief[] }) => (
                <GlassCard key={m.match_number} style={{ marginBottom: spacing.md, gap: spacing.sm }}>
                  <Label>Partido {m.match_number}</Label>
                  <TeamRow players={m.team_1} isMe={isMe} />
                  <View style={styles.vsRow}>
                    <View style={styles.vsLine} />
                    <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.vsText}>VS</Text>
                    <View style={styles.vsLine} />
                  </View>
                  <TeamRow players={m.team_2} isMe={isMe} />
                </GlassCard>
              )
            )}

            {/* La bitácora es de DESPUÉS de jugar: antes de la hora de la jornada solo
                alargaba la pantalla con una pregunta que todavía no tiene respuesta. */}
            {started && <FeedbackSection roundId={round.round_id} index={matchesIndex + 1} />}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Fila de un equipo de dobles: par de avatares + nombres (uno por línea, sin muro
 * de texto). El jugador actual se resalta con aro lima y etiqueta "Tú". */
function TeamRow({ players, isMe }: { players: PersonBrief[]; isMe: (n?: string | null) => boolean }) {
  const list = players ?? [];
  return (
    <View style={styles.teamRow}>
      <View style={{ flexDirection: "row" }}>
        {list.slice(0, 2).map((p, i) => (
          <View
            key={i}
            style={[
              i > 0 && { marginLeft: -14 },
              isMe(p?.name) && { borderRadius: 999, borderWidth: 2, borderColor: colors.primary },
            ]}
          >
            <Avatar name={p?.name} uri={p?.avatar_url} size={36} ring />
          </View>
        ))}
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        {list.map((p, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.playerName, isMe(p?.name) && { color: colors.primary }]} numberOfLines={1}>
              {p?.name}
            </Text>
            {isMe(p?.name) && <Chip label="Tú" color={colors.primary} />}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Bitácora de la jornada (ticket #31): comentario, experiencia y foto del propio jugador. */
function FeedbackSection({ roundId, index }: { roundId: number; index: number }) {
  const token = useAuth((s) => s.token);
  const toast = useToast();
  const [note, setNote] = useState("");
  // Lo que se guardó en el campo viejo «Tu experiencia» (eran dos campos casi iguales):
  // se conserva tal cual al guardar para no borrar nada que el jugador ya escribió.
  const [experience, setExperience] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .roundFeedback(token, roundId)
      .then((fb) => {
        setNote(fb?.comment ?? "");
        setExperience(fb?.experience ?? "");
        setSavedUrl(fb?.photo_url ?? null);
      })
      .catch(() => {});
  }, [token, roundId]);

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const fb = await api.submitRoundFeedback(token, roundId, { comment: note, experience }, photoUri);
      setSavedUrl(fb?.photo_url ?? savedUrl);
      setPhotoUri(null);
      toast.show("Bitácora guardada.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const preview = photoUri ?? savedUrl;

  return (
    <>
      <SectionHeader index={index} title="Tu bitácora" style={styles.section} />
      <GlassCard style={{ gap: spacing.sm }}>
        {/* Hoy nadie del club la lee: se presenta como lo que es, una nota personal.
            Antes pedía «Comentario» y «Tu experiencia», dos preguntas casi iguales. */}
        <Muted>Tus notas y una foto de la jornada. Solo tú las ves.</Muted>
        <TextInput maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={styles.fbInput}
          multiline
          value={note}
          onChangeText={setNote}
          placeholder="¿Cómo te fue? Con quién jugaste mejor, qué quieres mejorar…"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Notas de tu jornada"
        />
        {!!experience && (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.fbOld}>
            Nota anterior: <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ color: colors.text }}>{experience}</Text>
          </Text>
        )}
        <Pressable onPress={pick} style={styles.fbAttach}>
          <Ionicons name="image-outline" size={18} color={colors.primary} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.fbAttachText}>{preview ? "Cambiar foto" : "Agregar una foto (opcional)"}</Text>
        </Pressable>
        {preview && <Image source={{ uri: preview }} style={styles.fbThumb} />}
        {error && <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}
        <Button title="Guardar" onPress={save} loading={saving} />
      </GlassCard>
    </>
  );
}

const styles = StyleSheet.create({
  // Las pastillas de liga corren de borde a borde aunque el contenido tenga margen.
  chipsScroll: { marginHorizontal: -spacing.lg, marginBottom: spacing.sm },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },
  fbInput: {
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    color: colors.text,
    padding: spacing.md,
    textAlignVertical: "top",
    fontSize: 15,
  },
  fbAttach: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  fbAttachText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  fbThumb: { width: 96, height: 96, borderRadius: radius.md },
  fbOld: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  emptyCard: {
    marginTop: spacing.lg,
    alignItems: "center",
    paddingVertical: spacing.xl + spacing.md,
    gap: 8,
    overflow: "hidden", // recorta el motivo de cancha al radio de la tarjeta
  },
  emptyTitle: { fontWeight: "800", color: colors.text, fontSize: 16 },
  rowBetweenFull: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
  },
  courtNumber: { color: colors.primary, fontSize: 68, fontWeight: "800", lineHeight: 74 },
  whereBox: {
    alignSelf: "stretch",
    gap: 6,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  whereRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  whereText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  matesBox: {
    alignSelf: "stretch",
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  mateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mateName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  section: { marginTop: spacing.xl, marginBottom: spacing.sm },
  teamRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  playerName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  vsRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  vsLine: { flex: 1, height: 1, backgroundColor: colors.glassBorder },
  vsText: { color: colors.textFaint, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
});
