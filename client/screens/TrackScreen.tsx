import React, { useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, Shadows, StatusColors, CategoryColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_STEPS = ["reported", "verified", "assigned", "inProgress", "resolved"];
const STATUS_LABELS: Record<string, string> = { reported: "Reported", verified: "Valid", assigned: "Assigned", inProgress: "In Progress", resolved: "Resolved" };

function StatusTimeline({ status }: { status: string }) {
  const currentIndex = STATUS_STEPS.indexOf(status);

  return (
    <View style={styles.timeline}>
      {STATUS_STEPS.map((step, index) => {
        const isComplete = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const color = isComplete ? Colors.light.primary : Colors.light.backgroundTertiary;

        return (
          <View key={step} style={styles.timelineStep}>
            <View style={[styles.timelineDot, { backgroundColor: color, borderWidth: isCurrent ? 3 : 0, borderColor: Colors.light.primary + "40" }]}>
              {isComplete ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
            </View>
            {index < STATUS_STEPS.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: isComplete ? Colors.light.primary : Colors.light.backgroundTertiary }]} /> : null}
            <ThemedText type="small" style={[styles.timelineLabel, { color: isComplete ? Colors.light.text : Colors.light.muted }]}>{STATUS_LABELS[step]}</ThemedText>
          </View>
        );
      })}
    </View>
  );
}

function TrackingCard({ issue, onPress, index }: { issue: any; onPress: () => void; index: number }) {
  const categoryColor = (CategoryColors as any)[issue.category] || Colors.light.primary;
  const statusColor = (StatusColors as any)[issue.status] || Colors.light.primary;
  const daysAgo = Math.floor((Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400)}>
      <Pressable style={({ pressed }) => [styles.trackingCard, pressed && { opacity: 0.9 }]} onPress={onPress}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor + "20", alignSelf: "flex-start" }]}>
              <ThemedText type="small" style={{ color: categoryColor, textTransform: "capitalize" }}>{issue.category}</ThemedText>
            </View>
            <ThemedText type="body" style={{ fontWeight: "600", marginTop: Spacing.sm }} numberOfLines={2}>{issue.title}</ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <ThemedText type="small" style={{ color: statusColor, textTransform: "capitalize" }}>{STATUS_LABELS[issue.status] || issue.status}</ThemedText>
          </View>
        </View>

        <StatusTimeline status={issue.status} />

        <View style={styles.cardFooter}>
          <View style={styles.footerMeta}>
            <Feather name="clock" size={14} color={Colors.light.muted} />
            <ThemedText type="small" style={{ color: Colors.light.muted, marginLeft: 4 }}>{daysAgo === 0 ? "Today" : `${daysAgo}d ago`}</ThemedText>
          </View>
          <View style={styles.footerMeta}>
            <Feather name="check-circle" size={14} color={Colors.light.primary} />
            <ThemedText type="small" style={{ color: Colors.light.primary, marginLeft: 4 }}>{issue.verifiedCount} valid</ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function TrackScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: myIssues = [], refetch } = useQuery({
    queryKey: ["/api/issues", "user", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const baseUrl = getApiUrl();
      const url = new URL("/api/issues", baseUrl);
      url.searchParams.set("userId", user.id);
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!user?.id,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ThemedView style={styles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h3">My Reports</ThemedText>
        <ThemedText type="small" style={{ color: Colors.light.muted }}>{(myIssues as any[]).length} total</ThemedText>
      </Animated.View>

      <FlatList
        data={myIssues as any[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + Spacing.xl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.light.primary} />}
        renderItem={({ item, index }) => (
          <TrackingCard issue={item} index={index} onPress={() => navigation.navigate("IssueDetail", { issueId: item.id })} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={Colors.light.muted} />
            <ThemedText type="body" style={{ color: Colors.light.muted, marginTop: Spacing.lg }}>No reports yet</ThemedText>
            <ThemedText type="small" style={{ color: Colors.light.muted, textAlign: "center", marginTop: Spacing.xs }}>Start by reporting an issue in your community</ThemedText>
            <Pressable style={styles.reportButton} onPress={() => navigation.navigate("ReportIssue")}>
              <Feather name="plus" size={18} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.sm }}>Report Issue</ThemedText>
            </Pressable>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg },
  trackingCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, backgroundColor: Colors.light.surface },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  categoryBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, gap: Spacing.xs },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  timeline: { flexDirection: "row", marginTop: Spacing.xl, marginBottom: Spacing.md },
  timelineStep: { flex: 1, alignItems: "center" },
  timelineDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", zIndex: 1 },
  timelineLine: { position: "absolute", top: 11, left: "50%", right: "-50%", height: 3 },
  timelineLabel: { marginTop: Spacing.xs, fontSize: 10, textAlign: "center" },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.light.border },
  footerMeta: { flexDirection: "row", alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: Spacing["4xl"] },
  reportButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.xl, backgroundColor: Colors.light.primary, ...Shadows.clay },
});
