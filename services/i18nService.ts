import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '@/types';

import en from '@/locales/en.json';
import es from '@/locales/es.json';
import fr from '@/locales/fr.json';
import ht from '@/locales/ht.json';

const translations: Record<string, Record<string, string>> = {
  en,
  es,
  fr,
  ht,
};

export const APP_LANGUAGE_KEY = 'app_language';
export const CONTENT_LANGUAGE_KEY = 'content_language';
export const LEGACY_LANGUAGE_KEY = 'selected_language';

export type AppStringKey = string;

export const DISPLAY_LANGUAGES: Language[] = [
  { code: 'E', symbol: 'en', name: 'English', englishName: 'English', direction: 'ltr', wolRegion: 'r1', wolLangParam: 'lp-e' },
  { code: 'S', symbol: 'es', name: 'Español', englishName: 'Spanish', direction: 'ltr', wolRegion: 'r4', wolLangParam: 'lp-s' },
  { code: 'CR', symbol: 'ht', name: 'Kreyòl ayisyen', englishName: 'Haitian Creole', direction: 'ltr', wolRegion: 'r60', wolLangParam: 'lp-cr' },
  { code: 'F', symbol: 'fr', name: 'Français', englishName: 'French', direction: 'ltr', wolRegion: 'r30', wolLangParam: 'lp-f' },
];

export function normalizeAppLocale(input?: string | null): string {
  const symbol = String(input || 'en').toLowerCase();
  if (translations[symbol]) return symbol;
  const base = symbol.split('-')[0];
  return translations[base] ? base : 'en';
}

export function translate(locale: string | undefined | null, key: string): string {
  const lang = normalizeAppLocale(locale);
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}

export function createTranslator(locale: string | undefined | null) {
  return (key: string, replacements?: Record<string, string | number>) => {
    let value = translate(locale, key);
    if (replacements) {
      for (const [name, replacement] of Object.entries(replacements)) {
        value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
      }
    }
    return value;
  };
}

export function languageBadge(lang?: Partial<Language> | null): string {
  const src = lang?.symbol || lang?.code || lang?.englishName || lang?.name || 'en';
  return String(src).slice(0, 2).toUpperCase();
}

export async function readStoredLanguage(key: string): Promise<Language | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Language;
  } catch {
    return null;
  }
}

export async function readContentLanguage(): Promise<Language | null> {
  return (await readStoredLanguage(CONTENT_LANGUAGE_KEY))
    ?? (await readStoredLanguage(LEGACY_LANGUAGE_KEY));
}

export async function readAppLanguage(): Promise<Language | null> {
  return (await readStoredLanguage(APP_LANGUAGE_KEY))
    ?? (await readStoredLanguage(LEGACY_LANGUAGE_KEY));
}

export async function saveLanguagePair(displayLanguage: Language, contentLanguage: Language) {
  await Promise.all([
    AsyncStorage.setItem(APP_LANGUAGE_KEY, JSON.stringify(displayLanguage)),
    AsyncStorage.setItem(CONTENT_LANGUAGE_KEY, JSON.stringify(contentLanguage)),
    AsyncStorage.setItem(LEGACY_LANGUAGE_KEY, JSON.stringify(contentLanguage)),
  ]);
}
