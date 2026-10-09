import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  type ClubAgenda,
  type ClubPlayerCard,
  type ClubPlayerRow,
  type ClubToday,
  type PushCategory,
  type DashboardData,
  type FeedbackAccessRequest,
  type HistoryRow,
  type LeagueStandings,
  type MyReservation,
  type NextRound,
  type PlayerStats,
  type Ranking,
  type RentalCourt,
  type PayMethod,
  type RoundResults,
  type RoundSheet,
  type SubstituteCandidates,
  type TournamentDetail,
  type TournamentPartner,
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

/** Buscar pareja en el club (la búsqueda va con un respiro: no por cada tecla). */
export function useTournamentPartners(id: number | null, q: string, category: number | null) {
  const token = useAuth((s) => s.token);
  return useQuery<{ players: TournamentPartner[] }>({
    queryKey: ["tournament-partners", id, q, category],
    queryFn: () => api.tournamentPartners(token!, id!, q, category),
    enabled: !!token && id != null,
    staleTime: 60_000,
  });
}

/** Inscribirse o salirse: refresca el torneo y la lista de Inicio. */
export function useTournamentEnrollment(id: number | null) {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["tournament", id] });
    void qc.invalidateQueries({ queryKey: ["tournaments"] });
    void qc.invalidateQueries({ queryKey: ["tournament-partners", id] });
  };
  const enroll = useMutation({
    mutationFn: (body: { category: number; partner_id?: number; partner_name?: string; partner_phone?: string }) =>
      api.enrollTournament(token!, id!, body),
    onSuccess: refresh,
  });
  const withdraw = useMutation({
    mutationFn: (pairId: number) => api.withdrawTournament(token!, id!, pairId),
    onSuccess: refresh,
  });
  return { enroll, withdraw };
}

/** «Hoy en tu club» (modo club). */
export function useClubToday(orgId: number | null) {
  const token = useAuth((s) => s.token);
  return useQuery<ClubToday>({
    queryKey: ["club-today", orgId],
    queryFn: () => api.clubToday(token!, orgId!),
    enabled: !!token && orgId != null,
  });
}

/** La jornada desde la cancha (modo club). */
export function useRoundSheet(roundId: number | null) {
  const token = useAuth((s) => s.token);
  return useQuery<RoundSheet>({
    queryKey: ["round-sheet", roundId],
    queryFn: () => api.roundSheet(token!, roundId!),
    enabled: !!token && roundId != null,
  });
}

/** Con quién cubrir un lugar: sugeridos por nivel, o buscando por nombre. */
export function useSubstituteCandidates(roundId: number | null, slotId: number | null, q: string) {
  const token = useAuth((s) => s.token);
  return useQuery<SubstituteCandidates>({
    queryKey: ["substitute-candidates", roundId, slotId, q],
    queryFn: () => api.substituteCandidates(token!, roundId!, slotId!, q),
    enabled: !!token && roundId != null && slotId != null,
  });
}

/**
 * Lo que el club resuelve desde el celular. Cada acción refresca el «Hoy» y la hoja de
 * la jornada: lo que se acaba de hacer se ve al volver, sin jalar para refrescar.
 */
