import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "@civicresolv_auth";

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
  };

  const resolverLogin = async (username: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/resolver/login", { username, password });
    const userData = await response.json();
    setUser(userData);
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
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

  const isResolver = user?.role === "resolver";

  return (
    <AuthContext.Provider value={{ user, isLoading, isResolver, login, resolverLogin, register, logout, refreshUser }}>
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
