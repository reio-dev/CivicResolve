import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuth } from "@/hooks/useAuth";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useTranslation } from "react-i18next";

const GREEN = Colors.light.primary;
const BG = Colors.light.backgroundRoot;
const CARD = Colors.light.surface;
const TEXT = Colors.light.text;
const DIM = Colors.light.textSecondary;
const BORDER = Colors.light.border;

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();
  
  const memberSince = (user as any)?.createdAt
    ? new Date((user as any).createdAt).getFullYear()
    : new Date().getFullYear();
  const defaultBio = t("editProfile.defaultBio", { year: memberSince });
  
  const [displayName, setDisplayName] = useState((user as any)?.displayName || "");
  const [bio, setBio] = useState((user as any)?.bio || defaultBio);
  const [phone, setPhone] = useState((user as any)?.phone || "");
  const [email, setEmail] = useState((user as any)?.email || "");
  const [avatarUrl, setAvatarUrl] = useState((user as any)?.avatarUrl || "");
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setAvatarUrl(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      await updateUser({ displayName, bio, phone, email, avatarUrl });
      Alert.alert("Success", "Profile updated successfully!");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: Math.max(headerHeight, insets.top + 44) + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={styles.avatarSection}>
            <Pressable onPress={pickImage} style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <ThemedText style={styles.avatarInitial}>
                    {(displayName || (user as any)?.username || "U")[0].toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <View style={styles.editBadge}>
                <Feather name="camera" size={14} color="#fff" />
              </View>
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t("editProfile.displayName")}</ThemedText>
            <View style={styles.inputWrapper}>
              <Feather name="user" size={18} color={DIM} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="John Doe"
                placeholderTextColor={DIM}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t("editProfile.bio")}</ThemedText>
            <View style={[styles.inputWrapper, { alignItems: "flex-start", paddingTop: 12 }]}>
              <Feather name="info" size={18} color={DIM} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder={t("editProfile.tellUs")}
                placeholderTextColor={DIM}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t("editProfile.email")}</ThemedText>
            <View style={styles.inputWrapper}>
              <Feather name="mail" size={18} color={DIM} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="john@example.com"
                placeholderTextColor={DIM}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>{t("editProfile.phoneNumber")}</ThemedText>
            <View style={styles.inputWrapper}>
              <Feather name="phone" size={18} color={DIM} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 234 567 8900"
                placeholderTextColor={DIM}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <Pressable 
            style={({ pressed }) => [
              styles.saveBtn,
              (pressed || isLoading) && { opacity: 0.7 }
            ]}
            onPress={handleSave}
            disabled={isLoading}
          >
            <ThemedText style={styles.saveBtnText}>
              {isLoading ? t("editProfile.saving") : t("editProfile.saveChanges")}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { paddingHorizontal: Spacing.lg },
  avatarSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: GREEN + "40",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: "800",
    color: GREEN,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: GREEN,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: BG,
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT,
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    paddingVertical: Spacing.md,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 0,
  },
  saveBtn: {
    backgroundColor: GREEN,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.lg,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
