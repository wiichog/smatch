/**
 * Chips para cambiar de club en el modo club (quien administra más de uno). Sin nada que
 * elegir no pinta nada. El elegido queda para todas las pestañas (`useClubOrg`).
 */
import { ScrollView, StyleSheet } from "react-native";

import { SelectChip } from "@/components/ui";
import { useClubOrg } from "@/lib/clubOrg";
import { spacing } from "@/theme";

export function ClubSwitcher({
  selected,
  onSelect,
}: {
  /** El club que se está viendo (por omisión, el elegido). */
  selected?: number | null;
  onSelect?: (orgId: number) => void;
}) {
  const { orgId, memberships, setOrgId } = useClubOrg();
  if (memberships.length < 2) return null;
  const actual = selected ?? orgId;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.chips}>
      {memberships.map((m) => (
        <SelectChip
          key={m.organization_id}
          label={m.organization_name}
          selected={m.organization_id === actual}
          onPress={() => (onSelect ?? setOrgId)(m.organization_id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
