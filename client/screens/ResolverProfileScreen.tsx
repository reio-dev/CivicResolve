import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { Colors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

// ─── Design Tokens ───────────────────────────────
const SECONDARY = Colors.light.primary;
const BG = Colors.light.backgroundRoot;
const CARD = Colors.light.surface;
const CARD2 = Colors.light.surfaceHighlight;
const TEXT = Colors.light.text;
const DIM = Colors.light.textSecondary;
const GREEN = Colors.light.primary;
const SCREEN_W = Dimensions.get("window").width;

// ─── Tier computation ────────────────────────────
function getTierLabel(level: number): string {
  if (level >= 20) return "MASTER RESOLVER";
  if (level >= 15) return "SENIOR RESOLVER";
  if (level >= 10) return "EXPERT RESOLVER";
  if (level >= 5) return "FIELD SPECIALIST";
  return "FIELD RESOLVER";
}

function getNextLevelXP(level: number): number {
  return level * 1000;
}

// ─── Medal data derived from resolver stats ──────
function buildMedals(user: any, totalResolved: number) {
  return [
    {
      id: "wrench",
      name: "Master Fixer",
      tier: totalResolved >= 10 ? `${totalResolved} resolved` : "Locked",
      icon: "tool" as const,
      earned: totalResolved >= 5,
    },
    {
      id: "shield",
      name: "Field Guardian",
      tier: (user as any).level >= 5 ? `Level ${(user as any).level}` : "Locked",
      icon: "shield" as const,
      earned: ((user as any).level ?? 1) >= 5,
    },
    {
      id: "zap",
      name: "Quick Response",
      tier: totalResolved >= 3 ? `${totalResolved} cases` : "Locked",
      icon: "zap" as const,
      earned: totalResolved >= 3,
    },
    {
      id: "star",
      name: "Community Star",
      tier: (user as any).rating >= 4 ? `${(user as any).rating?.toFixed(1)} ★` : "Locked",
      icon: "star" as const,
      earned: ((user as any).rating ?? 0) >= 4,
    },
  ];
}

// ─── Sub-components ───────────────────────────────
function MedalCard({ medal }: { medal: ReturnType<typeof buildMedals>[0] }) {
  return (
    <View style={styles.medalCard}>
      <View style={[styles.medalIcon, { backgroundColor: medal.earned ? SECONDARY + "22" : CARD2 }]}>
        <Feather name={medal.icon} size={22} color={medal.earned ? SECONDARY : DIM} />
      </View>
      <ThemedText style={styles.medalName} numberOfLines={1}>{medal.name}</ThemedText>
      <ThemedText style={styles.medalTier}>{medal.tier}</ThemedText>
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
  color = SECONDARY,
  delay = 0,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string | number;
  label: string;
  color?: string;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(350)} style={styles.statCard}>
      <Feather name={icon} size={20} color={color} style={{ marginBottom: 8 }} />
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────
export default function ResolverProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  if (user?.role !== "resolver") return null;

  const adminUserId = user?.id ?? null;
  const resolverId = (user as any)?.resolverId ?? null;

  // Fetch resolver dashboard data
  const { data: dashboard } = useQuery<any>({
    queryKey: ["/api/resolver/dashboard", adminUserId],
    queryFn: async () => {
      if (!adminUserId) throw new Error("No user id");
      const apiUrl = `${getApiUrl()}/api/resolver/dashboard/${adminUserId}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Failed to fetch dashboard");
      return response.json();
    },
    enabled: !!adminUserId && user?.role === "resolver",
  });

  // Fetch assignments for active count
  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["/api/resolver", resolverId, "assignments"],
    queryFn: async () => {
      if (!resolverId) return [];
      const apiUrl = `${getApiUrl()}/api/resolver/${resolverId}/assignments`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error("Failed to fetch assignments");
      return response.json();
    },
    enabled: !!resolverId,
  });

  const displayName = (user as any)?.name || user?.username || "Resolver";
  const initial = displayName[0].toUpperCase();
  const level = dashboard?.resolver?.level ?? 1;
  const currentXP = dashboard?.resolver?.xp ?? 0;
  const nextLevelXP = getNextLevelXP(level);
  const xpProgress = nextLevelXP > 0 ? Math.min(currentXP / nextLevelXP, 1) : 0;
  const tierLabel = getTierLabel(level);
  const totalResolved = dashboard?.resolver?.totalResolved ?? 0;
  const activeAssignments = assignments.filter((a: any) => a.status !== "completed").length;
  const rating = (user as any)?.rating ?? 0;
  const specializations = (user as any)?.specializations ?? [];

  const medals = useMemo(() => buildMedals(user, totalResolved), [user, totalResolved]);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: tabBarHeight + 24 },
        ]}
      >
        {/* ── Header ── */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <Pressable 
            style={styles.settingsBtn}
            onPress={() => navigation.navigate("Settings")}
          >
            <Feather name="settings" size={24} color={TEXT} />
          </Pressable>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {(user as any)?.avatarUrl ? (
              <Image source={{ uri: (user as any).avatarUrl }} style={styles.avatarGradient} />
            ) : (
              <LinearGradient colors={["#16A34A", GREEN]} style={styles.avatarGradient}>
                <ThemedText style={styles.avatarInitial}>{initial}</ThemedText>
              </LinearGradient>
            )}
            <View style={[styles.levelBadge, { backgroundColor: SECONDARY }]}>
              <ThemedText style={styles.levelBadgeText}>Lvl {level}</ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.tierLabel, { color: SECONDARY }]}>{tierLabel}</ThemedText>
          <ThemedText style={styles.nameText}>{displayName}</ThemedText>

          {/* Role badge */}
          <View style={[styles.roleBadge, { backgroundColor: SECONDARY + "15", borderColor: SECONDARY + "30" }]}>
            <Feather name="shield" size={12} color={SECONDARY} />
            <ThemedText style={[styles.roleBadgeText, { color: SECONDARY }]}>
              {t("resolverProfile.fieldResolver")}
            </ThemedText>
          </View>

          {/* Specializations */}
          {specializations.length > 0 && (
            <ThemedText style={styles.bioText}>
              {specializations.map((s: string) => s.replace("_", " ")).join(", ")}
            </ThemedText>
          )}

          <Pressable 
            style={({ pressed }) => [styles.editBtn, { borderColor: SECONDARY }, pressed && { opacity: 0.75 }]}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <ThemedText style={[styles.editBtnText, { color: SECONDARY }]}>{t("profile.editProfile")}</ThemedText>
          </Pressable>
        </Animated.View>

        {/* ── XP Card ── */}
        <Animated.View entering={FadeInUp.delay(80).duration(350)} style={styles.xpCard}>
          <View style={styles.xpCardHeader}>
            <ThemedText style={styles.xpLabel}>{t("profile.totalExperience")}</ThemedText>
            <Feather name="trending-up" size={18} color={SECONDARY} />
          </View>

          <View style={styles.xpValueRow}>
            <ThemedText style={styles.xpNumber}>{currentXP.toLocaleString()}</ThemedText>
            <ThemedText style={[styles.xpUnit, { color: SECONDARY }]}>XP</ThemedText>
          </View>

          <View style={styles.xpBarMeta}>
            <ThemedText style={styles.xpMetaLeft}>{t("profile.nextLevel")}: {nextLevelXP.toLocaleString()}</ThemedText>
            <ThemedText style={[styles.xpMetaRight, { color: SECONDARY }]}>{Math.round(xpProgress * 100)}%</ThemedText>
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` as any, backgroundColor: SECONDARY }]} />
          </View>
        </Animated.View>

        {/* ── Stats ── */}
        <View style={styles.statsRow}>
          <StatCard icon="check-circle" value={totalResolved} label={t("resolverProfile.resolved")} delay={140} />
          <StatCard icon="clipboard" value={activeAssignments} label={t("resolverProfile.active")} color="#F59E0B" delay={200} />
        </View>

        <StatCard icon="star" value={rating > 0 ? rating.toFixed(1) : "—"} label={t("resolverProfile.rating")} color="#F59E0B" delay={260} />

        {/* ── Medal Case ── */}
        <Animated.View entering={FadeInUp.delay(320).duration(350)} style={styles.medalSection}>
          <ThemedText style={styles.medalSectionTitle}>{t("profile.medalCase")}</ThemedText>
          <View style={styles.medalGrid}>
            {medals.map((m) => (
              <MedalCard key={m.id} medal={m} />
            ))}
          </View>
        </Animated.View>

        {/* ── Log Out ── */}
        <Animated.View entering={FadeInUp.delay(380).duration(350)}>
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.75 }]}
            onPress={logout}
          >
            <Feather name="log-out" size={18} color="#EF4444" />
            <ThemedText style={styles.logoutText}>{t("profile.logOut")}</ThemedText>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

