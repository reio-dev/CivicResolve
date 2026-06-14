import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import ResolverTabNavigator from "@/navigation/ResolverTabNavigator";
import ReportIssueScreen from "@/screens/ReportIssueScreen";
import IssueDetailScreen from "@/screens/IssueDetailScreen";
import ResolverIssueDetailScreen from "@/screens/ResolverIssueDetailScreen";
import ResolverNotificationsScreen from "@/screens/ResolverNotificationsScreen";
import UserNotificationsScreen from "@/screens/UserNotificationsScreen";
import LoginScreen from "@/screens/LoginScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import CreditRedeemScreen from "@/screens/CreditRedeemScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

export type RootStackParamList = {
  Main: undefined;
  ResolverMain: undefined;
  Login: undefined;
  ReportIssue: undefined;
  IssueDetail: { issueId: string };
  ResolverIssueDetail: { assignmentId: string; issueId: string };
  ResolverNotifications: undefined;
  UserNotifications: undefined;
  Settings: undefined;
  EditProfile: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  CreditRedeem: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user, isResolver } = useAuth();
  const { t } = useTranslation();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : isResolver ? (
        <>
          <Stack.Screen
            name="ResolverMain"
            component={ResolverTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ResolverIssueDetail"
            component={ResolverIssueDetailScreen}
            options={{
              headerTitle: "Assignment Details",
            }}
          />
          <Stack.Screen
            name="ResolverNotifications"
            component={ResolverNotificationsScreen}
            options={{
              headerTitle: "Notifications",
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              headerTitle: t("settings.title"),
            }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{
              headerTitle: t("profile.editProfile"),
            }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ headerTitle: t("settings.privacyPolicy") }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{ headerTitle: t("settings.termsOfService") }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ReportIssue"
            component={ReportIssueScreen}
            options={{
              presentation: "modal",
              headerTitle: "Report Issue",
            }}
          />
          <Stack.Screen
            name="IssueDetail"
            component={IssueDetailScreen}
            options={{
              headerTitle: "Issue Details",
            }}
          />
          <Stack.Screen
            name="UserNotifications"
            component={UserNotificationsScreen}
            options={{
              headerTitle: "Notifications",
            }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              headerTitle: t("settings.title"),
            }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{
              headerTitle: t("profile.editProfile"),
            }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ headerTitle: t("settings.privacyPolicy") }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{ headerTitle: t("settings.termsOfService") }}
          />
          <Stack.Screen
            name="CreditRedeem"
            component={CreditRedeemScreen}
            options={{ headerShown: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
