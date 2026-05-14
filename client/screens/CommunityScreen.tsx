import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, Pressable, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOutLeft,
  FadeOutRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const BG = "#000000";
const CARD = "#0D1520";
const CARD_BORDER = "#1A2535";
const GREEN = "#58CC02";
const DARK_GREEN = "#0C1F0C";
const RED = "#EF4444";
const MUTED = "#6B7280";
const TEXT = "#F8FAFC";
const DIM_TEXT = "#9CA3AF";

function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Get user location for proximity sorting
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch {}
    })();
  }, []);

  const { data: issues, isLoading } = useQuery({
    queryKey: ["/api/issues"],
  });

  const validateMutation = useMutation({
    mutationFn: async ({
      issueId,
      vote,
    }: {
      issueId: string;
      vote: string;
    }) => {
      await apiRequest("POST", `/api/issues/${issueId}/validations`, {
        userId: user?.id,
        vote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      refreshUser();
    },
  });

  // Filter: only issues from OTHER users, pending validation
  // Sort: by proximity to user
  const validationIssues = useMemo(() => {
    const all = (issues as any[]) || [];
    const filtered = all.filter(
      (issue) =>
        issue.reporterId !== user?.id &&
        (issue.status === "reported" || issue.status === "verified")
    );

    if (userLocation) {
      filtered.sort((a, b) => {
        const distA =
          a.latitude && a.longitude
            ? getDistance(
                userLocation.latitude,
                userLocation.longitude,
                a.latitude,
                a.longitude
              )
            : 99999;
        const distB =
          b.latitude && b.longitude
            ? getDistance(
                userLocation.latitude,
                userLocation.longitude,
                b.latitude,
                b.longitude
              )
            : 99999;
        return distA - distB;
      });
    }

    return filtered;
  }, [issues, user?.id, userLocation]);

  const currentIssue = validationIssues[currentIndex];

  const goToNext = useCallback(() => {
    setHasVoted(false);
    setCurrentIndex((prev) =>
      prev < validationIssues.length - 1 ? prev + 1 : prev
    );
  }, [validationIssues.length]);

  const handleVote = (vote: "verified" | "invalid") => {
    if (!currentIssue || hasVoted) return;
    setHasVoted(true);
    validateMutation.mutate(
      { issueId: currentIssue.id, vote },
      {
        onSuccess: () => {
          setTimeout(goToNext, 600);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={GREEN} />
      </ThemedView>
    );
  }

  if (!currentIssue || validationIssues.length === 0) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Feather name="check-circle" size={48} color={GREEN} />
          </View>
          <ThemedText style={styles.emptyTitle}>All caught up!</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            No issues need your validation right now.{"\n"}Check back later or
            explore the map.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const distanceText =
    userLocation && currentIssue.latitude && currentIssue.longitude
      ? `${getDistance(userLocation.latitude, userLocation.longitude, currentIssue.latitude, currentIssue.longitude).toFixed(1)} km away`
      : "Nearby";

  const reporterLabel = `Citizen Reporter #${String(currentIssue.reporterId || currentIssue.id).padStart(4, "0")}`;

  return (
    <ThemedView style={[styles.container, { backgroundColor: BG }]}>
      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerLeft}>
          <Feather name="shield" size={22} color={GREEN} />
          <ThemedText style={styles.headerTitle}>CivicResolv</ThemedText>
        </View>
        <Pressable style={styles.notifButton}>
          <Feather name="bell" size={20} color={TEXT} />
        </Pressable>
      </Animated.View>

      {/* Card */}
      <Animated.View
        key={currentIssue.id}
        entering={FadeInUp.duration(400)}
        style={[
          styles.cardContainer,
          { marginBottom: tabBarHeight + 16 },
        ]}
      >
        {/* Image */}
        <View style={styles.imageWrap}>
          {currentIssue.images && currentIssue.images.length > 0 ? (
            <Image
              source={{ uri: currentIssue.images[0] }}
              style={styles.cardImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.cardImage, styles.placeholderImage]}>
              <Feather name="camera" size={40} color="#333" />
            </View>
          )}

          <LinearGradient
            colors={["rgba(13,21,32,0.8)", "transparent", "rgba(13,21,32,0.6)"]}
            locations={[0, 0.4, 1]}
            style={styles.imageGradient}
          />

          {/* Critical badge */}
          <View style={styles.criticalBadge}>
            <View style={styles.criticalDot} />
            <ThemedText style={styles.criticalText}>CRITICAL REPORT</ThemedText>
          </View>
        </View>

        {/* Info pills */}
        <View style={styles.infoPillsRow}>
          <View style={styles.infoPill}>
            <Feather name="map-pin" size={16} color={GREEN} />
            <View style={{ marginLeft: 8 }}>
              <ThemedText style={styles.infoPillLabel}>LOCATION</ThemedText>
              <ThemedText style={styles.infoPillValue} numberOfLines={1}>
                {currentIssue.address || distanceText}
              </ThemedText>
            </View>
          </View>
          <View style={styles.infoPill}>
            <Feather name="clock" size={16} color="#3B82F6" />
            <View style={{ marginLeft: 8 }}>
              <ThemedText style={styles.infoPillLabel}>REPORTED</ThemedText>
              <ThemedText style={styles.infoPillValue}>
                {timeAgo(currentIssue.createdAt)}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Description card */}
        <View style={styles.descCard}>
          <View style={styles.reporterRow}>
            <View style={styles.reporterAvatar}>
              <Feather name="user" size={16} color={GREEN} />
            </View>
            <ThemedText style={styles.reporterName}>{reporterLabel}</ThemedText>
          </View>
          <ThemedText style={styles.descText} numberOfLines={5}>
            {currentIssue.description}
          </ThemedText>
        </View>

        {/* Counter */}
        <View style={styles.counterRow}>
          <ThemedText style={styles.counterText}>
            {currentIndex + 1} / {validationIssues.length}
          </ThemedText>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          {/* Reject */}
          <Pressable
            style={[
              styles.actionButton,
              styles.rejectButton,
              hasVoted && { opacity: 0.4 },
            ]}
            onPress={() => handleVote("invalid")}
            disabled={hasVoted}
          >
            <Feather name="x" size={28} color={DIM_TEXT} />
          </Pressable>

          {/* Dots / progress */}
          <View style={styles.dotsRow}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === 0 ? GREEN : i === 1 ? GREEN + "60" : "#333",
                  },
                ]}
              />
            ))}
          </View>
          <ThemedText style={styles.verifyLabel}>VERIFY</ThemedText>

          {/* Verify */}
          <Pressable
            style={[
              styles.actionButton,
              styles.verifyButton,
              hasVoted && { opacity: 0.4 },
            ]}
            onPress={() => handleVote("verified")}
            disabled={hasVoted}
          >
            <Feather name="check" size={28} color="#000" />
          </Pressable>
        </View>

        {hasVoted && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.votedBanner}>
            <Feather name="check-circle" size={16} color={GREEN} />
            <ThemedText style={styles.votedText}>
              Thanks for validating! Loading next...
            </ThemedText>
          </Animated.View>
        )}
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { alignItems: "center", justifyContent: "center" },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: GREEN,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Card */
  cardContainer: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
  },

  /* Image */
  imageWrap: {
    height: "42%",
    minHeight: 200,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0F18",
  },
  imageGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  criticalBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  criticalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
  },
  criticalText: {
    fontSize: 11,
    fontWeight: "800",
    color: RED,
    letterSpacing: 0.5,
  },

  /* Info pills */
  infoPillsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  infoPillLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1,
  },
  infoPillValue: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT,
    marginTop: 2,
  },

  /* Description */
  descCard: {
    marginHorizontal: 16,
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
    flex: 1,
    minHeight: 100,
  },
  reporterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  reporterAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GREEN + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  reporterName: {
    fontSize: 14,
    fontWeight: "700",
    color: GREEN,
  },
  descText: {
    fontSize: 15,
    color: TEXT,
    lineHeight: 22,
    fontWeight: "400",
  },

  /* Counter */
  counterRow: {
    alignItems: "center",
    paddingVertical: 6,
  },
  counterText: {
    fontSize: 11,
    color: MUTED,
    letterSpacing: 1,
  },

  /* Actions */
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 4,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButton: {
    backgroundColor: "#1F2937",
    borderWidth: 2,
    borderColor: "#374151",
  },
  verifyButton: {
    backgroundColor: GREEN,
    ...Platform.select({
      web: { boxShadow: "0 0 24px rgba(88,204,2,0.4)" },
      default: {
        shadowColor: GREEN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  verifyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1.5,
    position: "absolute",
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: "center",
  },

  /* Voted */
  votedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 12,
  },
  votedText: {
    fontSize: 13,
    color: GREEN,
    fontWeight: "600",
  },

  /* Empty */
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GREEN + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
  },
});
