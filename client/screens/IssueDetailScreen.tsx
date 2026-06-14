import React, { useMemo } from "react";
import { View, StyleSheet, Pressable, Linking, Share, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useTranslation } from "react-i18next";

type RouteProps = RouteProp<RootStackParamList, "IssueDetail">;

const BG = "#000000";
const CARD = "#111111";
const CARD_BORDER = "#1A1A1A";
const GREEN = "#58CC02";
const DARK_GREEN = "#0C1F0C";
const MUTED = "#888888";
const TEXT = "#F8FAFC";

const STATUS_STEPS = ["reported", "verified", "assigned", "inProgress", "resolved"];

const getStatusLabel = (status: string, t: any) => {
  const map: Record<string, string> = {
    reported: t("issueDetail.ticketSubmitted"),
    verified: t("issueDetail.internalReviewComplete"),
    assigned: t("issueDetail.onSiteInspection"),
    inProgress: t("issueDetail.resolutionExecution"),
    resolved: t("issueDetail.resolvedAndClosed"),
  };
  return map[status] || status;
};

const getStatusDescription = (status: string, t: any) => {
  const map: Record<string, string> = {
    reported: t("issueDetail.descReported"),
    verified: t("issueDetail.descVerified"),
    assigned: t("issueDetail.descAssigned"),
    inProgress: t("issueDetail.descInProgress"),
    resolved: t("issueDetail.descResolved"),
  };
  return map[status] || "";
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#3B82F6",
  moderate: "#F59E0B",
  high: "#F97316",
  critical: "#EF4444",
};

