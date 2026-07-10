/**
 * Cliente API de la app móvil. Consume el MISMO backend (api/v2 del jugador).
 * Auth con Token de DRF (Authorization: Token <token>, no Bearer). Error =
 * message || error || detail (casa con el contrato del backend).
 */
import Constants from "expo-constants";

// En builds de EAS, EXPO_PUBLIC_API_URL (perfil production → prod) tiene prioridad.
// En dev cae al extra.apiUrl de app.json (localhost).
const BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  "http://localhost:8000";

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
/** Persona en un payload móvil: nombre + avatar (URL de foto o null → iniciales). */
export interface PersonBrief {
  name: string;
  avatar_url: string | null;
}

export interface NextRound {
  next_round: {
    round_id: number;
    availability: "available" | "unavailable" | "pending";
    league: string;
    round_number: number;
    scheduled_at: string | null;
    court_number: number;
    position: string;
    courtmates: { name: string; position: string; avatar_url: string | null }[];
    matches: { match_number: number; team_1: PersonBrief[]; team_2: PersonBrief[] }[];
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
  match_id: number;
  round_number: number;
  court_number: number;
  match_number: number;
  games_for: number;
  games_against: number;
  points_delta: number;
}

export type Direction = "up" | "down" | "stay";

export interface DashboardData {
  enrolled_leagues: {
    league_id: number;
    league_name: string;
    position: number;
    points: number;
    current_court_number: number | null;
    remaining_rounds: number | null;
    trend: Direction[];
  }[];
  open_tournaments: { id: number; name: string; format: string }[];
  nearby_leagues: { league_id: number; league_name: string; club: string; city: string }[];
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/api/v3/auth/login/", {
      method: "POST",
      body: { email, password },
    }),
  profile: (token: string) => request<any>("/api/v2/me/profile/", { token }),
  dashboard: (token: string) => request<DashboardData>("/api/v2/me/dashboard/", { token }),
  rankings: (token: string) => request<{ rankings: Ranking[] }>("/api/v2/me/rankings/", { token }),
  nextRound: (token: string) => request<NextRound>("/api/v2/me/next-round/", { token }),
  history: (token: string) => request<{ history: HistoryRow[] }>("/api/v2/me/history/", { token }),
  // --- Renta de canchas (ticket #30) ---
  rentalCourts: (token: string) => request<{ courts: any[] }>("/api/v2/rentals/courts/", { token }),
  courtFreeSlots: (token: string, courtId: number, date: string) =>
    request<{ date: string; slots: { start_time: string; end_time: string }[] }>(
      `/api/v2/rentals/courts/${courtId}/free-slots/?date=${date}`,
      { token }
    ),
  createReservation: (
    token: string,
    body: {
      court: number;
      date: string;
      start_time: string;
      end_time: string;
      pay_method?: string;
      participants?: { invited_name?: string; invited_phone?: string; player?: number }[];
    }
  ) => request<any>("/api/v2/rentals/reservations/", { method: "POST", token, body }),

  // --- Impugnación de marcador (ticket #32) ---
  raiseDispute: (token: string, matchId: number, team1: number, team2: number) =>
    request<{ id: number; status: string }>(`/api/v2/matches/${matchId}/dispute/`, {
      method: "POST",
      token,
      body: { team1_games: team1, team2_games: team2 },
    }),
  myDisputes: (token: string) =>
    request<{ disputes: any[] }>("/api/v2/me/disputes/", { token }),
  voteDispute: (token: string, disputeId: number, approve: boolean) =>
    request<{ id: number; status: string }>(`/api/v2/disputes/${disputeId}/vote/`, {
      method: "POST",
      token,
      body: { approve },
    }),

  roundFeedback: (token: string, roundId: number) =>
    request<any>(`/api/v2/me/rounds/${roundId}/feedback/`, { token }),
  submitRoundFeedback: async (
    token: string,
    roundId: number,
    fields: { comment: string; experience: string },
    photoUri?: string | null
  ): Promise<any> => {
    const path = `/api/v2/me/rounds/${roundId}/feedback/`;
    if (photoUri) {
      const fd = new FormData();
      fd.append("comment", fields.comment);
      fd.append("experience", fields.experience);
      const name = photoUri.split("/").pop() || "foto.jpg";
      const ext = name.split(".").pop()?.toLowerCase() || "jpg";
      fd.append("photo", { uri: photoUri, name, type: `image/${ext === "jpg" ? "jpeg" : ext}` } as any);
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(data?.message || data?.error || data?.detail || "Error", res.status);
      return data;
    }
    return request<any>(path, { method: "POST", token, body: fields });
  },
  setAvailability: (token: string, round: number, status: string) =>
    request<{ round: number; status: string }>("/api/v2/me/availability/", {
      method: "POST",
      token,
      body: { round, status },
    }),
  registerDevice: (token: string, pushToken: string, platform: string) =>
    request<{ id: number; registered: boolean }>("/api/v2/me/devices/", {
      method: "POST",
      token,
      body: { push_token: pushToken, platform },
    }),

  /**
   * El jugador edita su propio perfil (ticket #26): contacto, dirección, nacimiento y
   * foto. Con foto va multipart; sin ella, JSON. Devuelve el perfil actualizado.
   */
  updateProfile: async (
    token: string,
    fields: Record<string, string>,
    photoUri?: string | null
  ): Promise<any> => {
    if (photoUri) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined || v === null) continue;
        fd.append(k, String(v));
      }
      const name = photoUri.split("/").pop() || "foto.jpg";
      const ext = name.split(".").pop()?.toLowerCase() || "jpg";
      fd.append("photo", {
        uri: photoUri,
        name,
        type: `image/${ext === "jpg" ? "jpeg" : ext}`,
      } as any);
      const res = await fetch(`${BASE_URL}/api/v2/me/profile/`, {
        method: "PATCH",
        headers: { Authorization: `Token ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(data?.message || data?.error || data?.detail || "Error", res.status);
      }
      return data;
    }
    return request<any>("/api/v2/me/profile/", { method: "PATCH", token, body: fields });
  },

  /**
   * Reporta un error desde la app (superficie de cliente → SOLO reporta).
   * Con captura de pantalla va multipart; sin ella, JSON. Devuelve el id del ticket.
   */
  reportBug: async (
    token: string,
    payload: object,
    imageUri?: string | null
  ): Promise<{ id: number; status: string }> => {
    if (imageUri) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(payload)) {
        if (v === undefined || v === null) continue;
        fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
      // React Native: el archivo se adjunta como { uri, name, type }.
      const name = imageUri.split("/").pop() || "captura.jpg";
      const ext = name.split(".").pop()?.toLowerCase() || "jpg";
      fd.append("attachment", {
        uri: imageUri,
        name,
        type: `image/${ext === "jpg" ? "jpeg" : ext}`,
      } as any);
      const res = await fetch(`${BASE_URL}/api/v2/me/report/`, {
        method: "POST",
        headers: { Authorization: `Token ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new ApiError(data?.message || data?.error || data?.detail || "Error", res.status);
      }
      return data as { id: number; status: string };
    }
    return request<{ id: number; status: string }>("/api/v2/me/report/", {
      method: "POST",
      token,
      body: payload,
    });
  },
};
