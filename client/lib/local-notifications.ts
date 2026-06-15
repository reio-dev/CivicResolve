import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export interface LocalNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

const STORAGE_KEY = "civicresolv_local_notifications";

export async function getLocalNotifications(): Promise<LocalNotification[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const notifications: LocalNotification[] = JSON.parse(data);

    // Filter out notifications older than 24 hours
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const activeNotifications = notifications.filter(
      (n) => new Date(n.createdAt).getTime() > twentyFourHoursAgo
    );

    // If we deleted some, update storage
    if (activeNotifications.length !== notifications.length) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(activeNotifications));
    }

    // Sort by newest first
    return activeNotifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (err) {
    console.error("Failed to get local notifications", err);
    return [];
  }
}

export async function saveLocalNotification(
  pushNotification: Notifications.Notification | Notifications.NotificationResponse
): Promise<void> {
  try {
    const isResponse = "notification" in pushNotification;
    const notification = isResponse
      ? (pushNotification as Notifications.NotificationResponse).notification
      : (pushNotification as Notifications.Notification);

    const title = notification.request.content.title || "New Notification";
    const message = notification.request.content.body || "";
    const data = notification.request.content.data || {};
    const type = typeof data.type === "string" ? data.type : "unknown";
    
    // Use the push notification identifier as our ID to avoid duplicates
    const id = notification.request.identifier;

    const current = await getLocalNotifications();
    
    // Prevent duplicates
    if (current.some((n) => n.id === id)) {
      return;
    }

    const newNotif: LocalNotification = {
      id,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    const updated = [newNotif, ...current];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save local notification", err);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    const current = await getLocalNotifications();
    const updated = current.map((n) => (n.id === id ? { ...n, isRead: true } : n));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to mark notification read", err);
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    const current = await getLocalNotifications();
    const updated = current.map((n) => ({ ...n, isRead: true }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to mark all notifications read", err);
  }
}

export async function clearAllNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear notifications", err);
  }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const current = await getLocalNotifications();
    return current.filter((n) => !n.isRead).length;
  } catch (err) {
    return 0;
  }
}
