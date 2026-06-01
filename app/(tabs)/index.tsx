import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import {
  YStack,
  XStack,
  SizableText,
  Separator,
  Search,
  Users,
  ChevronRight,
  Globe,
  Calendar,
  Sparkles,
  BookOpen,
  Bookmark,
} from '@blinkdotnew/mobile-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/appStore';
import { translate } from '@/services/i18nService';
import { getDailyText as getNormalizedDailyText, normalizeAppLanguage } from '@/services/sourceGatewayService';
import type { Language } from '@/types';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import {
  AppScreen,
  HomeGreetingStrip,
  HomeDailyFeatured,
  HomeAiAsk,
  QuickActionGrid,
  QuickActionTile,
  NavTeaserRow,
  PremiumCard,
  EmptyState,
  GradientButton,
} from '@/components/premium';

const DAILY_CACHE_VERSION = 'v3';

interface DailyText {
  date: string;
  scripture: string;
  scriptureText?: string;
  comment: string;
  fullUrl?: string;
}

interface Contact {
  id: string;
  name: string;
  nextVisit?: string;
}

function getLocaleId(symbol: string): string {
  if (symbol === 'ht') return 'fr-HT';
  return symbol;
}

function formatDateShort(d: Date, symbol: string): string {
  return d.toLocaleDateString(getLocaleId(symbol), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function getMeetingWeekRange(symbol: string): string {
  const meeting = (offsetTo: number) => {
    const d = new Date();
    const day = d.getDay();
    const diff = day <= offsetTo ? offsetTo - day : 7 + offsetTo - day;
    d.setDate(d.getDate() + diff);
    return d.toLocaleDateString(getLocaleId(symbol), { month: 'short', day: 'numeric' });
  };
  return `${meeting(2)} – ${meeting(6)}`;
}

async function fetchDailyText(language: Language): Promise<DailyText | null> {
  const lang = normalizeAppLanguage(language);
  const now = new Date();
  const result = await getNormalizedDailyText({ date: now, language: lang });
  const data = result.data;
  if (!data.scriptureRef && !data.commentText) return null;
  return {
    date: data.date || formatDateShort(now, lang.symbol),
    scripture: data.scriptureRef,
    scriptureText: data.scriptureText,
    comment: data.commentText,
    fullUrl: data.sourceUrl,
  };
}

/** Home preview: verse text only — never the full meditation comment */
function homeVersePreview(dt: DailyText | null): string | undefined {
  if (!dt) return undefined;
  const verse = dt.scriptureText?.trim();
  if (verse) return verse;
  return undefined;
}

function homeReference(dt: DailyText | null): string | undefined {
  return dt?.scripture?.trim() || undefined;
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const appLanguage = useAppStore((s) => s.appLanguage);
  const fallbackLanguage = useAppStore((s) => s.language);
  const contentLanguage = useAppStore((s) => s.contentLanguage || s.language);
  const activeContentLanguage = useMemo(
    () => normalizeAppLanguage(contentLanguage || fallbackLanguage),
    [contentLanguage, fallbackLanguage]
  );
  const displaySymbol = appLanguage?.symbol || 'en';
  const language = activeContentLanguage.symbol || 'en';
  const expectedDailyTextPath = `/${language}/wol/dt/${activeContentLanguage.wolRegion}/${activeContentLanguage.wolLangParam}/`;

  const [dailyText, setDailyText] = useState<DailyText | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingText, setLoadingText] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [textError, setTextError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState('');

  const t = (key: string) => translate(displaySymbol, key);

  useEffect(() => {
    AsyncStorage.getItem('jw_sa:user_name').then((n) => {
      if (n) setUserName(n);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('jw_sa:contacts')
      .then((raw) => {
        if (raw) setContacts(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, []);

  const loadDailyText = useCallback(async () => {
    setLoadingText(true);
    setTextError(false);
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `daily_text_${DAILY_CACHE_VERSION}_${language}_${activeContentLanguage.wolRegion}_${activeContentLanguage.wolLangParam}_${today}`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as DailyText;
        if (
          parsed.fullUrl?.includes(expectedDailyTextPath) &&
          !/meeting program|reyinyon|Ann egzamine Ekriti yo chak jou/i.test(parsed.comment)
        ) {
          setDailyText(parsed);
          setLoadingText(false);
          return;
        }
        await AsyncStorage.removeItem(cacheKey);
      }
      const data = await fetchDailyText(activeContentLanguage);
      if (data) {
        setDailyText(data);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      } else {
        setTextError(true);
      }
    } catch {
      setTextError(true);
    } finally {
      setLoadingText(false);
    }
  }, [activeContentLanguage, language, expectedDailyTextPath, retryCount]);

  useEffect(() => {
    loadDailyText();
  }, [loadDailyText]);

  const goToDailyText = () =>
    router.push({ pathname: '/daily-text', params: { date: new Date().toISOString().slice(0, 10) } });

  const goToSearch = () => {
    router.push({ pathname: '/(tabs)/search', params: { aiMode: 'false' } });
  };

  const submitAiAsk = () => {
    const q = aiQuery.trim();
    router.push({
      pathname: '/(tabs)/search',
      params: { ...(q ? { query: q } : {}), aiMode: 'true', t: String(Date.now()) },
    });
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? t('good_morning') : hour < 17 ? t('good_afternoon') : t('good_evening');

  const returnVisitContacts = contacts.filter((c) => c.nextVisit);
  const versePreview = homeVersePreview(dailyText);
  const refPreview = homeReference(dailyText);

  const langButton = (
    <TouchableOpacity onPress={() => router.push('/(tabs)/settings')} activeOpacity={0.75}>
      <XStack
        alignItems="center"
        gap={6}
        backgroundColor={colors.tabActiveBg}
        borderRadius={999}
        paddingHorizontal={12}
        paddingVertical={6}
        borderWidth={1}
        borderColor={colors.border}
      >
        <Globe size={14} color={colors.primary} />
        <SizableText fontSize={12} color={colors.primary} fontWeight="700">
          {language.toUpperCase()}
        </SizableText>
      </XStack>
    </TouchableOpacity>
  );

  return (
    <AppScreen scroll padded>
      <HomeGreetingStrip
        dateLabel={formatDateShort(new Date(), displaySymbol)}
        title={`${greeting}${userName ? `, ${userName}` : ''}`}
        right={langButton}
      />

      <HomeDailyFeatured
        verse={versePreview}
        reference={refPreview}
        loading={loadingText}
        error={textError}
        onOpenFull={dailyText ? goToDailyText : undefined}
        onRetry={() => setRetryCount((c) => c + 1)}
        labels={{
          title: t('daily_text'),
          readFull: t('read_full_daily_text'),
          retry: t('retry'),
          errorTitle: t('could_not_load_daily_text'),
        }}
      />

      <HomeAiAsk
        title={t('quick_ai_ask')}
        hint={t('ask_ai_sources_hint')}
        value={aiQuery}
        onChangeText={setAiQuery}
        onSubmit={submitAiAsk}
        placeholder={t('ask_jw_sources_placeholder')}
        buttonLabel={t('ask')}
      />

      <QuickActionGrid>
        <QuickActionTile
          title={t('quick_action_search')}
          icon={<Search size={20} color={colors.primary} />}
          onPress={goToSearch}
          accent="royal"
        />
        <QuickActionTile
          title={t('quick_action_meetings')}
          icon={<Calendar size={20} color={colors.primary} />}
          onPress={() => router.push('/(tabs)/meetings')}
        />
        <QuickActionTile
          title={t('quick_action_territory')}
          icon={<Users size={20} color={colors.primary} />}
          onPress={() => router.push('/(tabs)/ministry')}
        />
        <QuickActionTile
          title={t('library')}
          icon={<Bookmark size={20} color={colors.gold} />}
          onPress={() => router.push('/(tabs)/saved')}
          accent="gold"
        />
      </QuickActionGrid>

      <NavTeaserRow
        title={t('this_weeks_meetings')}
        subtitle={getMeetingWeekRange(displaySymbol)}
        icon={<BookOpen size={20} color={colors.primary} />}
        onPress={() => router.push('/(tabs)/meetings')}
      />

      {returnVisitContacts.length > 0 ? (
        <YStack gap="$3" width="100%">
          <XStack justifyContent="space-between" alignItems="center">
            <SizableText color={colors.text} fontSize={17} fontWeight="700">
              {t('upcoming_return_visits')}
            </SizableText>
            <SizableText color={colors.primary} fontWeight="700" fontSize={14} onPress={() => router.push('/(tabs)/ministry')}>
              {t('view_all')}
            </SizableText>
          </XStack>
          <PremiumCard padded={false}>
            {returnVisitContacts.slice(0, 2).map((c, idx) => (
              <YStack key={c.id}>
                <XStack
                  padding="$4"
                  gap="$3"
                  alignItems="center"
                  onPress={() => router.push({ pathname: '/contact-detail', params: { id: c.id } })}
                  pressStyle={{ opacity: 0.74 }}
                >
                  <YStack
                    width={40}
                    height={40}
                    borderRadius={20}
                    backgroundColor={colors.tabActiveBg}
                    justifyContent="center"
                    alignItems="center"
                  >
                    <SizableText color={colors.gold} fontWeight="700">
                      {c.name.charAt(0).toUpperCase()}
                    </SizableText>
                  </YStack>
                  <YStack flex={1}>
                    <SizableText color={colors.text} fontWeight="700" fontSize={16}>
                      {c.name}
                    </SizableText>
                    <SizableText color={colors.textMuted} fontSize={13} numberOfLines={1}>
                      {c.nextVisit ? `${t('next_visit')}: ${c.nextVisit}` : t('no_date_set')}
                    </SizableText>
                  </YStack>
                  <ChevronRight size={16} color={colors.textMuted} />
                </XStack>
                {idx < Math.min(returnVisitContacts.length, 2) - 1 ? <Separator borderColor={colors.border} /> : null}
              </YStack>
            ))}
          </PremiumCard>
        </YStack>
      ) : !loadingContacts ? (
        <PremiumCard>
          <EmptyState
            icon={<Users size={28} color={colors.primary} />}
            title={t('no_return_visits_scheduled')}
            subtitle={t('no_return_visits_hint')}
            action={<GradientButton onPress={() => router.push('/add-contact')}>{t('add_visit')}</GradientButton>}
          />
        </PremiumCard>
      ) : null}
    </AppScreen>
  );
}
