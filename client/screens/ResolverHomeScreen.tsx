import React from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { getApiUrl } from "@/lib/query-client";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface DashboardData {
  resolver: {
    totalResolved: number;
    uptime: number;
    level: number;
    xp: number;
    name: string;
  };
  activeJob: {
    id: string;
    assignmentId: string;
    title: string;
    address: string;
    priority: string;
    status: string;
  } | null;
  priorityQueue: any[];
  criticalAlert: any | null;
}

export default function ResolverHomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();

  const adminUserId = user?.id ?? null;
  const resolverId = user?.role === "resolver" ? user.resolverId : null;

  const { data: dashboard, isLoading: isDashboardLoading, refetch: refetchDashboard } = useQuery<DashboardData>({
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

  // Also fetch all assignments (for complete pending list)
  const { data: assignments = [], isLoading: isAssignmentsLoading, refetch: refetchAssignments } = useQuery<any[]>({
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

  const isLoading = isDashboardLoading || isAssignmentsLoading;
  const refetch = () => { refetchDashboard(); refetchAssignments(); };

  // Debug: log what we're working with
  console.log("[ResolverHome] user:", JSON.stringify(user));
  console.log("[ResolverHome] adminUserId:", adminUserId, "resolverId:", resolverId);
  console.log("[ResolverHome] dashboard:", JSON.stringify(dashboard));
  console.log("[ResolverHome] assignments:", JSON.stringify(assignments));

  const totalResolved = dashboard?.resolver?.totalResolved ?? 0;
  const pendingAssignments = assignments.filter((a: any) => a.status !== "completed");
  const completedCount = totalResolved;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.primary} />
        }
      >
        <View style={styles.header}>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>My Assignments</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.muted }]}>
            Manage your active resolver tasks and community contributions in one precision-built workspace.
          </ThemedText>
        </View>

        {/* Card 1: Active Resolver Tasks */}
        <Card style={styles.card} elevation={2}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Feather name="clipboard" size={Spacing.xl} color={theme.primary} />
              <View style={[styles.clockBadge, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="clock" size={Spacing.md} color={theme.primary} />
              </View>
            </View>
            <ThemedText style={[styles.cardTitleText, { color: theme.text }]}>Active Resolver Tasks</ThemedText>
          </View>
          <View style={styles.activeContent}>
            <ThemedText style={[styles.bigNumber, { color: theme.primary }]}>
              {pendingAssignments.length}
            </ThemedText>
            <ThemedText style={[styles.activeSubtext, { color: theme.muted }]}>
              {pendingAssignments.length === 0 ? "Awaiting direct\ndepartment\nassignment" : "Active tasks\nrequire your\nattention"}
            </ThemedText>
          </View>
        </Card>

        {/* Card 2: Successfully Resolved */}
        <Card style={styles.card} elevation={2}>
          <View style={styles.centeredContent}>
            <View style={[styles.checkCircle, { borderColor: theme.success }]}>
              <Feather name="check" size={Spacing.lg} color={theme.success} />
            </View>
            <ThemedText style={[styles.hugeWhiteNumber, { color: theme.buttonText }]}>
              {completedCount || 0}
            </ThemedText>
            <ThemedText style={[styles.resolvedLabel, { color: theme.buttonText }]}>SUCCESSFULLY RESOLVED</ThemedText>
            <View style={[styles.heroPill, { backgroundColor: theme.backgroundTertiary }]}>
              <ThemedText style={[styles.heroPillText, { color: theme.primary }]}>
                COMMUNITY HERO TIER
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* Card 3: Pending Review */}
        <Card style={styles.card} elevation={2}>
          {pendingAssignments.length === 0 ? (
            <View style={styles.centeredContent}>
              <View style={[styles.largeIconCircle, { backgroundColor: theme.backgroundTertiary }]}>
                <Feather name="box" size={Spacing["3xl"]} color={theme.muted} />
                <View style={[styles.plusBadge, { backgroundColor: theme.primary, borderColor: theme.backgroundSecondary }]}>
                  <Feather name="plus" size={Spacing.md} color={theme.backgroundRoot} />
                </View>
              </View>
              <ThemedText style={[styles.pendingTitle, { color: theme.text }]}>
                Assignments{"\n"}Pending Review
              </ThemedText>
              <ThemedText style={[styles.pendingDescription, { color: theme.muted }]}>
                Your workspace is currently clear. New civic resolution tasks are assigned directly by the department based on priority and your verified skill set. You will be notified immediately when a new case requires your expertise.
              </ThemedText>
            </View>
          ) : (
            <View>
              <View style={styles.pendingListHeader}>
                <ThemedText style={[styles.activeAssignmentsTitle, { color: theme.text }]}>
                  Active Assigments
                </ThemedText>
              </View>
              {pendingAssignments.map((assignment: any) => (
                <View key={assignment.id} style={[styles.assignmentItem, { borderBottomColor: theme.border }]}>
                  <ThemedText style={[styles.assignmentItemTitle, { color: theme.text }]}>
                    {assignment.issue?.title || "Assigned Issue"}
                  </ThemedText>
                  <View style={styles.assignmentMeta}>
                    <View style={styles.assignmentMetaRow}>
                      <Feather name="map-pin" size={Spacing.sm} color={theme.muted} />
                      <ThemedText style={[styles.assignmentMetaText, { color: theme.muted }]}>
                        {assignment.issue?.address || assignment.issue?.category || "Unknown location"}
                      </ThemedText>
                    </View>
                    <View style={styles.assignmentMetaRow}>
                      <View style={[styles.statusDot, { backgroundColor: theme.warning }]} />
                      <ThemedText style={[styles.assignmentMetaText, { color: theme.warning }]}>
                        {assignment.status.toUpperCase()}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Card 4: Resolution Impact */}
        <Card style={styles.card} elevation={2}>
          <ThemedText style={[styles.impactTitle, { color: theme.text }]}>Resolution Impact</ThemedText>
          <ThemedText style={[styles.impactDescription, { color: theme.muted }]}>
            Level {dashboard?.resolver?.level ?? 1} · {dashboard?.resolver?.xp ?? 0} XP earned
          </ThemedText>
          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundRoot }]}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: theme.primary,
                  width: `${Math.min(((dashboard?.resolver?.xp ?? 0) % 1000) / 10, 100)}%`,
                },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <ThemedText style={[styles.progressLabelLeft, { color: theme.muted }]}>
              PROGRESS TO LEVEL {(dashboard?.resolver?.level ?? 1) + 1}
            </ThemedText>
            <ThemedText style={[styles.progressLabelRight, { color: theme.primary }]}>
              {Math.min(((dashboard?.resolver?.xp ?? 0) % 1000) / 10, 100).toFixed(0)}%
            </ThemedText>
          </View>
        </Card>

        {/* Card 5: Did you know? */}
        <Card style={styles.card} elevation={2}>
          <View style={styles.didYouKnowContent}>
            <View style={[styles.bulbContainer, { backgroundColor: theme.backgroundTertiary }]}>
              <Feather name="info" size={Spacing["2xl"]} color={theme.primary} />
            </View>
            <View style={styles.didYouKnowTextWrap}>
              <ThemedText style={[styles.didYouKnowTitle, { color: theme.text }]}>Did you know?</ThemedText>
              <ThemedText style={[styles.didYouKnowDescription, { color: theme.text }]}>
                Assignments are prioritized based on your "Verified Skills" in your profile settings.
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* Card 6: Global Feed */}
        <Card style={styles.card} elevation={2}>
          <View style={styles.feedHeader}>
            <ThemedText style={[styles.feedTitle, { color: theme.text }]}>Global Feed</ThemedText>
            <Feather name="rss" size={Spacing.lg} color={theme.primary} />
          </View>
          <View style={styles.feedItem}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundTertiary }]} />
            <View style={styles.feedItemContent}>
              <ThemedText style={[styles.feedItemText, { color: theme.muted }]}>
                <ThemedText style={{ color: theme.text, fontWeight: Typography.h1.fontWeight }}>Leo W.</ThemedText> resolved <ThemedText style={{ color: theme.primary, fontWeight: Typography.link.fontWeight }}>Street Light #82</ThemedText>
              </ThemedText>
              <ThemedText style={[styles.feedItemTime, { color: theme.muted }]}>2 mins ago</ThemedText>
            </View>
          </View>
          <View style={styles.feedItem}>
             <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundTertiary }]} />
             <View style={styles.feedItemContent}>
               <ThemedText style={[styles.feedItemText, { color: theme.muted }]}>
                 <ThemedText style={{ color: theme.text, fontWeight: Typography.h1.fontWeight }}>Sarah K.</ThemedText> joined <ThemedText style={{ color: theme.primary, fontWeight: Typography.link.fontWeight }}>Park Cleanup</ThemedText>
               </ThemedText>
               <ThemedText style={[styles.feedItemTime, { color: theme.muted }]}>1 hour ago</ThemedText>
             </View>
          </View>
        </Card>

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["5xl"] * 2,
    gap: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  headerTitle: {
    ...Typography.h1,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.small,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    position: "relative",
    marginRight: Spacing.sm,
  },
  clockBadge: {
    position: "absolute",
    bottom: -(Spacing.xs / 2),
    right: -(Spacing.xs),
    borderRadius: BorderRadius.full,
    padding: Spacing.xs / 4,
  },
  cardTitleText: {
    ...Typography.h4,
  },
  activeContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  bigNumber: {
    fontSize: Typography.h1.fontSize * 2,
    fontWeight: Typography.h1.fontWeight,
    marginRight: Spacing.lg,
    lineHeight: Typography.h1.fontSize * 2 + Spacing.sm,
  },
  activeSubtext: {
    ...Typography.small,
    flex: 1,
  },
  centeredContent: {
    alignItems: "center",
  },
  checkCircle: {
    width: Spacing["5xl"],
    height: Spacing["5xl"],
    borderRadius: BorderRadius.xl,
    borderWidth: Spacing.xs / 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  hugeWhiteNumber: {
    fontSize: Typography.h1.fontSize * 1.75,
    fontWeight: Typography.h1.fontWeight,
    lineHeight: Typography.h1.fontSize * 1.75 + Spacing.sm,
  },
  resolvedLabel: {
    ...Typography.small,
    fontWeight: Typography.h1.fontWeight,
    letterSpacing: Spacing.xs / 4,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  heroPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  heroPillText: {
    ...Typography.caption,
    fontWeight: Typography.h1.fontWeight,
    letterSpacing: Spacing.xs / 8,
  },
  largeIconCircle: {
    width: Spacing["5xl"] * 1.5,
    height: Spacing["5xl"] * 1.5,
    borderRadius: BorderRadius["3xl"],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    position: "relative",
  },
  plusBadge: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    width: Spacing.xl,
    height: Spacing.xl,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: Spacing.xs / 2,
  },
  pendingTitle: {
    ...Typography.h3,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  pendingDescription: {
    ...Typography.small,
    textAlign: "center",
  },
  pendingListHeader: {
    marginBottom: Spacing.lg,
  },
  activeAssignmentsTitle: {
    ...Typography.h4,
  },
  assignmentItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  assignmentItemTitle: {
    ...Typography.body,
    fontWeight: Typography.h1.fontWeight,
    marginBottom: Spacing.xs,
  },
  assignmentMeta: {
    flexDirection: "column",
    gap: Spacing.xs,
  },
  assignmentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  assignmentMetaText: {
    ...Typography.caption,
    marginLeft: Spacing.xs,
  },
  statusDot: {
    width: Spacing.sm,
    height: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  impactTitle: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  impactDescription: {
    ...Typography.small,
    marginBottom: Spacing.xl,
  },
  progressTrack: {
    height: Spacing.sm,
    borderRadius: BorderRadius.xs,
    width: "100%",
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: "100%",
    borderRadius: BorderRadius.xs,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabelLeft: {
    ...Typography.caption,
    fontWeight: Typography.h1.fontWeight,
    letterSpacing: Spacing.xs / 8,
  },
  progressLabelRight: {
    ...Typography.caption,
    fontWeight: Typography.h1.fontWeight,
  },
  didYouKnowContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  bulbContainer: {
    width: Spacing["5xl"],
    height: Spacing["5xl"],
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  didYouKnowTextWrap: {
    flex: 1,
  },
  didYouKnowTitle: {
    ...Typography.body,
    fontWeight: Typography.h1.fontWeight,
    marginBottom: Spacing.xs,
  },
  didYouKnowDescription: {
    ...Typography.caption,
  },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  feedTitle: {
    ...Typography.h4,
  },
  feedItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatarPlaceholder: {
    width: Spacing["4xl"],
    height: Spacing["4xl"],
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.md,
  },
  feedItemContent: {
    flex: 1,
  },
  feedItemText: {
    ...Typography.small,
    marginBottom: Spacing.xs / 2,
  },
  feedItemTime: {
    ...Typography.caption,
  },
});
