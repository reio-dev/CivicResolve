import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors, Spacing } from '@/constants/theme';
import { useTranslation } from 'react-i18next';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(headerHeight, insets.top + 44) + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }
        ]}
      >
        <ThemedText style={styles.title}>{t('privacyPolicy.title')}</ThemedText>
        <ThemedText style={styles.date}>{t('privacyPolicy.lastUpdated')}</ThemedText>
        
        <ThemedText style={styles.heading}>{t('privacyPolicy.h1')}</ThemedText>
        <ThemedText style={styles.paragraph}>
          {t('privacyPolicy.p1')}
        </ThemedText>
        
        <ThemedText style={styles.heading}>{t('privacyPolicy.h2')}</ThemedText>
        <ThemedText style={styles.paragraph}>
          {t('privacyPolicy.p2')}
        </ThemedText>

        <ThemedText style={styles.heading}>{t('privacyPolicy.h3')}</ThemedText>
        <ThemedText style={styles.paragraph}>
          {t('privacyPolicy.p3')}
        </ThemedText>

        <ThemedText style={styles.heading}>{t('privacyPolicy.h4')}</ThemedText>
        <ThemedText style={styles.paragraph}>
          {t('privacyPolicy.p4')}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.backgroundRoot },
  scroll: { paddingHorizontal: Spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: Colors.light.text, marginBottom: Spacing.xs },
  date: { fontSize: 14, color: Colors.light.textSecondary, marginBottom: Spacing.xl },
  heading: { fontSize: 18, fontWeight: '700', color: Colors.light.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  paragraph: { fontSize: 15, color: Colors.light.text, lineHeight: 22 },
});
