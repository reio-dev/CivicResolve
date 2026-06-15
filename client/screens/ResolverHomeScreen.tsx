import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

import { getApiUrl, apiRequest } from "@/lib/query-client";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { MapcnView } from "@/components/MapcnView";
import { useAuth } from "@/hooks/useAuth";
import * as Location from "expo-location";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const GREEN = Colors.light.primary;
const SECONDARY = Colors.light.primary;
const CARD = "#111111";
const CARD_BORDER = "#222222";
const MUTED = Colors.light.muted;
const TEXT = Colors.light.text;

const SPRING_CONFIG = {
  damping: 28,
  stiffness: 280,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.01,
  restSpeedThreshold: 0.01,
};

const getCategoryIcon = (category: string): keyof typeof Feather.glyphMap => {
  switch (category) {
    case "roads": return "alert-triangle";
    case "water": return "droplet";
    case "waste": return "trash-2";
    case "electricity": return "zap";
    case "drainage": return "cloud-rain";
    case "parks": return "sun";
    case "sanitation": return "wind";
    default: return "alert-circle";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical": return "#EF4444";
    case "high": return "#F97316";
    case "moderate": return "#F59E0B";
    default: return "#3B82F6";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "reported": return "#3B82F6";
    case "verified": return "#3B82F6";
    case "assigned": return "#F59E0B";
    case "in_progress":
    case "inProgress": return "#F97316";
    case "resolved": return GREEN;
    default: return MUTED;
  }
};

