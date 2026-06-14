import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

const expo = new Expo();

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(`Invalid Expo push token: ${pushToken}`);
    return;
  }

  const message: ExpoPushMessage = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data: data || {},
    priority: "high",
  };

  try {
    const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync([message]);
    const ticket = tickets[0];
    if (ticket.status === "ok") {
      console.log("Push notification sent successfully");
    } else if (ticket.status === "error") {
      console.error(`Push notification error: ${ticket.message}`);
      if (ticket.details?.error) {
        console.error(`Error detail: ${ticket.details.error}`);
      }
    }
  } catch (error) {
    console.error("Failed to send push notification:", error);
  }
}
