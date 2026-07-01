import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useBugReport } from "@/components/BugReport";
import { Button, Card, H1, Muted } from "@/components/ui";
import { useAuth } from "@/store/auth";
import { colors, radius, spacing } from "@/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const bugReport = useBugReport();

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <H1>Perfil</H1>
        <Card style={{ marginTop: spacing.lg, alignItems: "center", paddingVertical: spacing.xl }}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>
              {(user?.name ?? "?").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Muted>{user?.email}</Muted>
        </Card>

        <Pressable onPress={bugReport.open} style={styles.reportRow} accessibilityLabel="Reportar un problema">
          <View style={styles.reportIcon}>
            <Ionicons name="bug" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.reportTitle}>Reportar un problema</Text>
            <Muted>¿Algo falló? Cuéntanos (o sacude el teléfono).</Muted>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <View style={{ marginTop: spacing.xl }}>
          <Button
            title="Cerrar sesión"
            variant="outline"
            onPress={() => {
              signOut();
              router.replace("/login");
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.ink900,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  initials: { color: colors.primary, fontSize: 28, fontWeight: "800" },
  name: { fontSize: 20, fontWeight: "800", color: colors.text },
  reportRow: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  reportIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.ink900,
    alignItems: "center",
    justifyContent: "center",
  },
  reportTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
});
