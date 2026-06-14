import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, StatusColors, CategoryColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useTranslation } from "react-i18next";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BG = Colors.light.backgroundRoot;
const CARD = Colors.light.surface;
const CARD_BORDER = Colors.light.border;
const GREEN = Colors.light.primary;
const DARK_GREEN = "#0C1F0C"; // custom badge background
const RED = Colors.light.error;
const MUTED = Colors.light.muted;
const TEXT = Colors.light.text;
const DIM = Colors.light.textSecondary;
const DARK_CARD = "#0D1520";
const DARK_CARD_BORDER = "#1A2535";

const CATEGORIES = [
  { id: "water", label: "WATER", icon: "droplet" as const },
  { id: "roads", label: "ROADS", icon: "map" as const },
  { id: "electricity", label: "POWER", icon: "zap" as const },
  { id: "sanitation", label: "SANITATION", icon: "wind" as const },
  { id: "waste", label: "WASTE", icon: "trash-2" as const },
  { id: "drainage", label: "DRAINAGE", icon: "cloud-rain" as const },
  { id: "parks", label: "PARKS", icon: "sun" as const },
  { id: "other", label: "OTHER", icon: "more-horizontal" as const },
];

const getStatusLabel = (status: string, t: any) => {
  const map: Record<string, string> = {
    reported: t("issues.statusReported"),
    verified: t("issues.statusVerified"),
    assigned: t("issues.statusAssigned"),
    inProgress: t("issues.statusInProgress"),
    resolved: t("issues.statusResolved"),
  };
  return map[status] || status;
};

