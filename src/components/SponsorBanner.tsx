/**
 * Banner de patrocinadores del club (ticket #22). Rota los logos que el owner subió,
 * visible para todos los jugadores. Se oculta si el club no tiene patrocinadores con logo.
 */
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { api } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { colors, radius, spacing } from "@/theme";

type Sponsor = { id: number; name: string; logo_url: string | null };

export function SponsorBanner() {
  const token = useAuth((s) => s.token);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!token) return;
    api
      .sponsors(token)
      .then((r) => setSponsors((r.sponsors ?? []).filter((s) => s.logo_url)))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % sponsors.length), 3500);
    return () => clearInterval(t);
  }, [sponsors.length]);

  if (sponsors.length === 0) return null;
  const s = sponsors[i % sponsors.length];

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Patrocinadores</Text>
      <View style={styles.banner}>
        <Image source={{ uri: s.logo_url as string }} style={styles.logo} resizeMode="contain" />
      </View>
      {sponsors.length > 1 && (
        <View style={styles.dots}>
          {sponsors.map((sp, k) => (
            <View key={sp.id} style={[styles.dot, k === i && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm, gap: 6 },
  label: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: colors.textMuted,
    fontWeight: "700",
  },
  banner: {
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassStrong,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    overflow: "hidden",
  },
  logo: { width: "80%", height: "100%" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 999, backgroundColor: colors.glassBorder },
  dotOn: { backgroundColor: colors.primary },
});
