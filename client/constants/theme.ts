import { Platform } from "react-native";

// CivicResolv - Clean & Playful (Dark Mode) Design System
// Inspired by: Duolingo, Apple Fitness
// Primary: Lime Green #58CC02 with clay shadows
// Background: Deep Slate #0F172A
// Surface: Dark Slate #1E293B

export const Colors = {
  light: {
    text: "#F8FAFC",
    textSecondary: "#6B7280",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#58CC02",
    link: "#58CC02",
    backgroundRoot: "#000000",
    backgroundDefault: "#000000",
    backgroundSecondary: "#111111",
    backgroundTertiary: "#1A1A1A",
    primary: "#58CC02",
    primaryLight: "#7DD83A",
    primaryShadow: "#46A302",
    secondary: "#8B5CF6",
    secondaryLight: "#A78BFA",
    success: "#10B981",
    successLight: "#34D399",
    warning: "#F59E0B",
    warningLight: "#FBBF24",
    error: "#EF4444",
    errorLight: "#F87171",
    cardBackground: "#111111",
    border: "#1A1A1A",
    gradientStart: "#3B82F6",
    gradientEnd: "#8B5CF6",
    surface: "#111111",
    surfaceHighlight: "#1A1A1A",
    muted: "#6B7280",
  },
  dark: {
    text: "#F8FAFC",
    textSecondary: "#6B7280",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#58CC02",
    link: "#58CC02",
    backgroundRoot: "#000000",
    backgroundDefault: "#000000",
    backgroundSecondary: "#111111",
    backgroundTertiary: "#1A1A1A",
    primary: "#58CC02",
    primaryLight: "#7DD83A",
    primaryShadow: "#46A302",
    secondary: "#8B5CF6",
    secondaryLight: "#A78BFA",
    success: "#10B981",
    successLight: "#34D399",
    warning: "#F59E0B",
    warningLight: "#FBBF24",
    error: "#EF4444",
    errorLight: "#F87171",
    cardBackground: "#111111",
    border: "#1A1A1A",
    gradientStart: "#3B82F6",
    gradientEnd: "#8B5CF6",
    surface: "#111111",
    surfaceHighlight: "#1A1A1A",
    muted: "#6B7280",
  },
};

export const StatusColors = {
  reported: "#3B82F6",
  verified: "#58CC02",
  assigned: "#8B5CF6",
  inProgress: "#F59E0B",
  resolved: "#10B981",
};

export const CategoryColors = {
  roads: "#EF4444",
  water: "#3B82F6",
  waste: "#10B981",
  electricity: "#F59E0B",
  drainage: "#6366F1",
  parks: "#22C55E",
  sanitation: "#F97316",
  other: "#94A3B8",
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "500" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "'Fredoka', 'Nunito', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'Fredoka', 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  small: Platform.select<any>({
    web: { boxShadow: "0px 2px 4px rgba(0,0,0,0.2)" },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 2,
    },
  }),
  medium: Platform.select<any>({
    web: { boxShadow: "0px 4px 6px rgba(0,0,0,0.25)" },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 4,
    },
  }),
  large: Platform.select<any>({
    web: { boxShadow: "0px 6px 10px rgba(0,0,0,0.3)" },
    default: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 6,
    },
  }),
  clay: Platform.select<any>({
    web: { boxShadow: "0px 4px 0px rgba(70,163,2,1)" },
    default: {
      shadowColor: "#46A302",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
  }),
  clayPressed: Platform.select<any>({
    web: { boxShadow: "0px 0px 0px rgba(70,163,2,1)" },
    default: {
      shadowColor: "#46A302",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 0,
    },
  }),
  glow: Platform.select<any>({
    web: { boxShadow: "0px 0px 12px rgba(88,204,2,0.3)" },
    default: {
      shadowColor: "#58CC02",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 4,
    },
  }),
};
