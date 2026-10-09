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

let onUnauthorized: (() => void) | null = null;

/**
 * Qué hacer cuando el servidor ya no reconoce el token guardado (401 con sesión): la
 * cuenta se suspendió, cambió su contraseña o cerró sesión en este teléfono desde otro
 * lado. Sin esto la app se quedaba enseñando errores en cada pantalla. Lo pone la raíz.
 */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/**
 * `fetch` que, si la red falla, lanza un `ApiError` en español. Sin esto el jugador veía
 * el error crudo del motor («Network request failed») justo en el login, que es la
 * primera pantalla de la app. Y avisa del 401 de una sesión que ya no sirve.
 */
async function fetchOrExplain(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(OFFLINE_MESSAGE, 0);
  }
  const headers = (init.headers ?? {}) as Record<string, string>;
  if (res.status === 401 && headers.Authorization) onUnauthorized?.();
  return res;
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

/**
 * Manda un formulario con archivos: foto de perfil, de la bitácora, del marcador y la
 * captura de un reporte.
 *
 * Por `XMLHttpRequest` y NO por `fetch`: desde Expo SDK 56 el `fetch` global es el de
 * Expo (`expo/fetch`), que no entiende las partes `{ uri, name, type }` del FormData de
 * React Native («Unsupported FormDataPart implementation»), así que TODA subida de foto
 * fallaba con «No pudimos conectar» (2026-10). El XHR de React Native sí las entiende
 * —lee el archivo del disco en nativo— y Expo no lo reemplaza. No se le pone
 * Content-Type: el XHR arma el `multipart/form-data` con su frontera.
 */
