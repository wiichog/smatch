import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useBugReport } from "@/components/BugReport";
import { GlassCard, GlassPressable } from "@/components/Glass";
import { Screen } from "@/components/Screen";
import { Button, Muted } from "@/components/ui";
import { useAuth } from "@/store/auth";
import { alpha, colors, radius, spacing } from "@/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const bugReport = useBugReport();

  return (
    <Screen title="Perfil">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero del jugador */}
        <GlassCard strong style={{ marginTop: spacing.sm, alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm }}>
          <Avatar name={user?.name} uri={user?.avatar_url} size={88} ring />
          <Text style={styles.name}>{user?.name}</Text>
          <Muted>{user?.email}</Muted>
        </GlassCard>

        {/* Reportar un problema */}
        <GlassPressable onPress={bugReport.open} style={styles.reportRow}>
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
            onPress={() => {
              signOut();
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
