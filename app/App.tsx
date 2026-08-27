import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CurrentUserProvider } from './src/context/CurrentUser';
import AuthGate from './src/components/common/AuthGate';
import RootNavigator from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/colors';
import ThemeWatermark from './src/components/common/ThemeWatermark';

function AppContent() {
  const { theme, themeMode } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <ThemeWatermark />
      <AuthGate>
        <RootNavigator />
      </AuthGate>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <CurrentUserProvider>
          <AppContent />
        </CurrentUserProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
