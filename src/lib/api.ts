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

/** Mensaje cuando la petición ni siquiera llega al servidor (sin red, servidor caído). */
export const OFFLINE_MESSAGE = "No pudimos conectar con Smatch. Revisa tu internet e intenta de nuevo.";

/**
 * `fetch` que, si la red falla, lanza un `ApiError` en español. Sin esto el jugador veía
 * el error crudo del motor («Network request failed») justo en el login, que es la
 * primera pantalla de la app.
 */
async function fetchOrExplain(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  }
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const { method = "GET", body, token } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetchOrExplain(`${BASE_URL}${path}`, {
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
    // Tanda («20:30») y cancha física de ESTA pista. Opcionales: un backend anterior no
    // los manda, y el club puede no haber planeado horarios (null).
    time_slot?: string | null;
    physical_court_number?: number | null;
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
  /** Nombre del club (2026-10): distingue dos ligas homónimas de clubes distintos. */
  club?: string;
}

/** Una fila de la tabla de la liga (`GET /api/v2/leagues/<id>/standings/`). */
export interface StandingRow {
  player_id: number;
  name: string;
  avatar_url: string | null;
  points: number;
  /** Los empates comparten lugar: 1, 1, 3… */
  position: number;
  court_number: number | null;
  /** De la jornada más nueva a la más vieja, máximo 3. */
  trend: Direction[];
  is_me: boolean;
}

export interface LeagueStandings {
  league: {
    id: number;
    name: string;
    club: string;
    logo_url: string | null;
    rounds_closed: number;
    last_closed_round: number | null;
    /** Para abrir los resultados de esa jornada. Falta en un backend anterior. */
    last_closed_round_id?: number | null;
    remaining_rounds: number | null;
  };
  rows: StandingRow[];
}

type Result = "win" | "loss" | "draw";

/** `GET /api/v2/me/stats/`: los números del jugador, de todos sus clubes. */
export interface PlayerStats {
  clubs: { club: string; logo_url: string | null; category: string | null; branch: string | null }[];
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  /** Entero (58 = 58 %); `null` sin partidos. */
  win_rate: number | null;
  streak: { kind: Result; count: number } | null;
  best_win_streak: number;
  /** De la más reciente a la más vieja, máximo 5. */
  last_results: Result[];
  games_for: number;
  games_against: number;
  rounds_played: number;
  moves: { up: number; down: number };
}

/** Qué pasó con un jugador al cerrar la jornada. */
export interface RoundMove {
  direction: Direction;
  from_court_number: number;
  to_court_number: number;
  /** Texto del cierre («Mejor de la cancha.», «Ausente sin suplente: …»). */
  reason: string;
  /** Un empate se resolvió por sorteo. */
  by_draw: boolean;
}

export interface RoundResultPlayer {
  player_id: number;
  name: string;
  avatar_url: string | null;
  position: string;
  /** Puntos que hizo en ESTA jornada. */
  round_points: number;
  is_substitute: boolean;
  substitute_for: string | null;
  /** `null` para el suplente: no tiene pista propia, cubre la del titular. */
  movement: RoundMove | null;
  is_me: boolean;
}

/** `GET /api/v2/rounds/<id>/results/`: una jornada cerrada, pista por pista. */
export interface RoundResults {
  round: {
    id: number;
    number: number;
    scheduled_at: string | null;
    closed_at: string | null;
    league_id: number;
    league_name: string;
    club: string;
  };
  courts: {
    court_number: number;
    physical_court_number: number | null;
    time_slot: string;
    players: RoundResultPlayer[];
    matches: {
      match_number: number;
      team_1: string[];
      team_2: string[];
      score: { team1: number; team2: number } | null;
    }[];
  }[];
  /** No jugaron y aun así movieron (protegidos por suplente, o ausentes sin él). */
  absent: { player_id: number; name: string; avatar_url: string | null; movement: RoundMove; is_me: boolean }[];
}

export interface HistoryRow {
  match_id: number;
  round_number: number;
  court_number: number;
  match_number: number;
  games_for: number;
  games_against: number;
  points_delta: number;
  // --- Contexto (2026-10). Opcionales: un backend anterior no los manda. ---
  round_id?: number;
  /** Solo una jornada cerrada tiene resultados que ver. */
  round_closed?: boolean;
  league_id?: number;
  league_name?: string;
  scheduled_at?: string | null;
  /** Un partido de americano puede acabar empatado en games (por tiempo). */
  result?: "win" | "loss" | "draw";
  /** De qué lado jugó (1 o 2): la impugnación se manda por lado absoluto. */
  my_side?: 1 | 2 | null;
  partner?: PersonBrief | null;
  opponents?: PersonBrief[];
  open_dispute_id?: number | null;
  /** Qué pasó al cerrar la jornada; el mismo en todos sus partidos. */
  round_movement?: { direction: Direction; from_court_number: number; to_court_number: number } | null;
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
    // «draft» = el club lo está armando; «active» = ya se juega. Opcionales por la
    // misma razón que arriba (backend viejo).
    status?: "draft" | "active" | "finished";
    starts_on?: string | null;
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

// --- Impugnaciones ---
/** Una impugnación de marcador. Los campos de contexto son opcionales: un backend
 *  anterior solo mandaba liga, jornada y marcadores. */
export interface DisputeRow {
  id: number;
  match_id: number;
  league: string;
  round_number: number;
  current: { team1: number; team2: number } | null;
  proposed: { team1: number; team2: number };
  already_voted: boolean;
  raised_by_me: boolean;
  status?: "open" | "applied" | "rejected" | "approved";
  raised_by?: string;
  court_number?: number;
  match_number?: number;
  team_1?: string[];
  team_2?: string[];
  votes?: { approved: number; needed: number };
  round_closed?: boolean;
  resolved_at?: string | null;
}

// --- Renta de canchas ---
export interface FreeSlot {
  start_time: string; // "HH:MM:SS"
  end_time: string;
  /** Precio de ESA franja (con la tarifa del club). Opcional: backend viejo no lo manda. */
  price?: string;
}

export interface MyReservation {
  id: number;
  club: string;
  court_name: string;
  date: string; // "YYYY-MM-DD", hora del club
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  status_display: string;
  payment_status: "pending" | "partial" | "paid" | "refunded";
  total_amount: string;
  my_share: string | null;
  my_pay_method: "online" | "venue" | null;
  my_pay_status: "pending" | "paid" | null;
  booked_by_me: boolean;
  participants: { name: string; is_me: boolean }[];
  can_cancel: boolean;
  cancel_blocked_reason: string | null;
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
  leagueStandings: (token: string, leagueId: number) =>
    request<LeagueStandings>(`/api/v2/leagues/${leagueId}/standings/`, { token }),
  roundResults: (token: string, roundId: number) =>
    request<RoundResults>(`/api/v2/rounds/${roundId}/results/`, { token }),
  myStats: (token: string) => request<PlayerStats>("/api/v2/me/stats/", { token }),
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
    request<{ date: string; slots: FreeSlot[] }>(
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
      pay_method?: "online" | "venue";
      pay_now?: boolean;
      participants?: {
        invited_name?: string;
        invited_phone?: string;
        player?: number;
        pay_method?: "online" | "venue";
      }[];
    }
  ) => request<any>("/api/v2/rentals/reservations/", { method: "POST", token, body }),
  myReservations: (token: string) =>
    request<{ upcoming: MyReservation[]; past: MyReservation[] }>("/api/v2/me/reservations/", { token }),
  cancelReservation: (token: string, reservationId: number) =>
    request<MyReservation>(`/api/v2/rentals/reservations/${reservationId}/cancel/`, {
      method: "POST",
      token,
    }),

  // --- Impugnación de marcador (ticket #32) ---
  raiseDispute: (token: string, matchId: number, team1: number, team2: number) =>
    request<{ id: number; status: string }>(`/api/v2/matches/${matchId}/dispute/`, {
      method: "POST",
      token,
      body: { team1_games: team1, team2_games: team2 },
    }),
  myDisputes: (token: string) =>
    request<{ disputes: DisputeRow[]; recent?: DisputeRow[] }>("/api/v2/me/disputes/", { token }),
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
      const res = await fetchOrExplain(`${BASE_URL}${path}`, {
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
      const res = await fetchOrExplain(`${BASE_URL}/api/v2/me/profile/`, {
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
      const res = await fetchOrExplain(`${BASE_URL}/api/v2/me/report/`, {
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
