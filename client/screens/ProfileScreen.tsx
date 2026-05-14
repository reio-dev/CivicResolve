import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { Colors } from "@/constants/theme";

// ─── Design Tokens ───────────────────────────────
const GREEN = Colors.light.primary;
const GREEN_DARK = Colors.light.primaryShadow;
const BG = Colors.light.backgroundRoot;
const CARD = Colors.light.surface;
const CARD2 = Colors.light.surfaceHighlight;
const TEXT = Colors.light.text;
const DIM = Colors.light.textSecondary;
const SCREEN_W = Dimensions.get("window").width;

// ─── Tier computation ────────────────────────────
function getTierLabel(level: number): string {
  if (level >= 20) return "ELITE CONTRIBUTOR";
  if (level >= 15) return "PREMIER CONTRIBUTOR";
  if (level >= 10) return "SENIOR CONTRIBUTOR";
  if (level >= 5) return "ESTABLISHED CONTRIBUTOR";
  return "RISING CONTRIBUTOR";
}

// Points to reach the next level (simple linear: level * 1000)
function getNextLevelXP(level: number): number {
  return level * 1000;
}

// Derive a user-friendly rank label from position in leaderboard
function getRankLabel(position: number, total: number): string {
  if (total === 0) return "—";
  const pct = Math.round((position / total) * 100);
  if (position === 1) return "#1";
  if (pct <= 3) return "Top 3%";
  if (pct <= 10) return "Top 10%";
  if (pct <= 25) return "Top 25%";
  if (pct <= 50) return "Top 50%";
  return `#${position}`;
}

// ─── Medal data derived from user stats ──────────
function buildMedals(user: any) {
  return [
    {
      id: "earth",
      name: "Earth Guardian",
      tier: (user as any).level >= 8 ? `Tier ${(user as any).level}` : "Locked",
      icon: "globe" as const,
      earned: ((user as any).issuesReported ?? 0) >= 5,
    },
    {
      id: "heart",
      name: "Heart of City",
      tier: (user as any).createdAt
        ? `${Math.max(1, Math.floor((Date.now() - new Date((user as any).createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)))} Month`
        : "—",
      icon: "heart" as const,
      earned: false,
    },
    {
      id: "fixer",
      name: "Swift Fixer",
      tier: (user as any).level >= 4 ? `Tier ${Math.min((user as any).level, 4)}` : "Locked",
      icon: "zap" as const,
      earned: ((user as any).issuesResolved ?? 0) >= 3,
    },
    {
      id: "voice",
      name: "Mob Voice",
      tier: (user as any).validationsGiven >= 3 ? `Tier ${Math.min(Math.floor((user as any).validationsGiven / 3), 5)}` : "Locked",
      icon: "users" as const,
      earned: ((user as any).validationsGiven ?? 0) >= 3,
    },
  ];
}

