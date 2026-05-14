import React from "react";
import { View, StyleSheet, Pressable, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export default function ResolverProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to logout?")) {
        logout();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: logout },
      ]);
    }
  };

  if (user?.role !== "resolver") return null;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Feather name="tool" size={40} color={Colors.light.secondary} />
          </View>
        </View>
        <ThemedText type="h2" style={styles.name}>
          {user.name}
        </ThemedText>
        <View style={styles.roleBadge}>
          <Feather name="shield" size={14} color={Colors.light.secondary} />
          <ThemedText type="small" style={{ color: Colors.light.secondary, fontWeight: "600", marginLeft: Spacing.xs }}>
            Field Resolver
          </ThemedText>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <ThemedText type="h2" style={{ color: Colors.light.primary }}>
            {user.totalResolved}
          </ThemedText>
          <ThemedText type="small" style={{ color: Colors.light.muted }}>
            Resolved
          </ThemedText>
        </Card>
        <Card style={styles.statCard}>
          <ThemedText type="h2" style={{ color: Colors.light.secondary }}>
            {user.currentLoad}
          </ThemedText>
          <ThemedText type="small" style={{ color: Colors.light.muted }}>
            Active
          </ThemedText>
        </Card>
        <Card style={styles.statCard}>
          <View style={styles.ratingRow}>
            <Feather name="star" size={20} color={Colors.light.warning} />
            <ThemedText type="h2" style={{ color: Colors.light.warning, marginLeft: 4 }}>
              {user.rating.toFixed(1)}
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ color: Colors.light.muted }}>
            Rating
          </ThemedText>
        </Card>
      </View>

      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Feather name="user" size={20} color={Colors.light.muted} />
          <View style={styles.infoContent}>
            <ThemedText type="small" style={{ color: Colors.light.muted }}>
              Username
            </ThemedText>
            <ThemedText type="body">{user.username}</ThemedText>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: Colors.light.border }]} />
        <View style={styles.infoRow}>
          <Feather name="briefcase" size={20} color={Colors.light.muted} />
          <View style={styles.infoContent}>
            <ThemedText type="small" style={{ color: Colors.light.muted }}>
              Specializations
            </ThemedText>
            <ThemedText type="body" numberOfLines={2}>
              {user.specializations.map((s) => s.replace("_", " ")).join(", ") || "All categories"}
            </ThemedText>
          </View>
        </View>
      </Card>

      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          { backgroundColor: Colors.light.error + "15" },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Feather name="log-out" size={20} color={Colors.light.error} />
        <ThemedText type="body" style={{ color: Colors.light.error, marginLeft: Spacing.sm, fontWeight: "600" }}>
          Logout
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.xl },
  header: { alignItems: "center", paddingVertical: Spacing["2xl"] },
  avatarContainer: { marginBottom: Spacing.lg },
  avatar: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.secondary + "20" },
  name: { marginBottom: Spacing.xs },
  roleBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.light.secondary + "15", marginTop: Spacing.sm },
  statsGrid: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.xl },
  statCard: { flex: 1, alignItems: "center", padding: Spacing.lg },
  ratingRow: { flexDirection: "row", alignItems: "center" },
  infoCard: { padding: Spacing.lg, marginBottom: Spacing.xl },
  infoRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: Spacing.md },
  infoContent: { marginLeft: Spacing.md, flex: 1 },
  divider: { height: 1, marginVertical: Spacing.xs },
  logoutButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: Spacing.lg, borderRadius: BorderRadius.md },
});
