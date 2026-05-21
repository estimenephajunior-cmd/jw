import type { Router } from 'expo-router';

export function safeBack(router: Router, fallback: string = '/(tabs)') {
  const canGoBack =
    typeof (router as any).canGoBack === 'function'
    && (router as any).canGoBack();

  if (canGoBack) {
    router.back();
    return;
  }

  router.replace(fallback as any);
}
