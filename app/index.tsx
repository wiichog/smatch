import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { HOME_ROUTE } from "@/lib/routes";
import { colors } from "@/theme";
import { isClubOnly, useAuth } from "@/store/auth";

/** Punto de entrada: espera hidratación y redirige según sesión. */
export default function Index() {
  const { token, hydrated, user } = useAuth();

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.ink900 }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!token) return <Redirect href="/login" />;
  // Staff sin jugador: su casa es el modo club.
  return <Redirect href={isClubOnly(user) ? "/club" : HOME_ROUTE} />;
}
