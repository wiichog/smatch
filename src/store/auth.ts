/**
 * Estado de sesión del jugador (zustand + persist en SecureStore).
 * Guarda token + perfil. Datos de servidor (jornada, ranking) van por react-query.
 */
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Club donde la persona es staff (dueño, administrador, lector…). */
export interface ClubMembership {
  organization_id: number;
  organization_name: string;
  role: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  avatar_url?: string | null;
  /**
   * Jugadores vinculados (uno por club). 0 = solo staff: entra directo al modo club.
   * Las sesiones guardadas antes de 2026-10 no lo traen: eran todas de jugador.
   */
  players_count?: number;
  /** Clubes donde juega (uno por ficha). Falta en sesiones guardadas antes de 2026-10. */
  player_orgs?: number[];
  /** Clubes donde es staff: habilitan el modo club. */
  memberships?: ClubMembership[];
}

/**
 * Del `user` que mandan `/auth/login` y `/auth/me` al usuario que guarda la app. Uno solo
 * para los dos: después de sumarse como jugador la app relee la sesión con `/auth/me`.
 */
export function toAuthUser(u: any): AuthUser {
  const memberships: ClubMembership[] = (u?.memberships ?? []).map((m: any) => ({
    organization_id: m.organization_id,
    organization_name: m.organization_name,
    role: m.role,
  }));
  const players: { full_name?: string; organization_id?: number }[] = u?.players ?? [];
  const email = u?.email ?? "";
  const sessionName = (u?.name ?? "").trim();
  // Un backend anterior manda el correo como nombre del jugador invitado: si es así, se
  // usa el nombre del jugador vinculado.
  const name = sessionName && sessionName !== email ? sessionName : players[0]?.full_name ?? sessionName;
  return {
    id: u?.id,
    email,
    name,
    avatar_url: u?.avatar_url ?? null,
    players_count: players.length,
    player_orgs: players.map((p) => p.organization_id).filter((id): id is number => typeof id === "number"),
    memberships,
  };
}

/** Solo staff (sin jugador vinculado): su casa es el modo club, no las pestañas. */
export function isClubOnly(user: AuthUser | null | undefined): boolean {
  return !!user && user.players_count === 0 && (user.memberships?.length ?? 0) > 0;
}

/**
 * De quién es el token: `device` = solo de este teléfono (2026-10, se borra en el backend
 * al cerrar sesión); `shared` = el mismo del panel (backend anterior o sesión vieja), que
 * NO se borra porque sacaría también al panel.
 */
export type SessionKind = "device" | "shared";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  session: SessionKind | null;
  hydrated: boolean;
  /** Sin `session` conserva la que había (p. ej. al refrescar el perfil). */
  setSession: (token: string, user: AuthUser, session?: SessionKind) => void;
  signOut: () => void;
  setHydrated: () => void;
}

const secureStorage = {
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      session: null,
      hydrated: false,
      setSession: (token, user, session) => set((st) => ({ token, user, session: session ?? st.session })),
      signOut: () => set({ token: null, user: null, session: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "smatch-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ token: s.token, user: s.user, session: s.session }),
      // Marca hidratado SIEMPRE, también si SecureStore falla (`state` llega undefined).
      // Si no, `hydrated` se queda en false para siempre: la app se clava en el spinner
      // de `/` y todo tap de push se ignora en silencio esperando una sesión que nunca
      // se resuelve. Sin datos guardados el resultado correcto es "no hay sesión".
      onRehydrateStorage: () => (state) => {
        (state ?? useAuth.getState()).setHydrated();
      },
    }
  )
);
