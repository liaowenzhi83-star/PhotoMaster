import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme';
import { useSession } from './src/useSession';
import { Toast } from './src/components/ui';
import { HomeScreen } from './src/screens/HomeScreen';
import { SwipeScreen } from './src/screens/SwipeScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { DoneScreen } from './src/screens/DoneScreen';

function Root() {
  const { c, isDark } = useTheme();
  const s = useSession();

  // 安卓实体返回键：回到首页，而不是直接退出应用
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (s.phase === 'home') return false;
      if (s.busy) return true; // 删除中，吞掉返回
      s.goHome();
      return true;
    });
    return () => sub.remove();
  }, [s.phase, s.busy, s.goHome]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {s.phase === 'home' && <HomeScreen s={s} />}
      {s.phase === 'swipe' && <SwipeScreen s={s} />}
      {s.phase === 'review' && <ReviewScreen s={s} />}
      {s.phase === 'done' && <DoneScreen s={s} />}

      <Toast text={s.toast} />
    </View>
  );
}

function Shell() {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'bottom', 'left', 'right']}>
      <Root />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Shell />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
