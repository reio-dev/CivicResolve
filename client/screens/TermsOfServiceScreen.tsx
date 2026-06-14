import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Colors, Spacing } from '@/constants/theme';
import { useTranslation } from 'react-i18next';

export default function TermsOfServiceScreen() {
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
        <ThemedText style={styles.title}>{t('termsOfService.title')}</ThemedText>
        <ThemedText style={styles.date}>{t('termsOfService.lastUpdated')}</ThemedText>
        
        <ThemedText style={styles.heading}>{t('termsOfService.h1')}</ThemedText>
        <ThemedText style={styles.paragraph}>
          {t('termsOfService.p1')}
        </ThemedText>
        
        <ThemedText style={styles.heading}>{t('termsOfService.h2')}</ThemedText>
        <ThemedText style={styles.paragraph}>
          {t('termsOfService.p2')}
        </ThemedText>

        <ThemedText style={styles.heading}>{t('termsOfService.h3')}</ThemedText>
        <ThemedText style={styles.paragraph}>
          {t('termsOfService.p3')}
        </ThemedText>

        <ThemedText style={styles.heading}>{t('termsOfService.h4')}</ThemedText>
        <ThemedText style={styles.paragraph}>
          {t('termsOfService.p4')}
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
