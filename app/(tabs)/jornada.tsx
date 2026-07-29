import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
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

import { Avatar } from "@/components/Avatar";
import { CourtBackdrop } from "@/components/CourtBackdrop";
import { GlassCard } from "@/components/Glass";
import { SectionHeader } from "@/components/SectionHeader";
import { Screen } from "@/components/Screen";
import { SponsorBanner } from "@/components/SponsorBanner";
import { Button, Chip, Label, Muted, Pill } from "@/components/ui";
import { useNextRound, useSetAvailability } from "@/hooks";
import { api, type PersonBrief } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, radius, spacing } from "@/theme";

export default function JornadaScreen() {
  // `round_id` llega cuando la pantalla la abrió un push (jornada publicada /
  // recordatorio): entonces mostramos ESA jornada, no la que el servidor crea próxima.
  const { round_id } = useLocalSearchParams<{ round_id?: string }>();
  const roundId = Number(round_id) > 0 ? Number(round_id) : undefined;
  const { data, isLoading, refetch, isRefetching } = useNextRound(roundId);
  const availMut = useSetAvailability();
  const round = data?.next_round;
  const me = useAuth((s) => s.user?.name) ?? "";
  const isMe = (name?: string | null) => !!me && !!name && name.trim() === me.trim();

  return (
    <Screen title="Jornada" subtitle={round?.league ?? "Tu próxima jornada"}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <SponsorBanner />

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
        ) : !round ? (
          <GlassCard style={styles.emptyCard}>
            {/* Motivo de cancha nocturna: llena el vacío sin robarle protagonismo al mensaje */}
            <CourtBackdrop />
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Sin jornada publicada</Text>
            <Muted style={{ textAlign: "center" }}>
              Cuando tu club publique la jornada, aparecerá aquí.
            </Muted>
          </GlassCard>
        ) : (
          <>
            {/* Hero: tu cancha */}
            <GlassCard strong style={{ marginTop: spacing.sm, alignItems: "center", gap: spacing.sm }}>
              <View style={styles.rowBetweenFull}>
                <Label>Tu cancha</Label>
                <Pill label={`Jornada ${round.round_number}`} tone="primary" />
              </View>
              <Text style={styles.courtNumber}>{round.court_number}</Text>
              <Chip label={`Posición ${round.position}`} color={colors.highlight} />

              {(round.courtmates?.length ?? 0) > 0 && (
                <View style={styles.matesBox}>
                  <Label>Compañeros de cancha</Label>
                  <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    {(round.courtmates ?? []).map(
                      (c: { name: string; position: string; avatar_url: string | null }) => (
                        <View key={c.position} style={styles.mateRow}>
                          <Avatar name={c.name} uri={c.avatar_url} size={38} />
                          <Text style={styles.mateName} numberOfLines={1}>
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

            <SectionHeader index={1} title="Partidos" count={round.matches?.length ?? 0} style={styles.section} />
            {(round.matches ?? []).map(
              (m: { match_number: number; team_1: PersonBrief[]; team_2: PersonBrief[] }) => (
                <GlassCard key={m.match_number} style={{ marginBottom: spacing.md, gap: spacing.sm }}>
                  <Label>Partido {m.match_number}</Label>
                  <TeamRow players={m.team_1} isMe={isMe} />
                  <View style={styles.vsRow}>
                    <View style={styles.vsLine} />
                    <Text style={styles.vsText}>VS</Text>
                    <View style={styles.vsLine} />
                  </View>
                  <TeamRow players={m.team_2} isMe={isMe} />
                </GlassCard>
              )
            )}

            {/* Solo mientras la jornada siga viva: un deep link del push de cierre abre
                una jornada CLOSED, y ahí "No voy" mandaría un correo al club por un
                partido ya jugado. */}
            {round.status === "published" && (
              <>
                <SectionHeader index={2} title="¿Vas a jugar?" style={styles.section} />
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={round.availability === "available" ? "✓ Voy" : "Voy"}
                      variant={round.availability === "available" ? "primary" : "glass"}
                      loading={availMut.isPending}
                      onPress={() => availMut.mutate({ round: round.round_id, status: "available" })}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={round.availability === "unavailable" ? "✓ No voy" : "No voy"}
                      variant={round.availability === "unavailable" ? "ink" : "glass"}
                      loading={availMut.isPending}
                      onPress={() => availMut.mutate({ round: round.round_id, status: "unavailable" })}
                    />
                  </View>
                </View>
              </>
            )}

            <FeedbackSection roundId={round.round_id} />
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
            <Text style={[styles.playerName, isMe(p?.name) && { color: colors.primary }]} numberOfLines={1}>
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
function FeedbackSection({ roundId }: { roundId: number }) {
  const token = useAuth((s) => s.token);
  const [comment, setComment] = useState("");
  const [experience, setExperience] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .roundFeedback(token, roundId)
      .then((fb) => {
        setComment(fb?.comment ?? "");
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
    setDone(false);
    try {
      const fb = await api.submitRoundFeedback(token, roundId, { comment, experience }, photoUri);
      setSavedUrl(fb?.photo_url ?? savedUrl);
      setPhotoUri(null);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const preview = photoUri ?? savedUrl;

  return (
    <>
      <SectionHeader index={3} title="Tu bitácora" style={styles.section} />
      <GlassCard style={{ gap: spacing.sm }}>
        <Label>Comentario</Label>
        <TextInput
          style={styles.fbInput}
          multiline
          value={comment}
          onChangeText={setComment}
          placeholder="¿Cómo estuvo tu jornada?"
          placeholderTextColor={colors.textMuted}
        />
        <Label>Tu experiencia</Label>
        <TextInput
          style={styles.fbInput}
          multiline
          value={experience}
          onChangeText={setExperience}
          placeholder="Cuéntanos tu experiencia…"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable onPress={pick} style={styles.fbAttach}>
          <Ionicons name="image-outline" size={18} color={colors.primary} />
          <Text style={styles.fbAttachText}>{preview ? "Cambiar foto" : "Adjuntar foto (opcional)"}</Text>
        </Pressable>
        {preview && <Image source={{ uri: preview }} style={styles.fbThumb} />}
        {error && <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}
        {done && <Text style={{ color: colors.highlight, fontSize: 13 }}>Guardado ✓</Text>}
        <Button title="Guardar bitácora" onPress={save} loading={saving} />
      </GlassCard>
    </>
  );
}

const styles = StyleSheet.create({
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
