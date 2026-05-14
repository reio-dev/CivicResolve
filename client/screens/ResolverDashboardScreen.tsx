import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const C = Colors.light;
type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const priorityColor = (p?: string) => {
  if (p === "critical" || p === "high") return C.error;
  if (p === "medium") return C.warning;
  return C.muted;
};

const priorityIcon = (p?: string): any =>
  p === "critical" || p === "high" ? "alert-circle" : p === "medium" ? "alert-triangle" : "globe";

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ResolverDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  const { data, isLoading } = useQuery<any>({
    queryKey: [`/api/resolver/dashboard/${user?.id}`],
    enabled: !!user?.id && user?.role === "resolver",
  });

  if (isLoading) {
    return (
      <ThemedView style={[$s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </ThemedView>
    );
  }

  if (!data || !data.resolver || typeof data.resolver !== "object") {
    return (
      <ThemedView style={[$s.root, { paddingTop: insets.top, justifyContent: "center", alignItems: "center", padding: Spacing.xl }]}>
        <ThemedText style={{ color: C.error, textAlign: "center", fontWeight: "700", marginBottom: Spacing.sm }}>
          Unable to load dashboard.
        </ThemedText>
        <ThemedText style={{ color: C.muted, textAlign: "center", fontSize: 12 }}>
          {data?.error ?? (data ? `Unexpected payload: ${JSON.stringify(data).substring(0, 80)}` : "No data returned")}
        </ThemedText>
      </ThemedView>
    );
  }

  const xp = Number(data.resolver?.xp ?? 0);
  const level = Number(data.resolver?.level ?? 1);
  const uptime = Number(data.resolver?.uptime ?? 0);
  const rankings: any[] = data.departmentRankings ?? [];
  const queue: any[] = data.priorityQueue ?? [];
  const activeJob = data.activeJob ?? null;
  const critical = data.criticalAlert ?? null;
  const myDeptId = data.myDepartmentId ?? null;
  const maxResolved = Math.max(...rankings.map((d) => d.totalResolved ?? 0), 1);

  const goActiveJob = () => {
    if (activeJob) {
      navigation.navigate("ResolverIssueDetail", {
        assignmentId: activeJob.assignmentId,
        issueId: activeJob.id,
      });
    }
  };

  const goIssue = (issueId: string) => navigation.navigate("IssueDetail", { issueId });

  return (
    <ThemedView style={$s.root}>
      <ScrollView
        contentContainerStyle={[
          $s.scroll,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── App Header ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(0)} style={$s.appHeader}>
          <View style={$s.brandRow}>
            <Feather name="shield" size={18} color={C.primary} />
            <ThemedText style={$s.brandName}>CivicResolv</ThemedText>
          </View>
          <Pressable style={$s.bellBtn}>
            <Feather name="bell" size={20} color={C.text} />
          </Pressable>
        </Animated.View>

        {/* ── Title ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(50)} style={{ marginBottom: Spacing.lg }}>
          <ThemedText style={$s.titleWhite}>Resolver</ThemedText>
          <ThemedText style={$s.titleGreen}>Dashboard</ThemedText>
          <ThemedText style={$s.subtitle}>Your precision work queue is ready.</ThemedText>
        </Animated.View>

        {/* ── XP Pill ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(100)} style={$s.xpPill}>
          <View style={$s.xpLeft}>
            <Feather name="zap" size={14} color="#000" />
            <ThemedText style={$s.xpText}>+{xp.toLocaleString()} XP</ThemedText>
          </View>
          <View style={$s.levelChip}>
            <ThemedText style={$s.levelText}>LEVEL {level}</ThemedText>
          </View>
        </Animated.View>

        {/* ── Active Job Card ── */}
        {activeJob && (
          <Animated.View entering={FadeInDown.duration(350).delay(150)} style={$s.card}>
            <View style={$s.activeBadge}>
              <ThemedText style={$s.activeBadgeText}>ACTIVE JOB</ThemedText>
            </View>

            <View style={$s.activeJobRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={$s.jobTitle}>{activeJob.title ?? "Active Issue"}</ThemedText>
                <ThemedText style={$s.jobMeta}>
                  {activeJob.address ?? "Unknown Location"} • {(activeJob.priority ?? "medium").toUpperCase()} URGENCY
                </ThemedText>
              </View>
              <View style={$s.jobIcon}>
                <Feather name="home" size={20} color={C.primary} />
              </View>
            </View>

            {/* Map stub */}
            <View style={$s.mapStub}>
              <Feather name="map" size={50} color={C.border} style={{ opacity: 0.3 }} />
              <View style={$s.distancePill}>
                <View style={$s.distanceDot} />
                <ThemedText style={$s.distanceLabel}>{activeJob.distance ?? "Near current location"}</ThemedText>
              </View>
            </View>

            <Pressable style={$s.resumeBtn} onPress={goActiveJob}>
              <ThemedText style={$s.resumeBtnText}>RESUME RESOLUTION</ThemedText>
              <Feather name="arrow-right" size={16} color="#000" />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Global Standings ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(200)} style={$s.card}>
          <ThemedText style={$s.sectionLabel}>GLOBAL STANDINGS</ThemedText>
          <ThemedText style={$s.cardTitle}>Team Rank</ThemedText>

          <View style={{ gap: Spacing.sm }}>
            {rankings.slice(0, 3).map((dept) => {
              const isMe = dept.departmentId === myDeptId;
              const progress = ((dept.totalResolved ?? 0) / maxResolved) * 100;
              return (
                <View
                  key={dept.departmentId}
                  style={[
                    $s.rankRow,
                    isMe && { backgroundColor: `${C.primary}12`, borderWidth: 1, borderColor: `${C.primary}33`, borderRadius: BorderRadius.sm, padding: Spacing.sm, marginHorizontal: -Spacing.sm },
                  ]}
                >
                  <View style={[$s.rankBadge, isMe && { backgroundColor: C.primary }]}>
                    <ThemedText style={[$s.rankNum, isMe && { color: "#000", fontWeight: "700" }]}>
                      {String(dept.rank ?? 0).padStart(2, "0")}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <ThemedText style={[$s.rankName, isMe && { color: C.primary }]}>
                      {isMe
                        ? `YOU (${(dept.name ?? "").toUpperCase()})`
                        : (dept.name ?? "Unknown").replace(" ", "_")}
                    </ThemedText>
                    <View style={$s.progBg}>
                      <View
                        style={[
                          $s.progFill,
                          { width: `${progress}%` as any, backgroundColor: isMe ? C.primary : "#4ADE80" },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={$s.nextTierBox}>
            <ThemedText style={$s.nextTierLabel}>NEXT TIER</ThemedText>
            <ThemedText style={$s.nextTierVal}>{Math.max(0, level * 1000 - xp)} XP to Silver</ThemedText>
          </View>
        </Animated.View>

        {/* ── Emergency Alert ── */}
        {critical && (
          <Animated.View entering={FadeInDown.duration(350).delay(260)} style={$s.alertCard}>
            <View style={$s.alertIconWrap}>
              <Feather name="alert-triangle" size={18} color={C.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={$s.alertTitle}>Emergency Alert</ThemedText>
              <ThemedText style={$s.alertDesc}>
                {critical.title} in {critical.district ?? "Grid 4"}. {(critical.description ?? "").substring(0, 60)}...
              </ThemedText>
            </View>
          </Animated.View>
        )}

        {/* ── Uptime ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(310)} style={$s.card}>
          <ThemedText style={$s.sectionLabel}>UPTIME</ThemedText>
          <ThemedText style={$s.uptimeVal}>{uptime}%</ThemedText>
          <ThemedText style={$s.uptimeLabel}>RESOLUTION ACCURACY</ThemedText>
        </Animated.View>

        {/* ── Priority Queue ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(360)} style={$s.card}>
          <View style={$s.queueHeader}>
            <ThemedText style={$s.cardTitle}>Priority Queue</ThemedText>
            <Pressable style={$s.viewAllBtn}>
              <ThemedText style={$s.viewAllText}>VIEW ALL</ThemedText>
              <Feather name="external-link" size={12} color={C.primary} />
            </Pressable>
          </View>

          {queue.length === 0 && (
            <ThemedText style={{ color: C.muted, textAlign: "center", marginVertical: Spacing.xl, fontSize: 13 }}>
              No pending issues.
            </ThemedText>
          )}

          {queue.map((item, i) => (
            <Pressable key={item.id ?? i} style={$s.queueRow} onPress={() => goIssue(item.id)}>
              <View style={[$s.queueIconBg, { backgroundColor: `${priorityColor(item.priority)}22` }]}>
                <Feather name={priorityIcon(item.priority)} size={16} color={priorityColor(item.priority)} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText style={$s.queueTitle}>{item.title ?? "Unknown Issue"}</ThemedText>
                <ThemedText style={$s.queueMeta}>{item.address ?? "Unknown"} • 2.1KM</ThemedText>
              </View>
              <View style={[$s.priorityChip, { borderColor: priorityColor(item.priority) }]}>
                <ThemedText style={[$s.priorityChipText, { color: priorityColor(item.priority) }]}>
                  {(item.priority ?? "low").toUpperCase()}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </Animated.View>

        {/* ── Master Status ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(420)} style={$s.masterCard}>
          <View style={$s.masterIconWrap}>
            <Feather name="award" size={24} color="#000" />
          </View>
          <ThemedText style={$s.masterTitle}>MASTER RESOLVER STATUS</ThemedText>
          <View style={$s.masterDivider} />
          <ThemedText style={$s.masterVerified}>VERIFIED</ThemedText>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const C2 = Colors.light;
const $s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C2.backgroundRoot,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
  },
  // Header
  appHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  brandName: {
    fontSize: 15,
    fontWeight: "700",
    color: C2.text,
    letterSpacing: 0.3,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C2.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C2.border,
  },
  // Title
  titleWhite: {
    fontSize: 38,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 42,
    letterSpacing: -1,
  },
  titleGreen: {
    fontSize: 38,
    fontWeight: "900",
    color: C2.primary,
    lineHeight: 42,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    color: C2.muted,
    marginTop: Spacing.xs,
  },
  // XP Pill
  xpPill: {
    backgroundColor: C2.primary,
    borderRadius: BorderRadius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  xpLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  xpText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 15,
  },
  levelChip: {
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  levelText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  // Card base
  card: {
    backgroundColor: C2.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: C2.border,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: C2.muted,
    letterSpacing: 2,
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C2.text,
    marginBottom: Spacing.lg,
  },
  // Active Job
  activeBadge: {
    alignSelf: "flex-start",
    backgroundColor: `${C2.primary}18`,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginBottom: Spacing.md,
  },
  activeBadgeText: {
    color: C2.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  activeJobRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  jobTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: C2.text,
    marginBottom: 4,
    lineHeight: 28,
  },
  jobMeta: {
    fontSize: 12,
    color: C2.muted,
  },
  jobIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${C2.primary}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  mapStub: {
    height: 110,
    backgroundColor: C2.backgroundRoot,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: C2.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: Spacing.sm,
  },
  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C2.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: C2.border,
    alignSelf: "flex-start",
  },
  distanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C2.primary,
    marginRight: Spacing.xs,
  },
  distanceLabel: {
    color: C2.text,
    fontSize: 9,
    fontWeight: "700",
  },
  resumeBtn: {
    backgroundColor: C2.primary,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  resumeBtnText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1.5,
  },
  // Rankings
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C2.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNum: {
    color: C2.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  rankName: {
    color: C2.text,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  progBg: {
    height: 3,
    backgroundColor: C2.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  progFill: {
    height: "100%",
    borderRadius: 2,
  },
  nextTierBox: {
    backgroundColor: C2.backgroundRoot,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  nextTierLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: C2.muted,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  nextTierVal: {
    color: C2.text,
    fontWeight: "700",
    fontSize: 14,
  },
  // Alert
  alertCard: {
    backgroundColor: `${C2.warning}0D`,
    borderWidth: 1,
    borderColor: `${C2.warning}33`,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  alertIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${C2.warning}22`,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  alertTitle: {
    color: C2.text,
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 4,
  },
  alertDesc: {
    color: C2.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  // Uptime
  uptimeVal: {
    color: C2.primary,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -2,
    lineHeight: 56,
  },
  uptimeLabel: {
    color: C2.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 2,
  },
  // Queue
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    color: C2.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C2.backgroundRoot,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  queueIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  queueTitle: {
    color: C2.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  queueMeta: {
    color: C2.muted,
    fontSize: 11,
  },
  priorityChip: {
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 3,
  },
  priorityChipText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  // Master
  masterCard: {
    backgroundColor: C2.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  masterIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  masterTitle: {
    color: "#000",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },
  masterDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginVertical: Spacing.sm,
  },
  masterVerified: {
    color: "#000",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    opacity: 0.6,
  },
});