export default function IssueDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation();

  const { data: issue, isLoading } = useQuery({
    queryKey: ["/api/issues", route.params.issueId],
    queryFn: async () => {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/issues/${route.params.issueId}`, baseUrl);
      const response = await fetch(url);
      return response.json();
    },
  });

  // Compute estimated resolution countdown from creation date
  const countdown = useMemo(() => {
    if (!issue) return { days: 0, hours: 0, mins: 0 };
    const created = new Date(issue.createdAt).getTime();
    // Estimate: moderate=3d, high=2d, critical=1d, low=3d (max 72 hours)
    const estimatedDays =
      issue.priority === "critical" ? 1 : issue.priority === "high" ? 2 : issue.priority === "moderate" ? 3 : 3;
    const deadline = created + estimatedDays * 24 * 60 * 60 * 1000;
    const remaining = Math.max(0, deadline - Date.now());
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, mins };
  }, [issue]);

  const currentStatusIndex = issue ? STATUS_STEPS.indexOf(issue.status) : 0;

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@civicresolv.app");
  };

  const handleShareStatus = async () => {
    if (!issue) return;
    try {
      await Share.share({
        message: `Issue: ${issue.title}\nStatus: ${getStatusLabel(issue.status, t)}\nID: #CR-${String(issue.id).padStart(4, "0")}\n\nTracked on CivicResolv`,
      });
    } catch {}
  };

  if (isLoading || !issue) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Feather name="loader" size={32} color={MUTED} />
      </ThemedView>
    );
  }

  const priorityColor = PRIORITY_COLORS[issue.priority] || GREEN;
  const issueId = `#CR-${new Date(issue.createdAt).getFullYear()}-${String(issue.id).padStart(4, "0")}`;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Image with Overlay ── */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.heroContainer}>
          <View style={styles.heroImageWrap}>
            {issue.images && issue.images.length > 0 ? (
              <Image source={{ uri: issue.images[0] }} style={styles.heroImage} contentFit="cover" />
            ) : (
              <View style={[styles.heroImage, { backgroundColor: CARD, alignItems: "center", justifyContent: "center" }]}>
                <Feather name="image" size={48} color={MUTED} />
              </View>
            )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.85)"]}
              style={styles.heroGradient}
            />
            {/* Badges */}
            <View style={styles.heroBadges}>
              <View style={[styles.badge, { backgroundColor: priorityColor }]}>
                <ThemedText style={styles.badgeText}>
                  {issue.priority.toUpperCase()}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: GREEN }]}>
                <ThemedText style={[styles.badgeText, { color: "#000" }]}>
                  {(getStatusLabel(issue.status, t)).toUpperCase()}
                </ThemedText>
              </View>
            </View>
            {/* Title & Location overlay */}
            <View style={styles.heroOverlay}>
              <ThemedText style={styles.heroTitle}>{issue.title}</ThemedText>
              <View style={styles.heroLocationRow}>
                <Feather name="map-pin" size={14} color={GREEN} />
                <ThemedText style={styles.heroLocation} numberOfLines={1}>
                  {issue.address || t("issueDetail.locationUnavailable")}
                </ThemedText>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Issue ID Row ── */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <View style={styles.issueIdRow}>
            <ThemedText style={styles.issueIdLabel}>{t("issueDetail.issueId")}: {issueId}</ThemedText>
            <View style={styles.avatarGroup}>
              {[GREEN, "#3B82F6", GREEN].map((c, i) => (
                <View key={i} style={[styles.miniAvatar, { backgroundColor: c, marginLeft: i > 0 ? -8 : 0 }]}>
                  <ThemedText style={styles.miniAvatarText}>{i === 0 ? "U" : i === 1 ? "R" : "A"}</ThemedText>
                </View>
              ))}
              <ThemedText style={styles.avatarCount}>+{Math.max(issue.verifiedCount || 1, 2)}</ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* ── Estimated Resolution ── */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <View style={styles.card}>
            <ThemedText style={styles.cardLabel}>{t("issueDetail.estimatedResolution")}</ThemedText>
            <View style={styles.countdownRow}>
              <View style={styles.countdownItem}>
                <ThemedText style={styles.countdownNumber}>
                  {String(countdown.days).padStart(2, "0")}
                </ThemedText>
                <ThemedText style={styles.countdownUnit}>{t("issueDetail.days")}</ThemedText>
              </View>
              <View style={styles.countdownItem}>
                <ThemedText style={styles.countdownNumber}>
                  {String(countdown.hours).padStart(2, "0")}
                </ThemedText>
                <ThemedText style={styles.countdownUnit}>{t("issueDetail.hours")}</ThemedText>
              </View>
              <View style={styles.countdownItem}>
                <ThemedText style={styles.countdownNumber}>
                  {String(countdown.mins).padStart(2, "0")}
                </ThemedText>
                <ThemedText style={styles.countdownUnit}>{t("issueDetail.mins")}</ThemedText>
              </View>
            </View>
            <Pressable style={styles.trackingButton}>
              <View style={styles.trackingDot} />
              <ThemedText style={styles.trackingButtonText}>{t("issueDetail.trackingLiveResolution")}</ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── Case Timeline ── */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <View style={styles.card}>
            <View style={styles.timelineHeader}>
              <Feather name="file-text" size={20} color={GREEN} />
              <ThemedText style={styles.timelineTitle}>{t("issueDetail.caseTimeline")}</ThemedText>
            </View>

            {STATUS_STEPS.map((status, index) => {
              const isComplete = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isLast = index === STATUS_STEPS.length - 1;
              const dotColor = isComplete ? GREEN : "#333";
              const lineColor = isComplete ? GREEN : "#222";

              // Generate a plausible timestamp
              const baseDate = new Date(issue.createdAt);
              const stepDate = new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000 + index * 5 * 60 * 60 * 1000);
              const dateLabel = isComplete || isCurrent ? formatDate(index === 0 ? issue.createdAt : stepDate.toISOString()) : "";

              return (
                <View key={status} style={styles.timelineEntry}>
                  {/* Left column: dot + line */}
                  <View style={styles.timelineLeftCol}>
                    <View style={[styles.timelineDot, { backgroundColor: dotColor, borderWidth: isCurrent ? 3 : 0, borderColor: isCurrent ? GREEN + "50" : "transparent" }]}>
                      {isComplete && !isCurrent ? (
                        <Feather name="check" size={10} color="#FFF" />
                      ) : isCurrent ? (
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN }} />
                      ) : null}
                    </View>
                    {!isLast && (
                      <View style={[styles.timelineLine, { backgroundColor: lineColor }]} />
                    )}
                  </View>

                  {/* Right column: content */}
                  <View style={[styles.timelineRight, { opacity: isComplete || isCurrent ? 1 : 0.4 }]}>
                    {dateLabel ? (
                      <ThemedText style={styles.timelineDate}>{dateLabel}</ThemedText>
                    ) : null}
                    <ThemedText style={[styles.timelineStepTitle, { fontWeight: isCurrent ? "700" : "600" }]}>
                      {getStatusLabel(status, t)}
                    </ThemedText>
                    {(isComplete || isCurrent) && (
                      <ThemedText style={styles.timelineDesc}>
                        {getStatusDescription(status, t)}
                      </ThemedText>
                    )}

                    {/* Active inspection card for current step */}
                    {isCurrent && status !== "reported" && status !== "resolved" && (
                      <View style={styles.inspectionCard}>
                        {issue.images && issue.images.length > 0 && (
                          <View style={styles.inspectionImageWrap}>
                            <Image source={{ uri: issue.images[0] }} style={styles.inspectionImage} contentFit="cover" />
                            <View style={styles.liveIndicator}>
                              <View style={styles.liveDot} />
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Resolution Photos (if resolved) ── */}
        {issue.status === "resolved" && issue.resolutionPhotos && issue.resolutionPhotos.length > 0 && (
          <Animated.View entering={FadeInUp.delay(350).duration(400)}>
            <View style={styles.card}>
              <View style={styles.timelineHeader}>
                <Feather name="camera" size={20} color={GREEN} />
                <ThemedText style={styles.timelineTitle}>{t("issueDetail.resolutionPhotos")}</ThemedText>
              </View>
              <View style={styles.resolutionGrid}>
                {issue.resolutionPhotos.map((photo: string, idx: number) => (
                  <Image key={idx} source={{ uri: photo }} style={styles.resolutionPhoto} contentFit="cover" />
                ))}
              </View>
              <View style={styles.resolvedBanner}>
                <Feather name="check-circle" size={16} color={GREEN} />
                <ThemedText style={{ color: GREEN, marginLeft: 8, fontSize: 13 }}>
                  {t("issueDetail.issueResolvedOn")} {issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString() : ""}
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Action Buttons ── */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)}>
          <Pressable style={styles.contactButton} onPress={handleContactSupport}>
            <Feather name="phone" size={18} color={GREEN} />
            <ThemedText style={styles.contactButtonText}>{t("issueDetail.contactSupport")}</ThemedText>
          </Pressable>

          <Pressable style={styles.shareButton} onPress={handleShareStatus}>
            <Feather name="share-2" size={18} color={TEXT} />
            <ThemedText style={styles.shareButtonText}>{t("issueDetail.shareStatus")}</ThemedText>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 16 },

  /* Hero */
  heroContainer: { marginBottom: 16 },
  heroImageWrap: {
    height: 280,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: CARD,
  },
  heroImage: { width: "100%", height: "100%" },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  heroBadges: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.5,
  },
  heroOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFF",
    lineHeight: 34,
    marginBottom: 8,
  },
  heroLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroLocation: {
    fontSize: 13,
    color: "#CCC",
    flex: 1,
  },

  /* Issue ID */
  issueIdRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  issueIdLabel: {
    fontSize: 12,
    color: MUTED,
    letterSpacing: 1,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  avatarGroup: { flexDirection: "row", alignItems: "center" },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BG,
  },
  miniAvatarText: { fontSize: 10, fontWeight: "700", color: "#FFF" },
  avatarCount: { fontSize: 12, color: MUTED, marginLeft: 6 },

  /* Card */
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 24,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 12,
    color: MUTED,
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: 20,
  },

  /* Countdown */
  countdownRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    marginBottom: 24,
  },
  countdownItem: { alignItems: "center" },
  countdownNumber: {
    fontSize: 48,
    fontWeight: "800",
    color: GREEN,
    lineHeight: 52,
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  countdownUnit: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1.5,
    marginTop: 4,
  },

  /* Tracking button */
  trackingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
  },
  trackingButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
    letterSpacing: 1,
  },

  /* Timeline */
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  timelineTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: TEXT,
  },
  timelineEntry: {
    flexDirection: "row",
    minHeight: 80,
  },
  timelineLeftCol: {
    width: 28,
    alignItems: "center",
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  timelineRight: {
    flex: 1,
    marginLeft: 14,
    paddingBottom: 28,
  },
  timelineDate: {
    fontSize: 11,
    fontWeight: "700",
    color: GREEN,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timelineStepTitle: {
    fontSize: 16,
    color: TEXT,
    marginBottom: 6,
  },
  timelineDesc: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },

  /* Inspection card */
  inspectionCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  inspectionImageWrap: {
    borderRadius: 12,
    overflow: "hidden",
    height: 100,
  },
  inspectionImage: {
    width: "100%",
    height: "100%",
  },
  liveIndicator: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GREEN,
  },

  /* Resolution photos */
  resolutionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  resolutionPhoto: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  resolvedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#222",
  },

  /* Buttons */
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: DARK_GREEN,
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 12,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: GREEN,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 12,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT,
  },
});
