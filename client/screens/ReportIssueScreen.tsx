import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, Platform, Alert, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { File } from "expo-file-system/next";
import * as ImageManipulator from "expo-image-manipulator";
import { useAudioRecorder, useAudioPlayer, useAudioPlayerStatus, RecordingPresets, requestRecordingPermissionsAsync } from "expo-audio";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInUp, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, CategoryColors } from "@/constants/theme";

const CARD_BG = "#111111";
const CARD_BORDER = "#222222";
const GREEN = "#58CC02";
const DARK_GREEN_BG = "#0C1F0C";
const DARK_BLUE_BG = "#0C0F1F";

// All project categories
const CATEGORIES = [
  { id: "roads", label: "Roads", icon: "map" },
  { id: "water", label: "Water", icon: "droplet" },
  { id: "waste", label: "Waste", icon: "trash-2" },
  { id: "electricity", label: "Electricity", icon: "zap" },
  { id: "drainage", label: "Drainage", icon: "cloud-rain" },
  { id: "parks", label: "Parks", icon: "sun" },
  { id: "sanitation", label: "Sanitation", icon: "wind" },
  { id: "other", label: "Other", icon: "more-horizontal" },
] as const;

const URGENCY_LEVELS = ["Low", "Moderate", "High", "Critical"] as const;
const PRIVACY_OPTIONS = ["Public", "Anonymous"] as const;

type Step = "camera" | "details" | "success";

