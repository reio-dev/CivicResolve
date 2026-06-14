import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system/next";
import * as ImageManipulator from "expo-image-manipulator";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { MapcnView } from "@/components/MapcnView";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { Issue } from "@shared/schema";

const C = Colors.light;

const priorityColor = (p: string) => {
  if (p === "critical" || p === "high") return C.error;
  if (p === "medium") return C.warning;
  return C.success;
};

const categoryColor = (cat: string) => {
  if (cat === "water") return "#3B82F6";
  if (cat === "electricity") return C.warning;
  if (cat === "roads") return C.error;
  if (cat === "parks" || cat === "waste") return C.success;
  return C.muted;
};

export default function ResolverIssueDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { assignmentId, issueId } = route.params as { assignmentId: string; issueId: string };

  const [resolutionImages, setResolutionImages] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [mapActive, setMapActive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const { data: issue, isLoading } = useQuery<Issue>({
    queryKey: ["/api/issues", issueId],
  });

  const { data: statusUpdates } = useQuery<any[]>({
    queryKey: ["/api/issues", issueId, "status-updates"],
  });

  const convertImageToBase64 = async (uri: string): Promise<string> => {
    if (Platform.OS === "web") {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(blob);
      });
    }
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
    );
    const file = new File(compressed.uri);
    const base64 = await file.base64();
    return `data:image/jpeg;base64,${base64}`;
  };

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const base64Images = await Promise.all(resolutionImages.map(convertImageToBase64));
      const response = await apiRequest("PATCH", `/api/resolver/assignments/${assignmentId}/resolve`, {
        resolutionImages: base64Images,
        notes,
      });
      return response.json();
    },
    onSuccess: () => {
      const adminUserId = user?.id;
      const resolverId = user?.role === "resolver" ? (user as any).resolverId : null;
      queryClient.invalidateQueries({ queryKey: ["/api/resolver", resolverId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      if (adminUserId) {
        queryClient.invalidateQueries({ queryKey: [`/api/resolver/dashboard/${adminUserId}`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard"] });
      Alert.alert("Success", "Issue has been marked as resolved!", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to resolve issue");
    },
  });

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      setResolutionImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  };

  const handleOpenCamera = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Camera not available", "Please use Expo Go on your phone to take photos");
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Please enable camera access in your device settings");
        return;
      }
    }
    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) {
          setResolutionImages((prev) => [...prev, photo.uri]);
          setShowCamera(false);
        }
      } catch {
        Alert.alert("Error", "Failed to take photo");
      }
    }
  };

  const handleResolve = () => {
    if (resolutionImages.length === 0) {
      if (Platform.OS === "web") window.alert("Please add at least one photo as proof of resolution.");
      else Alert.alert("Photo Required", "Please add at least one photo as proof of resolution");
      return;
    }
    if (Platform.OS === "web") {
      if (window.confirm("Mark this issue as resolved?")) resolveMutation.mutate();
    } else {
      Alert.alert("Confirm Resolution", "Are you sure you want to mark this issue as resolved?", [
        { text: "Cancel", style: "cancel" },
        { text: "Resolve", onPress: () => resolveMutation.mutate() },
      ]);
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={[$s.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </ThemedView>
    );
  }

  if (!issue) {
    return (
      <ThemedView style={[$s.root, { alignItems: "center", justifyContent: "center" }]}>
        <ThemedText style={{ color: C.muted }}>Issue not found</ThemedText>
      </ThemedView>
    );
  }

  const pColor = priorityColor(issue.priority ?? "low");
  const cColor = categoryColor(issue.category ?? "other");
  const formatDate = (d: any) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "—";
  const formatTime = (d: any) =>
    d ? new Date(d).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <ThemedView style={$s.root}>
      {/* ── Header ── */}
      <View style={[$s.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={$s.backBtn} hitSlop={10}>
          <Feather name="chevron-left" size={22} color={C.primary} />
        </Pressable>
        <ThemedText style={$s.headerTitle}>Assignment Details</ThemedText>
        <ThemedText style={$s.headerBrand}>CivicResolv</ThemedText>
      </View>

      <ScrollView
        scrollEnabled={!mapActive}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero image ── */}
        <View style={$s.heroWrap}>
          {issue.images && issue.images.length > 0 ? (
            <Image source={{ uri: issue.images[0] }} style={$s.heroImage} contentFit="cover" />
          ) : (
            <View style={$s.heroPlaceholder}>
              <Feather name="image" size={48} color={C.border} />
            </View>
          )}
          {/* Overlay gradient strip at bottom */}
          <View style={$s.heroOverlay}>
            {/* Priority + Category tags */}
            <View style={$s.tagRow}>
              <View style={[$s.tag, { backgroundColor: pColor }]}>
                <ThemedText style={$s.tagText}>{(issue.priority ?? "low").toUpperCase()} PRIORITY</ThemedText>
              </View>
              <View style={[$s.tag, { backgroundColor: cColor }]}>
                <ThemedText style={$s.tagText}>{(issue.category ?? "OTHER").replace("_", " ").toUpperCase()}</ThemedText>
              </View>
            </View>
          </View>
        </View>

        <View style={$s.body}>
          {/* Issue ID + Title */}
          {issue.id && (
            <ThemedText style={$s.issueId}>Id: {issue.id.substring(0, 12).toUpperCase()}</ThemedText>
          )}
          <ThemedText style={$s.issueTitle}>{issue.title}</ThemedText>

          {/* Location */}
          <View style={$s.infoCard}>
            <View style={$s.infoIconWrap}>
              <Feather name="map-pin" size={14} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={$s.infoLabel}>LOCATION</ThemedText>
              <ThemedText style={$s.infoValue}>{issue.address ?? issue.district ?? "Unknown Location"}</ThemedText>
            </View>
          </View>

          {/* Assigned On */}
          <View style={$s.infoCard}>
            <View style={$s.infoIconWrap}>
              <Feather name="calendar" size={14} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={$s.infoLabel}>ASSIGNED ON</ThemedText>
              <ThemedText style={$s.infoValue}>
                {formatDate(issue.createdAt)} • {formatTime(issue.createdAt)}
              </ThemedText>
            </View>
          </View>

          {/* mapcn styled Map */}
          <View style={$s.mapCard}>
            <MapcnView
              style={{ ...StyleSheet.absoluteFillObject }}
              theme="dark"
              zoom={15}
              center={issue.longitude !== undefined && issue.latitude !== undefined ? [issue.longitude, issue.latitude] : undefined}
              showsUserLocation={true}
              onInteract={setMapActive}
              markers={issue.longitude !== undefined && issue.latitude !== undefined ? [{
                id: issue.id,
                coordinate: [issue.longitude, issue.latitude],
                color: issue.status === "resolved" ? "#10B981" : issue.status === "in_progress" ? "#3B82F6" : "#F59E0B",
                icon: issue.category === "water" ? "droplet" : issue.category === "electricity" ? "zap" : issue.category === "roads" ? "map" : issue.category === "waste" ? "trash-2" : "alert-circle"
              }] : []}
            />
          </View>

          {/* ── Resolution Proof ── */}
          <View style={$s.sectionCard}>
            <View style={$s.proofHeader}>
              <ThemedText style={$s.sectionTitle}>Resolution Proof</ThemedText>
              <View style={$s.requiredBadge}>
                <ThemedText style={$s.requiredText}>REQUIRED</ThemedText>
              </View>
            </View>
            <ThemedText style={$s.proofHint}>
              Please capture or upload a clear photo of the repaired issue. Ensure the repair joint and surrounding area are visible.
            </ThemedText>

            {/* Buttons */}
            <Pressable style={$s.photoBtn} onPress={handleOpenCamera}>
              <Feather name="camera" size={18} color="#000" />
              <ThemedText style={$s.photoBtnText}>Take Photo</ThemedText>
            </Pressable>

            <Pressable style={$s.galleryBtn} onPress={handlePickImage}>
              <Feather name="image" size={18} color={C.text} />
              <ThemedText style={$s.galleryBtnText}>Gallery</ThemedText>
            </Pressable>

            {/* Images */}
            {resolutionImages.length === 0 ? (
              <View style={$s.noImageBox}>
                <Feather name="upload" size={28} color={C.border} />
                <ThemedText style={$s.noImageText}>NO IMAGES UPLOADED YET</ThemedText>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.md }}>
                {resolutionImages.map((uri, i) => (
                  <View key={i} style={$s.thumbWrap}>
                    <Image source={{ uri }} style={$s.thumb} contentFit="cover" />
                    <Pressable
                      style={$s.thumbRemove}
                      onPress={() => setResolutionImages((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Feather name="x" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Notes */}
            <TextInput
              style={[$s.notesInput]}
              placeholder="Resolution notes (optional)..."
              placeholderTextColor={C.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* ── Assignment Logs ── */}
          <View style={$s.logsSection}>
            <ThemedText style={$s.logsTitle}>ASSIGNMENT LOGS</ThemedText>
            {(statusUpdates ?? []).length === 0 ? (
              <ThemedText style={{ color: C.muted, fontSize: 12 }}>No logs yet.</ThemedText>
            ) : (
              (statusUpdates ?? []).slice(0, 5).map((update: any, i: number) => (
                <View key={i} style={$s.logRow}>
                  <ThemedText style={$s.logTime}>
                    {update.createdAt ? new Date(update.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </ThemedText>
                  <ThemedText style={$s.logText}>
                    {update.note ?? `STATUS_CHANGE: ${update.fromStatus?.toUpperCase()} → ${update.toStatus?.toUpperCase()}`}
                  </ThemedText>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Footer Resolve Button ── */}
      <View style={[$s.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable style={$s.resolveBtn} onPress={handleResolve} disabled={resolveMutation.isPending}>
          {resolveMutation.isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <View style={$s.resolveBtnCheck}>
                <Feather name="check" size={16} color="#000" />
              </View>
              <ThemedText style={$s.resolveBtnText}>Mark as Resolved</ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {/* ── Camera Modal ── */}
      <Modal visible={showCamera} animationType="slide" onRequestClose={() => setShowCamera(false)}>
        <View style={$s.cameraWrap}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          <View style={[$s.cameraOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <Pressable onPress={() => setShowCamera(false)} style={$s.cameraClose}>
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={takePicture} style={$s.captureBtn}>
              <View style={$s.captureBtnInner} />
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const $s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.backgroundRoot,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: C.backgroundRoot,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    zIndex: 10,
  },
  backBtn: {
    marginRight: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
  },
  headerBrand: {
    fontSize: 13,
    fontWeight: "700",
    color: C.primary,
  },
  // Hero
  heroWrap: {
    width: "100%",
    height: 220,
    backgroundColor: C.surface,
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.surfaceHighlight,
  },
  heroOverlay: {
    position: "absolute",
    top: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  tagRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  tagText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  // Body
  body: {
    padding: Spacing.lg,
  },
  issueId: {
    fontSize: 11,
    color: C.muted,
    marginBottom: 4,
    fontWeight: "500",
  },
  issueTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: C.text,
    lineHeight: 30,
    marginBottom: Spacing.lg,
  },
  // Info Cards
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.surface,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: C.border,
    gap: Spacing.md,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${C.primary}18`,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: C.text,
    lineHeight: 20,
  },
  // Map
  mapCard: {
    height: 100,
    backgroundColor: "#0D2B2B",
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1A3A3A",
  },
  mapInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1A4A4A",
    alignItems: "center",
    justifyContent: "center",
  },
  // Resolution Proof
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: C.border,
  },
  proofHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.text,
  },
  requiredBadge: {
    backgroundColor: `${C.primary}20`,
    borderRadius: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: `${C.primary}40`,
  },
  requiredText: {
    color: C.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  proofHint: {
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  photoBtn: {
    backgroundColor: C.primary,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  photoBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 14,
  },
  galleryBtn: {
    backgroundColor: C.backgroundRoot,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: Spacing.md,
  },
  galleryBtnText: {
    color: C.text,
    fontWeight: "600",
    fontSize: 14,
  },
  noImageBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  noImageText: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  thumbWrap: {
    marginRight: Spacing.sm,
    position: "relative",
  },
  thumb: {
    width: 90,
    height: 90,
    borderRadius: BorderRadius.sm,
  },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.error,
    alignItems: "center",
    justifyContent: "center",
  },
  notesInput: {
    backgroundColor: C.backgroundRoot,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    padding: Spacing.md,
    marginTop: Spacing.md,
    minHeight: 72,
    textAlignVertical: "top",
    fontSize: 13,
  },
  // Logs
  logsSection: {
    marginBottom: Spacing.xl,
  },
  logsTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 2,
    marginBottom: Spacing.md,
  },
  logRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logTime: {
    color: C.primary,
    fontSize: 11,
    fontWeight: "700",
    minWidth: 55,
  },
  logText: {
    color: C.muted,
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.backgroundRoot,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    zIndex: 10,
  },
  resolveBtn: {
    backgroundColor: C.primary,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    gap: Spacing.sm,
  },
  resolveBtnCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  resolveBtnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 15,
  },
  // Camera
  cameraWrap: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
  },
  cameraClose: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  captureBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
});
