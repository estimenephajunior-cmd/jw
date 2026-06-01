import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BlinkProvider, createTamagui, tamaguiDefaultConfig, Theme, BlinkToastProvider } from '@blinkdotnew/mobile-ui';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { DISPLAY_LANGUAGES, readAppLanguage, readContentLanguage } from '@/services/i18nService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const config = createTamagui({ ...tamaguiDefaultConfig });

function WebStyleReset() {
  if (Platform.OS !== 'web') return null;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
          *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
          html,body,#root{min-height:100%;width:100%;max-width:100%;background:#07111F;overflow-x:hidden;}
          body{margin:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#F4F0E8;}
          h1,h2,h3,h4{font-family:'Inter Tight','Inter',-apple-system,sans-serif;}
          input:focus,textarea:focus{outline:2px solid rgba(31,77,140,0.45)!important;outline-offset:2px;}
          @media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
          img,canvas,video,iframe,svg{max-width:100%;}
        `,
      }}
    />
  );
}

function LanguageHydrator() {
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setAppLanguage = useAppStore((s) => s.setAppLanguage);
  const setContentLanguage = useAppStore((s) => s.setContentLanguage);

  useEffect(() => {
    let mounted = true;
    Promise.all([readAppLanguage(), readContentLanguage()]).then(([display, content]) => {
      if (!mounted) return;
      const appLang = display ?? DISPLAY_LANGUAGES[0];
      const contentLang = content ?? appLang;
      setAppLanguage(appLang);
      setContentLanguage(contentLang);
      setLanguage(contentLang);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [setAppLanguage, setContentLanguage, setLanguage]);

  return null;
}

function ThemeHydrator() {
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    AsyncStorage.getItem('jw_sa:theme')
      .then((raw) => {
        if (raw === 'light' || raw === 'dark' || raw === 'system') setTheme(raw);
      })
      .catch(() => {});
  }, [setTheme]);

  return null;
}

function AppShell() {
  const theme = useAppStore((s) => s.theme);
  const scheme = useColorScheme();
  const resolvedTheme =
    theme === 'system' ? (scheme === 'light' ? 'light' : 'dark') : theme === 'light' ? 'light' : 'dark';

  return (
    <BlinkProvider config={config} defaultTheme={resolvedTheme}>
      <Theme name={resolvedTheme}>
        <QueryClientProvider client={queryClient}>
          <BlinkToastProvider>
            <LanguageHydrator />
            <ThemeHydrator />
            <WebStyleReset />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="daily-text" />
              <Stack.Screen name="meeting-prep" />
              <Stack.Screen name="watchtower-study" />
              <Stack.Screen name="add-contact" />
              <Stack.Screen name="contact-detail" />
              <Stack.Screen name="edit-profile" />
              <Stack.Screen name="study-plan-detail" />
              <Stack.Screen name="add-visit" />
              <Stack.Screen name="ministry-prep" />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style={resolvedTheme === 'light' ? 'dark' : 'light'} />
          </BlinkToastProvider>
        </QueryClientProvider>
      </Theme>
    </BlinkProvider>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return <AppShell />;
}
