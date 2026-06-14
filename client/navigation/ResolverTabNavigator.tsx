import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import ResolverDashboardScreen from "@/screens/ResolverDashboardScreen";
import ResolverHomeScreen from "@/screens/ResolverHomeScreen";
import ResolverProfileScreen from "@/screens/ResolverProfileScreen";
import { Colors } from "@/constants/theme";

export type ResolverTabParamList = {
  ResolverDashboardTab: undefined;
  ResolverAssignmentsTab: undefined;
  ResolverProfileTab: undefined;
};

const Tab = createBottomTabNavigator<ResolverTabParamList>();

function TabIcon({ name, focused, size }: { name: keyof typeof Feather.glyphMap; focused: boolean; size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={name} size={size} color={focused ? Colors.light.primary : Colors.light.tabIconDefault} />
    </View>
  );
}

export default function ResolverTabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      initialRouteName="ResolverDashboardTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: Colors.light.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
          height: 80,
          paddingBottom: Platform.OS === "ios" ? 20 : 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 1,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="ResolverDashboardTab"
        component={ResolverDashboardScreen}
        options={{
          title: t("resolverTabs.home"),
          tabBarIcon: ({ focused, size }) => (
            <TabIcon name="home" focused={focused} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ResolverAssignmentsTab"
        component={ResolverHomeScreen}
        options={{
          title: t("resolverTabs.map"),
          tabBarIcon: ({ focused, size }) => (
            <TabIcon name="map" focused={focused} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="ResolverProfileTab"
        component={ResolverProfileScreen}
        options={{
          title: t("resolverTabs.profile"),
          tabBarIcon: ({ focused, size }) => (
            <TabIcon name="user" focused={focused} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
