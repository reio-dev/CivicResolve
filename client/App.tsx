import React, { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import { saveLocalNotification } from "@/lib/local-notifications";
import "@/lib/i18n";

import AsyncStorage from "@react-native-async-storage/async-storage";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    let shouldShow = true;
    try {
      const data = notification.request.content.data;
      if (data && data.targetUserId) {
        const userStr = await AsyncStorage.getItem("@civicresolv_auth");
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.id !== data.targetUserId) {
            shouldShow = false;
          }
        } else {
          shouldShow = false;
        }
      }
    } catch (err) {
      console.error("Error in notification handler:", err);
    }
    
    return {
      shouldShowAlert: shouldShow,
      shouldPlaySound: shouldShow,
      shouldSetBadge: shouldShow,
      shouldShowBanner: shouldShow,
      shouldShowList: shouldShow,
    };
  },
});

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const notificationResponseListener = useRef<Notifications.Subscription | null>(null);
  const notificationReceivedListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // Save notifications received while app is in foreground
    notificationReceivedListener.current = 
      Notifications.addNotificationReceivedListener((notification) => {
        saveLocalNotification(notification).then(() => {
          queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["resolver-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["unread-count"] });
        });
      });

    // Handle notification tap — navigate to the relevant issue
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        // Save to local storage just in case it wasn't caught in foreground
        saveLocalNotification(response).then(() => {
          queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["resolver-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["unread-count"] });
        });

        const data = response.notification.request.content.data;
        if (data?.type === "assignment" && data?.issueId && data?.assignmentId) {
          // Small delay to ensure navigation is ready
          setTimeout(() => {
            if (navigationRef.isReady()) {
              (navigationRef as any).navigate("ResolverIssueDetail", {
                assignmentId: data.assignmentId,
                issueId: data.issueId,
              });
            }
          }, 500);
        }
      });

    return () => {
      if (notificationResponseListener.current) {
        notificationResponseListener.current.remove();
      }
      if (notificationReceivedListener.current) {
        notificationReceivedListener.current.remove();
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={styles.root}>
              <KeyboardProvider>
                <LanguageProvider>
                  <NavigationContainer ref={navigationRef}>
                    <RootStackNavigator />
                  </NavigationContainer>
                </LanguageProvider>
                <StatusBar style="auto" />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

