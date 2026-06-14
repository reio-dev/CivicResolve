import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface BaseUser {
  id: string;
  username: string;
  role: "user" | "resolver";
}

interface RegularUser extends BaseUser {
  role: "user";
  displayName?: string;
  avatarUrl?: string;
  points: number;
  level: number;
  issuesReported: number;
  issuesResolved: number;
  validationsGiven: number;
  bio?: string;
  phone?: string;
  email?: string;
}

interface ResolverUser extends BaseUser {
  role: "resolver";
  name: string;
  departmentId: string | null;
  resolverId: string | null;
  specializations: string[];
  totalResolved: number;
  currentLoad: number;
  rating: number;
}

type User = RegularUser | ResolverUser;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isResolver: boolean;
  login: (username: string, password: string) => Promise<void>;
  resolverLogin: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (data: Partial<RegularUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "@civicresolv_auth";

async function registerForPushNotifications(userId: string, role: "admin" | "user"): Promise<void> {
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permission not granted");
      return;
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const pushToken = tokenData.data;
    console.log("Expo push token:", pushToken);

    // Send to server
    const endpoint = role === "admin" ? "/api/resolver/push-token" : "/api/users/push-token";
    const payload = role === "admin" ? { adminUserId: userId, pushToken } : { userId, pushToken };

    await apiRequest("POST", endpoint, payload);
    console.log("Push token registered on server");

    // Configure Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1E40AF",
      });
    }
  } catch (error) {
    console.error("Failed to register for push notifications:", error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredUser();
  }, []);

  const loadStoredUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        
        // Also ensure push token is synced on app start for logged-in users
        registerForPushNotifications(parsed.id, parsed.role === "resolver" ? "admin" : "user");
      }
    } catch (error) {
      console.error("Failed to load stored user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/login", { username, password });
    const userData = await response.json();
    setUser(userData);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));

    // Register push token for user
    registerForPushNotifications(userData.id, "user");
  };

  const resolverLogin = async (username: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/resolver/login", { username, password });
    const userData = await response.json();
    setUser(userData);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));

    // Register push token for resolver
    registerForPushNotifications(userData.id, "admin");
  };

  const register = async (username: string, password: string, displayName?: string) => {
    const response = await apiRequest("POST", "/api/auth/register", { 
      username, 
      password,
      displayName: displayName || username,
    });
    const userData = await response.json();
    const userWithRole = { ...userData, role: "user" as const };
    setUser(userWithRole);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userWithRole));

    // Register push token for user
    registerForPushNotifications(userData.id, "user");
  };

  const logout = async () => {
    setUser(null);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      if (user.role === "user") {
        const response = await fetch(new URL(`/api/users/${user.id}`, getApiUrl()).toString());
        if (response.ok) {
          const userData = await response.json();
          const userWithRole = { ...userData, role: "user" as const };
          setUser(userWithRole);
          await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userWithRole));
        }
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  const updateUser = async (data: Partial<RegularUser>) => {
    if (!user || user.role !== "user") return;
    const response = await apiRequest("PUT", `/api/users/${user.id}`, data);
    if (response.ok) {
      const userData = await response.json();
      const userWithRole = { ...userData, role: "user" as const };
      setUser(userWithRole);
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userWithRole));
    } else {
      throw new Error("Failed to update user");
    }
  };

  const isResolver = user?.role === "resolver";

  return (
    <AuthContext.Provider value={{ user, isLoading, isResolver, login, resolverLogin, register, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