/* ── Utils ── */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── Category Chip ── */
function CategoryChip({
  cat,
  selected,
  onPress,
}: {
  cat: (typeof CATEGORIES)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const color = (CategoryColors as any)[cat.id] || GREEN;
  return (
    <Pressable
      style={[
        styles.categoryChip,
        { backgroundColor: selected ? color + "20" : CARD, borderColor: selected ? color : CARD_BORDER },
      ]}
      onPress={onPress}
    >
      <Feather name={cat.icon} size={14} color={selected ? color : MUTED} />
      <ThemedText style={[styles.categoryChipText, { color: selected ? color : MUTED }]}>
        {cat.label === "ALL" ? "ALL" : cat.id === "all" ? "ALL" : cat.id ? t(`report.cat${cat.id.charAt(0).toUpperCase() + cat.id.slice(1)}`).toUpperCase() : cat.label}
      </ThemedText>
    </Pressable>
  );
}

function IssueCard({ issue, onPress, index }: { issue: any; onPress: () => void; index: number }) {
  const { t } = useTranslation();
  const statusColor = (StatusColors as any)[issue.status] || GREEN;
  const categoryColor = (CategoryColors as any)[issue.category] || GREEN;
  const priorityColor =
    issue.priority === "critical" ? "#EF4444" : issue.priority === "high" ? "#F97316" : issue.priority === "moderate" ? "#F59E0B" : "#3B82F6";

  return (
    <Animated.View entering={FadeInUp.delay(index * 60).duration(350)}>
      <Pressable
        style={({ pressed }) => [styles.issueCard, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
        onPress={onPress}
      >
        <View style={styles.issueCardImageWrap}>
          {issue.images && issue.images.length > 0 ? (
            <Image source={{ uri: issue.images[0] }} style={styles.issueCardImage} contentFit="cover" />
          ) : (
            <View style={[styles.issueCardImage, styles.placeholderImage]}>
              <Feather name="image" size={32} color="#333" />
            </View>
          )}
          <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
            <ThemedText style={styles.priorityBadgeText}>{(issue.priority || "moderate").toUpperCase()}</ThemedText>
          </View>
        </View>
        <View style={styles.issueCardBody}>
          <View style={styles.issueCardTopRow}>
            <View style={[styles.categoryTag, { backgroundColor: categoryColor + "20" }]}>
              <ThemedText style={[styles.categoryTagText, { color: categoryColor }]}>
                {(issue.category || "other").toUpperCase()}
              </ThemedText>
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusColor + "20" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <ThemedText style={[styles.statusPillText, { color: statusColor }]}>
                {getStatusLabel(issue.status, t)}
              </ThemedText>
            </View>
          </View>
          <ThemedText style={styles.issueCardTitle} numberOfLines={2}>{issue.title}</ThemedText>
          <ThemedText style={styles.issueCardDesc} numberOfLines={2}>{issue.description}</ThemedText>
          <View style={styles.issueCardFooter}>
            <View style={styles.footerMeta}>
              <Feather name="map-pin" size={12} color={MUTED} />
              <ThemedText style={styles.footerMetaText} numberOfLines={1}>{issue.address || "Location"}</ThemedText>
            </View>
            <View style={styles.footerStats}>
              <Feather name="check-circle" size={12} color={GREEN} />
              <ThemedText style={[styles.footerMetaText, { color: GREEN, marginLeft: 4 }]}>{issue.verifiedCount || 0}</ThemedText>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ══════════════════════════════════════════
   ── All Issues: Validation Card View ──
   ══════════════════════════════════════════ */
function AllIssuesValidationView({
  issues,
  userLocation,
  tabBarHeight,
  localValidatedIds,
  setLocalValidatedIds,
}: {
  issues: any[];
  userLocation: { latitude: number; longitude: number } | null;
  tabBarHeight: number;
  localValidatedIds: Set<string>;
  setLocalValidatedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();

  const { data: userValidations } = useQuery({
    queryKey: [`/api/users/${user?.id}/validations`],
    enabled: !!user?.id,
  });

  const validateMutation = useMutation({
    mutationFn: async ({ issueId, vote }: { issueId: string; vote: string }) => {
      await apiRequest("POST", `/api/issues/${issueId}/validations`, { userId: user?.id, vote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/validations`] });
      queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      refreshUser();
    },
  });

  // Filter: only other users' issues pending validation. Sort by proximity.
  const validationIssues = useMemo(() => {
    const remoteValidatedIds = new Set(((userValidations as any[]) || []).map((v) => v.issueId.toString()));
    const filtered = issues.filter(
      (issue) =>
        issue.reporterId !== user?.id &&
        (issue.status === "reported" || issue.status === "verified") &&
        !localValidatedIds.has(issue.id.toString()) &&
        !remoteValidatedIds.has(issue.id.toString())
    );
    if (userLocation) {
      filtered.sort((a, b) => {
        const dA = a.latitude && a.longitude ? getDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude) : 99999;
        const dB = b.latitude && b.longitude ? getDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude) : 99999;
        return dA - dB;
      });
    }
    return filtered;
  }, [issues, user?.id, userLocation, localValidatedIds, userValidations]);

  // Always show the first item — we remove voted issues from the list immediately
  const currentIssue = validationIssues[0];

  const handleVote = (vote: "verified" | "invalid") => {
    if (!currentIssue) return;
    // Immediately remove from local list so the card disappears
    const idToHide = currentIssue.id.toString();
    setLocalValidatedIds((prev: Set<string>) => new Set([...prev, idToHide]));
    // Fire mutation in background
    validateMutation.mutate({ issueId: currentIssue.id, vote });
  };

  if (!currentIssue || validationIssues.length === 0) {
    return (
      <View style={[styles.validationEmpty, { marginBottom: tabBarHeight + 24 }]}>
        <View style={styles.emptyIcon}>
          <Feather name="check-circle" size={48} color={GREEN} />
        </View>
        <ThemedText style={styles.emptyTitle}>{t("issues.allCaughtUp")}</ThemedText>
        <ThemedText style={styles.emptySubtitle}>{t("issues.noIssuesValidation")}</ThemedText>
      </View>
    );
  }

  const distanceText =
    userLocation && currentIssue.latitude && currentIssue.longitude
      ? `${getDistance(userLocation.latitude, userLocation.longitude, currentIssue.latitude, currentIssue.longitude).toFixed(1)} ${t("issues.kmAway")}`
      : t("issues.nearby");

  const reporterIdStr = String(currentIssue.reporterId || currentIssue.id);
  const displayId = reporterIdStr.includes("-") ? reporterIdStr.substring(0, 8) : reporterIdStr.padStart(4, "0");
  const reporterLabel = `${t("issues.citizenReporter")} #${displayId}`;

  return (
    <Animated.View
      key={currentIssue.id}
      entering={FadeInUp.duration(400)}
      style={[styles.validationCard, { marginBottom: tabBarHeight + 16 }]}
    >
      {/* Image */}
      <Pressable
        style={styles.valImageWrap}
        onPress={() => navigation.navigate("IssueDetail", { issueId: currentIssue.id })}
      >
        {currentIssue.images && currentIssue.images.length > 0 ? (
          <Image source={{ uri: currentIssue.images[0] }} style={styles.valImage} contentFit="cover" />
        ) : (
          <View style={[styles.valImage, styles.placeholderImage]}>
            <Feather name="camera" size={40} color="#333" />
          </View>
        )}
        <LinearGradient colors={["rgba(13,21,32,0.8)", "transparent", "rgba(13,21,32,0.6)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.criticalBadge}>
          <View style={[styles.criticalDot, { backgroundColor: currentIssue.priority === "critical" ? RED : currentIssue.priority === "high" ? "#F97316" : GREEN }]} />
          <ThemedText style={[styles.criticalText, { color: currentIssue.priority === "critical" ? RED : currentIssue.priority === "high" ? "#F97316" : GREEN }]}>
            {(currentIssue.priority || "moderate").toUpperCase()} REPORT
          </ThemedText>
        </View>
      </Pressable>

      {/* Info pills */}
      <View style={styles.infoPillsRow}>
        <View style={styles.infoPill}>
          <Feather name="map-pin" size={16} color={GREEN} />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <ThemedText style={styles.infoPillLabel}>{t("issues.location")}</ThemedText>
            <ThemedText style={styles.infoPillValue} numberOfLines={1}>{currentIssue.address || distanceText}</ThemedText>
          </View>
        </View>
        <View style={styles.infoPill}>
          <Feather name="clock" size={16} color="#3B82F6" />
          <View style={{ marginLeft: 8 }}>
            <ThemedText style={styles.infoPillLabel}>{t("issues.reported")}</ThemedText>
            <ThemedText style={styles.infoPillValue}>{timeAgo(currentIssue.createdAt)}</ThemedText>
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={styles.descCard}>
        <View style={styles.reporterRow}>
          <View style={styles.reporterAvatar}>
            <Feather name="user" size={16} color={GREEN} />
          </View>
          <ThemedText style={styles.reporterName}>{reporterLabel}</ThemedText>
        </View>
        <ThemedText style={styles.descText} numberOfLines={3}>{currentIssue.description}</ThemedText>
      </View>

      {/* Counter */}
      <View style={styles.counterRow}>
        <ThemedText style={styles.counterText}>1 / {validationIssues.length}</ThemedText>
      </View>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleVote("invalid")}
        >
          <Feather name="x" size={28} color={DIM} />
        </Pressable>

        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === 0 ? GREEN : i === 1 ? GREEN + "60" : "#333" }]} />
          ))}
        </View>

        <Pressable
          style={[styles.actionButton, styles.verifyButton]}
          onPress={() => handleVote("verified")}
        >
          <Feather name="check" size={28} color="#000" />
        </Pressable>
      </View>

      <ThemedText style={styles.verifyLabel}>{t("issues.verify")}</ThemedText>
    </Animated.View>
  );
}

/* ══════════════════════════════
   ── Main Screen ──
   ══════════════════════════════ */
export default function IssuesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [tab, setTab] = useState<"all" | "my">("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [localValidatedIds, setLocalValidatedIds] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  // Get user location for proximity sorting
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch { }
    })();
  }, []);

  const { data: issues, refetch } = useQuery({
    queryKey: ["/api/issues"],
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  const myIssues = useMemo(() => {
    return ((issues as any[]) || []).filter((issue) => {
      if (user && issue.reporterId !== user.id) return false;
      if (selectedCategory && issue.category !== selectedCategory) return false;
      return true;
    });
  }, [issues, user, selectedCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const toggleCategory = (id: string) => {
    setSelectedCategory((prev: string | null) => (prev === id ? null : id));
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: BG }]}>
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(400)} style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <ThemedText style={styles.headerLabel}>{t("issues.citizenDashboard")}</ThemedText>
        <View style={styles.headerTitleRow}>
          <ThemedText style={styles.headerTitle}>{t("issues.browseIssues")}</ThemedText>
          <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <Feather name="filter" size={20} color={selectedCategory ? GREEN : TEXT} />
            {selectedCategory && <View style={styles.filterActiveDot} />}
          </Pressable>
        </View>

        {/* Toggle tabs */}
        <View style={styles.toggleRow}>
          <Pressable style={[styles.toggleTab, tab === "all" && styles.toggleTabActive]} onPress={() => setTab("all")}>
            <ThemedText style={[styles.toggleTabText, tab === "all" && styles.toggleTabTextActive]}>{t("issues.allIssues")}</ThemedText>
          </Pressable>
          <Pressable style={[styles.toggleTab, tab === "my" && styles.toggleTabActive]} onPress={() => setTab("my")}>
            <ThemedText style={[styles.toggleTabText, tab === "my" && styles.toggleTabTextActive]}>{t("issues.myIssues")}</ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Filter Modal ── */}
      <Modal visible={showFilters} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilters(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{t("issues.filterCategory")}</ThemedText>
              <Pressable onPress={() => setShowFilters(false)} style={styles.modalCloseBtn}>
                <Feather name="x" size={24} color={MUTED} />
              </Pressable>
            </View>
            <View style={styles.categoryGrid}>
              <CategoryChip
                cat={{ id: "all", label: "ALL", icon: "grid" } as any}
                selected={!selectedCategory}
                onPress={() => { setSelectedCategory(null); setShowFilters(false); }}
              />
              {CATEGORIES.map((cat) => (
                <CategoryChip
                  key={cat.id}
                  cat={cat}
                  selected={selectedCategory === cat.id}
                  onPress={() => { toggleCategory(cat.id); setShowFilters(false); }}
                />
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Content ── */}
      {tab === "all" ? (
        /* Validation card view */
        <AllIssuesValidationView
          issues={(issues as any[]) || []}
          userLocation={userLocation}
          tabBarHeight={tabBarHeight}
          localValidatedIds={localValidatedIds}
          setLocalValidatedIds={setLocalValidatedIds}
        />
      ) : (
        /* My Issues list */
        <FlatList
          data={myIssues}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GREEN} />}
          renderItem={({ item, index }) => (
            <IssueCard issue={item} index={index} onPress={() => navigation.navigate("IssueDetail", { issueId: item.id })} />
          )}
          ListEmptyComponent={
            <View style={styles.validationEmpty}>
              <Feather name="inbox" size={48} color="#333" />
              <ThemedText style={styles.emptyTitle}>{t("issues.noIssuesFound")}</ThemedText>
              <ThemedText style={styles.emptySubtitle}>{t("issues.noIssuesReported")}</ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: CARD_BORDER },
  headerLabel: { fontSize: 11, fontWeight: "700", color: MUTED, letterSpacing: 2, marginBottom: 6 },
  headerTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  headerTitle: { fontSize: 30, fontWeight: "800", color: TEXT },
  filterButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: CARD, borderWidth: 1, borderColor: CARD_BORDER, alignItems: "center", justifyContent: "center" },
  filterActiveDot: { position: "absolute", top: 12, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },

  /* Filter Modal */
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: CARD_BORDER },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: TEXT },
  modalCloseBtn: { padding: 4 },

  /* Toggle */
  toggleRow: { flexDirection: "row", backgroundColor: CARD, borderRadius: 28, padding: 4, marginBottom: 16 },
  toggleTab: { flex: 1, paddingVertical: 11, borderRadius: 24, alignItems: "center" },
  toggleTabActive: { backgroundColor: GREEN },
  toggleTabText: { fontSize: 14, fontWeight: "600", color: MUTED },
  toggleTabTextActive: { color: "#000" },

  /* Category grid */
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minWidth: "46%" as any },
  categoryChipText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },

  /* My Issues list */
  listContent: { paddingHorizontal: 20, paddingTop: 16 },
  issueCard: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: CARD_BORDER, overflow: "hidden", marginBottom: 16 },
  issueCardImageWrap: { height: 140, backgroundColor: "#0A0A0A" },
  issueCardImage: { width: "100%", height: "100%" },
  placeholderImage: { alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0A" },
  priorityBadge: { position: "absolute", top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priorityBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFF", letterSpacing: 0.5 },
  issueCardBody: { padding: 16 },
  issueCardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  categoryTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryTagText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusPillText: { fontSize: 11, fontWeight: "600" },
  issueCardTitle: { fontSize: 17, fontWeight: "700", color: TEXT, marginBottom: 6, lineHeight: 22 },
  issueCardDesc: { fontSize: 13, color: MUTED, lineHeight: 18, marginBottom: 14 },
  issueCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTopWidth: 1, borderTopColor: "#1A1A1A" },
  footerMeta: { flexDirection: "row", alignItems: "center", flex: 1, gap: 5 },
  footerMetaText: { fontSize: 12, color: MUTED },
  footerStats: { flexDirection: "row", alignItems: "center" },

  /* ── Validation Card View ── */
  validationCard: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: DARK_CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: DARK_CARD_BORDER,
    overflow: "hidden",
  },
  valImageWrap: { height: "30%", minHeight: 140, maxHeight: 180 },
  valImage: { width: "100%", height: "100%" },
  criticalBadge: {
    position: "absolute", top: 16, left: 16,
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.2)",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6,
  },
  criticalDot: { width: 8, height: 8, borderRadius: 4 },
  criticalText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },

  infoPillsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  infoPill: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#111827", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#1F2937",
  },
  infoPillLabel: { fontSize: 10, fontWeight: "700", color: DIM, letterSpacing: 1 },
  infoPillValue: { fontSize: 13, fontWeight: "600", color: TEXT, marginTop: 2 },

  descCard: {
    marginHorizontal: 16, backgroundColor: "#111827",
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#1F2937",
    flex: 1, minHeight: 80, maxHeight: 160,
  },
  reporterRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  reporterAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: GREEN + "20", alignItems: "center", justifyContent: "center" },
  reporterName: { fontSize: 14, fontWeight: "700", color: GREEN },
  descText: { fontSize: 15, color: TEXT, lineHeight: 22 },

  counterRow: { alignItems: "center", paddingVertical: 6 },
  counterText: { fontSize: 11, color: DIM, letterSpacing: 1 },

  actionsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingBottom: 8, paddingTop: 4,
  },
  actionButton: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  rejectButton: { backgroundColor: "#1F2937", borderWidth: 2, borderColor: "#374151" },
  verifyButton: {
    backgroundColor: GREEN,
    ...Platform.select({
      web: { boxShadow: "0 0 24px rgba(88,204,2,0.4)" } as any,
      default: { shadowColor: GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    }),
  },
  dotsRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  verifyLabel: { fontSize: 11, fontWeight: "700", color: DIM, letterSpacing: 1.5, textAlign: "center", marginBottom: 8 },

  votedBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 12 },
  votedText: { fontSize: 13, color: GREEN, fontWeight: "600" },

  /* Empty */
  validationEmpty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: GREEN + "15", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 6 },
});
