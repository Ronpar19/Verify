// TermsScreen.js
//
// Blocking first-launch consent screen. Rendered by App.js in place of
// LinkCheckerScreen until the user has accepted the current terms
// version (see terms.js) — it isn't an overlay drawn on top of the main
// screen, the main screen simply never mounts until acceptance happens.
//
// Also reused (in read-only mode, no checkbox) by LinkCheckerScreen's
// "terms of use" footer link so users can re-read the terms later.

import React, { useCallback, useState } from 'react';
import { SafeAreaView, View, Text, ScrollView, Pressable, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STRINGS, isRTL, getDeviceDefaultLanguage } from './translations';
import { getTermsBody, TERMS_KEY, TERMS_UPDATED_DATE } from './terms';
import { CheckIcon } from './icons';
import { COLORS } from './LinkCheckerScreen';
import * as Localization from 'expo-localization';

function Checkbox({ checked, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.checkbox, checked && styles.checkboxChecked]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      {checked && <CheckIcon size={14} color="#fff" />}
    </Pressable>
  );
}

export default function TermsScreen({ onAccept }) {
  const lang = getDeviceDefaultLanguage(Localization.getLocales ? Localization.getLocales() : []);
  const t = STRINGS[lang];
  const rtl = isRTL(lang);
  const { text: body, isFallback } = getTermsBody(lang);
  const bodyIsRTL = isFallback ? true : rtl;

  const [checked, setChecked] = useState(false);

  const handleAccept = useCallback(async () => {
    await AsyncStorage.setItem(TERMS_KEY, 'true');
    onAccept();
  }, [onAccept]);

  return (
    <View style={[styles.container, Platform.OS === 'web' ? styles.webFill : null]}>
      <SafeAreaView style={[styles.safe, Platform.OS === 'web' ? styles.webFill : null]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.title, { textAlign: rtl ? 'right' : 'left' }]}>{t.termsTitle}</Text>
          <Text style={[styles.updated, { textAlign: rtl ? 'right' : 'left' }]}>
            {t.termsUpdatedLabel(TERMS_UPDATED_DATE)}
          </Text>
          {isFallback && (
            <Text style={[styles.fallbackNotice, { textAlign: rtl ? 'right' : 'left' }]}>
              {t.termsFallbackNotice}
            </Text>
          )}
          <Text
            style={[
              styles.body,
              // The body itself is Hebrew whenever no reviewed translation
              // exists yet (isFallback) — direction must follow the text's
              // own language, not necessarily the UI chrome's language.
              bodyIsRTL
                ? { textAlign: 'right', writingDirection: 'rtl' }
                : { textAlign: 'left', writingDirection: 'ltr' },
            ]}
          >
            {body}
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.checkboxRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
            onPress={() => setChecked((v) => !v)}
            activeOpacity={0.7}
          >
            <Checkbox checked={checked} onToggle={() => setChecked((v) => !v)} />
            <Text style={[styles.checkboxLabel, { textAlign: rtl ? 'right' : 'left' }]}>{t.termsCheckbox}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.continueBtn, !checked && styles.continueBtnDisabled]}
            onPress={handleAccept}
            disabled={!checked}
          >
            <Text style={styles.continueBtnText}>{t.termsContinueBtn}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  webFill: { minHeight: '100vh' },
  safe: { flex: 1 },
  scrollContent: { padding: 22, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  updated: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  fallbackNotice: {
    fontSize: 12, color: COLORS.unknown, backgroundColor: COLORS.unknownBg,
    borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginTop: 8,
  },
  body: { marginTop: 16, fontSize: 13.5, lineHeight: 21, color: COLORS.text },
  footer: {
    padding: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  checkboxRow: { alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  checkboxLabel: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '600' },
  continueBtn: {
    marginTop: 14, height: 50, borderRadius: 14, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  continueBtnDisabled: { backgroundColor: COLORS.border },
  continueBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
});
