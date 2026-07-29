/**
 * Estado de sesión del jugador (zustand + persist en SecureStore).
 * Guarda token + perfil. Datos de servidor (jornada, ranking) van por react-query.
 */
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthUser {
  id: number;
  email: string;
  name: string;
  avatar_url?: string | null;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setSession: (token: string, user: AuthUser) => void;
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
      hydrated: false,
      setSession: (token, user) => set({ token, user }),
      signOut: () => set({ token: null, user: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "smatch-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ token: s.token, user: s.user }),
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
