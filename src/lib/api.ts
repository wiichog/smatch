/**
 * Cliente API de la app móvil. Consume el MISMO backend (api/v2 del jugador).
 * Auth con Token de DRF (Authorization: Token <token>, no Bearer). Error =
 * message || error || detail (casa con el contrato del backend).
 */
import Constants from "expo-constants";

// Orden: EXPO_PUBLIC_API_URL (la inyecta cada perfil de eas.json) → localhost SOLO en
// desarrollo → extra.apiUrl de app.json (prod) → prod.
// `||` y NO `??`: una cadena vacía no es nullish, así que una variable definida-pero-
// vacía se colaba y dejaba la app pegando a la nada (mismo bug que tuvimos en el web).
// El `__DEV__` va ANTES de extra.apiUrl porque `expo start` contra el backend local no
// trae env var: sin esta rama la app de desarrollo escribiría en PRODUCCIÓN.
// Y después de __DEV__ ya nada puede ser localhost: un build de tienda atorado en
// http://localhost:8000 lo bloquea ATS en iOS sin error claro.
const BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? "http://localhost:8000" : undefined) ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  "https://api.smatchapp.mx";

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
    // Un deep link de push puede abrir una jornada ya cerrada: sin esto la pantalla
    // ofrecería confirmar disponibilidad de algo que ya se jugó.
    status: "draft" | "published" | "closed";
    league_id: number;
    org_id: number;
    availability: "available" | "unavailable" | "pending";
    league: string;
    // Material digital del club (ticket #77): logo y fondo, o null si el club no los subió.
    logo_url?: string | null;
    background_image_url?: string | null;
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
    // Material digital del club (ticket #77): logo y fondo, o null si el club no los subió.
    logo_url?: string | null;
    background_image_url?: string | null;
  }[];
  open_tournaments: {
    id: number;
    name: string;
    format: string;
    logo_url?: string | null;
    background_image_url?: string | null;
  }[];
  nearby_leagues: {
    league_id: number;
    league_name: string;
    club: string;
    city: string;
    logo_url?: string | null;
    background_image_url?: string | null;
  }[];
}

/**
 * Deriva un `{ name, type }` seguros para el campo multipart `photo`. El backend
 * (`validate_photo`) exige una extensión válida (jpg/jpeg/png/webp): si el asset de
 * expo-image-picker o el URI local no la traen, cae a `photo.jpg` + `image/jpeg`.
 * Garantiza que el `name` SIEMPRE lleve una extensión válida coherente con el `type`.
 */
function resolvePhotoPart(
  uri: string,
  meta?: { name?: string | null; type?: string | null } | null
): { name: string; type: string } {
  const MIME_BY_EXT: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const EXT_BY_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const validExt = (s?: string | null): string => {
    const clean = ((s ?? "").trim().toLowerCase().split(/[?#]/)[0] ?? "");
    const parts = clean.split(".");
    const ext = parts.length > 1 ? (parts.pop() ?? "") : "";
    return ext in MIME_BY_EXT ? ext : "";
  };

  const mimeExt = EXT_BY_MIME[(meta?.type ?? "").trim().toLowerCase()] ?? "";
  // Fuente de verdad para la extensión: fileName del asset → URI local → mimeType → jpg.
  const ext = validExt(meta?.name) || validExt(uri) || mimeExt || "jpg";
  const type = MIME_BY_EXT[ext] ?? "image/jpeg";
  // Conserva el nombre del asset si ya trae extensión válida; si no, photo.<ext>.
  const name = validExt(meta?.name) ? (meta?.name ?? "").trim() : `photo.${ext}`;
  return { name, type };
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
  // `roundId` pide UNA jornada concreta: es lo que usa el deep link de un push, que
  // trae el id. Sin él, el servidor elige la más próxima del jugador.
  nextRound: (token: string, roundId?: number) =>
    request<NextRound>(
      `/api/v2/me/next-round/${roundId ? `?round_id=${roundId}` : ""}`,
      { token }
    ),
  history: (token: string) => request<{ history: HistoryRow[] }>("/api/v2/me/history/", { token }),
  // --- Banner de patrocinadores (ticket #22) ---
  sponsors: (token: string) =>
    request<{ sponsors: { id: number; name: string; logo_url: string | null }[] }>(
      "/api/v2/sponsors/",
      { token }
    ),

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
      pay_now?: boolean;
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
  /** Suelta el token al cerrar sesión, para que este teléfono deje de recibir sus push. */
  unregisterDevice: (token: string, pushToken: string) =>
    request<{ registered: boolean; deleted: boolean }>("/api/v2/me/devices/", {
      method: "DELETE",
      token,
      body: { push_token: pushToken },
    }),

  /**
   * El jugador edita su propio perfil (ticket #26): contacto, dirección, nacimiento y
   * foto. Con foto va multipart; sin ella, JSON. Devuelve el perfil actualizado.
   */
  updateProfile: async (
    token: string,
    fields: Record<string, string>,
    photoUri?: string | null,
    photoMeta?: { name?: string | null; type?: string | null } | null
  ): Promise<any> => {
    if (photoUri) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined || v === null) continue;
        fd.append(k, String(v));
      }
      // name/type robustos: usa el fileName/mimeType del asset; si faltan, jpg/jpeg.
      const part = resolvePhotoPart(photoUri, photoMeta);
      fd.append("photo", { uri: photoUri, name: part.name, type: part.type } as any);
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
