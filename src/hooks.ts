import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  type DashboardData,
  type HistoryRow,
  type LeagueStandings,
  type MyReservation,
  type NextRound,
  type PlayerStats,
  type Ranking,
  type RentalCourt,
  type RoundResults,
  type TournamentDetail,
  type TournamentRow,
} from "@/lib/api";
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

/** La tabla completa de una liga del jugador. Sin liga elegida no pide nada. */
export function useLeagueStandings(leagueId: number | null) {
  const token = useAuth((s) => s.token);
  return useQuery<LeagueStandings>({
    queryKey: ["standings", leagueId],
    queryFn: () => api.leagueStandings(token!, leagueId!),
    enabled: !!token && leagueId != null,
  });
}

/** Resultados de una jornada cerrada. */
export function useRoundResults(roundId: number | null) {
  const token = useAuth((s) => s.token);
  return useQuery<RoundResults>({
    queryKey: ["round-results", roundId],
    queryFn: () => api.roundResults(token!, roundId!),
    enabled: !!token && roundId != null,
  });
}

/** Los números del jugador para su Perfil. */
export function useMyStats() {
  const token = useAuth((s) => s.token);
  return useQuery<PlayerStats>({
    queryKey: ["stats"],
    queryFn: () => api.myStats(token!),
    enabled: !!token,
  });
}

/**
 * Canchas que el club del jugador renta desde la app. La comparten la pantalla de
 * Reservar y la barra de pestañas, que esconde «Reservar» si la lista viene vacía.
 */
export function useRentalCourts() {
  const token = useAuth((s) => s.token);
  return useQuery<{ courts: RentalCourt[] }>({
    queryKey: ["rental-courts"],
    queryFn: () => api.rentalCourts(token!),
    enabled: !!token,
    // Que un club abra o cierre la renta pasa muy de vez en cuando.
    staleTime: 5 * 60_000,
  });
}

/** Torneos del jugador: en los que juega y los abiertos de sus clubes. */
export function useMyTournaments() {
  const token = useAuth((s) => s.token);
  return useQuery<{ tournaments: TournamentRow[] }>({
    queryKey: ["tournaments"],
    queryFn: () => api.myTournaments(token!),
    enabled: !!token,
  });
}

export function useTournament(id: number | null) {
  const token = useAuth((s) => s.token);
  return useQuery<TournamentDetail>({
    queryKey: ["tournament", id],
    queryFn: () => api.tournament(token!, id!),
    enabled: !!token && id != null,
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

/** Reservas del jugador: próximas (la más cercana primero) y pasadas recientes. */
export function useMyReservations() {
  const token = useAuth((s) => s.token);
  return useQuery<{ upcoming: MyReservation[]; past: MyReservation[] }>({
    queryKey: ["my-reservations"],
    queryFn: () => api.myReservations(token!),
    enabled: !!token,
  });
}

export function useCancelReservation() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: number) => api.cancelReservation(token!, reservationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-reservations"] }),
  });
}
