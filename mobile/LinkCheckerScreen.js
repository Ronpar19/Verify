// LinkCheckerScreen.js
//
// Drop this into your Expo app (e.g. as a screen) and wire it into your
// navigator. Requires:
//   npx expo install expo-clipboard expo-localization react-native-svg expo-linear-gradient
//
// Point API_URL at your deployed Vercel backend (see the README).
//
// Multi-language: UI text lives in translations.js. Default language is
// picked from the device's locale (Localization.getLocales()); if the
// device isn't set to one of our 5 supported languages, we fall back to
// Hebrew. The small globe button (top-right) opens a popover so the user
// can override this manually at any time. The chosen language code is
// also sent to the backend as `lang` so the returned `details` text (Web
// Risk / heuristic explanations) comes back in the same language.

import React, { useCallback, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  ScrollView,
  Image,
  Linking,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Localization from 'expo-localization';
import { LANGUAGES, STRINGS, isRTL, getDeviceDefaultLanguage } from './translations';
import { extractUrls } from './extractUrls';
import {
  LinkLogoIcon,
  GlobeIcon,
  MenuIcon,
  AppleIcon,
  AndroidIcon,
  SearchIcon,
  ClipboardIcon,
  CheckIcon,
  WarningIcon,
  ShieldIcon,
  BoltIcon,
  SearchAdvancedIcon,
} from './icons';

const LOGO_SOURCE = require('./assets/logo.png');

// Prefer an EXPO_PUBLIC_ env var (Expo inlines these at build time) so you
// don't have to hardcode the URL. Falls back to a literal you should edit.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://YOUR-PROJECT.vercel.app/api/check-link';

// The PWA build of this same app (what the iOS "Add to Home Screen" flow
// points at) and the standalone Android APK it serves.
const WEB_APP_URL = 'https://verifyweb-phi.vercel.app';
const APK_URL = `${WEB_APP_URL}/link-checker.apk`;

const COLORS = {
  bg: '#EEF0F6',
  surface: '#FFFFFF',
  text: '#1B1E2B',
  textSecondary: '#767C93',
  border: '#E4E7F0',
  chipBg: '#EEF1FC',
  accent: '#3F5AE0',
  accentDark: '#2E42B0',
  busy: '#8C99E8',
  success: '#1FA25A',
  successBg: '#E6F6ED',
  successBorder: '#CDEBDA',
  danger: '#E0453F',
  dangerBg: '#FBE9E8',
  dangerBorder: '#F5D2D0',
  unknown: '#B9770E',
  unknownBg: '#FDF3E3',
  unknownBorder: '#F3E1B8',
};

// If a message has several links, the overall verdict should be the most
// cautious one found across all of them — danger beats unknown beats safe,
// and it only ever escalates (never downgrades) as results come in.
const SEVERITY = { safe: 0, unknown: 1, danger: 2 };
function worstOf(current, next) {
  return SEVERITY[next] > SEVERITY[current] ? next : current;
}

function paletteFor(status) {
  if (status === 'safe') return { fg: COLORS.success, bg: COLORS.successBg, border: COLORS.successBorder };
  if (status === 'danger') return { fg: COLORS.danger, bg: COLORS.dangerBg, border: COLORS.dangerBorder };
  return { fg: COLORS.unknown, bg: COLORS.unknownBg, border: COLORS.unknownBorder };
}

function normalizeUrl(url) {
  if (!url) return url;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}

function hostnameOf(url) {
  try {
    return new URL(normalizeUrl(url)).hostname;
  } catch (e) {
    return url;
  }
}

function StatusIcon({ status, size = 24 }) {
  if (status === 'safe') return <CheckIcon size={size} color={COLORS.success} />;
  if (status === 'danger') return <WarningIcon size={size} color={COLORS.danger} />;
  if (status === 'unknown') {
    return <Text style={{ fontSize: size * 0.85, fontWeight: '800', color: COLORS.unknown }}>?</Text>;
  }
  return <LinkLogoIcon size={size * 0.7} color={COLORS.textSecondary} />;
}

function ResultCard({ status, url, details, t, rtl, onReset }) {
  const palette = paletteFor(status);
  const title = status === 'safe' ? t.safeTitle : status === 'danger' ? t.dangerTitle : t.unknownTitle;
  const subtitle =
    details || (status === 'safe' ? t.safeSubtitle(hostnameOf(url)) : status === 'danger' ? t.dangerSubtitle : t.unknownSubtitle);

  return (
    <View style={[styles.resultCard, { borderColor: palette.border }]}>
      <View style={[styles.resultIconCircle, { backgroundColor: palette.bg }]}>
        <StatusIcon status={status} size={26} />
      </View>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultSubtitle}>{subtitle}</Text>
      <View style={[styles.resultActions, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity style={styles.resultBtnSecondary} onPress={onReset}>
          <Text style={styles.resultBtnSecondaryText}>{t.checkAnotherBtn}</Text>
        </TouchableOpacity>
        {status === 'danger' && (
          <TouchableOpacity style={[styles.resultBtnPrimary, { backgroundColor: COLORS.danger }]} onPress={onReset}>
            <Text style={styles.resultBtnPrimaryText}>{t.blockBtn}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function MultiResultCard({ checks, overallStatus, t, rtl, onReset }) {
  const palette = paletteFor(overallStatus === 'loading' ? 'unknown' : overallStatus);
  const caption =
    overallStatus === 'danger' ? t.multiDanger
    : overallStatus === 'unknown' ? t.multiUnknown
    : overallStatus === 'safe' ? t.multiSafe
    : '';

  return (
    <View style={[styles.resultCard, { borderColor: palette.border }]}>
      <Text style={styles.multiCaption}>{t.multiFoundCount(checks.length)}</Text>
      {!!caption && <Text style={styles.resultSubtitle}>{caption}</Text>}
      <View style={styles.linksList}>
        {checks.map((c, idx) => (
          <View key={`${idx}-${c.url}`} style={[styles.linkRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <View style={styles.linkRowIconCircle}>
              {c.status === 'loading' ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <StatusIcon status={c.status} size={16} />
              )}
            </View>
            <View style={styles.linkRowTextBlock}>
              <Text style={[styles.linkRowUrl, { textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
                {c.url}
              </Text>
              {(c.status === 'danger' || c.status === 'unknown') && !!c.details && (
                <Text style={[styles.linkRowDetails, { textAlign: rtl ? 'right' : 'left' }]} numberOfLines={2}>
                  {c.details}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
      <TouchableOpacity style={[styles.resultBtnSecondary, styles.resultBtnFull]} onPress={onReset}>
        <Text style={styles.resultBtnSecondaryText}>{t.checkAnotherBtn}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Chip({ Icon, label }) {
  return (
    <View style={styles.chip}>
      <View style={styles.chipIconCircle}>
        <Icon size={18} color={COLORS.accent} />
      </View>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

export default function LinkCheckerScreen() {
  const [lang, setLang] = useState(() =>
    getDeviceDefaultLanguage(Localization.getLocales ? Localization.getLocales() : [])
  );
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [iosHelpVisible, setIosHelpVisible] = useState(false);
  const t = STRINGS[lang];
  const rtl = isRTL(lang);

  const [link, setLink] = useState('');
  // One entry per link found in the pasted text. Each entry's status is
  // pending | loading | safe | danger | unknown.
  const [checks, setChecks] = useState([]);
  const [overallStatus, setOverallStatus] = useState('idle'); // idle | loading | safe | danger | unknown
  const requestSeqRef = useRef(0);

  // Finds every link in the pasted text and checks them one after another
  // (not in parallel) against the backend. The result escalates to
  // "danger" the moment a dangerous link turns up — it doesn't wait for
  // the whole batch — while the rest keep checking in the background so
  // you can see exactly which link(s) triggered it.
  const runCheck = useCallback(async (rawText) => {
    const urls = extractUrls(rawText);
    if (!urls.length) return;
    const seq = ++requestSeqRef.current;

    setLink(urls.length === 1 ? urls[0] : urls.join(', '));
    setChecks(urls.map((url) => ({ url, status: 'pending', details: '' })));
    setOverallStatus('loading');

    let worst = 'safe';

    for (let i = 0; i < urls.length; i++) {
      if (seq !== requestSeqRef.current) return; // a newer check superseded this run

      setChecks((prev) => prev.map((c, idx) => (idx === i ? { ...c, status: 'loading' } : c)));

      let result;
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link: urls[i], lang }),
        });
        const data = await response.json();
        const s = ['safe', 'danger', 'unknown'].includes(data.status) ? data.status : 'unknown';
        result = { status: s, details: data.details || '' };
      } catch (err) {
        result = { status: 'unknown', details: t.connectionError };
      }

      if (seq !== requestSeqRef.current) return;

      setChecks((prev) => prev.map((c, idx) => (idx === i ? { url: urls[i], ...result } : c)));

      const before = worst;
      worst = worstOf(worst, result.status);
      if (worst !== before) setOverallStatus(worst);
    }

    if (seq === requestSeqRef.current) setOverallStatus(worst);
  }, [lang, t]);

  // Same limitation as on the web: there's no API for a regular app to
  // silently read the last SMS on either iOS or Android (by design, for
  // privacy). This reads the clipboard instead — copy the link first
  // (long-press → Copy in Messages/Mail), then tap this button.
  const handleAutoPaste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text && text.trim()) runCheck(text);
  }, [runCheck]);

  const handleCheckPress = useCallback(() => runCheck(link), [runCheck, link]);

  const handleClear = useCallback(() => {
    requestSeqRef.current++; // invalidate any in-flight check
    setLink('');
    setChecks([]);
    setOverallStatus('idle');
  }, []);

  const handleSelectLanguage = useCallback((code) => {
    setLang(code);
    setLangPickerVisible(false);
  }, []);

  const handleAndroidDownload = useCallback(() => {
    Linking.openURL(APK_URL);
  }, []);

  const handleIosContinue = useCallback(() => {
    setIosHelpVisible(false);
    Linking.openURL(WEB_APP_URL);
  }, []);

  const isBusy = overallStatus === 'loading';
  const isIdle = overallStatus === 'idle';
  const showSingleResult = checks.length === 1 && !isBusy && !isIdle;
  const showMultiResult = checks.length > 1;
  const checkButtonLabel = isBusy ? t.checkBtnBusy : isIdle ? t.checkBtnIdle : t.checkBtnAgain;

  return (
    <View style={[styles.container, Platform.OS === 'web' ? styles.webFill : null]}>
      <SafeAreaView style={[styles.safe, Platform.OS === 'web' ? styles.webFill : null]}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuVisible(true)}
            accessibilityLabel={t.menuButtonA11y}
          >
            <MenuIcon size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.langBtn}
            onPress={() => setLangPickerVisible(true)}
            accessibilityLabel={t.languageButtonA11y}
          >
            <GlobeIcon size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <Image source={LOGO_SOURCE} style={styles.logoImage} />
          <Text style={styles.appName}>{t.appName}</Text>
          <Text style={styles.tagline}>{t.tagline}</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputIcon}>
              <LinkLogoIcon size={18} color={COLORS.accent} />
            </View>
            <TextInput
              style={[styles.input, { textAlign: rtl ? 'right' : 'left' }]}
              value={link}
              onChangeText={setLink}
              onSubmitEditing={() => runCheck(link)}
              placeholder={t.placeholder}
              placeholderTextColor="#9ba0b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!isBusy}
            />
            {!!link && (
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear} accessibilityLabel={t.clearA11y}>
                <Text style={styles.clearBtnText}>×</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.checkBtn}
            onPress={handleCheckPress}
            disabled={isBusy || !link.trim()}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isBusy ? [COLORS.busy, COLORS.busy] : [COLORS.accent, COLORS.accentDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.checkBtnInner, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
            >
              {isBusy ? <ActivityIndicator size="small" color="#fff" /> : <SearchIcon size={17} color="#fff" />}
              <Text style={styles.checkBtnText}>{checkButtonLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {isBusy && <Text style={styles.checkingHint}>{t.checkingHint}</Text>}

          {showSingleResult && (
            <ResultCard
              status={overallStatus}
              url={checks[0].url}
              details={checks[0].details}
              t={t}
              rtl={rtl}
              onReset={handleClear}
            />
          )}

          {showMultiResult && (
            <MultiResultCard checks={checks} overallStatus={overallStatus} t={t} rtl={rtl} onReset={handleClear} />
          )}

          {isIdle && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t.orDivider}</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.pasteBtn, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
                onPress={handleAutoPaste}
              >
                <ClipboardIcon size={14} color={COLORS.accent} />
                <Text style={styles.pasteBtnText}>{t.autoPasteBtn}</Text>
              </TouchableOpacity>

              <View style={styles.chipsRow}>
                <Chip Icon={ShieldIcon} label={t.chipSecure} />
                <Chip Icon={BoltIcon} label={t.chipFast} />
                <Chip Icon={SearchAdvancedIcon} label={t.chipAdvanced} />
              </View>
            </>
          )}

          <Text style={styles.footer}>{t.footer}</Text>
        </ScrollView>

        <Modal visible={menuVisible} transparent onRequestClose={() => setMenuVisible(false)}>
          <View style={styles.drawerRoot}>
            <View style={styles.drawerPanel}>
              <View style={[styles.drawerHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <Text style={styles.drawerTitle}>{t.downloadTitle}</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)} style={styles.drawerClose}>
                  <Text style={styles.drawerCloseText}>×</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.drawerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
                onPress={() => {
                  setMenuVisible(false);
                  setIosHelpVisible(true);
                }}
              >
                <View style={styles.drawerRowIcon}>
                  <AppleIcon size={20} color={COLORS.text} />
                </View>
                <Text style={styles.drawerRowText}>{t.iosDownloadBtn}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.drawerRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
                onPress={() => {
                  setMenuVisible(false);
                  handleAndroidDownload();
                }}
              >
                <View style={styles.drawerRowIcon}>
                  <AndroidIcon size={20} color={COLORS.text} />
                </View>
                <Text style={styles.drawerRowText}>{t.androidDownloadBtn}</Text>
              </TouchableOpacity>
            </View>
            <Pressable style={styles.drawerBackdrop} onPress={() => setMenuVisible(false)} />
          </View>
        </Modal>

        <Modal
          visible={langPickerVisible}
          transparent
          onRequestClose={() => setLangPickerVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setLangPickerVisible(false)}>
            <Pressable style={styles.langCard} onPress={() => {}}>
              <Text style={styles.langCardTitle}>{t.languagePickerTitle}</Text>
              {LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  style={styles.langRow}
                  onPress={() => handleSelectLanguage(l.code)}
                >
                  <Text style={styles.langFlag}>{l.flag}</Text>
                  <Text style={[styles.langName, l.code === lang && styles.langNameActive]}>
                    {l.name}
                  </Text>
                  {l.code === lang && <Text style={styles.langCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={iosHelpVisible}
          transparent
          onRequestClose={() => setIosHelpVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setIosHelpVisible(false)}>
            <Pressable style={styles.helpCard} onPress={() => {}}>
              <Text style={styles.helpTitle}>{t.iosHelpTitle}</Text>
              {t.iosHelpSteps.map((step, i) => (
                <View key={i} style={[styles.helpStepRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  <View style={styles.helpStepNumber}>
                    <Text style={styles.helpStepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.helpStepText, { textAlign: rtl ? 'right' : 'left' }]}>{step}</Text>
                </View>
              ))}
              <View style={[styles.helpActions, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                <TouchableOpacity style={styles.resultBtnSecondary} onPress={() => setIosHelpVisible(false)}>
                  <Text style={styles.resultBtnSecondaryText}>{t.iosHelpCancelBtn}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.resultBtnPrimary, { backgroundColor: COLORS.accent }]}
                  onPress={handleIosContinue}
                >
                  <Text style={styles.resultBtnPrimaryText}>{t.iosHelpContinueBtn}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  webFill: { minHeight: '100vh' },
  safe: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 24,
  },
  langBtn: {
    position: 'absolute',
    top: 8,
    right: 4,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 10,
  },
  menuBtn: {
    position: 'absolute',
    top: 8,
    left: 4,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    zIndex: 10,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  langCard: {
    position: 'absolute',
    top: 56,
    right: 16,
    minWidth: 190,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  langCardTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 12, paddingBottom: 6,
  },
  langRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
  },
  langFlag: { fontSize: 20, marginRight: 10 },
  langName: { flex: 1, fontSize: 15, color: COLORS.text },
  langNameActive: { fontWeight: '700', color: COLORS.accent },
  langCheck: { fontSize: 15, color: COLORS.accent, marginLeft: 6 },
  logoImage: {
    width: 76, height: 76, borderRadius: 20,
    marginTop: 8,
    shadowColor: '#28378C', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  appName: { marginTop: 14, fontSize: 27, fontWeight: '800', letterSpacing: -0.5, color: COLORS.text },
  tagline: { marginTop: 4, fontSize: 14, color: COLORS.textSecondary },
  inputRow: {
    width: '100%', maxWidth: 420, marginTop: 26,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, paddingHorizontal: 16, height: 52,
  },
  inputIcon: { flexShrink: 0 },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  clearBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(20,20,40,0.06)', alignItems: 'center', justifyContent: 'center',
  },
  clearBtnText: { fontSize: 16, color: COLORS.textSecondary },
  checkBtn: {
    width: '100%', maxWidth: 420, marginTop: 12, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#28378C', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  checkBtnInner: {
    height: 52, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  checkBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  checkingHint: { marginTop: 14, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  resultCard: {
    width: '100%', maxWidth: 420, marginTop: 18,
    backgroundColor: COLORS.surface, borderWidth: 1, borderRadius: 18,
    padding: 20, alignItems: 'center',
  },
  resultIconCircle: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
  },
  resultTitle: { marginTop: 12, fontSize: 17, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  resultSubtitle: { marginTop: 4, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  resultActions: { width: '100%', gap: 10, marginTop: 16 },
  resultBtnSecondary: {
    flex: 1, height: 44, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
  },
  resultBtnSecondaryText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  resultBtnPrimary: { flex: 1, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  resultBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resultBtnFull: { width: '100%', marginTop: 4 },
  multiCaption: { fontSize: 13, fontWeight: '700', color: COLORS.text, textAlign: 'center' },
  linksList: { width: '100%', marginTop: 14 },
  linkRow: {
    alignItems: 'flex-start', backgroundColor: COLORS.bg, borderRadius: 14,
    padding: 10, marginBottom: 8,
  },
  linkRowIconCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  linkRowTextBlock: { flex: 1, marginHorizontal: 10 },
  linkRowUrl: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  linkRowDetails: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  dividerRow: { width: '100%', maxWidth: 420, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 12, color: COLORS.textSecondary },
  pasteBtn: {
    alignSelf: 'center', marginTop: 14, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1.5, borderColor: COLORS.accent, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  pasteBtnText: { color: COLORS.accent, fontSize: 12.5, fontWeight: '700' },
  chipsRow: { width: '100%', maxWidth: 420, flexDirection: 'row', marginTop: 24 },
  chip: { flex: 1, alignItems: 'center', gap: 8 },
  chipIconCircle: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.chipBg,
    alignItems: 'center', justifyContent: 'center',
  },
  chipLabel: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
  drawerRoot: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  drawerPanel: {
    width: 270, maxWidth: '80%', height: '100%', backgroundColor: COLORS.surface,
    paddingTop: 50, paddingHorizontal: 18,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 4, height: 0 },
    elevation: 12,
  },
  drawerHeader: {
    alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8,
  },
  drawerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  drawerClose: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  drawerCloseText: { fontSize: 16, color: COLORS.textSecondary },
  drawerRow: {
    alignItems: 'center', gap: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  drawerRowIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.chipBg,
    alignItems: 'center', justifyContent: 'center',
  },
  drawerRowText: { fontSize: 14.5, fontWeight: '600', color: COLORS.text },
  footer: {
    marginTop: 18, color: COLORS.textSecondary, fontSize: 11, textAlign: 'center', paddingHorizontal: 8,
  },
  helpCard: {
    position: 'absolute', top: '50%', left: 20, right: 20, marginTop: -180,
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  helpTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 16, textAlign: 'center' },
  helpStepRow: { alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  helpStepNumber: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.chipBg,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  helpStepNumberText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },
  helpStepText: { flex: 1, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  helpActions: { gap: 10, marginTop: 8 },
});