function sendForm<T>(path: string, method: string, token: string, fd: FormData): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${BASE_URL}${path}`);
    xhr.setRequestHeader("Authorization", `Token ${token}`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.timeout = 60000;
    xhr.onload = () => {
      let data: any = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }
      if (xhr.status === 401) onUnauthorized?.();
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new ApiError(data?.message || data?.error || data?.detail || "Error", xhr.status));
    };
    xhr.onerror = () => reject(new ApiError(OFFLINE_MESSAGE, 0));
    xhr.ontimeout = () => reject(new ApiError(OFFLINE_MESSAGE, 0));
    xhr.send(fd);
  });
}

// --- Tipos del jugador (api/v2) ---
/** Persona en un payload móvil: nombre + avatar (URL de foto o null → iniciales). */
/** Cancha que el club renta desde la app (`GET /api/v2/rentals/courts/`). */
export interface RentalCourt {
  id: number;
  name: string;
  price_per_slot?: string | number | null;
  /** Club de la cancha: quien juega en dos clubes ve las de los dos. Falta en un backend anterior. */
  club?: string;
  organization_id?: number;
}

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
    /** Juega de suplente: el lugar es de `substitute_for`. Falta en un backend anterior. */
    is_substitute?: boolean;
    substitute_for?: string | null;
    courtmates: { name: string; position: string; avatar_url: string | null }[];
    matches: {
      match_number: number;
      team_1: PersonBrief[];
      team_2: PersonBrief[];
      /** En cuanto el club lo captura (2026-10). `null` sin jugar; falta en un backend anterior. */
      score?: { team1: number; team2: number } | null;
    }[];
  } | null;
  /**
   * La jornada vigente de CADA liga del jugador (2026-10), la más próxima primero: quien
   * juega en dos ligas ve y confirma las dos. Falta en un backend anterior.
   */
  upcoming?: UpcomingRound[];
  /** Jornadas vigentes donde OTRO juega en tu lugar (te cubre un suplente). */
  covered?: CoveredRound[];
}

export interface CoveredRound {
  round_id: number;
  league_id: number;
  league: string;
  club: string;
  round_number: number;
  scheduled_at: string | null;
  court_number: number;
  /** Quién juega en tu lugar. */
  substitute: string;
}

export interface UpcomingRound {
  round_id: number;
  league_id: number;
  league: string;
  club: string;
  round_number: number;
  scheduled_at: string | null;
  time_slot: string | null;
  court_number: number;
  availability: "available" | "unavailable" | "pending";
  is_substitute?: boolean;
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

/** «Hoy en tu club» (`GET /api/v3/orgs/<id>/today/`): el modo club de la app. */
export interface ClubToday {
  club: { id: number; name: string; logo_url: string | null; is_demo: boolean };
  /**
   * Qué secciones le enseña el panel a esta membresía. `calendar` y `players` (2026-10)
   * deciden las pestañas Agenda y Jugadores; faltan en un backend anterior.
   */
  sections: { leagues: boolean; rentals: boolean; calendar?: boolean; players?: boolean };
  /** Admin u owner: enseña los botones (cubrir, capturar, cobrar, publicar). El Lector solo mira. */
  can_edit?: boolean;
  rounds: {
    round_id: number;
    league_id: number;
    league: string;
    number: number;
    scheduled_at: string | null;
    in_play: boolean;
    courts: number;
    players: number;
    /** Dijeron «No voy» (cubiertos o no). */
    declined: number;
    /** Lugares que ya juega un suplente. */
    substitutes?: number;
    /** Lugares por cubrir con suplente. */
    needs_substitute: { slot_id: number; court_number: number; position: string; player: string }[];
    scores: { captured: number; total: number };
    /** Todos los marcadores están: ya se puede cerrar (2026-10). */
    ready_to_close?: boolean;
    /** Empates que esperan la ruleta para terminar de cerrar. */
    pending_tiebreaks?: number;
  }[];
  /** Jornadas que ya se jugaron y siguen sin cerrar (o esperan la ruleta). 2026-10. */
  to_close?: {
    round_id: number;
    league: string;
    number: number;
    scheduled_at: string | null;
    scores: { captured: number; total: number };
    pending_tiebreaks: number;
  }[];
  draft_rounds: { round_id: number; league_id: number; league: string; number: number }[];
  open_disputes: {
    id: number;
    round_id?: number;
    match_id?: number;
    league: string;
    round_number: number;
    court_number: number;
    match_number: number;
    raised_by: string;
    proposed: string;
    created_at: string;
  }[];
  reservations: {
    id: number;
    court: string;
    start_time: string;
    end_time: string;
    customer: string;
    status: string;
    payment_status: string;
    total: string;
  }[];
}

/** La jornada desde la cancha (`GET /api/v3/rounds/<id>/sheet/`), modo club. */
export interface RoundSheet {
  round: {
    id: number;
    league_id: number;
    league: string;
    number: number;
    status: "draft" | "published" | "closed";
    scheduled_at: string | null;
    /** Publicada y sin cerrar: se capturan marcadores. */
    accepts_results: boolean;
  };
  can_edit: boolean;
  /** Empates que esperan la ruleta para terminar de cerrar (2026-10). */
  pending_tiebreaks?: number;
  courts: {
    court_number: number;
    physical_court_number: number | null;
    time_slot: string | null;
    /** Ya tiene marcador: su alineación ya no se cambia. */
    locked: boolean;
    players: {
      slot_id: number;
      position: string;
      player_id: number;
      name: string;
      avatar_url: string | null;
      is_substitute: boolean;
      /** A quién cubre, si juega de suplente. */
      substitute_for: string | null;
      /** Dijo «No voy». */
      declined: boolean;
      /** Jornada cerrada: subió, bajó o se quedó, y a qué pista va. */
      movement?: { direction: "up" | "down" | "stay"; to_court_number: number } | null;
    }[];
    matches: SheetMatch[];
  }[];
}

export interface SheetMatch {
  id: number;
  match_number: number;
  team1: string[];
  team2: string[];
  score: {
    team1_games: number;
    team2_games: number;
    is_auto: boolean;
    /** Foto del marcador físico, si se subió. */
    photo_url?: string | null;
  } | null;
  dispute: { id: number; raised_by: string; proposed: string } | null;
}

/** Un empate que se decide con la ruleta (respuesta de cerrar y de girar). */
export interface PendingTiebreak {
  draw_id: number;
  court_number: number;
  kind: "up" | "down";
  candidates: { player: number; player_name: string }[];
}

/** Un movimiento al cerrar: quién sube, baja o se queda. */
export interface RoundMovement {
  id: number;
  player: number;
  player_name: string;
  direction: "up" | "down" | "stay";
  from_court_number: number;
  to_court_number: number;
  round_points: number;
  reason: string;
}

/** Cerrar o leer el cierre (`rounds/<id>/close/` y `rounds/<id>/movements/`). */
export interface CloseState {
  status: "closed" | "pending_tiebreaks" | "published" | "draft";
  pending_tiebreaks: PendingTiebreak[];
  movements: RoundMovement[];
}

/** Girar la ruleta de un empate (`rounds/<id>/tiebreak/<draw>/spin/`). */
export interface SpinResult {
  draw: {
    id: number;
    court_number: number;
    kind: "up" | "down";
    winner: number | null;
    winner_name: string | null;
    loser: number | null;
    loser_name: string | null;
  };
  finalized: boolean;
  pending_tiebreaks: PendingTiebreak[];
  movements?: RoundMovement[];
}

/** Un renglón de la agenda del club (`GET /api/v3/orgs/<id>/agenda/`). */
export interface AgendaItem {
  kind: "reservation" | "league" | "lesson" | "tournament" | "maintenance" | "blocked" | string;
  id: number | null;
  start: string;
  end: string;
  court: string | null;
  title: string;
  subtitle: string;
  status: string;
  /** Reservas, si la membresía ve rentas. */
  total?: string;
  payment_status?: string;
  can_pay?: boolean;
  /** Jornadas: abre su hoja si la membresía ve ligas. */
  round_id?: number;
  can_open?: boolean;
}

export interface ClubAgenda {
  club: { id: number; name: string };
  date: string;
  today: string;
  can_edit: boolean;
  sections: { rentals: boolean; leagues: boolean };
  days: { date: string; count: number }[];
  items: AgendaItem[];
}

/** Jugador del club en la lista del modo club. */
export interface ClubPlayerRow {
  id: number;
  name: string;
  avatar_url: string | null;
  category: string | null;
  branch: string | null;
  phone: string | null;
  has_app: boolean;
  is_active: boolean;
  leagues: { league: string; court: number | null }[];
}

/** Ficha de un jugador para la cancha (`GET /api/v3/orgs/<id>/club-players/<pk>/`). */
export interface ClubPlayerCard {
  id: number;
  name: string;
  avatar_url: string | null;
  category: string | null;
  branch: string | null;
  is_active: boolean;
  has_app: boolean;
  birthday: string | null;
  contact: { phone: string | null; email: string | null; call_url: string | null; whatsapp_url: string | null };
  leagues: { league_id: number; league: string; points: number; court: number | null; place: number; active: boolean }[];
  next_round: {
    round_id: number;
    league: string;
    number: number;
    scheduled_at: string | null;
    court_number: number;
    position: string;
    availability: "available" | "unavailable" | "pending";
    is_substitute: boolean;
    substitute_for: string | null;
  } | null;
  recent: {
    round_id: number;
    league: string;
    number: number;
    direction: "up" | "down" | "stay";
    from_court: number;
    to_court: number;
    points: number;
    closed_at: string | null;
  }[];
  reservations: { upcoming: number; unpaid: number; last_date: string | null } | null;
}

/** Qué avisos quiere recibir la persona (`/api/v3/me/push-preferences/`). */
export interface PushCategory {
  key: string;
  group: "player" | "staff";
  label: string;
  description: string;
  enabled: boolean;
}

/** Con quién cubrir un lugar (`GET /api/v3/rounds/<id>/substitute-candidates/`). */
export interface SubstituteCandidates {
  /** En borrador nadie se entera hasta publicar; publicada, el backend avisa. */
  round_status?: "draft" | "published" | "closed";
  slot: { slot_id: number; court_number: number; position: string; player: string; titular: string; category: string };
  candidates: {
    player_id: number;
    name: string;
    avatar_url: string | null;
    category: string;
    same_category: boolean;
    in_league: boolean;
    points: number | null;
  }[];
}

export type PayMethod = "cash" | "card" | "transfer";

/** Un club que pidió leer tu bitácora (`GET /api/v2/me/feedback-access/`). */
export interface FeedbackAccessRequest {
  id: number;
  club: string;
  logo_url: string | null;
  status: "pending" | "approved" | "rejected" | "revoked";
  /** Para qué la quiere el club. */
  message: string;
  requested_at: string;
  responded_at: string | null;
}

/** Un torneo en la lista del jugador (`GET /api/v2/me/tournaments/`). */
export interface TournamentRow {
  id: number;
  name: string;
  club: string;
  logo_url: string | null;
  format: string;
  format_label: string;
  status: "draft" | "active" | "finished";
  starts_on: string | null;
  /** Ya juega en él (lo inscribió su club o se inscribió). */
  enrolled: boolean;
  my_category: string | null;
  partner: string | null;
}

/** Jugador del club para elegir pareja. `available` = no está ya en esa categoría. */
export interface TournamentPartner {
  player_id: number;
  name: string;
  avatar_url: string | null;
  category: string | null;
  available: boolean;
}

/** Respuesta de inscribirse. `whatsapp_url` para avisar a la pareja (si tiene teléfono). */
export interface EnrollResult {
  pair_id: number;
  category: string;
  partner: string;
  partner_in_club: boolean;
  whatsapp_url: string | null;
}

/** `GET /api/v2/tournaments/<id>/`. */
export interface TournamentDetail {
  tournament: {
    id: number;
    name: string;
    club: string;
    logo_url: string | null;
    background_image_url: string | null;
    format: string;
    format_label: string;
    status: "draft" | "active" | "finished";
    starts_on: string | null;
    /** Fechas «YYYY-MM-DD» en que se juega. */
    days: string[];
    time_slots: string[];
    match_duration_minutes: number | null;
    open_to_app: boolean;
    /** Se puede inscribir desde la app (abierto a la app y armándose). */
    enrollment_open?: boolean;
  };
  enrolled: boolean;
  my_category: string | null;
  partner: string | null;
  /** Todas sus inscripciones: puede jugar más de una categoría. */
  my_entries?: {
    pair_id: number;
    category: string;
    partner: string;
    can_withdraw: boolean;
    /** Su grupo («A») en cuanto el club los siembra (2026-10). */
    group?: string | null;
  }[];
  categories: {
    id: number;
    name: string;
    registered_pairs: number;
    max_pairs: number | null;
    is_mine: boolean;
    is_full?: boolean;
  }[];
  matches: {
    id: number;
    category: string;
    stage: "group" | "bracket";
    stage_label: string;
    date: string | null;
    start_time: string | null;
    court: string | null;
    partner: string | null;
    rivals: string[];
    games_for: number | null;
    games_against: number | null;
    result: "win" | "loss" | "draw" | null;
  }[];
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
  /** La jugó cubriendo a alguien: sus puntos cuentan, la pista no es suya. */
  as_substitute?: boolean;
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
  /**
   * Qué pasa si se aprueba con la jornada ya cerrada (2026-10): `reclose` = se rehace el
   * cierre (puntos y quién sube o baja); `points_only` = la siguiente ya está armada y
   * solo se ajustan los puntos. Falta en un backend anterior.
   */
  on_approve?: "reclose" | "points_only" | null;
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
  // `client: "app"`: el backend da un token propio de este teléfono (2026-10), que al
  // cerrar sesión se borra sin sacar al panel ni a los otros teléfonos.
  login: (email: string, password: string) =>
    request<{ token: string; user: any; session?: "device" | "shared" }>("/api/v3/auth/login/", {
      method: "POST",
      body: { email, password, client: "app" },
    }),
  me: (token: string) => request<{ user: any }>("/api/v3/auth/me/", { token }),
  logout: (token: string) =>
    request<void>("/api/v3/auth/logout/", { method: "POST", token, body: { client: "app" } }),
  /** El dueño o supervisor se suma como jugador de su propio club. */
  joinAsPlayer: (token: string, orgId: number, fullName?: string) =>
    request<{ player_id: number; full_name: string; created: boolean }>(`/api/v3/orgs/${orgId}/players/me/`, {
      method: "POST",
      token,
      body: fullName ? { full_name: fullName } : {},
    }),
  myFeedbackAccess: (token: string) =>
    request<{ requests: FeedbackAccessRequest[] }>("/api/v2/me/feedback-access/", { token }),
  decideFeedbackAccess: (token: string, id: number, decision: "approve" | "reject" | "revoke") =>
    request<FeedbackAccessRequest>(`/api/v2/me/feedback-access/${id}/`, { method: "POST", token, body: { decision } }),
  profile: (token: string) => request<any>("/api/v2/me/profile/", { token }),
  dashboard: (token: string) => request<DashboardData>("/api/v2/me/dashboard/", { token }),
  rankings: (token: string) => request<{ rankings: Ranking[] }>("/api/v2/me/rankings/", { token }),
  leagueStandings: (token: string, leagueId: number) =>
    request<LeagueStandings>(`/api/v2/leagues/${leagueId}/standings/`, { token }),
  roundResults: (token: string, roundId: number) =>
    request<RoundResults>(`/api/v2/rounds/${roundId}/results/`, { token }),
  myStats: (token: string) => request<PlayerStats>("/api/v2/me/stats/", { token }),
  clubToday: (token: string, orgId: number) => request<ClubToday>(`/api/v3/orgs/${orgId}/today/`, { token }),
  // Modo club: las lecturas del celular y las MISMAS rutas de escritura del panel.
  roundSheet: (token: string, roundId: number) => request<RoundSheet>(`/api/v3/rounds/${roundId}/sheet/`, { token }),
  substituteCandidates: (token: string, roundId: number, slotId: number, q: string) =>
    request<SubstituteCandidates>(
      `/api/v3/rounds/${roundId}/substitute-candidates/?slot_id=${slotId}&q=${encodeURIComponent(q)}`,
      { token }
    ),
  assignSubstitute: (token: string, roundId: number, slotId: number, substituteId: number) =>
    request<unknown>(`/api/v3/rounds/${roundId}/substitute/`, {
      method: "POST",
      token,
      body: { slot_id: slotId, substitute_id: substituteId },
    }),
  /** Con foto del marcador va multipart (`score_photo`); sin ella, JSON. */
  captureScore: async (
    token: string,
    matchId: number,
    team1: number,
    team2: number,
    photo?: { uri: string; name?: string | null; type?: string | null } | null
  ): Promise<unknown> => {
    const path = `/api/v3/matches/${matchId}/result/`;
    if (!photo) {
      return request<unknown>(path, { method: "POST", token, body: { team1_games: team1, team2_games: team2 } });
    }
    const fd = new FormData();
    fd.append("team1_games", String(team1));
    fd.append("team2_games", String(team2));
    const part = resolvePhotoPart(photo.uri, { name: photo.name, type: photo.type });
    fd.append("score_photo", { uri: photo.uri, name: part.name, type: part.type } as any);
    return sendForm<unknown>(path, "POST", token, fd);
  },
  closeRound: (token: string, roundId: number) =>
    request<CloseState>(`/api/v3/rounds/${roundId}/close/`, { method: "POST", token }),
  roundMovements: (token: string, roundId: number) =>
    request<CloseState>(`/api/v3/rounds/${roundId}/movements/`, { token }),
  spinTiebreak: (token: string, roundId: number, drawId: number) =>
    request<SpinResult>(`/api/v3/rounds/${roundId}/tiebreak/${drawId}/spin/`, { method: "POST", token }),
  clubAgenda: (token: string, orgId: number, date?: string) =>
    request<ClubAgenda>(`/api/v3/orgs/${orgId}/agenda/${date ? `?date=${date}` : ""}`, { token }),
  clubPlayers: (token: string, orgId: number, q: string, scope: "active" | "all" = "active") =>
    request<{ count: number; next_offset: number | null; players: ClubPlayerRow[] }>(
      `/api/v3/orgs/${orgId}/club-players/?q=${encodeURIComponent(q)}&scope=${scope}`,
      { token }
    ),
  clubPlayerCard: (token: string, orgId: number, playerId: number) =>
    request<ClubPlayerCard>(`/api/v3/orgs/${orgId}/club-players/${playerId}/`, { token }),
  pushPreferences: (token: string) =>
    request<{ categories: PushCategory[] }>("/api/v3/me/push-preferences/", { token }),
  setPushPreference: (token: string, key: string, enabled: boolean) =>
    request<{ categories: PushCategory[] }>("/api/v3/me/push-preferences/", {
      method: "PATCH",
      token,
      body: { key, enabled },
    }),
  publishRound: (token: string, roundId: number) =>
    request<unknown>(`/api/v3/rounds/${roundId}/publish/`, { method: "POST", token }),
  payReservation: (token: string, orgId: number, reservationId: number, method: PayMethod) =>
    request<unknown>(`/api/v3/orgs/${orgId}/reservations/${reservationId}/pay/`, {
      method: "POST",
      token,
      body: { method },
    }),
  myTournaments: (token: string) => request<{ tournaments: TournamentRow[] }>("/api/v2/me/tournaments/", { token }),
  tournament: (token: string, id: number) => request<TournamentDetail>(`/api/v2/tournaments/${id}/`, { token }),
  tournamentPartners: (token: string, id: number, q: string, category?: number | null) =>
    request<{ players: TournamentPartner[] }>(
      `/api/v2/tournaments/${id}/partners/?q=${encodeURIComponent(q)}${category ? `&category=${category}` : ""}`,
      { token }
    ),
  enrollTournament: (
    token: string,
    id: number,
    body: { category: number; partner_id?: number; partner_name?: string; partner_phone?: string }
  ) => request<EnrollResult>(`/api/v2/tournaments/${id}/enroll/`, { method: "POST", token, body }),
  withdrawTournament: (token: string, id: number, pairId: number) =>
    request<{ withdrawn: boolean }>(`/api/v2/tournaments/${id}/withdraw/`, {
      method: "POST",
      token,
      body: { pair_id: pairId },
    }),
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
  rentalCourts: (token: string) => request<{ courts: RentalCourt[] }>("/api/v2/rentals/courts/", { token }),
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
      return sendForm<any>(path, "POST", token, fd);
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
   * El teléfono de la PERSONA (modo club, 2026-10): el registro de v2 exige ficha de
   * jugador, así que el dueño que no juega no recibía avisos del club.
   */
  registerAccountDevice: (token: string, pushToken: string, platform: string) =>
    request<{ id: number; registered: boolean }>("/api/v3/me/devices/", {
      method: "POST",
      token,
      body: { push_token: pushToken, platform },
    }),
  unregisterAccountDevice: (token: string, pushToken: string) =>
    request<{ registered: boolean; deleted: boolean }>("/api/v3/me/devices/", {
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
      return sendForm<any>("/api/v2/me/profile/", "PATCH", token, fd);
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
      return sendForm<{ id: number; status: string }>("/api/v2/me/report/", "POST", token, fd);
    }
    return request<{ id: number; status: string }>("/api/v2/me/report/", {
      method: "POST",
      token,
      body: payload,
    });
  },
};
