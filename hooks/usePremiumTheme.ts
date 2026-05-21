import { useColorScheme } from 'react-native';
import { useAppStore } from '@/store/appStore';
import { getPremiumTheme } from '@/constants/premiumTheme';

export function usePremiumTheme() {
  const mode = useAppStore((s) => s.theme);
  const scheme = useColorScheme();
  return getPremiumTheme(mode, scheme);
}
