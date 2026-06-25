import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect } from "react";

import { registerDevice } from "@/lib/push";
import { useAuth } from "@/store/auth";
import { colors } from "@/theme";

export default function TabsLayout() {
  const token = useAuth((s) => s.token);

  // Registrar el dispositivo para push cuando hay sesión (best-effort).
  useEffect(() => {
    if (token) registerDevice(token);
  }, [token]);

  if (!token) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "rgba(255,255,255,0.5)",
        tabBarStyle: { backgroundColor: colors.ink900, borderTopColor: colors.cardBorder, height: 60, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Jornada",
          tabBarIcon: ({ color, size }) => <Ionicons name="tennisball-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          title: "Ranking",
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Historial",
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
