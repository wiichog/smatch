import { Text, View } from "react-native";

import type { Direction } from "@/lib/api";
import { colors, TIGHT_FONT_SCALE } from "@/theme";

type Person = "you" | "they";

const TREND: Record<Direction, { symbol: string; color: string; you: string; they: string }> = {
  up: { symbol: "↑", color: colors.success, you: "subiste de pista", they: "subió de pista" },
  down: { symbol: "↓", color: colors.danger, you: "bajaste de pista", they: "bajó de pista" },
  stay: { symbol: "=", color: colors.textFaint, you: "te quedaste", they: "se quedó" },
};

/**
 * El backend manda la tendencia de la más reciente a la más vieja (3 como máximo); se
 * pinta al revés para leerse como una línea de tiempo: la última jornada queda a la
 * derecha, junto a los puntos.
 */
export function chronological(trend: Direction[] | undefined): Direction[] {
  return [...(trend ?? [])].slice(0, 3).reverse();
}

/** «Últimas jornadas: te quedaste, bajaste de pista» — lo que dice el lector de pantalla. */
export function trendLabel(trend: Direction[] | undefined, person: Person = "you"): string {
  const steps = chronological(trend);
  if (steps.length === 0) return "";
  return `Últimas jornadas: ${steps.map((d) => (TREND[d] ?? TREND.stay)[person]).join(", ")}`;
}

/** Flechas ↑ ↓ = de las últimas jornadas. Sin movimientos no pinta nada. */
export function Trend({
  trend,
  person = "you",
  size = 13,
}: {
  trend?: Direction[];
  person?: Person;
  size?: number;
}) {
  const steps = chronological(trend);
  if (steps.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", gap: 2 }} accessible accessibilityLabel={trendLabel(trend, person)}>
      {steps.map((d, k) => {
        const t = TREND[d] ?? TREND.stay;
        return (
          <Text
            key={k}
            maxFontSizeMultiplier={TIGHT_FONT_SCALE}
            style={{ color: t.color, fontWeight: "800", fontSize: size }}
          >
            {t.symbol}
          </Text>
        );
      })}
    </View>
  );
}
