import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1A2B44", // Navy
          borderTopWidth: 1,
          borderTopColor: "#E0E0E0",
          height: 80,
          paddingBottom: 20,
        },
        tabBarActiveTintColor: "#FF6B00", // Safety Orange
        tabBarInactiveTintColor: "#F8F9FA", // Light Gray
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Work",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="work" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: "Sync",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="sync" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
