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
import { Platform, View } from 'react-native';

function TabBarBackground() {
  const premium = usePremiumTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 28,
        backgroundColor: premium.mode === 'dark' ? 'rgba(7,17,31,0.94)' : 'rgba(255,255,255,0.94)',
        borderWidth: 1,
        borderColor: premium.border,
        ...(Platform.OS === 'web'
          ? { backdropFilter: 'blur(24px)', boxShadow: `0 12px 40px ${premium.cardShadow}` }
          : {}),
      }}
    />
  );
}

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
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          position: 'absolute',
          left: 10,
          right: 10,
          bottom: Platform.OS === 'ios' ? 20 : 12,
          height: 72,
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
          paddingBottom: 6,
          paddingTop: 6,
          paddingHorizontal: 6,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarItemStyle: {
          borderRadius: 999,
          marginHorizontal: 1,
          paddingVertical: 4,
        },
        tabBarActiveBackgroundColor: premium.tabActiveBg,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: translate(displaySymbol, 'today'),
          tabBarIcon: ({ color, size, focused }) => (
            <Home size={focused ? size + 1 : size} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: translate(displaySymbol, 'find'),
          tabBarIcon: ({ color, size, focused }) => (
            <Search size={focused ? size + 1 : size} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: translate(displaySymbol, 'meetings'),
          tabBarIcon: ({ color, size, focused }) => (
            <BookOpen size={focused ? size + 1 : size} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="ministry"
        options={{
          title: translate(displaySymbol, 'field'),
          tabBarIcon: ({ color, size, focused }) => (
            <Users size={focused ? size + 1 : size} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: translate(displaySymbol, 'study'),
          tabBarIcon: ({ color, size, focused }) => (
            <BookMarked size={focused ? size + 1 : size} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: translate(displaySymbol, 'library'),
          tabBarIcon: ({ color, size, focused }) => (
            <Bookmark size={focused ? size + 1 : size} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: translate(displaySymbol, 'settings'),
          tabBarIcon: ({ color, size, focused }) => (
            <Settings size={focused ? size + 1 : size} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
    </Tabs>
  );
}