// ─── Styles ──────────────────────────────────────
const CARD_RADIUS = 20;
const MEDAL_W = (SCREEN_W - 32 - 40 - 12) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: 16 },

  // ── Header ──
  header: {
    backgroundColor: CARD,
    borderRadius: CARD_RADIUS,
    padding: 20,
    alignItems: "center",
    marginBottom: 10,
    position: "relative",
  },
  settingsBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    zIndex: 10,
    padding: 4,
  },
  avatarWrap: { alignItems: "center", marginBottom: 10 },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { fontSize: 32, fontWeight: "800", color: "#fff" },
  levelBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: CARD,
  },
  levelBadgeText: { fontSize: 10, fontWeight: "800", color: "#000" },
  tierLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  nameText: { fontSize: 26, fontWeight: "800", color: TEXT, marginBottom: 6 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
  roleBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  bioText: { fontSize: 13, color: DIM, textAlign: "center", lineHeight: 19, marginBottom: 16, textTransform: "capitalize" },
  editBtn: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 36,
    paddingVertical: 9,
  },
  editBtnText: { fontWeight: "700", fontSize: 14 },

  // ── XP ──
  xpCard: { backgroundColor: CARD, borderRadius: CARD_RADIUS, padding: 20, marginBottom: 10 },
  xpCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  xpLabel: { fontSize: 11, fontWeight: "600", color: DIM, letterSpacing: 1 },
  xpValueRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8 },
  xpNumber: { fontSize: 48, fontWeight: "900", color: TEXT, lineHeight: 56 },
  xpUnit: { fontSize: 24, fontWeight: "700", marginBottom: 4, marginLeft: 4 },
  xpBarMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  xpMetaLeft: { fontSize: 12, color: DIM },
  xpMetaRight: { fontSize: 12, fontWeight: "700" },
  xpBarBg: { height: 10, borderRadius: 5, backgroundColor: CARD2, overflow: "hidden" },
  xpBarFill: { height: "100%", borderRadius: 5 },

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: CARD_RADIUS,
    padding: 24,
    marginBottom: 10,
    alignItems: "center",
  },
  statValue: { fontSize: 52, fontWeight: "900", color: TEXT, letterSpacing: -1 },
  statLabel: { fontSize: 11, fontWeight: "700", color: DIM, letterSpacing: 2, marginTop: 4 },

  // ── Medal ──
  medalSection: {
    backgroundColor: CARD,
    borderRadius: CARD_RADIUS,
    padding: 20,
    marginBottom: 10,
  },
  medalSectionTitle: { fontSize: 20, fontWeight: "800", color: TEXT, marginBottom: 16 },
  medalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  medalCard: {
    width: MEDAL_W,
    backgroundColor: CARD2,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  medalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  medalName: { fontSize: 13, fontWeight: "700", color: TEXT, textAlign: "center" },
  medalTier: { fontSize: 11, color: DIM, marginTop: 3 },

  // ── Log out ──
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    backgroundColor: CARD,
    borderRadius: CARD_RADIUS,
    marginBottom: 8,
  },
  logoutText: { fontSize: 15, fontWeight: "700", color: "#EF4444" },
});
