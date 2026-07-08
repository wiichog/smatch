import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from "@expo-google-fonts/space-grotesk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppErrorFallback } from "@/components/AppErrorFallback";
import { BugReportProvider } from "@/components/BugReport";

/** Red de seguridad global: cualquier throw en render de una pantalla cae aquí en vez de
 *  tumbar la app. expo-router usa este export por convención. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorFallback error={props.error} retry={props.retry} />;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [client] = useState(() => queryClient);
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_300Light,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={client}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {/* Reporter global: shake-to-report + acceso desde Perfil, en toda la app. */}
        <BugReportProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </BugReportProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
