import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Location from "expo-location";
import { useTranslation } from "react-i18next";
import { getUnreadCount } from "@/lib/local-notifications";
import { ThemedText } from "@/components/ThemedText";
import { MapcnView } from "@/components/MapcnView";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

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

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ResolverDashboardScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [mapActive, setMapActive] = useState(false);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();

  React.useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLoc([loc.coords.longitude, loc.coords.latitude]);
      }
    })();
  }, []);

  const resolverId = (user as any)?.resolverId ?? null;

  const { data, isLoading, refetch: refetchDashboard } = useQuery<any>({
    queryKey: [`/api/resolver/dashboard/${user?.id}`],
    enabled: !!user?.id && user?.role === "resolver",
  });

  // Fetch assignments
  const { data: assignments = [], refetch: refetchAssignments } = useQuery<any[]>({
    queryKey: ["/api/resolver", resolverId, "assignments"],
    queryFn: async () => {
      if (!resolverId) return [];
      const apiUrl = `${getApiUrl()}/api/resolver/${resolverId}/assignments`;
      const response = await fetch(apiUrl, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (!response.ok) throw new Error("Failed to fetch assignments");
      return response.json();
    },
    enabled: !!resolverId,
  });

  // Unread notification count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      return await getUnreadCount();
    },
    enabled: !!user?.id,
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDashboard(), refetchAssignments()]);
    setRefreshing(false);
  }, [refetchDashboard, refetchAssignments]);

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
          {t("resolverDash.unableToLoad")}
        </ThemedText>
        <ThemedText style={{ color: C.muted, textAlign: "center", fontSize: 12 }}>
          {data?.error ?? t("resolverDash.noData")}
        </ThemedText>
      </ThemedView>
    );
  }

  const xp = Number(data.resolver?.xp ?? 0);
  const level = Number(data.resolver?.level ?? 1);
  const totalResolved = Number(data.resolver?.totalResolved ?? 0);
  const rawQueue: any[] = assignments
    .filter((a: any) => a.issue && a.status !== "completed")
    .map((a: any) => a.issue);

  const priorityWeight = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case "critical": return 4;
      case "high": return 3;
      case "medium": return 2;
      case "low": return 1;
      default: return 0;
    }
  };

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const queue = React.useMemo(() => {
    let sorted = [...rawQueue];
    sorted.sort((a, b) => {
      const pA = priorityWeight(a.priority);
      const pB = priorityWeight(b.priority);
      if (pA !== pB) return pB - pA; // Descending priority
      
      if (userLoc && a.latitude && a.longitude && b.latitude && b.longitude) {
        const distA = haversine(userLoc[1], userLoc[0], a.latitude, a.longitude);
        const distB = haversine(userLoc[1], userLoc[0], b.latitude, b.longitude);
        return distA - distB; // Ascending distance
      }
      return 0;
    });
    return sorted;
  }, [rawQueue, userLoc]);

  const activeJob = data.activeJob ?? null;
  const fullActiveJob = queue.length > 0 ? queue[0] : null;
  const activeAssignments = assignments.filter((a: any) => a.status !== "completed").length;
  const rating = (user as any)?.rating ?? 0;

  const goActiveJob = () => {
    if (fullActiveJob) {
      const assignment = assignments.find((a: any) => a.issueId === fullActiveJob.id);
      navigation.navigate("ResolverIssueDetail", {
        assignmentId: assignment?.id?.toString() || activeJob?.assignmentId,
        issueId: fullActiveJob.id,
      });
    }
  };

  const getCategoryIcon = (cat?: string) => {
    if (cat === "water") return "droplet";
    if (cat === "electricity") return "zap";
    if (cat === "roads") return "map";
    if (cat === "parks") return "tree";
    if (cat === "waste") return "trash-2";
    return "alert-circle";
  };

  const getStatusColor = (status?: string) => {
    if (status === "resolved") return "#10B981"; // Success
    if (status === "in_progress") return "#3B82F6"; // Primary
    if (status === "assigned") return "#F59E0B"; // Warning
    return "#EF4444"; // Error
  };

  const activeJobDistance = React.useMemo(() => {
    if (!fullActiveJob?.latitude || !fullActiveJob?.longitude || !userLoc) return "Distance unknown";
    const dist = haversine(userLoc[1], userLoc[0], fullActiveJob.latitude, fullActiveJob.longitude);
    return dist < 1 ? `${(dist * 1000).toFixed(0)}m away` : `${dist.toFixed(1)}km away`;
  }, [fullActiveJob, userLoc]);

  const displayName = (user as any)?.name || user?.username || "Resolver";

  return (
    <ThemedView style={$s.root}>
      <ScrollView
        scrollEnabled={!mapActive}
        contentContainerStyle={[
          $s.scroll,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {/* ── App Header ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(0)} style={$s.appHeader}>
          <View style={$s.brandRow}>
            <Feather name="shield" size={18} color={C.primary} />
            <ThemedText style={$s.brandName}>CivicResolv</ThemedText>
          </View>
          <Pressable style={$s.bellBtn} onPress={() => navigation.navigate("ResolverNotifications" as any)}>
            <Feather name="bell" size={20} color={C.text} />
            {unreadCount > 0 && (
              <View style={$s.bellBadge}>
                <ThemedText style={$s.bellBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </ThemedText>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* ── Greeting ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(50)} style={{ marginBottom: Spacing.lg }}>
          <ThemedText style={$s.greeting}>{t("resolverDash.welcome")},</ThemedText>
          <ThemedText style={$s.titleGreen}>{displayName}</ThemedText>
          <ThemedText style={$s.subtitle}>{t("resolverDash.subtitle")}</ThemedText>
        </Animated.View>

        {/* ── XP Pill ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(100)} style={$s.xpPill}>
          <View style={$s.xpLeft}>
            <Feather name="zap" size={14} color="#000" />
            <ThemedText style={$s.xpText}>+{xp.toLocaleString()} XP</ThemedText>
          </View>
          <View style={$s.levelChip}>
            <ThemedText style={$s.levelText}>{t("resolverDash.level")} {level}</ThemedText>
          </View>
        </Animated.View>

        {/* ── Quick Stats ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(140)} style={$s.statsRow}>
          <View style={$s.statBox}>
            <View style={[$s.statIconWrap, { backgroundColor: `${C.primary}18` }]}>
              <Feather name="check-circle" size={18} color={C.primary} />
            </View>
            <ThemedText style={$s.statNumber}>{totalResolved}</ThemedText>
            <ThemedText style={$s.statLabel}>{t("resolverDash.resolved")}</ThemedText>
          </View>
          <View style={$s.statBox}>
            <View style={[$s.statIconWrap, { backgroundColor: "#F59E0B18" }]}>
              <Feather name="clipboard" size={18} color="#F59E0B" />
            </View>
            <ThemedText style={$s.statNumber}>{activeAssignments}</ThemedText>
            <ThemedText style={$s.statLabel}>{t("resolverDash.active")}</ThemedText>
          </View>
          <View style={$s.statBox}>
            <View style={[$s.statIconWrap, { backgroundColor: "#F59E0B18" }]}>
              <Feather name="star" size={18} color="#F59E0B" />
            </View>
            <ThemedText style={$s.statNumber}>{rating > 0 ? rating.toFixed(1) : "—"}</ThemedText>
            <ThemedText style={$s.statLabel}>{t("resolverDash.rating")}</ThemedText>
          </View>
        </Animated.View>

        {/* ── Active Job Card ── */}
        {fullActiveJob && (
          <Animated.View entering={FadeInDown.duration(350).delay(180)} style={$s.card}>
            <View style={$s.activeBadge}>
              <ThemedText style={$s.activeBadgeText}>{t("resolverDash.activeJob")}</ThemedText>
            </View>

            <View style={$s.activeJobRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={$s.jobTitle}>{fullActiveJob.title ?? "Active Issue"}</ThemedText>
                <ThemedText style={$s.jobMeta}>
                  {fullActiveJob.address ?? t("resolverDash.unknownLocation")} • {(fullActiveJob.priority ?? "medium").toUpperCase()}
                </ThemedText>
              </View>
              <View style={$s.jobIcon}>
                <Feather name="navigation" size={20} color={C.primary} />
              </View>
            </View>

            {/* Map */}
            <View style={$s.mapStub}>
              {(fullActiveJob?.longitude !== undefined && fullActiveJob?.latitude !== undefined) || userLoc ? (
                <MapcnView
                  style={{ ...StyleSheet.absoluteFillObject }}
                  theme="dark"
                  zoom={14}
                  center={fullActiveJob?.longitude !== undefined && fullActiveJob?.latitude !== undefined ? [fullActiveJob.longitude, fullActiveJob.latitude] : userLoc!}
                  showsUserLocation={true}
                  fitToMarkersAndUser={true}
                  disableShakeToFly={true}
                  onInteract={setMapActive}
                  markers={fullActiveJob?.longitude !== undefined && fullActiveJob?.latitude !== undefined ? [{
                    id: fullActiveJob.id,
                    coordinate: [fullActiveJob.longitude, fullActiveJob.latitude],
                    color: getStatusColor(fullActiveJob.status),
                    icon: getCategoryIcon(fullActiveJob.category)
                  }] : []}
                />
              ) : (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#111", ...StyleSheet.absoluteFillObject }}>
                  <ActivityIndicator color={C.primary} size="large" />
                  <ThemedText style={{ color: C.muted, marginTop: 10, fontSize: 12 }}>{t("resolverDash.locating", "Locating...")}</ThemedText>
                </View>
              )}
              <View style={[$s.distancePill, { position: 'absolute', bottom: Spacing.sm, left: Spacing.sm, zIndex: 10 }]}>
                <View style={$s.distanceDot} />
                <ThemedText style={$s.distanceLabel}>{activeJobDistance}</ThemedText>
              </View>
            </View>

            <Pressable style={$s.resumeBtn} onPress={goActiveJob}>
              <ThemedText style={$s.resumeBtnText}>{t("resolverDash.resumeResolution")}</ThemedText>
              <Feather name="arrow-right" size={16} color="#000" />
            </Pressable>
          </Animated.View>
        )}

        {/* ── No Active Job ── */}
        {!fullActiveJob && (
          <Animated.View entering={FadeInDown.duration(350).delay(180)} style={$s.noJobCard}>
            <View style={$s.noJobIconWrap}>
              <Feather name="check" size={28} color={C.primary} />
            </View>
            <ThemedText style={$s.noJobTitle}>{t("resolverDash.allClear")}</ThemedText>
            <ThemedText style={$s.noJobDesc}>{t("resolverDash.allClearDesc")}</ThemedText>
          </Animated.View>
        )}

        {/* ── Priority Queue ── */}
        <Animated.View entering={FadeInDown.duration(350).delay(220)} style={$s.queueContainer}>
          <View style={$s.queueHeader}>
            <ThemedText style={$s.queueHeading}>{t("resolverDash.priorityQueue")}</ThemedText>
            <View style={$s.queueCount}>
              <ThemedText style={$s.queueCountText}>{queue.length}</ThemedText>
            </View>
          </View>

          {queue.length === 0 && (
            <View style={$s.emptyQueue}>
              <Feather name="inbox" size={28} color={C.border} />
              <ThemedText style={$s.emptyQueueText}>{t("resolverDash.noPending")}</ThemedText>
            </View>
          )}

          {queue.length > 1 && queue.slice(1).map((item, i) => (
            <Pressable key={item.id ?? i} style={$s.queueRow}>
              <View style={[$s.queueIconBg, { backgroundColor: `${priorityColor(item.priority)}22` }]}>
                <Feather name={priorityIcon(item.priority)} size={16} color={priorityColor(item.priority)} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <ThemedText style={$s.queueTitle}>{item.title ?? "Unknown Issue"}</ThemedText>
                <ThemedText style={$s.queueMeta}>
                  {item.address ?? "Unknown"} {item.createdAt ? `• ${timeAgo(item.createdAt)}` : ""}
                </ThemedText>
              </View>
              <View style={[$s.priorityChip, { borderColor: priorityColor(item.priority) }]}>
                <ThemedText style={[$s.priorityChipText, { color: priorityColor(item.priority) }]}>
                  {(item.priority ?? "low").toUpperCase()}
                </ThemedText>
              </View>
            </Pressable>
          ))}
          {queue.length === 1 && (
            <ThemedText style={{ color: C.muted, paddingVertical: Spacing.md, textAlign: "center" }}>
              No additional issues in queue
            </ThemedText>
          )}
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const $s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.backgroundRoot,
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
    color: C.text,
    letterSpacing: 0.3,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: C.backgroundRoot,
  },
  bellBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  // Greeting
  greeting: {
    fontSize: 16,
    fontWeight: "500",
    color: C.muted,
  },
  titleGreen: {
    fontSize: 34,
    fontWeight: "900",
    color: C.primary,
    lineHeight: 40,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    color: C.muted,
    marginTop: Spacing.xs,
  },
  // XP Pill
  xpPill: {
    backgroundColor: C.primary,
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
  // Quick Stats
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: "900",
    color: C.text,
    lineHeight: 30,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  // Card base
  card: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },
  // Active Job
  activeBadge: {
    alignSelf: "flex-start",
    backgroundColor: `${C.primary}18`,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginBottom: Spacing.md,
  },
  activeBadgeText: {
    color: C.primary,
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
    fontSize: 22,
    fontWeight: "900",
    color: C.text,
    marginBottom: 4,
    lineHeight: 26,
  },
  jobMeta: {
    fontSize: 12,
    color: C.muted,
  },
  jobIcon: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${C.primary}14`,
    alignItems: "center",
    justifyContent: "center",
  },
  mapStub: {
    height: 150,
    backgroundColor: C.backgroundRoot,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: Spacing.sm,
  },
  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: "flex-start",
  },
  distanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.primary,
    marginRight: Spacing.xs,
  },
  distanceLabel: {
    color: C.text,
    fontSize: 9,
    fontWeight: "700",
  },
  resumeBtn: {
    backgroundColor: C.primary,
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
  // No active job
  noJobCard: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
  },
  noJobIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${C.primary}15`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  noJobTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    marginBottom: Spacing.xs,
  },
  noJobDesc: {
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
    lineHeight: 19,
  },
  // Queue
  queueContainer: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  queueHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
  },
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  queueCount: {
    backgroundColor: `${C.primary}18`,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  queueCountText: {
    color: C.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyQueue: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyQueueText: {
    color: C.muted,
    fontSize: 13,
  },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.backgroundRoot,
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
    color: C.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  queueMeta: {
    color: C.muted,
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
});
