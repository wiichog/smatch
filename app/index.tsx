import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { colors } from "@/theme";
import { useAuth } from "@/store/auth";

/** Punto de entrada: espera hidratación y redirige según sesión. */
export default function Index() {
  const { token, hydrated } = useAuth();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.ink900 }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <Redirect href={token ? "/(tabs)" : "/login"} />;
}
