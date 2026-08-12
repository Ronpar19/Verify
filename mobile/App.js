import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import LinkCheckerScreen, { COLORS } from './LinkCheckerScreen';
import TermsScreen from './TermsScreen';
import { TERMS_KEY } from './terms';

export default function App() {
  // null = still reading AsyncStorage (brief); false = must accept; true = accepted.
  // LinkCheckerScreen is never mounted until this is true, so there is no
  // way to reach the main screen by dismissing/skipping an overlay.
  const [accepted, setAccepted] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(TERMS_KEY).then((value) => setAccepted(value === 'true'));
  }, []);

  const handleAccept = useCallback(() => setAccepted(true), []);

  if (accepted === null) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  }

  return (
    <>
      {accepted ? <LinkCheckerScreen /> : <TermsScreen onAccept={handleAccept} />}
      <StatusBar style="light" />
    </>
  );
}
