import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getLocalNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications, LocalNotification } from "@/lib/local-notifications";

const C = Colors.light;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (mins < 1) return `Just now • ${timeStr}`;
  if (mins < 60) return `${mins}m ago • ${timeStr}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago • ${timeStr}`;
  return `${Math.floor(hours / 24)}d ago • ${timeStr}`;
}

function getNotificationIcon(type: string): keyof typeof Feather.glyphMap {
  switch (type) {
    case "assignment":
      return "map-pin";
    case "status_update":
      return "refresh-cw";
    default:
      return "bell";
  }
}

function getNotificationColor(type: string): string {
  switch (type) {
    case "assignment":
      return "#3B82F6";
    case "status_update":
      return "#10B981";
    default:
      return C.primary;
  }
}

export default function ResolverNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = React.useState(false);

  const topPadding = headerHeight > 0 ? headerHeight : insets.top + 60;

  const { data: notifications = [], isLoading, refetch } = useQuery<LocalNotification[]>({
    queryKey: ["resolver-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return await getLocalNotifications();
    },
    enabled: !!user?.id && user?.role === "resolver",
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await clearAllNotifications();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resolver-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to clear notifications");
      console.error(error);
    }
  });

  const handleClearAll = () => {
    Alert.alert(
      "Clear Notifications",
      "Are you sure you want to delete all notifications?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive",
          onPress: () => clearAllMutation.mutate() 
        }
      ]
    );
  };

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await markNotificationRead(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resolver-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await markAllNotificationsRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resolver-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    },
  });

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleNotificationPress = (notification: LocalNotification) => {
    // Mark as read
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }

    // Navigate based on type
    if (notification.type === "assignment" && notification.data?.issueId) {
      navigation.navigate("ResolverIssueDetail", {
        assignmentId: notification.data.assignmentId,
        issueId: notification.data.issueId,
      });
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (isLoading) {
    return (
      <ThemedView style={[$s.root, { paddingTop: topPadding }]}>
        <View style={$s.loadingContainer}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={$s.root}>
      <ScrollView
        contentContainerStyle={[
          $s.scroll,
          { paddingTop: topPadding + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
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
        {/* Header Actions */}
        {notifications.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300)} style={$s.headerRow}>
            <ThemedText style={$s.unreadLabel}>
              {unreadCount} unread
            </ThemedText>
            <View style={$s.actionBtns}>
              {unreadCount > 0 && (
                <Pressable
                  onPress={() => markAllReadMutation.mutate()}
                  style={$s.actionBtn}
                >
                  <Feather name="check-circle" size={14} color={C.primary} />
                  <ThemedText style={$s.actionText}>Mark all as read</ThemedText>
                </Pressable>
              )}
              <Pressable
                onPress={handleClearAll}
                style={[$s.actionBtn, $s.deleteBtn]}
              >
                <Feather name="trash-2" size={14} color="#EF4444" />
                <ThemedText style={[$s.actionText, { color: "#EF4444" }]}>Clear</ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* Empty State */}
        {notifications.length === 0 && (
          <Animated.View entering={FadeInDown.duration(350)} style={$s.emptyContainer}>
            <View style={$s.emptyIconWrap}>
              <Feather name="bell-off" size={32} color={C.border} />
            </View>
            <ThemedText style={$s.emptyTitle}>No notifications yet</ThemedText>
            <ThemedText style={$s.emptyDesc}>
              You'll be notified when new issues are assigned to you.
            </ThemedText>
          </Animated.View>
        )}

        {/* Notification List */}
        {notifications.map((notification, index) => (
          <Animated.View
            key={notification.id}
            entering={FadeInDown.duration(300).delay(index * 50)}
          >
            <Pressable
              style={[
                $s.notificationCard,
                !notification.isRead && $s.notificationUnread,
              ]}
              onPress={() => handleNotificationPress(notification)}
            >
              <View
                style={[
                  $s.iconWrap,
                  {
                    backgroundColor: `${getNotificationColor(notification.type)}18`,
                  },
                ]}
              >
                <Feather
                  name={getNotificationIcon(notification.type)}
                  size={18}
                  color={getNotificationColor(notification.type)}
                />
              </View>

              <View style={$s.contentWrap}>
                <View style={$s.titleRow}>
                  <ThemedText
                    style={[
                      $s.notifTitle,
                      !notification.isRead && $s.notifTitleUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {notification.title}
                  </ThemedText>
                  {!notification.isRead && <View style={$s.unreadDot} />}
                </View>
                <ThemedText style={$s.notifMessage} numberOfLines={2}>
                  {notification.message}
                </ThemedText>
                <ThemedText style={$s.notifTime}>
                  {timeAgo(notification.createdAt)}
                </ThemedText>
              </View>

              <Feather name="chevron-right" size={16} color={C.muted} />
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const $s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.backgroundRoot,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  unreadLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: C.muted,
  },
  actionBtns: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: `${C.primary}12`,
  },
  deleteBtn: {
    backgroundColor: "#EF444412",
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
    color: C.primary,
  },
  // Empty
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 3,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    fontSize: 13,
    color: C.muted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: Spacing.xl,
  },
  // Notification card
  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: C.border,
  },
  notificationUnread: {
    borderColor: `${C.primary}40`,
    backgroundColor: `${C.primary}06`,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  contentWrap: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
    flex: 1,
  },
  notifTitleUnread: {
    fontWeight: "800",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.primary,
  },
  notifMessage: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 10,
    color: C.border,
    marginTop: 4,
    fontWeight: "500",
  },
});