export default function ReportIssueScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("camera");
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, requestLocationPermission] = Location.useForegroundPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("roads");
  const [urgency, setUrgency] = useState<string>("Moderate");
  const [privacy, setPrivacy] = useState<string>("Public");
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string; district?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioPlayer = useAudioPlayer(audioUri || null);
  const playerStatus = useAudioPlayerStatus(audioPlayer);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIsPlaying(playerStatus.playing);
  }, [playerStatus.playing]);

  // Waveform animation
  const waveValues = Array.from({ length: 7 }, () => useSharedValue(0.3));

  const successScale = useSharedValue(0);
  const successStyle = useAnimatedStyle(() => ({ transform: [{ scale: successScale.value }] }));

  useEffect(() => {
    if (step === "success") {
      successScale.value = withSpring(1, { damping: 10 });
    }
  }, [step]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Start/stop waveform animation
  useEffect(() => {
    if (isRecording) {
      waveValues.forEach((val, i) => {
        val.value = withRepeat(
          withTiming(0.6 + Math.random() * 0.4, { duration: 300 + i * 80 }),
          -1,
          true
        );
      });
    } else {
      waveValues.forEach((val) => {
        val.value = withTiming(0.3, { duration: 200 });
      });
    }
  }, [isRecording]);

  const waveStyles = waveValues.map((val) =>
    useAnimatedStyle(() => ({
      height: `${val.value * 100}%`,
    }))
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission needed", "Microphone access is required for voice reports.");
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    try {
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
      const uri = audioRecorder.uri;
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);

      if (uri) {
        setAudioUri(uri);
        // Auto-fill description with transcription
        transcribeAudio(uri);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Transcription — uses server endpoint with fallback
  const transcribeAudio = async (uri: string) => {
    try {
      // Read audio file as base64 — web-compatible via fetch/blob, native via File
      let audioBase64: string;
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        audioBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            // strip data:audio/...;base64, prefix
            resolve(result.split(",")[1] || "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const audioFile = new File(uri);
        audioBase64 = await audioFile.base64();
      }

      // Try server-side transcription
      const response = await apiRequest("POST", "/api/transcribe", {
        audio: audioBase64,
        mimeType: "audio/m4a",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.transcript) {
          setTranscript(data.transcript);
          setDescription(data.transcript);
          // Auto-generate title from first sentence
          if (!title) {
            const firstSentence = data.transcript.split(/[.!?]/)[0]?.trim();
            if (firstSentence && firstSentence.length > 5) {
              setTitle(firstSentence.substring(0, 60));
            }
          }
          return;
        }
      }
    } catch (error) {
      console.log("Server transcription unavailable, using fallback.");
    }

    // Fallback: prompt user to type
    setTranscript("Voice recorded — please type the description below or re-record.");
  };

  // Audio playback
  const playAudio = async () => {
    if (!audioUri) return;
    try {
      audioPlayer.play();
    } catch (err) {
      console.error("Playback error:", err);
    }
  };

  const stopPlayback = async () => {
    try {
      audioPlayer.pause();
    } catch (err) {
      console.error("Stop error:", err);
    }
  };

  const createIssueMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/issues", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      refreshUser();
      setStep("success");
    },
    onError: () => {
      Alert.alert("Error", "Failed to submit report. Please try again.");
      setSubmitting(false);
    },
  });

  const getLocation = async () => {
    if (!locationPermission?.granted) {
      const result = await requestLocationPermission();
      if (!result.granted) return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [address] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const area = (address as any)?.subLocality || address?.street || "";
      const district = address?.city || (address as any)?.district || "";
      const state = address?.region || "";
      const postalCode = address?.postalCode || "";
      const addressParts = [area, district, state, postalCode].filter(Boolean);
      const fullAddress = addressParts.join(", ");
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, address: fullAddress, district });
    } catch (error) {
      console.error("Location error:", error);
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        if (photo?.uri) {
          setCapturedImage(photo.uri);
          await getLocation();
          setStep("details");
        }
      } catch (error) {
        console.error("Camera error:", error);
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      await getLocation();
      setStep("details");
    }
  };

  const convertImageToBase64 = async (uri: string): Promise<string> => {
    if (Platform.OS === "web") {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read image"));
          reader.readAsDataURL(blob);
        });
      } catch {
        throw new Error("Failed to convert image to base64");
      }
    }
    try {
      const compressed = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG });
      const file = new File(compressed.uri);
      const base64 = await file.base64();
      return `data:image/jpeg;base64,${base64}`;
    } catch {
      throw new Error("Failed to convert image to base64.");
    }
  };

  const convertAudioToBase64 = async (uri: string): Promise<string> => {
    try {
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      const audioFile = new File(uri);
      const base64 = await audioFile.base64();
      return `data:audio/m4a;base64,${base64}`;
    } catch {
      console.error("Failed to convert audio");
      return "";
    }
  };

  const priorityFromUrgency = (u: string) => {
    switch (u) {
      case "Low": return "low";
      case "Moderate": return "medium";
      case "High": return "high";
      case "Critical": return "critical";
      default: return "medium";
    }
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert("Missing Location", "Please wait for location to be detected.");
      return;
    }
    const finalTitle = title.trim() || "Reported Issue";
    const finalDesc = description.trim() || transcript || "Reported via voice";

    setSubmitting(true);
    let mediaUrls: string[] = [];

    // Upload image
    if (capturedImage) {
      try {
        const base64Image = await convertImageToBase64(capturedImage);
        mediaUrls.push(base64Image);
      } catch (error) {
        console.error("Image conversion failed:", error);
      }
    }

    // Upload audio
    if (audioUri) {
      try {
        const base64Audio = await convertAudioToBase64(audioUri);
        if (base64Audio) {
          mediaUrls.push(base64Audio);
        }
      } catch (error) {
        console.error("Audio conversion failed:", error);
      }
    }

    createIssueMutation.mutate({
      title: finalTitle,
      description: finalDesc,
      category,
      priority: priorityFromUrgency(urgency),
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
      district: location.district,
      images: mediaUrls,
      reporterId: user?.id,
    });
  };

  // ── Camera Step ──
  if (!permission) return <View style={[styles.container, { backgroundColor: "#000000" }]} />;

  if (!permission.granted) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Feather name="camera-off" size={48} color={Colors.light.muted} />
        <ThemedText type="body" style={{ color: Colors.light.muted, marginTop: Spacing.lg, textAlign: "center" }}>Camera access is needed to report issues</ThemedText>
        <Pressable style={[styles.permissionButton, { backgroundColor: GREEN }]} onPress={requestPermission}>
          <ThemedText type="body" style={{ color: "#000000", fontWeight: "700" }}>Enable Camera</ThemedText>
        </Pressable>
        {Platform.OS !== "web" ? (
          <Pressable style={styles.galleryLink} onPress={pickImage}>
            <ThemedText type="small" style={{ color: GREEN }}>Or select from gallery</ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>
    );
  }

  if (step === "camera") {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={[styles.cameraOverlay, { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={styles.cameraFrame}>
            <View style={[styles.cameraCorner, styles.topLeft]} />
            <View style={[styles.cameraCorner, styles.topRight]} />
            <View style={[styles.cameraCorner, styles.bottomLeft]} />
            <View style={[styles.cameraCorner, styles.bottomRight]} />
            <Feather name="crosshair" size={40} color="rgba(88, 204, 2, 0.6)" style={{ position: "absolute", alignSelf: "center", top: "50%", left: "50%", marginTop: -20, marginLeft: -20 }} />
          </View>
          <ThemedText type="body" style={styles.cameraHint}>Capture the issue clearly</ThemedText>
          <View style={styles.cameraControls}>
            <Pressable style={styles.galleryButton} onPress={pickImage}>
              <Feather name="image" size={24} color="#FFFFFF" />
            </Pressable>
            <Pressable style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </Pressable>
            <View style={styles.galleryButton} />
          </View>
        </View>
      </View>
    );
  }

  // ── Success Step ──
  if (step === "success") {
    return (
      <ThemedView style={[styles.container, styles.centered, { paddingHorizontal: Spacing.xl }]}>
        <Animated.View style={[styles.successIcon, successStyle]}>
          <View style={[styles.successGradient, { backgroundColor: GREEN }]}>
            <Feather name="check" size={48} color="#000000" />
          </View>
        </Animated.View>
        <ThemedText type="h3" style={{ marginTop: Spacing.xl, textAlign: "center" }}>Report Submitted!</ThemedText>
        <ThemedText type="body" style={{ color: Colors.light.muted, marginTop: Spacing.md, textAlign: "center" }}>Thank you for helping improve your community. You earned 25 points!</ThemedText>
        <Pressable style={[styles.doneButton, { backgroundColor: GREEN }]} onPress={() => navigation.goBack()}>
          <ThemedText type="body" style={{ color: "#000000", fontWeight: "700" }}>Done</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  // ── Details / Voice Report Step ──
  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.formContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}>

        {/* ── CivicResolv Header ── */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.logoIcon}>
              <Feather name="shield" size={14} color={GREEN} />
            </View>
            <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.sm }}>CivicResolv</ThemedText>
          </View>
          <Feather name="bell" size={18} color="#FFFFFF" />
        </Animated.View>

        {/* ── Photo Preview with Location ── */}
        <Animated.View entering={FadeIn.duration(400)}>
          {capturedImage ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: capturedImage }} style={styles.previewImage} contentFit="cover" />
              {location ? (
                <View style={styles.locationPill}>
                  <Feather name="map-pin" size={12} color={GREEN} />
                  <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.xs, fontSize: 11 }} numberOfLines={1}>
                    {location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                  </ThemedText>
                </View>
              ) : null}
              <Pressable style={styles.retakeButton} onPress={() => setStep("camera")}>
                <Feather name="refresh-cw" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : null}
        </Animated.View>

        {/* ── NEW RESOLUTION / Voice Report ── */}
        <Animated.View entering={FadeInUp.delay(80).duration(350)}>
          <ThemedText type="small" style={{ color: GREEN, textTransform: "uppercase", letterSpacing: 2, fontWeight: "600", marginBottom: Spacing.xs }}>
            New Resolution
          </ThemedText>
          <ThemedText type="h2" style={{ fontWeight: "700", marginBottom: Spacing.lg }}>
            Voice Report
          </ThemedText>
        </Animated.View>

        {/* ── Voice Recorder Card ── */}
        <Animated.View entering={FadeInUp.delay(140).duration(350)}>
          <View style={styles.card}>
            <View style={styles.recorderHeader}>
              <ThemedText type="small" style={{ color: Colors.light.muted, textTransform: "uppercase", letterSpacing: 1.5, fontSize: 10 }}>
                Live Stream
              </ThemedText>
              <ThemedText type="body" style={{ color: GREEN, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                {formatTime(recordingDuration)}
              </ThemedText>
            </View>

            {/* Record / Stop Button with Waveform */}
            <Pressable
              style={[styles.recordButton, isRecording && styles.recordButtonActive]}
              onPress={isRecording ? stopRecording : startRecording}
            >
              <Feather name="mic" size={20} color={isRecording ? "#000000" : "#FFFFFF"} />
              <View style={styles.waveformContainer}>
                {waveStyles.map((wStyle, i) => (
                  <Animated.View key={i} style={[styles.waveBar, isRecording ? { backgroundColor: "#000000" } : { backgroundColor: Colors.light.muted }, wStyle]} />
                ))}
              </View>
              <ThemedText type="body" style={{ color: isRecording ? "#000000" : "#FFFFFF", fontWeight: "600" }}>
                {isRecording ? "Stop" : "Record"}
              </ThemedText>
            </Pressable>

            {/* Transcript */}
            {transcript ? (
              <ThemedText type="small" style={{ color: Colors.light.muted, fontStyle: "italic", textAlign: "center", marginTop: Spacing.lg }}>
                "{transcript}"
              </ThemedText>
            ) : (
              <ThemedText type="small" style={{ color: Colors.light.muted, fontStyle: "italic", textAlign: "center", marginTop: Spacing.lg }}>
                Tap record to describe the issue
              </ThemedText>
            )}

            {/* Replay Button */}
            {audioUri && !isRecording ? (
              <Pressable
                style={styles.replayButton}
                onPress={isPlaying ? stopPlayback : playAudio}
              >
                <Feather name={isPlaying ? "pause" : "play"} size={16} color={GREEN} />
                <ThemedText type="small" style={{ color: GREEN, fontWeight: "600", marginLeft: Spacing.xs }}>
                  {isPlaying ? "Pause" : "Replay"} ({formatTime(recordingDuration)})
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>

        {/* ── Description (auto-filled by transcription) ── */}
        <Animated.View entering={FadeInUp.delay(180).duration(350)}>
          <ThemedText type="small" style={{ color: Colors.light.muted, marginBottom: Spacing.sm, fontSize: 11 }}>
            Description {transcript ? "(auto-filled from voice)" : ""}
          </ThemedText>
          <TextInput
            style={styles.textInput}
            placeholder="Description will be auto-filled from voice recording..."
            placeholderTextColor={Colors.light.muted + "80"}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </Animated.View>

        {/* ── Select Category ── */}
        <Animated.View entering={FadeInUp.delay(220).duration(350)}>
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg }}>
              <Feather name="grid" size={14} color={Colors.light.muted} />
              <ThemedText type="small" style={{ color: Colors.light.muted, textTransform: "uppercase", letterSpacing: 1.5, fontSize: 10, marginLeft: Spacing.sm }}>
                Select Category
              </ThemedText>
            </View>
            <View style={styles.categoryChips}>
              {CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                const catColor = (CategoryColors as any)[cat.id] || GREEN;
                return (
                  <Pressable
                    key={cat.id}
                    style={[styles.chip, isSelected && { borderColor: catColor, backgroundColor: catColor + "15" }]}
                    onPress={() => setCategory(cat.id)}
                  >
                    {isSelected ? <Feather name={cat.icon as any} size={14} color={catColor} style={{ marginRight: Spacing.xs }} /> : null}
                    <ThemedText type="small" style={{ color: isSelected ? catColor : Colors.light.muted, fontWeight: isSelected ? "600" : "400" }}>
                      {cat.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* ── Urgency + Privacy Row ── */}
        <Animated.View entering={FadeInUp.delay(280).duration(350)}>
          <View style={styles.twoCol}>
            {/* Urgency */}
            <Pressable
              style={[styles.card, styles.optionCard, { backgroundColor: DARK_GREEN_BG, borderColor: GREEN + "30" }]}
              onPress={() => {
                const idx = URGENCY_LEVELS.indexOf(urgency as any);
                setUrgency(URGENCY_LEVELS[(idx + 1) % URGENCY_LEVELS.length]);
              }}
            >
              <Feather name="alert-triangle" size={20} color={GREEN} />
              <ThemedText type="small" style={{ color: Colors.light.muted, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, marginTop: Spacing.sm }}>
                Urgency
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", marginTop: Spacing.xs, color: "#FFFFFF" }}>
                {urgency}
              </ThemedText>
            </Pressable>

            {/* Privacy */}
            <Pressable
              style={[styles.card, styles.optionCard, { backgroundColor: DARK_BLUE_BG, borderColor: "#3B82F6" + "30" }]}
              onPress={() => {
                const idx = PRIVACY_OPTIONS.indexOf(privacy as any);
                setPrivacy(PRIVACY_OPTIONS[(idx + 1) % PRIVACY_OPTIONS.length]);
              }}
            >
              <Feather name="eye" size={20} color="#3B82F6" />
              <ThemedText type="small" style={{ color: Colors.light.muted, textTransform: "uppercase", letterSpacing: 1, fontSize: 9, marginTop: Spacing.sm }}>
                Privacy
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "700", marginTop: Spacing.xs, color: "#FFFFFF" }}>
                {privacy}
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── Submit Button ── */}
        <Animated.View entering={FadeInUp.delay(340).duration(350)}>
          <Pressable
            style={[styles.submitButton, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <ThemedText type="body" style={{ color: "#000000", fontWeight: "700", fontSize: 16 }}>
                Submit Resolution
              </ThemedText>
            )}
          </Pressable>
        </Animated.View>

      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  formContent: { paddingHorizontal: Spacing.lg },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  logoIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: GREEN + "20", alignItems: "center", justifyContent: "center" },

  // Card
  card: { backgroundColor: CARD_BG, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: CARD_BORDER, padding: Spacing.xl, marginBottom: Spacing.md },

  // Image
  imagePreview: { marginBottom: Spacing.xl, position: "relative", borderRadius: BorderRadius.xl, overflow: "hidden" },
  previewImage: { height: 180, width: "100%", borderRadius: BorderRadius.xl },
  locationPill: { position: "absolute", bottom: Spacing.md, left: Spacing.md, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  retakeButton: { position: "absolute", top: Spacing.sm, right: Spacing.sm, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },

  // Voice Recorder
  recorderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xl },
  recordButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", alignSelf: "center", backgroundColor: "#222222", borderRadius: BorderRadius.full, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, gap: Spacing.sm },
  recordButtonActive: { backgroundColor: GREEN },
  waveformContainer: { flexDirection: "row", alignItems: "center", height: 24, gap: 3, marginHorizontal: Spacing.sm },
  waveBar: { width: 4, borderRadius: 2, minHeight: 6 },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: GREEN + "40",
    backgroundColor: GREEN + "10",
  },

  // Text input
  textInput: { backgroundColor: CARD_BG, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: CARD_BORDER, padding: Spacing.lg, color: "#FFFFFF", fontSize: 14, marginBottom: Spacing.md, minHeight: 80, textAlignVertical: "top" },

  // Categories
  categoryChips: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: CARD_BORDER },

  // Urgency / Privacy
  twoCol: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
  optionCard: { flex: 1, alignItems: "center", marginBottom: 0 },

  // Submit
  submitButton: { backgroundColor: GREEN, borderRadius: BorderRadius.xl, height: 56, alignItems: "center", justifyContent: "center", marginTop: Spacing.sm },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", alignItems: "center", paddingHorizontal: Spacing.xl },
  cameraFrame: { width: 280, height: 280, position: "relative" },
  cameraCorner: { position: "absolute", width: 40, height: 40, borderColor: GREEN },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  cameraHint: { color: "rgba(255,255,255,0.8)", textAlign: "center" },
  cameraControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  galleryButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  captureButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: GREEN, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: "#FFFFFF" },
  captureButtonInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: GREEN },

  // Success
  successIcon: { width: 100, height: 100, borderRadius: 50, overflow: "hidden" },
  successGradient: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", borderRadius: 50 },
  doneButton: { paddingHorizontal: Spacing["3xl"], paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing["3xl"] },
  permissionButton: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.full, marginTop: Spacing.xl },
  galleryLink: { marginTop: Spacing.lg },
});
