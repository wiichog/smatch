/**
 * Cliente API de la app móvil. Consume el MISMO backend (api/v2 del jugador).
 * Auth con Token de DRF (Authorization: Token <token>, no Bearer). Error =
 * message || error || detail (casa con el contrato del backend).
 */
import Constants from "expo-constants";

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const { method = "GET", body, token } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.message || data?.error || data?.detail || "Error", res.status);
  }
  return data as T;
}

// --- Tipos del jugador (api/v2) ---
export interface NextRound {
  next_round: {
    round_id: number;
    availability: "available" | "unavailable" | "pending";
    league: string;
    round_number: number;
    scheduled_at: string | null;
    court_number: number;
    position: string;
    courtmates: { name: string; position: string }[];
    matches: { match_number: number; team_1: string[]; team_2: string[] }[];
  } | null;
}

export interface Ranking {
  league_id: number;
  league_name: string;
  points: number;
  current_court_number: number | null;
  position: number;
}

export interface HistoryRow {
  round_number: number;
  court_number: number;
  match_number: number;
  games_for: number;
  games_against: number;
  points_delta: number;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/api/v3/auth/login/", {
      method: "POST",
      body: { email, password },
    }),
  profile: (token: string) => request<any>("/api/v2/me/profile/", { token }),
  rankings: (token: string) => request<{ rankings: Ranking[] }>("/api/v2/me/rankings/", { token }),
  nextRound: (token: string) => request<NextRound>("/api/v2/me/next-round/", { token }),
  history: (token: string) => request<{ history: HistoryRow[] }>("/api/v2/me/history/", { token }),
  setAvailability: (token: string, round: number, status: string) =>
    request<{ round: number; status: string }>("/api/v2/me/availability/", {
      method: "POST",
      token,
      body: { round, status },
    }),
};
