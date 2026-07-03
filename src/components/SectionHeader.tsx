import { Text, View, type ViewStyle } from "react-native";

import { colors, fonts } from "@/theme";

/**
 * Encabezado de sección editorial (patrón de la landing/panel): numeración 01/02
 * tenue + punto de color opcional + título en MAYÚSCULAS con tracking + contador.
 */
export function SectionHeader({
  index,
  title,
  dotColor,
  count,
  style,
}: {
  index?: number;
  title: string;
  dotColor?: string;
  count?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, style]}>
      {index !== undefined && (
        <Text style={{ fontFamily: fonts.displaySemi, fontSize: 11, color: colors.textFaint }}>
          {String(index).padStart(2, "0")}
        </Text>
      )}
      {dotColor ? (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
      ) : null}
      <Text
        style={{
          fontSize: 11,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          color: colors.text,
          fontWeight: "700",
        }}
      >
        {title}
      </Text>
      {count !== undefined && (
        <Text style={{ fontSize: 11, color: colors.textFaint }}>({count})</Text>
      )}
    </View>
  );
}
