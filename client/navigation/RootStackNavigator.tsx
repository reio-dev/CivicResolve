import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import ResolverTabNavigator from "@/navigation/ResolverTabNavigator";
import ReportIssueScreen from "@/screens/ReportIssueScreen";
import IssueDetailScreen from "@/screens/IssueDetailScreen";
import ResolverIssueDetailScreen from "@/screens/ResolverIssueDetailScreen";
import LoginScreen from "@/screens/LoginScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/hooks/useAuth";

export type RootStackParamList = {
  Main: undefined;
  ResolverMain: undefined;
  Login: undefined;
  ReportIssue: undefined;
  IssueDetail: { issueId: string };
  ResolverIssueDetail: { assignmentId: string; issueId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user, isResolver } = useAuth();

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
        </>
      )}
    </Stack.Navigator>
  );
}