export function useClubActions() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["club-today"] });
    void qc.invalidateQueries({ queryKey: ["round-sheet"] });
    void qc.invalidateQueries({ queryKey: ["substitute-candidates"] });
    void qc.invalidateQueries({ queryKey: ["club-agenda"] });
    void qc.invalidateQueries({ queryKey: ["club-player"] });
  };
  const substitute = useMutation({
    mutationFn: (v: { roundId: number; slotId: number; substituteId: number }) =>
      api.assignSubstitute(token!, v.roundId, v.slotId, v.substituteId),
    onSuccess: refresh,
  });
  const capture = useMutation({
    mutationFn: (v: {
      matchId: number;
      team1: number;
      team2: number;
      photo?: { uri: string; name?: string | null; type?: string | null } | null;
    }) => api.captureScore(token!, v.matchId, v.team1, v.team2, v.photo),
    onSuccess: refresh,
  });
  // Cerrar y girar la ruleta (2026-10): mismas rutas del panel.
  const close = useMutation({
    mutationFn: (roundId: number) => api.closeRound(token!, roundId),
    onSuccess: refresh,
  });
  const spin = useMutation({
    mutationFn: (v: { roundId: number; drawId: number }) => api.spinTiebreak(token!, v.roundId, v.drawId),
    onSuccess: refresh,
  });
  const publish = useMutation({
    mutationFn: (roundId: number) => api.publishRound(token!, roundId),
    onSuccess: refresh,
  });
  const pay = useMutation({
    mutationFn: (v: { orgId: number; reservationId: number; method: PayMethod }) =>
      api.payReservation(token!, v.orgId, v.reservationId, v.method),
    onSuccess: refresh,
  });
  return { substitute, capture, publish, pay, close, spin };
}

/** La agenda del club, un día a la vez (modo club, 2026-10). */
export function useClubAgenda(orgId: number | null, date: string | null) {
  const token = useAuth((s) => s.token);
  return useQuery<ClubAgenda>({
    queryKey: ["club-agenda", orgId, date],
    queryFn: () => api.clubAgenda(token!, orgId!, date ?? undefined),
    enabled: !!token && orgId != null,
    // Al cambiar de día se queda el anterior a la vista mientras llega el nuevo.
    placeholderData: (prev) => prev,
  });
}

/** Jugadores del club, buscando por nombre o teléfono. */
export function useClubPlayers(orgId: number | null, q: string, scope: "active" | "all") {
  const token = useAuth((s) => s.token);
  return useQuery<{ count: number; next_offset: number | null; players: ClubPlayerRow[] }>({
    queryKey: ["club-players", orgId, q, scope],
    queryFn: () => api.clubPlayers(token!, orgId!, q, scope),
    enabled: !!token && orgId != null,
    placeholderData: (prev) => prev,
  });
}

export function useClubPlayerCard(orgId: number | null, playerId: number | null) {
  const token = useAuth((s) => s.token);
  return useQuery<ClubPlayerCard>({
    queryKey: ["club-player", orgId, playerId],
    queryFn: () => api.clubPlayerCard(token!, orgId!, playerId!),
    enabled: !!token && orgId != null && playerId != null,
  });
}

/** Qué avisos quiere recibir la persona; el cambio se ve al instante y se guarda. */
export function usePushPreferences() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const list = useQuery<{ categories: PushCategory[] }>({
    queryKey: ["push-preferences"],
    queryFn: () => api.pushPreferences(token!),
    enabled: !!token,
  });
  const toggle = useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => api.setPushPreference(token!, v.key, v.enabled),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["push-preferences"] });
      const prev = qc.getQueryData<{ categories: PushCategory[] }>(["push-preferences"]);
      qc.setQueryData<{ categories: PushCategory[] }>(["push-preferences"], (old) =>
        old ? { categories: old.categories.map((c) => (c.key === v.key ? { ...c, enabled: v.enabled } : c)) } : old
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["push-preferences"], ctx.prev);
    },
    onSuccess: (data) => qc.setQueryData(["push-preferences"], data),
  });
  return { list, toggle };
}

/** Clubes que pidieron leer tu bitácora, y decidir. */
export function useFeedbackAccess() {
  const token = useAuth((s) => s.token);
  const qc = useQueryClient();
  const list = useQuery<{ requests: FeedbackAccessRequest[] }>({
    queryKey: ["feedback-access"],
    queryFn: () => api.myFeedbackAccess(token!),
    enabled: !!token,
  });
  const decide = useMutation({
    mutationFn: (v: { id: number; decision: "approve" | "reject" | "revoke" }) =>
      api.decideFeedbackAccess(token!, v.id, v.decision),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feedback-access"] }),
  });
  return { list, decide };
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
