import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type DashboardData, type HistoryRow, type NextRound, type Ranking } from "@/lib/api";
import { useAuth } from "@/store/auth";

export function useDashboard() {
  const token = useAuth((s) => s.token);
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard(token!),
    enabled: !!token,
  });
}

/**
 * La jornada del jugador. Con `roundId` pide ESA jornada (deep link desde un push);
 * sin él, la más próxima. El id va en la queryKey para que las dos no se pisen la caché.
 */
export function useNextRound(roundId?: number) {
  const token = useAuth((s) => s.token);
  return useQuery<NextRound>({
    queryKey: ["next-round", roundId ?? null],
    queryFn: () => api.nextRound(token!, roundId),
    enabled: !!token,
  });
}

export function useRankings() {
  const token = useAuth((s) => s.token);
  return useQuery<{ rankings: Ranking[] }>({
    queryKey: ["rankings"],
    queryFn: () => api.rankings(token!),
    enabled: !!token,
  });
}

export function useHistory() {
  const token = useAuth((s) => s.token);
  return useQuery<{ history: HistoryRow[] }>({
    queryKey: ["history"],
    queryFn: () => api.history(token!),
    enabled: !!token,
  });
}

export function useSetAvailability() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ round, status }: { round: number; status: string }) =>
      api.setAvailability(token!, round, status),
    // Prefijo: invalida tanto la "próxima jornada" como la pedida por id.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["next-round"] }),
  });
}