// ─── Sub-components ───────────────────────────────
function MedalCard({ medal }: { medal: ReturnType<typeof buildMedals>[0] }) {
  return (
    <View style={styles.medalCard}>
      <View style={[styles.medalIcon, { backgroundColor: medal.earned ? GREEN + "22" : CARD2 }]}>
        <Feather name={medal.icon} size={22} color={medal.earned ? GREEN : DIM} />
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
  delay = 0,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string | number;
  label: string;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(350)} style={styles.statCard}>
      <Feather name={icon} size={20} color={GREEN} style={{ marginBottom: 8 }} />
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, logout } = useAuth();

  // Leaderboard for rank computation
  const { data: leaderboard } = useQuery({ queryKey: ["/api/leaderboard"] });

  // Streak: number of validations given (each validation ≈ 1 day of community activity)
  const streak = (user as any)?.validationsGiven ?? 0;

  // Compute rank
  const rankLabel = useMemo(() => {
    const lb = (leaderboard as any[]) ?? [];
    const idx = lb.findIndex((u: any) => u.id === user?.id);
    const pos = idx >= 0 ? idx + 1 : lb.length + 1;
    return getRankLabel(pos, lb.length || 1);
  }, [leaderboard, user?.id]);

  const displayName = (user as any)?.displayName || user?.username || "User";
  const initial = displayName[0].toUpperCase();
  const level = (user as any)?.level ?? 1;
  const currentXP = (user as any)?.points ?? 0;
  const nextLevelXP = getNextLevelXP(level);
  const xpProgress = Math.min(currentXP / nextLevelXP, 1);
  const tierLabel = getTierLabel(level);
  const issuesFixed = (user as any)?.issuesResolved ?? 0;
  const policyDrafts = (user as any)?.issuesReported ?? 0;

  // Member since text
  const memberSince = (user as any)?.createdAt
    ? new Date((user as any).createdAt).getFullYear()
    : new Date().getFullYear();

  const medals = useMemo(() => (user ? buildMedals(user) : []), [user]);

  const streakQuote = streak >= 30
    ? '"A community pillar."'
    : streak >= 10
      ? '"A steady contributor."'
      : '"Building momentum."';

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

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <LinearGradient colors={["#16A34A", GREEN]} style={styles.avatarGradient}>
              <ThemedText style={styles.avatarInitial}>{initial}</ThemedText>
            </LinearGradient>
            <View style={styles.levelBadge}>
              <ThemedText style={styles.levelBadgeText}>Lvl {level}</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.tierLabel}>{tierLabel}</ThemedText>
          <ThemedText style={styles.nameText}>{displayName}</ThemedText>
          <ThemedText style={styles.bioText}>
            CivicCore member since {memberSince}. Actively shaping the urban landscape through high-impact initiatives.
          </ThemedText>

          <Pressable style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.75 }]}>
            <ThemedText style={styles.editBtnText}>Edit Profile</ThemedText>
          </Pressable>
        </Animated.View>

        {/* ── XP Card ── */}
        <Animated.View entering={FadeInUp.delay(80).duration(350)} style={styles.xpCard}>
          <View style={styles.xpCardHeader}>
            <ThemedText style={styles.xpLabel}>TOTAL EXPERIENCE</ThemedText>
            <Feather name="trending-up" size={18} color={GREEN} />
          </View>

          <View style={styles.xpValueRow}>
            <ThemedText style={styles.xpNumber}>{currentXP.toLocaleString()}</ThemedText>
            <ThemedText style={styles.xpUnit}>XP</ThemedText>
          </View>

          <View style={styles.xpBarMeta}>
            <ThemedText style={styles.xpMetaLeft}>Next Level: {nextLevelXP.toLocaleString()}</ThemedText>
            <ThemedText style={styles.xpMetaRight}>{Math.round(xpProgress * 100)}%</ThemedText>
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` as any }]} />
          </View>
        </Animated.View>

        {/* ── Streak Card ── */}
        <Animated.View entering={FadeInUp.delay(160).duration(350)} style={styles.streakCard}>
          <View style={styles.streakHeader}>
            <ThemedText style={styles.streakLabel}>ACTIVITY STREAK</ThemedText>
            <Feather name="zap" size={18} color="#064E1E" />
          </View>
          <ThemedText style={styles.streakNumber}>{streak}</ThemedText>
          <ThemedText style={styles.streakDays}>Days</ThemedText>
          <ThemedText style={styles.streakQuote}>{streakQuote}</ThemedText>
        </Animated.View>

        {/* ── Stat: Issues Fixed ── */}
        <StatCard icon="check-circle" value={issuesFixed} label="ISSUES FIXED" delay={220} />

        {/* ── Stat: Global Rank ── */}
        <StatCard icon="award" value={rankLabel} label="GLOBAL RANK" delay={280} />

        {/* ── Stat: Policy Drafts (issues reported) ── */}
        <StatCard icon="file-text" value={policyDrafts} label="POLICY DRAFTS" delay={330} />

        {/* ── Medal Case ── */}
        <Animated.View entering={FadeInUp.delay(380).duration(350)} style={styles.medalSection}>
          <ThemedText style={styles.medalSectionTitle}>Medal Case</ThemedText>
          <View style={styles.medalGrid}>
            {medals.map((m) => (
              <MedalCard key={m.id} medal={m} />
            ))}
          </View>
        </Animated.View>

        {/* ── Log Out ── */}
        <Animated.View entering={FadeInUp.delay(440).duration(350)}>
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.75 }]}
            onPress={logout}
          >
            <Feather name="log-out" size={18} color="#EF4444" />
            <ThemedText style={styles.logoutText}>Log Out</ThemedText>
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
  },
  appBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
  },
  appBarLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  appBarTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
  bellBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: CARD2,
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: GREEN_DARK,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: CARD,
  },
  levelBadgeText: { fontSize: 10, fontWeight: "800", color: "#000" },
  tierLabel: { fontSize: 11, fontWeight: "700", color: GREEN, letterSpacing: 2, marginBottom: 4 },
  nameText: { fontSize: 26, fontWeight: "800", color: TEXT, marginBottom: 6 },
  bioText: { fontSize: 13, color: DIM, textAlign: "center", lineHeight: 19, marginBottom: 16 },
  editBtn: {
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 24,
    paddingHorizontal: 36,
    paddingVertical: 9,
  },
  editBtnText: { color: GREEN, fontWeight: "700", fontSize: 14 },

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
  xpUnit: { fontSize: 24, fontWeight: "700", color: GREEN, marginBottom: 4, marginLeft: 4 },
  xpBarMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  xpMetaLeft: { fontSize: 12, color: DIM },
  xpMetaRight: { fontSize: 12, fontWeight: "700", color: GREEN },
  xpBarBg: { height: 10, borderRadius: 5, backgroundColor: CARD2, overflow: "hidden" },
  xpBarFill: { height: "100%", borderRadius: 5, backgroundColor: GREEN },

  // ── Streak ──
  streakCard: {
    backgroundColor: GREEN,
    borderRadius: CARD_RADIUS,
    padding: 20,
    marginBottom: 10,
  },
  streakHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  streakLabel: { fontSize: 11, fontWeight: "700", color: "#064E1E", letterSpacing: 1 },
  streakNumber: { fontSize: 72, fontWeight: "900", color: "#000", lineHeight: 80 },
  streakDays: { fontSize: 26, fontWeight: "700", color: "#064E1E", marginTop: -4 },
  streakQuote: { fontSize: 13, color: "#064E1E", fontStyle: "italic", marginTop: 10 },

  // ── Stat ──
  statCard: {
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
