import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CARD_BG = "#111111";
const CARD_BORDER = "#222222";
const GREEN = "#58CC02";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const { data: issues = [] } = useQuery({ queryKey: ["/api/issues"] });

  // Dynamic user data
  const allIssues = issues as any[];
  const isRegularUser = user?.role === "user";
  const userPoints = isRegularUser ? (user as any).points ?? 0 : 0;
  const userLevel = isRegularUser ? (user as any).level ?? 1 : 1;
  const userIssuesResolved = isRegularUser ? (user as any).issuesResolved ?? 0 : 0;
  const userValidations = isRegularUser ? (user as any).validationsGiven ?? 0 : 0;
  const displayName = isRegularUser
    ? (user as any).displayName || user?.username || "Citizen"
    : user?.username || "Citizen";

  // XP
  const nextLevelXP = userLevel * 1000;
  const xpProgress = nextLevelXP > 0 ? Math.min(userPoints / nextLevelXP, 1) : 0;

  // Active reports
  const myIssues = allIssues.filter((i: any) => i.reporterId === user?.id);
  const activeReports = myIssues.filter((i: any) => i.status !== "resolved");
  const resolvedCount = myIssues.filter((i: any) => i.status === "resolved").length;

  // Rank title based on level
  const getRankTitle = (lvl: number) => {
    if (lvl >= 20) return "MASTER RESOLVER";
    if (lvl >= 10) return "CIVIC HERO";
    if (lvl >= 5) return "GUARDIAN";
    return "CITIZEN";
  };

  // Progress fraction per active issue (simulate)
  const issueProgress = (issue: any) => {
    switch (issue.status) {
      case "reported": return 0.2;
      case "verified": return 0.4;
      case "assigned": return 0.6;
      case "inProgress": return 0.8;
      default: return 0.1;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.logoIcon}>
              <Feather name="shield" size={16} color={GREEN} />
            </View>
            <ThemedText type="h4" style={{ fontWeight: "700", marginLeft: Spacing.sm }}>
              CivicResolv
            </ThemedText>
          </View>
          <Pressable style={styles.bellBtn}>
            <Feather name="bell" size={20} color="#FFFFFF" />
          </Pressable>
        </Animated.View>

        {/* ── Profile Card ── */}
        <Animated.View entering={FadeInUp.delay(60).duration(350)}>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Feather name="user" size={24} color={GREEN} />
              </View>
              <View style={{ marginLeft: Spacing.lg, flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "700", fontSize: 17 }}>
                  {displayName}
                </ThemedText>
                <ThemedText type="small" style={{ color: GREEN, fontWeight: "600", marginTop: 2, letterSpacing: 1 }}>
                  {getRankTitle(userLevel)} • LVL {userLevel}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="small" style={{ color: Colors.light.muted, marginTop: Spacing.lg }}>
              {userPoints.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
            </ThemedText>
            <View style={styles.xpBarBg}>
              <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` }]} />
            </View>
          </View>
        </Animated.View>

        {/* ── Credits + Report Row ── */}
        <Animated.View entering={FadeInUp.delay(120).duration(350)}>
          <View style={styles.twoCol}>
            <View style={[styles.card, styles.creditCard]}>
              <View style={styles.creditIcon}>
                <Feather name="credit-card" size={20} color={GREEN} />
              </View>
              <ThemedText type="small" style={{ color: Colors.light.muted, marginTop: Spacing.sm, textTransform: "uppercase", letterSpacing: 1, fontSize: 10 }}>
                Credits
              </ThemedText>
              <ThemedText type="h2" style={{ fontWeight: "700", marginTop: Spacing.xs }}>
                {userPoints}
              </ThemedText>
            </View>

            <Pressable
              style={[styles.reportBtn]}
              onPress={() => navigation.navigate("ReportIssue")}
            >
              <Feather name="plus-circle" size={32} color="#000000" />
              <ThemedText type="body" style={{ color: "#000000", fontWeight: "700", marginTop: Spacing.sm, textTransform: "uppercase", letterSpacing: 1 }}>
                Report
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── Active Reports ── */}
        <Animated.View entering={FadeInUp.delay(180).duration(350)}>
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <ThemedText type="h4" style={{ fontWeight: "700" }}>Active</ThemedText>
                <ThemedText type="small" style={{ color: Colors.light.muted, marginTop: 2 }}>
                  {activeReports.length} reports in progress
                </ThemedText>
              </View>
              <View style={styles.liveBadge}>
                <ThemedText type="small" style={{ color: GREEN, fontWeight: "700", fontSize: 10, letterSpacing: 1 }}>
                  LIVE
                </ThemedText>
              </View>
            </View>

            {activeReports.length > 0 ? (
              activeReports.slice(0, 4).map((issue: any) => (
                <Pressable
                  key={issue.id}
                  style={styles.activeItem}
                  onPress={() => navigation.navigate("IssueDetail", { issueId: issue.id })}
                >
                  <View style={styles.activeItemIcon}>
                    <Feather
                      name={
                        issue.category === "roads" ? "alert-triangle" :
                        issue.category === "water" ? "droplet" :
                        issue.category === "waste" ? "trash-2" :
                        issue.category === "electricity" ? "zap" :
                        issue.category === "drainage" ? "cloud-rain" :
                        "alert-circle"
                      }
                      size={18}
                      color={Colors.light.muted}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
                      {issue.title}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: Colors.light.muted, marginTop: 2 }} numberOfLines={1}>
                      {issue.address || issue.category}
                    </ThemedText>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${issueProgress(issue) * 100}%` }]} />
                    </View>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyActive}>
                <Feather name="check-circle" size={32} color={Colors.light.muted} />
                <ThemedText type="small" style={{ color: Colors.light.muted, marginTop: Spacing.sm }}>
                  No active reports
                </ThemedText>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Nearby ── */}
        <Animated.View entering={FadeInUp.delay(240).duration(350)}>
          <View style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <ThemedText type="h4" style={{ fontWeight: "700" }}>Nearby</ThemedText>
              <Feather name="navigation" size={20} color={GREEN} />
            </View>
            {/* Simulated map area */}
            <View style={styles.mapArea}>
              <View style={styles.mapGrid}>
                {[...Array(5)].map((_, i) => (
                  <View key={`h${i}`} style={[styles.mapLineH, { top: `${(i + 1) * 16.6}%` }]} />
                ))}
                {[...Array(5)].map((_, i) => (
                  <View key={`v${i}`} style={[styles.mapLineV, { left: `${(i + 1) * 16.6}%` }]} />
                ))}
              </View>
              {/* Nearby issues as pins */}
              {allIssues.slice(0, 2).map((issue: any, idx: number) => (
                <View key={issue.id} style={[styles.nearbyPin, idx === 0 ? { left: 20, bottom: 20 } : { left: 100, bottom: 30 }]}>
                  <ThemedText type="small" style={{ fontWeight: "600", fontSize: 11 }}>
                    {issue.title?.split(" ")[0] || "Issue"}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: GREEN, fontSize: 10 }}>
                    {(idx + 1) * 200}m
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* ── Bottom Stats ── */}
        <Animated.View entering={FadeInUp.delay(300).duration(350)}>
          <View style={styles.twoCol}>
            <View style={[styles.card, styles.statCard]}>
              <ThemedText type="h3" style={{ color: GREEN, fontWeight: "700" }}>
                {resolvedCount > 999 ? `${(resolvedCount / 1000).toFixed(0)}k` : resolvedCount}
              </ThemedText>
              <ThemedText type="small" style={{ color: Colors.light.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: Spacing.xs, fontSize: 10 }}>
                Resolved
              </ThemedText>
            </View>
            <View style={[styles.card, styles.statCard]}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ThemedText type="h3" style={{ fontWeight: "700" }}>
                  {userValidations}
                </ThemedText>
                <View style={styles.civicDot} />
              </View>
              <ThemedText type="small" style={{ color: Colors.light.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: Spacing.xs, fontSize: 10 }}>
                Civics
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GREEN + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // Cards
  card: {
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },

  // Profile
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1A1A1A",
    borderWidth: 1.5,
    borderColor: CARD_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  xpBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1A1A1A",
    marginTop: Spacing.sm,
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: GREEN,
  },

  // Credits + Report
  twoCol: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  creditCard: {
    flex: 1,
    marginBottom: 0,
    alignItems: "flex-start",
  },
  creditIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: GREEN + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  reportBtn: {
    flex: 1,
    backgroundColor: GREEN,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },

  // Active
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  liveBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: GREEN + "40",
    backgroundColor: GREEN + "10",
  },
  activeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  activeItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#222222",
    alignItems: "center",
    justifyContent: "center",
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2A2A2A",
    marginTop: Spacing.sm,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: GREEN,
  },
  emptyActive: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },

  // Nearby
  mapArea: {
    height: 120,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#0A0A0A",
    marginTop: Spacing.lg,
    overflow: "hidden",
    position: "relative",
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#1A1A1A",
  },
  mapLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#1A1A1A",
  },
  nearbyPin: {
    position: "absolute",
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  // Stats
  statCard: {
    flex: 1,
    marginBottom: 0,
    alignItems: "center",
  },
  civicDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
    marginLeft: Spacing.xs,
  },
});
