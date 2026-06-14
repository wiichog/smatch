import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Card, H1, Muted } from "@/components/ui";
import { useAuth } from "@/store/auth";
import { colors, radius, spacing } from "@/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

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
  name: { fontSize: 20, fontWeight: "800", color: colors.ink900 },
});
