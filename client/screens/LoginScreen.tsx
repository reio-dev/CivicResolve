import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Pressable,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";

type LoginMode = "user_login" | "user_register" | "resolver";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { login, register, resolverLogin } = useAuth();
  const { t } = useTranslation();

  const [mode, setMode] = useState<LoginMode>("user_login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t("login.fillAll"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (mode === "resolver") {
        await resolverLogin(username.trim(), password);
      } else if (mode === "user_login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, displayName.trim() || username.trim());
      }
    } catch (err: any) {
      setError(err.message || t("login.authFailed"));
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "resolver": return t("login.titleResolver");
      case "user_register": return t("login.titleRegister");
      default: return t("login.titleLogin");
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case "resolver": return t("login.btnResolver");
      case "user_register": return t("login.btnRegister");
      default: return t("login.btnLogin");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.light.backgroundRoot }]} />

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
      >
        <Animated.View entering={FadeIn.duration(600)} style={styles.headerSection}>
          <View style={styles.iconContainer}>
            <Feather
              name={mode === "resolver" ? "tool" : "shield"}
              size={48}
              color={Colors.light.primary}
            />
          </View>
          <ThemedText type="h1" style={styles.title}>
            CivicResolv
          </ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            {mode === "resolver" ? t("login.subtitleResolver") : t("login.subtitleUser")}
          </ThemedText>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(200).duration(500)}
          style={[styles.formCard, { backgroundColor: Colors.light.surface }]}
        >
          <ThemedText type="h3" style={styles.formTitle}>
            {getTitle()}
          </ThemedText>

          {error ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color={Colors.light.error} />
              <ThemedText type="small" style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          {mode === "user_register" ? (
            <View style={[styles.inputContainer, { borderColor: Colors.light.border, backgroundColor: Colors.light.backgroundRoot }]}>
              <Feather name="user" size={20} color={Colors.light.muted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: Colors.light.text }]}
                placeholder={t("login.displayName")}
                placeholderTextColor={Colors.light.muted}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>
          ) : null}

          <View style={[styles.inputContainer, { borderColor: Colors.light.border, backgroundColor: Colors.light.backgroundRoot }]}>
            <Feather name="at-sign" size={20} color={Colors.light.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: Colors.light.text }]}
              placeholder={t("login.username")}
              placeholderTextColor={Colors.light.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.inputContainer, { borderColor: Colors.light.border, backgroundColor: Colors.light.backgroundRoot }]}>
            <Feather name="lock" size={20} color={Colors.light.muted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: Colors.light.text }]}
              placeholder={t("login.password")}
              placeholderTextColor={Colors.light.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
            ]}
          >
            <View
              style={[
                styles.submitButtonInner,
                {
                  backgroundColor: Colors.light.primary,
                },
                ...(loading ? [] : [mode === "resolver" ? Shadows.medium : Shadows.clay]),
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText type="body" style={styles.submitButtonText}>
                  {getButtonText()}
                </ThemedText>
              )}
            </View>
          </Pressable>

          {mode !== "resolver" ? (
            <Pressable
              onPress={() => setMode(mode === "user_login" ? "user_register" : "user_login")}
              style={styles.switchButton}
            >
              <ThemedText type="small" style={{ color: Colors.light.muted }}>
                {mode === "user_login" ? t("login.noAccount") : t("login.hasAccount")}
                <ThemedText type="small" style={{ color: Colors.light.primary, fontWeight: "600" }}>
                  {mode === "user_login" ? t("login.signUp") : t("login.signIn")}
                </ThemedText>
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: Colors.light.border }]} />
            <ThemedText type="small" style={[styles.dividerText, { color: Colors.light.muted }]}>
              {t("login.or")}
            </ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: Colors.light.border }]} />
          </View>

          <Pressable
            onPress={() => {
              setMode(mode === "resolver" ? "user_login" : "resolver");
              setError("");
            }}
            style={[styles.altButton, { borderColor: Colors.light.border }]}
          >
            <Feather
              name={mode === "resolver" ? "users" : "tool"}
              size={18}
              color={Colors.light.primary}
              style={{ marginRight: Spacing.sm }}
            />
            <ThemedText type="small" style={{ color: Colors.light.primary, fontWeight: "600" }}>
              {mode === "resolver" ? t("login.loginUser") : t("login.loginResolver")}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor: "rgba(88, 204, 2, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    color: "#F8FAFC",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: "rgba(248,250,252,0.7)",
  },
  formCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  formTitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  errorText: {
    color: Colors.light.error,
    flex: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    height: Spacing.inputHeight,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  submitButton: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  submitButtonPressed: {
    transform: [{ translateY: 4 }],
  },
  submitButtonInner: {
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  switchButton: {
    alignItems: "center",
    marginTop: Spacing.xl,
    padding: Spacing.sm,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.lg,
  },
  altButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    height: Spacing.buttonHeight,
  },
});