const formatStatusKey = (status: string) => {
  if (!status) return "";
  if (status === "in_progress") return "InProgress";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ResolverHomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [mapActive, setMapActive] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);

  // Get user location for distance sorting
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLoc([loc.coords.longitude, loc.coords.latitude]);
      }
    })();
  }, []);

  const resolverId = user?.role === "resolver" ? (user as any).resolverId : null;
  const adminUserId = user?.id ?? null;

  // Fetch all issues for map display
  const { data: allIssues = [], isLoading: issuesLoading } = useQuery<any[]>({
    queryKey: ["/api/issues"],
    staleTime: 10000,
  });

  // Fetch dashboard data for department slug
  const { data: dashboardData } = useQuery<any>({
    queryKey: [`/api/resolver/dashboard/${adminUserId}`],
    enabled: !!adminUserId && user?.role === "resolver",
  });

  // Fetch resolver assignments
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

  // Find the assignment for a given issue
  const getAssignmentForIssue = useCallback(
    (issueId: string) => {
      return assignments.find((a: any) => a.issueId?.toString() === issueId?.toString());
    },
    [assignments]
  );

  // Bottom sheet animation
  const SHEET_FULL_HEIGHT = SCREEN_HEIGHT * 0.75;
  const HIDDEN_Y = SHEET_FULL_HEIGHT;
  const translateY = useSharedValue(HIDDEN_Y);
  const backdropOpacity = useSharedValue(0);
  const context = useSharedValue({ y: 0 });

  const openSheet = useCallback(() => {
    setSheetVisible(true);
    backdropOpacity.value = withTiming(1, { duration: 250 });
    translateY.value = withSpring(0, SPRING_CONFIG);
  }, []);

  const closeSheet = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withSpring(HIDDEN_Y, SPRING_CONFIG, () => {
      runOnJS(setSheetVisible)(false);
      runOnJS(setSelectedIssue)(null);
    });
  }, [HIDDEN_Y]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      const newY = context.value.y + event.translationY;
      translateY.value = Math.max(-20, newY);
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        runOnJS(closeSheet)();
      } else {
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, translateY.value) }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(backdropOpacity.value, [0, 1], [0, 0.5], Extrapolation.CLAMP),
  }));

  // Handle marker press
  const handleMarkerPress = useCallback(
    (markerId: string) => {
      const issue = allIssues.find((i: any) => i.id?.toString() === markerId);
      if (issue) {
        setSelectedIssue(issue);
        openSheet();
      }
    },
    [allIssues, openSheet]
  );

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const response = await apiRequest("PATCH", `/api/resolver/assignments/${assignmentId}/resolve`, {
        resolutionImages: [],
        notes: "Resolved from map view",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resolver", resolverId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      if (adminUserId) {
        queryClient.invalidateQueries({ queryKey: [`/api/resolver/dashboard/${adminUserId}`] });
      }
      closeSheet();
      Alert.alert(t("resolverMap.success"), t("resolverMap.issueResolved"));
    },
    onError: (error: any) => {
      Alert.alert(t("resolverMap.error"), error.message || t("resolverMap.resolveFailed"));
    },
  });

  const handleContinueResolution = () => {
    if (!selectedIssue) return;
    const assignment = getAssignmentForIssue(selectedIssue.id?.toString());
    if (assignment) {
      closeSheet();
      navigation.navigate("ResolverIssueDetail", {
        assignmentId: assignment.id?.toString(),
        issueId: selectedIssue.id?.toString(),
      });
    } else {
      Alert.alert(t("resolverMap.noAssignment"), t("resolverMap.noAssignmentDesc"));
    }
  };

  const handleMarkResolved = () => {
    if (!selectedIssue) return;
    const assignment = getAssignmentForIssue(selectedIssue.id?.toString());
    if (assignment) {
      if (Platform.OS === "web") {
        if (window.confirm(t("resolverMap.confirmResolve"))) resolveMutation.mutate(assignment.id?.toString());
      } else {
        Alert.alert(t("resolverMap.confirmTitle"), t("resolverMap.confirmResolve"), [
          { text: t("resolverMap.cancel"), style: "cancel" },
          { text: t("resolverMap.resolve"), onPress: () => resolveMutation.mutate(assignment.id?.toString()) },
        ]);
      }
    } else {
      Alert.alert(t("resolverMap.noAssignment"), t("resolverMap.noAssignmentDesc"));
    }
  };

  // Build markers from all issues
  const mapMarkers = useMemo(
    () =>
      allIssues
        .filter((i: any) => i.latitude && i.longitude)
        .map((issue: any) => ({
          id: issue.id?.toString(),
          coordinate: [issue.longitude, issue.latitude] as [number, number],
          color: getStatusColor(issue.status),
          icon: getCategoryIcon(issue.category),
        })),
    [allIssues]
  );

  // My assignment issue IDs
  const assignedIssueIds = useMemo(
    () => new Set(assignments.map((a: any) => a.issueId?.toString())),
    [assignments]
  );

  const isAssignedToMe = selectedIssue
    ? assignedIssueIds.has(selectedIssue.id?.toString())
    : false;

  // Department-matched issues sorted by distance from user
  const departmentSlug = dashboardData?.myDepartmentSlug;
  const deptIssues = useMemo(() => {
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    let filtered = allIssues.filter((i: any) => {
      if (!i.latitude || !i.longitude) return false;
      if (i.status === "resolved") return false;
      return assignedIssueIds.has(i.id?.toString());
    });

    if (userLoc) {
      filtered = filtered
        .map((i: any) => ({ ...i, _dist: haversine(userLoc[1], userLoc[0], i.latitude, i.longitude) }))
        .sort((a: any, b: any) => a._dist - b._dist);
    }
    return filtered;
  }, [allIssues, assignedIssueIds, userLoc]);

  const handleNavIssue = useCallback((direction: "next" | "prev") => {
    if (deptIssues.length === 0) return;
    setFocusIndex((prev) => {
      let next: number;
      if (prev < 0) {
        next = 0;
      } else if (direction === "next") {
        next = (prev + 1) % deptIssues.length;
      } else {
        next = (prev - 1 + deptIssues.length) % deptIssues.length;
      }
      const issue = deptIssues[next];
      if (issue) {
        setMapCenter([issue.longitude, issue.latitude]);
        setSelectedIssue(issue);
        openSheet();
      }
      return next;
    });
  }, [deptIssues, openSheet]);

  return (
    <View style={{ flex: 1 }}>
      <ThemedView style={styles.container}>
        {/* Full-screen map */}
        <View style={[styles.mapContainer, { paddingTop: 0 }]}>
          {userLoc ? (
            <MapcnView
              theme="dark"
              zoom={mapCenter ? 15 : 13.5}
              center={mapCenter || userLoc}
              showsUserLocation={true}
              onInteract={setMapActive}
              onMarkerPress={handleMarkerPress}
              markers={mapMarkers}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#111" }}>
              <ActivityIndicator color={SECONDARY} size="large" />
              <ThemedText style={{ color: SECONDARY, marginTop: 10, fontSize: 12 }}>{t("resolverMap.locating", "Locating...")}</ThemedText>
            </View>
          )}
        </View>

        {/* Floating header */}
        <View style={[styles.floatingHeader, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
          <View style={styles.floatingHeaderInner}>
            <View style={styles.headerBadge}>
              <Feather name="map" size={16} color={SECONDARY} />
            </View>
            <View>
              <ThemedText style={styles.floatingTitle}>{t("resolverMap.title")}</ThemedText>
              <ThemedText style={styles.floatingSubtitle}>
                {mapMarkers.length} {t("resolverMap.issuesNearby")}
              </ThemedText>
            </View>
          </View>
          <View style={styles.assignedCountBadge}>
            <ThemedText style={styles.assignedCountText}>{assignments.length}</ThemedText>
            <ThemedText style={styles.assignedCountLabel}>{t("resolverMap.assigned")}</ThemedText>
          </View>
        </View>

        {/* Loading overlay */}
        {issuesLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={SECONDARY} />
          </View>
        )}

        {/* Navigation buttons */}
        <View style={[styles.navBtnContainer, { bottom: tabBarHeight + Spacing.lg }]}>
          <Pressable
            style={({ pressed }) => [styles.navBtn, (pressed || deptIssues.length === 0) && { opacity: 0.7, transform: [{ scale: 0.93 }] }]}
            onPress={() => handleNavIssue("prev")}
            disabled={deptIssues.length === 0}
          >
            <Feather name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <View style={styles.navCounter}>
            <ThemedText style={styles.navCounterText}>
              {deptIssues.length > 0 ? (focusIndex >= 0 ? focusIndex + 1 : "—") : "0"} / {deptIssues.length}
            </ThemedText>
          </View>
          <Pressable
            style={({ pressed }) => [styles.navBtn, (pressed || deptIssues.length === 0) && { opacity: 0.7, transform: [{ scale: 0.93 }] }]}
            onPress={() => handleNavIssue("next")}
            disabled={deptIssues.length === 0}
          >
            <Feather name="chevron-right" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Bottom sheet backdrop */}
        {sheetVisible && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeSheet}
          >
            <Animated.View style={[styles.backdrop, backdropStyle]} />
          </Pressable>
        )}

        {/* Bottom sheet */}
        {sheetVisible && selectedIssue && (
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                sheetStyle,
                { height: SHEET_FULL_HEIGHT, paddingBottom: tabBarHeight + Spacing.md },
              ]}
            >
              {/* Handle */}
              <View style={styles.handleWrap}>
                <View style={styles.handle} />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {/* Priority + Category row */}
                <View style={styles.sheetTagRow}>
                  <View style={[styles.sheetTag, { backgroundColor: getPriorityColor(selectedIssue.priority || "moderate") }]}>
                    <ThemedText style={styles.sheetTagText}>
                      {(selectedIssue.priority || "moderate").toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={[styles.sheetTag, { backgroundColor: getStatusColor(selectedIssue.status) }]}>
                    <ThemedText style={styles.sheetTagText}>
                      {t(`issues.status${formatStatusKey(selectedIssue.status)}`) || selectedIssue.status?.toUpperCase()}
                    </ThemedText>
                  </View>
                  {isAssignedToMe && (
                    <View style={[styles.sheetTag, { backgroundColor: SECONDARY + "30", borderWidth: 1, borderColor: SECONDARY }]}>
                      <ThemedText style={[styles.sheetTagText, { color: SECONDARY }]}>
                        {t("resolverMap.myAssignment")}
                      </ThemedText>
                    </View>
                  )}
                </View>

                {/* Title */}
                <ThemedText style={styles.sheetTitle}>{selectedIssue.title}</ThemedText>

                {/* Details grid */}
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <View style={styles.detailIcon}>
                      <Feather name={getCategoryIcon(selectedIssue.category)} size={16} color={SECONDARY} />
                    </View>
                    <View>
                      <ThemedText style={styles.detailLabel}>{t("resolverMap.category")}</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {t(`report.cat${selectedIssue.category?.charAt(0).toUpperCase()}${selectedIssue.category?.slice(1)}`) || selectedIssue.category}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.detailItem}>
                    <View style={styles.detailIcon}>
                      <Feather name="map-pin" size={16} color={SECONDARY} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.detailLabel}>{t("resolverMap.location")}</ThemedText>
                      <ThemedText style={styles.detailValue} numberOfLines={1}>
                        {selectedIssue.address || selectedIssue.district || t("resolverMap.unknownLocation")}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.detailItem}>
                    <View style={styles.detailIcon}>
                      <Feather name="clock" size={16} color={SECONDARY} />
                    </View>
                    <View>
                      <ThemedText style={styles.detailLabel}>{t("resolverMap.reported")}</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {selectedIssue.createdAt ? timeAgo(selectedIssue.createdAt) : "—"}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.detailItem}>
                    <View style={styles.detailIcon}>
                      <Feather name="check-circle" size={16} color={SECONDARY} />
                    </View>
                    <View>
                      <ThemedText style={styles.detailLabel}>{t("resolverMap.verifications")}</ThemedText>
                      <ThemedText style={styles.detailValue}>{selectedIssue.verifiedCount || 0}</ThemedText>
                    </View>
                  </View>
                </View>

                {/* Description */}
                {selectedIssue.description && (
                  <View style={styles.descriptionCard}>
                    <ThemedText style={styles.descriptionLabel}>{t("resolverMap.description")}</ThemedText>
                    <ThemedText style={styles.descriptionText} numberOfLines={4}>
                      {selectedIssue.description}
                    </ThemedText>
                  </View>
                )}

                {/* Actions */}
                {isAssignedToMe && (
                  <View style={styles.actionsWrap}>
                    <Pressable
                      style={[styles.actionBtn, styles.continueBtn]}
                      onPress={handleContinueResolution}
                    >
                      <Feather name="arrow-right-circle" size={20} color="#000" />
                      <ThemedText style={styles.continueBtnText}>{t("resolverMap.continueResolution")}</ThemedText>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, styles.resolveBtn]}
                      onPress={handleMarkResolved}
                      disabled={resolveMutation.isPending}
                    >
                      {resolveMutation.isPending ? (
                        <ActivityIndicator size="small" color={GREEN} />
                      ) : (
                        <>
                          <Feather name="check-circle" size={20} color={GREEN} />
                          <ThemedText style={styles.resolveBtnText}>{t("resolverMap.markResolved")}</ThemedText>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
                {!isAssignedToMe && (
                  <View style={styles.notAssignedBanner}>
                    <Feather name="info" size={16} color={MUTED} />
                    <ThemedText style={styles.notAssignedText}>{t("resolverMap.notAssigned")}</ThemedText>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
  },

  // Floating header
  floatingHeader: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  floatingHeaderInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SECONDARY + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT,
  },
  floatingSubtitle: {
    fontSize: 11,
    color: MUTED,
    marginTop: 1,
  },
  assignedCountBadge: {
    alignItems: "center",
    backgroundColor: SECONDARY + "15",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: SECONDARY + "30",
  },
  assignedCountText: {
    fontSize: 18,
    fontWeight: "900",
    color: SECONDARY,
  },
  assignedCountLabel: {
    fontSize: 8,
    fontWeight: "700",
    color: SECONDARY,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  // Nav buttons
  navBtnContainer: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20,20,20,0.85)",
    borderRadius: 30,
    padding: 6,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CARD_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  navCounter: {
    paddingHorizontal: Spacing.md,
    minWidth: 50,
    alignItems: "center",
  },
  navCounterText: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },

  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },

  // Sheet
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000000",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "#1A1A1A",
    paddingHorizontal: Spacing.xl,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 24 },
      android: { elevation: 20 },
    }),
  },
  handleWrap: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#333",
  },

  // Tags
  sheetTagRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
    marginBottom: Spacing.md,
  },
  sheetTag: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs + 2,
  },
  sheetTagText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Title
  sheetTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: TEXT,
    lineHeight: 28,
    marginBottom: Spacing.lg,
  },

  // Details grid
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    width: "47%" as any,
    backgroundColor: "#111111",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SECONDARY + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT,
    marginTop: 1,
  },

  // Description
  descriptionCard: {
    backgroundColor: "#111111",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  descriptionLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  descriptionText: {
    fontSize: 14,
    color: TEXT,
    lineHeight: 21,
  },

  // Swipe hint
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  swipeHintText: {
    fontSize: 11,
    fontWeight: "600",
    color: MUTED,
    letterSpacing: 0.5,
  },

  // Actions
  actionsWrap: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  continueBtn: {
    backgroundColor: SECONDARY,
  },
  continueBtnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "800",
  },
  resolveBtn: {
    backgroundColor: GREEN + "15",
    borderWidth: 1.5,
    borderColor: GREEN + "40",
  },
  resolveBtnText: {
    color: GREEN,
    fontSize: 15,
    fontWeight: "800",
  },

  // Not assigned
  notAssignedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#111111",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  notAssignedText: {
    flex: 1,
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
});
