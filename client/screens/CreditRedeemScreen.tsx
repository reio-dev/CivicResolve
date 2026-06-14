import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useAuth } from "@/hooks/useAuth";
import { Colors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const SCREEN_W = Dimensions.get("window").width;
const GREEN = Colors.light.primary;
const BG = Colors.light.backgroundRoot;
const CARD = Colors.light.surface;
const CARD2 = Colors.light.surfaceHighlight;
const TEXT = Colors.light.text;
const DIM = Colors.light.textSecondary;

const REDEEM_OPTIONS = [100, 500, 1000];

// ─── Swipe Button Component ─────────────────────────────────
function SwipeToRedeem({
  onRedeem,
  disabled,
}: {
  onRedeem: () => void;
  disabled: boolean;
}) {
  const SWIPE_WIDTH = SCREEN_W - 50; // Padding
  const BUTTON_SIZE = 56;
  const MAX_TRANSLATE = SWIPE_WIDTH - BUTTON_SIZE - 8;

  const translateX = useSharedValue(0);
  const isSwiped = useSharedValue(false);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => {
      if (isSwiped.value) return;
      translateX.value = Math.max(0, Math.min(e.translationX, MAX_TRANSLATE));
    })
    .onEnd(() => {
      if (isSwiped.value) return;
      if (translateX.value > MAX_TRANSLATE * 0.8) {
        translateX.value = withSpring(MAX_TRANSLATE);
        isSwiped.value = true;
        runOnJS(onRedeem)();
        // Reset after a delay
        setTimeout(() => {
          translateX.value = withSpring(0);
          isSwiped.value = false;
        }, 1500);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const rStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: 1 - translateX.value / MAX_TRANSLATE,
  }));

  return (
    <View style={[styles.swipeContainer, disabled && { opacity: 0.5 }]}>
      <Animated.Text style={[styles.swipeText, textStyle]}>
        Swipe to Redeem &gt;&gt;
      </Animated.Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.swipeButton, rStyle]}>
          <Feather name="chevron-right" size={24} color="#FFF" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function CreditRedeemScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  useFocusEffect(
    React.useCallback(() => {
      refreshUser();
    }, [])
  );

  const [selectedAmount, setSelectedAmount] = useState<number>(REDEEM_OPTIONS[0]);
  const [optimisticDeduction, setOptimisticDeduction] = useState<number>(0);

  const { data: redemptions = [], isLoading: isLoadingRedemptions } = useQuery<any[]>({
    queryKey: [`/api/users/${user?.id}/redemptions`],
    enabled: !!user?.id,
  });

  const { data: allocations = [], isLoading: isLoadingAllocations } = useQuery<any[]>({
    queryKey: [`/api/users/${user?.id}/credit-allocations`],
    enabled: !!user?.id,
  });

  const isLoading = isLoadingRedemptions || isLoadingAllocations;

  const combinedHistory = useMemo(() => {
    const r = redemptions.map((item) => ({ ...item, type: 'redeem' }));
    const a = allocations.map((item) => ({ ...item, type: 'allocate' }));
    return [...r, ...a].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [redemptions, allocations]);

  const currentCredits = (user as any)?.credits ?? 0;

  // Clear optimistic deduction when the true server value syncs
  React.useEffect(() => {
    setOptimisticDeduction(0);
  }, [currentCredits]);

  const displayCredits = currentCredits - optimisticDeduction;

  const redeemMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await fetch(`${getApiUrl()}/api/users/${user?.id}/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to redeem");
      }
      return res.json();
    },
    onMutate: () => {
      setOptimisticDeduction(selectedAmount);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/redemptions`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${user?.id}/credit-allocations`] });
      refreshUser(); // sync in background
      Alert.alert(
        "Redemption Successful",
        `You have successfully redeemed ${selectedAmount} credits.\n\nCoupon Code: ${data.couponCode}`,
        [{ text: "OK" }]
      );
    },
    onError: (error: Error) => {
      setOptimisticDeduction(0);
      Alert.alert("Redemption Failed", error.message);
    },
  });

  const handleRedeem = () => {
    if (displayCredits < selectedAmount) {
      Alert.alert("Insufficient Credits", "You do not have enough credits to redeem this amount.");
      return;
    }
    redeemMutation.mutate(selectedAmount);
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={TEXT} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Redeem Credits</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Points Display */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.pointsCard}>
          <Feather name="award" size={32} color="#FFF" style={{ marginBottom: 8 }} />
          <ThemedText style={styles.pointsLabel}>Available Credits</ThemedText>
          <ThemedText style={styles.pointsValue}>{displayCredits.toLocaleString()}</ThemedText>
        </Animated.View>

        {/* Disclaimer */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.disclaimerBox}>
          <Feather name="info" size={20} color="#059669" style={{ marginTop: 2 }} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <ThemedText style={styles.disclaimerTitle}>Government Payments Only</ThemedText>
            <ThemedText style={styles.disclaimerText}>
              Coupons generated can only be used to pay for Government bills, taxes, and other official civic dues. 100 credits = 10% off up to ₹100, and so on.
            </ThemedText>
          </View>
        </Animated.View>

        {/* Amount Selection */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          <ThemedText style={styles.sectionTitle}>Select Amount</ThemedText>
          <View style={styles.optionsGrid}>
            {REDEEM_OPTIONS.map((amount) => {
              const isSelected = selectedAmount === amount;
              const canAfford = displayCredits >= amount;
              return (
                <Pressable
                  key={amount}
                  onPress={() => setSelectedAmount(amount)}
                  style={[
                    styles.optionCard,
                    isSelected && styles.optionCardSelected,
                    !canAfford && styles.optionCardDisabled,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                      !canAfford && styles.optionTextDisabled,
                    ]}
                  >
                    {amount}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.optionLabel,
                      isSelected && styles.optionLabelSelected,
                    ]}
                  >
                    Credits
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Swipe Action */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.swipeWrapper}>
          <SwipeToRedeem
            onRedeem={handleRedeem}
            disabled={redeemMutation.isPending || displayCredits < selectedAmount}
          />
        </Animated.View>

        {/* History */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={styles.historySection}>
          <ThemedText style={styles.sectionTitle}>Transaction History</ThemedText>

          {isLoading ? (
            <ActivityIndicator color={GREEN} style={{ marginTop: 24 }} />
          ) : combinedHistory.length === 0 ? (
            <ThemedText style={styles.emptyText}>No past transactions.</ThemedText>
          ) : (
            combinedHistory.map((item: any) => {
              const isRedeem = item.type === 'redeem';
              return (
                <View key={`${item.type}-${item.id}`} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <ThemedText style={[styles.historyAmount, { color: isRedeem ? "#EF4444" : "#10B981" }]}>
                      {isRedeem ? '-' : '+'}{item.amount} Credits
                    </ThemedText>
                    <ThemedText style={styles.historyDate}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <View style={styles.historyRight}>
                    {isRedeem ? (
                      <>
                        <ThemedText style={styles.historyCode}>{item.couponCode}</ThemedText>
                        <ThemedText style={styles.historyPurpose}>{item.purpose || "Government Bills & Taxes"}</ThemedText>
                        {item.expiresAt && (
                          <ThemedText style={[styles.historyPurpose, { color: "#EF4444", marginTop: 2, fontWeight: "600" }]}>
                            Expires: {new Date(item.expiresAt).toLocaleDateString()}
                          </ThemedText>
                        )}
                      </>
                    ) : (
                      <>
                        <ThemedText style={[styles.historyPurpose, { marginTop: 4 }]}>{item.reason || "Points Earned"}</ThemedText>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </Animated.View>

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: CARD,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  pointsCard: {
    backgroundColor: GREEN,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  pointsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "600", marginBottom: 4 },
  pointsValue: { color: "#FFF", fontSize: 48, fontWeight: "900" },

  disclaimerBox: {
    flexDirection: "row",
    backgroundColor: "#ECFDF5",
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  disclaimerTitle: { fontSize: 14, fontWeight: "700", color: "#065F46", marginBottom: 4 },
  disclaimerText: { fontSize: 13, color: "#047857", lineHeight: 18 },

  sectionTitle: { fontSize: 18, fontWeight: "800", color: TEXT, marginBottom: 16 },

  optionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  optionCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginHorizontal: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionCardSelected: { borderColor: GREEN, backgroundColor: `${GREEN}10` },
  optionCardDisabled: { opacity: 0.5 },
  optionText: { fontSize: 24, fontWeight: "800", color: TEXT },
  optionTextSelected: { color: GREEN },
  optionTextDisabled: { color: DIM },
  optionLabel: { fontSize: 12, color: DIM, marginTop: 4, fontWeight: "600" },
  optionLabelSelected: { color: GREEN },

  swipeWrapper: { marginBottom: 40 },
  swipeContainer: {
    height: 64,
    backgroundColor: CARD2,
    borderRadius: 32,
    justifyContent: "center",
    position: "relative",
    marginHorizontal: 12,
    overflow: "hidden",
  },
  swipeText: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: DIM,
  },
  swipeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  historySection: { flex: 1 },
  emptyText: { textAlign: "center", color: DIM, marginTop: 16, fontSize: 14 },
  historyCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: CARD,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  historyLeft: { flex: 1 },
  historyAmount: { fontSize: 16, fontWeight: "800", color: "#EF4444", marginBottom: 4 },
  historyDate: { fontSize: 12, color: DIM },
  historyRight: { alignItems: "flex-end" },
  historyCode: { fontSize: 14, fontWeight: "700", color: TEXT, fontFamily: "monospace", letterSpacing: 1, marginBottom: 4 },
  historyPurpose: { fontSize: 11, color: DIM },
});
