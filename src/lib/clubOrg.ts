/**
 * El club elegido en el modo club (2026-10), compartido por sus pestañas.
 *
 * Antes el «Hoy» era la única pantalla y el club vivía en su ruta (`/club?org=`). Con
 * Agenda, Jugadores y Más, cada pestaña es otra ruta y un parámetro no se comparte: aquí
 * vive el elegido. El `?org=` de un aviso lo sigue fijando (lo lee el «Hoy»), y si el
 * guardado ya no es de esta cuenta —otra sesión, una membresía que se quitó— cae al
 * primer club de la persona.
 */
import { create } from "zustand";

import { useAuth, type ClubMembership } from "@/store/auth";

const useClubStore = create<{ orgId: number | null; setOrgId: (orgId: number) => void }>((set) => ({
  orgId: null,
  setOrgId: (orgId) => set({ orgId }),
}));

const NINGUNA: ClubMembership[] = [];

// Como los nombra el panel: el «admin» del club es el Supervisor (ticket #26).
export const ROLE_LABEL: Record<string, string> = { owner: "Dueño", admin: "Supervisor", viewer: "Lector" };

export function useClubOrg() {
  const memberships = useAuth((s) => s.user?.memberships) ?? NINGUNA;
  const stored = useClubStore((s) => s.orgId);
  const setOrgId = useClubStore((s) => s.setOrgId);
  const membership = memberships.find((m) => m.organization_id === stored) ?? memberships[0] ?? null;
  return { orgId: membership?.organization_id ?? null, membership, memberships, setOrgId };
}
