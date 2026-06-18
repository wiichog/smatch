import { Image, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme";

/**
 * Logo de Smatch para la app: el isotipo (pelota lima con costura en "S") +
 * el wordmark. `dark` para fondos grafito (login), claro para fondos surface.
 * El isotipo es el mismo asset que genera el icon/splash de la app.
 */
export function Logo({
  size = 40,
  showWordmark = true,
  dark = false,
}: {
  size?: number;
  showWordmark?: boolean;
  dark?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Image
        source={require("../../assets/logo-mark.png")}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      {showWordmark && (
        <Text
          style={[
            styles.word,
            { fontSize: size * 0.72, color: dark ? colors.textInverse : colors.ink900 },
          ]}
        >
          Smatch<Text style={{ color: colors.primary }}>.</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { fontWeight: "800", letterSpacing: -0.5 },
});
