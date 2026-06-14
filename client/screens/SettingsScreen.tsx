import React, { useState, useEffect } from "react";
import { View, StyleSheet, Switch, ScrollView, Pressable, Modal } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

const GREEN = Colors.light.primary;
const CARD_BG = Colors.light.surface;
const CARD_BORDER = Colors.light.surfaceHighlight;
const TEXT = Colors.light.text;
const DIM = Colors.light.textSecondary;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [groqAutoFill, setGroqAutoFill] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const { language: selectedLanguage, setLanguage: setSelectedLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { isResolver } = useAuth();

  const LANGUAGES = [
    "English (US)",
    "Hindi (हिन्दी)",
    "Bengali (বাংলা)",
    "Telugu (తెలుగు)",
    "Marathi (मराठी)",
    "Tamil (தமிழ்)",
    "Gujarati (ગુજરાતી)",
    "Kannada (ಕನ್ನಡ)",
    "Malayalam (മലയാളം)",
    "Odia (ଓଡ଼ିଆ)",
    "Punjabi (ਪੰਜਾਬੀ)",
    "Assamese (অসমীয়া)",
  ];

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const groq = await AsyncStorage.getItem("setting_groq_autofill");
        const push = await AsyncStorage.getItem("setting_push_notifications");
        const loc = await AsyncStorage.getItem("setting_location_services");

        if (groq !== null) setGroqAutoFill(groq === "true");
        if (push !== null) setPushNotifications(push === "true");
        if (loc !== null) setLocationServices(loc === "true");
      } catch (e) {
        console.error("Failed to load settings", e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const toggleSetting = async (key: string, value: boolean, setter: (val: boolean) => void) => {
    setter(value);
    try {
      await AsyncStorage.setItem(key, value.toString());
    } catch (e) {
      console.error(`Failed to save ${key}`, e);
    }
  };

  if (loading) return <ThemedView style={styles.container} />;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(headerHeight, insets.top + 44) + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <ThemedText style={styles.sectionTitle}>{t("settings.account")}</ThemedText>
        <View style={styles.card}>
          <Pressable style={[styles.settingRow, styles.borderBottom]}>
            <View style={styles.settingInfo}>
              <View style={styles.iconBox}>
                <Feather name="lock" size={20} color={GREEN} />
              </View>
              <View style={styles.textContainer}>
                <ThemedText style={styles.settingTitle}>{t("settings.changePassword")}</ThemedText>
                <ThemedText style={styles.settingDesc}>{t("settings.changePasswordDesc")}</ThemedText>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={DIM} />
          </Pressable>
          <Pressable style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.iconBox}>
                <Feather name="trash-2" size={20} color="#EF4444" />
              </View>
              <View style={styles.textContainer}>
                <ThemedText style={[styles.settingTitle, { color: "#EF4444" }]}>{t("settings.deleteAccount")}</ThemedText>
                <ThemedText style={styles.settingDesc}>{t("settings.deleteAccountDesc")}</ThemedText>
              </View>
            </View>
          </Pressable>
        </View>

        {!isResolver && (
          <>
            <ThemedText style={styles.sectionTitle}>{t("settings.features")}</ThemedText>
            <View style={styles.card}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <View style={styles.iconBox}>
                    <Feather name="cpu" size={20} color={GREEN} />
                  </View>
                  <View style={styles.textContainer}>
                    <ThemedText style={styles.settingTitle}>{t("settings.aiIssueAnalysis")}</ThemedText>
                    <ThemedText style={styles.settingDesc}>{t("settings.aiIssueAnalysisDesc")}</ThemedText>
                  </View>
                </View>
                <Switch
                  value={groqAutoFill}
                  onValueChange={(val) => toggleSetting("setting_groq_autofill", val, setGroqAutoFill)}
                  trackColor={{ false: "#333", true: GREEN + "80" }}
                  thumbColor={groqAutoFill ? GREEN : "#f4f3f4"}
                />
              </View>
            </View>
          </>
        )}

        <ThemedText style={styles.sectionTitle}>{t("settings.permissions")}</ThemedText>
        <View style={styles.card}>
          <View style={[styles.settingRow, styles.borderBottom]}>
            <View style={styles.settingInfo}>
              <View style={styles.iconBox}>
                <Feather name="bell" size={20} color={GREEN} />
              </View>
              <View style={styles.textContainer}>
                <ThemedText style={styles.settingTitle}>{t("settings.pushNotifications")}</ThemedText>
                <ThemedText style={styles.settingDesc}>{t("settings.pushNotificationsDesc")}</ThemedText>
              </View>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={(val) => toggleSetting("setting_push_notifications", val, setPushNotifications)}
              trackColor={{ false: "#333", true: GREEN + "80" }}
              thumbColor={pushNotifications ? GREEN : "#f4f3f4"}
            />
          </View>
          <View style={[styles.settingRow, styles.borderBottom]}>
            <View style={styles.settingInfo}>
              <View style={styles.iconBox}>
                <Feather name="map-pin" size={20} color={GREEN} />
              </View>
              <View style={styles.textContainer}>
                <ThemedText style={styles.settingTitle}>{t("settings.locationServices")}</ThemedText>
                <ThemedText style={styles.settingDesc}>{t("settings.locationServicesDesc")}</ThemedText>
              </View>
            </View>
            <Switch
              value={locationServices}
              onValueChange={(val) => toggleSetting("setting_location_services", val, setLocationServices)}
              trackColor={{ false: "#333", true: GREEN + "80" }}
              thumbColor={locationServices ? GREEN : "#f4f3f4"}
            />
          </View>
          <Pressable style={styles.settingRow} onPress={() => setLanguageModalVisible(true)}>
            <View style={styles.settingInfo}>
              <View style={styles.iconBox}>
                <Feather name="globe" size={20} color={GREEN} />
              </View>
              <View style={styles.textContainer}>
                <ThemedText style={styles.settingTitle}>{t("settings.language")}</ThemedText>
                <ThemedText style={styles.settingDesc}>{selectedLanguage}</ThemedText>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={DIM} />
          </Pressable>
        </View>

        <ThemedText style={styles.sectionTitle}>{t("settings.about")}</ThemedText>
        <View style={styles.card}>
          <Pressable 
            style={[styles.settingRow, styles.borderBottom]}
            onPress={() => navigation.navigate("PrivacyPolicy")}
          >
            <View style={styles.settingInfo}>
              <View style={styles.iconBox}>
                <Feather name="shield" size={20} color={GREEN} />
              </View>
              <View style={styles.textContainer}>
                <ThemedText style={styles.settingTitle}>{t("settings.privacyPolicy")}</ThemedText>
              </View>
            </View>
            <Feather name="external-link" size={20} color={DIM} />
          </Pressable>
          <Pressable 
            style={styles.settingRow}
            onPress={() => navigation.navigate("TermsOfService")}
          >
            <View style={styles.settingInfo}>
              <View style={styles.iconBox}>
                <Feather name="file-text" size={20} color={GREEN} />
              </View>
              <View style={styles.textContainer}>
                <ThemedText style={styles.settingTitle}>{t("settings.termsOfService")}</ThemedText>
              </View>
            </View>
            <Feather name="external-link" size={20} color={DIM} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal visible={languageModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{t("settings.selectLanguage")}</ThemedText>
              <Pressable onPress={() => setLanguageModalVisible(false)}>
                <Feather name="x" size={24} color={TEXT} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <Pressable 
                  key={lang} 
                  style={styles.languageOption}
                  onPress={() => {
                    setSelectedLanguage(lang);
                    setLanguageModalVisible(false);
                  }}
                >
                  <ThemedText style={[styles.languageText, selectedLanguage === lang && { color: GREEN, fontWeight: '700' }]}>
                    {lang}
                  </ThemedText>
                  {selectedLanguage === lang && <Feather name="check" size={20} color={GREEN} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundRoot },
  scroll: { paddingHorizontal: Spacing.lg },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: DIM,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
    marginLeft: Spacing.sm,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: TEXT,
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 12,
    color: DIM,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.light.backgroundRoot,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
  },
  languageOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.surfaceHighlight,
  },
  languageText: {
    fontSize: 16,
    color: TEXT,
  },
});
