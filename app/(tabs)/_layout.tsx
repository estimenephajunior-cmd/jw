import { Tabs } from 'expo-router';
import {
  Home,
  Search,
  Users,
  BookOpen,
  Bookmark,
  Settings,
  BookMarked,
} from '@blinkdotnew/mobile-ui';
import { useAppStore } from '@/store/appStore';
import { translate } from '@/services/i18nService';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';

export default function TabLayout() {
  const appLanguage = useAppStore((s) => s.appLanguage);
  const displaySymbol = appLanguage?.symbol || 'en';
  const premium = usePremiumTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: premium.primary,
        tabBarInactiveTintColor: premium.textMuted,
        tabBarStyle: {
          backgroundColor: premium.bg2,
          borderTopColor: premium.border,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: -2,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: translate(displaySymbol, 'today'),
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: translate(displaySymbol, 'find'),
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: translate(displaySymbol, 'meetings'),
          tabBarIcon: ({ color, size }) => <BookOpen size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ministry"
        options={{
          title: translate(displaySymbol, 'field'),
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: translate(displaySymbol, 'study'),
          tabBarIcon: ({ color, size }) => <BookMarked size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: translate(displaySymbol, 'library'),
          tabBarIcon: ({ color, size }) => <Bookmark size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: translate(displaySymbol, 'settings'),
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
