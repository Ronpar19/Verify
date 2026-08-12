import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useShareIntent } from 'expo-share-intent';
import LinkCheckerScreen, { COLORS } from './LinkCheckerScreen';
import TermsScreen from './TermsScreen';
import { TERMS_KEY } from './terms';

// The share-intent native module only exists in a custom dev-client/EAS
// build — Expo Go and the web preview never have it compiled in.
// Disabling the hook in both keeps `npx expo start --web` and Expo Go
// working exactly as before for every other feature — only a real
// Android build actually receives shares.
const SHARE_INTENT_DISABLED = Platform.OS === 'web' || Constants.appOwnership === 'expo';

export default function App() {
  // null = still reading AsyncStorage (brief); false = must accept; true = accepted.
  // LinkCheckerScreen is never mounted until this is true, so there is no
  // way to reach the main screen by dismissing/skipping an overlay.
  const [accepted, setAccepted] = useState(null);

  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    disabled: SHARE_INTENT_DISABLED,
  });

  useEffect(() => {
    AsyncStorage.getItem(TERMS_KEY).then((value) => setAccepted(value === 'true'));
  }, []);

  const handleAccept = useCallback(() => setAccepted(true), []);

  if (accepted === null) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  }

  return (
    <>
      {accepted ? (
        <LinkCheckerScreen
          sharedText={hasShareIntent ? shareIntent.text : null}
          onSharedTextHandled={resetShareIntent}
        />
      ) : (
        <TermsScreen onAccept={handleAccept} />
      )}
      <StatusBar style="light" />
    </>
  );
}
