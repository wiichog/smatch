import { Image, Text, View, type ViewStyle } from "react-native";

import { alpha, avatarColor, colors } from "@/theme";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/**
 * Avatar de una persona: muestra su foto si existe (`uri`), si no las iniciales
 * en un círculo con color estable por-nombre. Unifica cómo se ve CADA persona en
 * la app (compañeros de cancha, partidos, ranking, perfil).
 *
 * Nota: hoy la API v2 sólo devuelve `name`; cuando el backend exponga `avatar_url`
 * en los payloads del jugador, basta pasar `uri` y aparece la foto real.
 */
export function Avatar({
  name,
  uri,
  size = 40,
  ring,
  style,
}: {
  name?: string | null;
  uri?: string | null;
  size?: number;
  /** Aro sutil alrededor (para superponer avatares o destacar al usuario). */
  ring?: boolean;
  style?: ViewStyle;
}) {
  const r = size / 2;
  const hue = avatarColor(name);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: uri ? colors.ink800 : alpha(hue, 0.18),
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        ring && { borderWidth: 2, borderColor: colors.surface },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r }} />
      ) : (
        <Text style={{ color: hue, fontWeight: "800", fontSize: size * 0.36 }}>
          {name ? initials(name) : "·"}
        </Text>
      )}
    </View>
  );
}

/** Pareja de avatares superpuestos (para un equipo de dobles). */
export function AvatarPair({ names, size = 34 }: { names: string[]; size?: number }) {
  return (
    <View style={{ flexDirection: "row" }}>
      {names.slice(0, 2).map((n, i) => (
        <Avatar
          key={i}
          name={n}
          size={size}
          ring
          style={i > 0 ? { marginLeft: -size * 0.42 } : undefined}
        />
      ))}
    </View>
  );
}
