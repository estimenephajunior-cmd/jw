import { useState, useEffect, useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  YStack,
  XStack,
  ScrollView,
  SizableText,
  Card,
  Button,
  Spinner,
  Input,
  Separator,
} from '@blinkdotnew/mobile-ui';
import {
  BookOpen,
  Search,
  Users,
  ChevronRight,
  Globe,
  Calendar,
  Zap,
  AlertTriangle,
  RefreshCw,
} from '@blinkdotnew/mobile-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TouchableOpacity, Platform } from 'react-native';
import { useAppStore } from '@/store/appStore';
import { translate } from '@/services/i18nService';
import { getDailyText as getNormalizedDailyText, normalizeAppLanguage } from '@/services/sourceGatewayService';
import type { Language } from '@/types';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const PRIMARY = '#5B7E6B';
const BG = '#1C1C1E';
const CARD_BG = '#2C2C2E';
const CARD_BORDER = '#3A3A3C';
const TEXT_PRIMARY = '#F2F2F7';
const TEXT_SECONDARY = '#9CA3AF';
const PRIMARY_SUBTLE = 'rgba(91,126,107,0.15)';
const PRIMARY_BORDER = 'rgba(91,126,107,0.3)';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailyText {
  date: string;
  scripture: string;
  comment: string;
  fullUrl?: string;
}

interface Contact {
  id: string;
  name: string;
  address?: string;
  nextVisit?: string;
  notes?: string;
}

// ─── WOL language map ─────────────────────────────────────────────────────────
// ─── Helpers ──────────────────────────────────────────────────────────────────
function getLocaleId(symbol: string): string {
  if (symbol === 'ht') return 'fr-HT';
  return symbol;
}

function formatDate(d: Date, symbol: string): string {
  return d.toLocaleDateString(getLocaleId(symbol), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getMidweekDate(symbol: string): string {
  const d = new Date();
  const day = d.getDay();
  // aim for Tuesday (2) or Wednesday (3)
  const diff = day <= 2 ? 2 - day : 9 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString(getLocaleId(symbol), { weekday: 'short', month: 'short', day: 'numeric' });
}

function getWeekendDate(symbol: string): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : 6 - day;
  d.setDate(d.getDate() + diff);
  return d.toLocaleDateString(getLocaleId(symbol), { weekday: 'short', month: 'short', day: 'numeric' });
}

async function fetchDailyText(language: Language): Promise<DailyText | null> {
  const lang = normalizeAppLanguage(language);
  const now = new Date();
  const result = await getNormalizedDailyText({ date: now, language: lang });
  const data = result.data;

  if (!data.scriptureRef && !data.commentText) return null;

  return {
    date: data.date || formatDate(now, lang.symbol),
    scripture: data.scriptureRef,
    comment: data.commentText,
    fullUrl: data.sourceUrl,
  };
}

// ─── Skeleton component ───────────────────────────────────────────────────────
function SkeletonLine({
  width = '100%',
  height = 14,
}: {
  width?: string | number;
  height?: number;
}) {
  return (
    <YStack
      backgroundColor={CARD_BORDER}
      borderRadius="$2"
      height={height}
      width={width as any}
      opacity={0.6}
    />
  );
}

function CardSkeleton() {
  return (
    <Card
      backgroundColor={CARD_BG}
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor={CARD_BORDER}
      gap="$3"
    >
      <SkeletonLine width="40%" height={12} />
      <SkeletonLine width="90%" height={18} />
      <SkeletonLine width="70%" height={14} />
      <SkeletonLine width="35%" height={36} />
    </Card>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const PRIMARY = colors.primary;
  const BG = colors.bg;
  const CARD_BG = colors.surface;
  const CARD_BORDER = colors.border;
  const TEXT_PRIMARY = colors.text;
  const TEXT_SECONDARY = colors.textMuted;
  const PRIMARY_SUBTLE = colors.glow;
  const PRIMARY_BORDER = colors.borderStrong;

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
  const [aiQuery, setAiQuery] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [userName, setUserName] = useState<string | null>(null);

  // Load user name for greeting
  useEffect(() => {
    AsyncStorage.getItem('jw_sa:user_name').then((n) => {
      if (n) setUserName(n);
    });
  }, []);

  // ── Load contacts ──────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem('jw_sa:contacts')
      .then((raw) => {
        if (raw) setContacts(JSON.parse(raw));
      })
      .catch(() => {})
      .finally(() => setLoadingContacts(false));
  }, []);

  // ── Load / fetch daily text ────────────────────────────────────────────────
  const loadDailyText = useCallback(async () => {
    setLoadingText(true);
    setTextError(false);

    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `daily_text_${language}_${activeContentLanguage.wolRegion}_${activeContentLanguage.wolLangParam}_${today}`;

    try {
      // Try cache first
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as DailyText;
        if (parsed.fullUrl?.includes(expectedDailyTextPath) && !/meeting program|reyinyon|Ann egzamine Ekriti yo chak jou/i.test(parsed.comment)) {
          setDailyText(parsed);
          setLoadingText(false);
          return;
        }
        await AsyncStorage.removeItem(cacheKey);
      }

      // Fetch fresh
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

  // ── Navigate helpers ───────────────────────────────────────────────────────
  const goToSettings = () => router.push('/(tabs)/settings');
  const goToDailyText = () =>
    router.push({
      pathname: '/daily-text',
      params: { date: new Date().toISOString().slice(0, 10) },
    });
  const goToSearch = (q?: string, ai?: boolean) =>
    router.push({ pathname: '/(tabs)/search', params: q ? { query: q, aiMode: ai ? 'true' : undefined } : undefined });
  const goToMinistry = () => router.push('/(tabs)/ministry');
  const goToMeetings = () => router.push('/(tabs)/meetings');
  const goToStudy = () => router.push('/(tabs)/study');

  const handleAskAI = () => {
    if (aiQuery.trim()) goToSearch(aiQuery.trim(), true);
  };

  const langCode = language.toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView flex={1} showsVerticalScrollIndicator={false} backgroundColor={BG}>
        <YStack paddingHorizontal="$5" paddingTop="$4" paddingBottom="$8" gap="$5">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2">
              <YStack
                width={34}
                height={34}
                borderRadius="$3"
                backgroundColor={PRIMARY_SUBTLE}
                justifyContent="center"
                alignItems="center"
                borderWidth={1}
                borderColor={PRIMARY_BORDER}
              >
                <BookOpen size={16} color={PRIMARY} />
              </YStack>
              <YStack gap="$0">
                <SizableText size="$2" color={TEXT_SECONDARY} letterSpacing={0.5}>
                  JW
                </SizableText>
                <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="800" lineHeight={18}>
                  {translate(displaySymbol, 'study_assistant')}
                </SizableText>
              </YStack>
            </XStack>

            <TouchableOpacity
              onPress={goToSettings}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: PRIMARY_SUBTLE,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderWidth: 1,
                borderColor: PRIMARY_BORDER,
              }}
            >
              <Globe size={13} color={PRIMARY} />
              <SizableText size="$2" color={PRIMARY} fontWeight="700" letterSpacing={1}>
                {langCode}
              </SizableText>
            </TouchableOpacity>
          </XStack>

          {/* ── Today's date greeting ────────────────────────────────────── */}
          <YStack gap="$0">
            <SizableText size="$2" color={TEXT_SECONDARY}>
              {formatDate(new Date(), displaySymbol)}
            </SizableText>
            <SizableText size="$6" color={TEXT_PRIMARY} fontWeight="800">
              {new Date().getHours() < 12
                ? translate(displaySymbol, 'good_morning')
                : new Date().getHours() < 17
                ? translate(displaySymbol, 'good_afternoon')
                : translate(displaySymbol, 'good_evening')}{' '}
              {userName ? userName : ''} 🕊️
            </SizableText>
          </YStack>

          {/* ── Daily Text Card ──────────────────────────────────────────── */}
          <YStack gap="$2">
            <SectionLabel icon="📖" label={translate(displaySymbol, 'todays_daily_text').toUpperCase()} />
            {loadingText ? (
              <CardSkeleton />
            ) : textError ? (
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                gap="$3"
              >
                <XStack alignItems="center" gap="$2">
                  <AlertTriangle size={16} color="#F59E0B" />
                  <SizableText size="$3" color="#F59E0B" fontWeight="600">
                    {translate(displaySymbol, 'could_not_load_daily_text')}
                  </SizableText>
                </XStack>
                <SizableText size="$2" color={TEXT_SECONDARY}>
                  {translate(displaySymbol, 'check_connection_retry')}
                </SizableText>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setRetryCount((c) => c + 1)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    alignSelf: 'flex-start',
                    backgroundColor: PRIMARY_SUBTLE,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: PRIMARY_BORDER,
                  }}
                >
                  <RefreshCw size={13} color={PRIMARY} />
                  <SizableText size="$3" color={PRIMARY} fontWeight="600">
                    {translate(displaySymbol, 'retry')}
                  </SizableText>
                </TouchableOpacity>
              </Card>
            ) : dailyText ? (
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                gap="$3"
                elevation={2}
              >
                <XStack justifyContent="space-between" alignItems="flex-start">
                  <SizableText size="$3" color={PRIMARY} fontWeight="700" flex={1} lineHeight={20}>
                    {dailyText.scripture}
                  </SizableText>
                  <YStack
                    backgroundColor={PRIMARY_SUBTLE}
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$10"
                    borderWidth={1}
                    borderColor={PRIMARY_BORDER}
                  >
                    <SizableText size="$1" color={PRIMARY} fontWeight="600">
                      {translate(displaySymbol, 'today')}
                    </SizableText>
                  </YStack>
                </XStack>

                {dailyText.comment ? (
                  <SizableText size="$3" color={TEXT_SECONDARY} lineHeight={20} numberOfLines={3}>
                    {dailyText.comment.slice(0, 150)}
                    {dailyText.comment.length > 150 ? '…' : ''}
                  </SizableText>
                ) : null}

                <TouchableOpacity
                  onPress={goToDailyText}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: PRIMARY,
                    borderRadius: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    alignSelf: 'flex-start',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <SizableText size="$3" color="#fff" fontWeight="700">
                    {translate(displaySymbol, 'read_full_daily_text')}
                  </SizableText>
                  <ChevronRight size={14} color="#fff" />
                </TouchableOpacity>
              </Card>
            ) : (
              <TouchableOpacity onPress={() => setRetryCount((c) => c + 1)} activeOpacity={0.7}>
                <Card
                  backgroundColor={CARD_BG}
                  borderRadius="$4"
                  padding="$5"
                  borderWidth={1}
                  borderColor={CARD_BORDER}
                  alignItems="center"
                  gap="$2"
                >
                  <SizableText style={{ fontSize: 36 }}>📖</SizableText>
                  <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="600">
                    {translate(displaySymbol, 'tap_to_load_daily_text')}
                  </SizableText>
                </Card>
              </TouchableOpacity>
            )}
          </YStack>

          {/* ── This Week's Meetings ─────────────────────────────────────── */}
          <YStack gap="$2">
            <SectionLabel icon="🗓️" label={translate(displaySymbol, 'this_weeks_meetings').toUpperCase()} />
            <Card
              backgroundColor={CARD_BG}
              borderRadius="$4"
              padding="$0"
              borderWidth={1}
              borderColor={CARD_BORDER}
              overflow="hidden"
              elevation={2}
            >
              {/* Midweek row */}
              <TouchableOpacity onPress={goToMeetings} activeOpacity={0.7}>
                <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$3" alignItems="center">
                  <YStack
                    width={44}
                    height={44}
                    borderRadius="$3"
                    backgroundColor={PRIMARY_SUBTLE}
                    justifyContent="center"
                    alignItems="center"
                    borderWidth={1}
                    borderColor={PRIMARY_BORDER}
                  >
                    <SizableText size="$1" color={PRIMARY} fontWeight="800">
                      MID
                    </SizableText>
                  </YStack>
                  <YStack flex={1} gap="$0">
                    <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="600">
                      {translate(displaySymbol, 'midweek_meeting')}
                    </SizableText>
                    <SizableText size="$2" color={TEXT_SECONDARY}>
                      {getMidweekDate(displaySymbol)} · {translate(displaySymbol, 'life_ministry')}
                    </SizableText>
                  </YStack>
                  <TouchableOpacity
                    onPress={goToMeetings}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: PRIMARY_SUBTLE,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: PRIMARY_BORDER,
                    }}
                  >
                    <SizableText size="$2" color={PRIMARY} fontWeight="600">
                      {translate(displaySymbol, 'prepare')}
                    </SizableText>
                  </TouchableOpacity>
                </XStack>
              </TouchableOpacity>

              <Separator borderColor={CARD_BORDER} />

              {/* Weekend row */}
              <TouchableOpacity onPress={goToMeetings} activeOpacity={0.7}>
                <XStack paddingHorizontal="$4" paddingVertical="$3" gap="$3" alignItems="center">
                  <YStack
                    width={44}
                    height={44}
                    borderRadius="$3"
                    backgroundColor="rgba(123,158,139,0.12)"
                    justifyContent="center"
                    alignItems="center"
                    borderWidth={1}
                    borderColor="rgba(123,158,139,0.25)"
                  >
                    <SizableText size="$1" color="#7B9E8B" fontWeight="800">
                      WT
                    </SizableText>
                  </YStack>
                  <YStack flex={1} gap="$0">
                    <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="600">
                      {translate(displaySymbol, 'watchtower_study')}
                    </SizableText>
                    <SizableText size="$2" color={TEXT_SECONDARY}>
                      {getWeekendDate(displaySymbol)} · {translate(displaySymbol, 'weekend_meeting')}
                    </SizableText>
                  </YStack>
                  <TouchableOpacity
                    onPress={goToMeetings}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: PRIMARY_SUBTLE,
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderWidth: 1,
                      borderColor: PRIMARY_BORDER,
                    }}
                  >
                    <SizableText size="$2" color={PRIMARY} fontWeight="600">
                      {translate(displaySymbol, 'prepare')}
                    </SizableText>
                  </TouchableOpacity>
                </XStack>
              </TouchableOpacity>
            </Card>
          </YStack>

          {/* ── Upcoming Return Visits ───────────────────────────────────── */}
          <YStack gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <SectionLabel icon="🚶" label={translate(displaySymbol, 'upcoming_return_visits').toUpperCase()} />
              <TouchableOpacity onPress={goToMinistry} activeOpacity={0.7}>
                <SizableText size="$2" color={PRIMARY} fontWeight="600">
                  {translate(displaySymbol, 'view_all')}
                </SizableText>
              </TouchableOpacity>
            </XStack>

            {loadingContacts ? (
              <CardSkeleton />
            ) : contacts.length === 0 ? (
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                alignItems="center"
                gap="$2"
              >
                <Users size={28} color={TEXT_SECONDARY} />
                <SizableText size="$3" color={TEXT_SECONDARY} textAlign="center">
                  {translate(displaySymbol, 'no_return_visits')}
                </SizableText>
                <TouchableOpacity
                  onPress={goToMinistry}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: PRIMARY_SUBTLE,
                    borderRadius: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: PRIMARY_BORDER,
                  }}
                >
                  <SizableText size="$3" color={PRIMARY} fontWeight="600">
                    {translate(displaySymbol, 'go_to_ministry')}
                  </SizableText>
                </TouchableOpacity>
              </Card>
            ) : (
              <Card
                backgroundColor={CARD_BG}
                borderRadius="$4"
                borderWidth={1}
                borderColor={CARD_BORDER}
                overflow="hidden"
                elevation={2}
              >
                {contacts.slice(0, 2).map((c, idx) => (
                  <YStack key={c.id}>
                    <TouchableOpacity onPress={goToMinistry} activeOpacity={0.7}>
                      <XStack
                        paddingHorizontal="$4"
                        paddingVertical="$3"
                        gap="$3"
                        alignItems="center"
                      >
                        <YStack
                          width={40}
                          height={40}
                          borderRadius={20}
                          backgroundColor={PRIMARY_SUBTLE}
                          justifyContent="center"
                          alignItems="center"
                          borderWidth={1}
                          borderColor={PRIMARY_BORDER}
                        >
                          <SizableText size="$3" color={PRIMARY} fontWeight="800">
                            {c.name.charAt(0).toUpperCase()}
                          </SizableText>
                        </YStack>
                        <YStack flex={1} gap="$0">
                          <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="600">
                            {c.name}
                          </SizableText>
                          <SizableText size="$2" color={TEXT_SECONDARY} numberOfLines={1}>
                            {c.nextVisit
                              ? `${translate(displaySymbol, 'next_visit')}: ${c.nextVisit}`
                              : c.address ?? translate(displaySymbol, 'no_date_set')}
                          </SizableText>
                        </YStack>
                        <ChevronRight size={16} color={TEXT_SECONDARY} />
                      </XStack>
                    </TouchableOpacity>
                    {idx < Math.min(contacts.length, 2) - 1 && (
                      <Separator borderColor={CARD_BORDER} />
                    )}
                  </YStack>
                ))}
              </Card>
            )}
          </YStack>

          {/* ── Quick AI Ask ─────────────────────────────────────────────── */}
          <YStack gap="$2">
            <SectionLabel icon="✨" label={translate(displaySymbol, 'quick_ai_ask').toUpperCase()} />
            <Card
              backgroundColor={CARD_BG}
              borderRadius="$4"
              padding="$4"
              borderWidth={1}
              borderColor={CARD_BORDER}
              gap="$3"
              elevation={2}
            >
              <SizableText size="$2" color={TEXT_SECONDARY} lineHeight={18}>
                {translate(displaySymbol, 'ask_ai_sources_hint')}
              </SizableText>
              <XStack
                backgroundColor="#1C1C1E"
                borderRadius="$3"
                borderWidth={1}
                borderColor={CARD_BORDER}
                alignItems="center"
                paddingHorizontal="$3"
                gap="$2"
              >
                <Search size={15} color={TEXT_SECONDARY} />
                <Input
                  flex={1}
                  value={aiQuery}
                  onChangeText={setAiQuery}
                  placeholder={translate(displaySymbol, 'ask_jw_sources_placeholder')}
                  placeholderTextColor={TEXT_SECONDARY}
                  color={TEXT_PRIMARY}
                  backgroundColor="transparent"
                  borderWidth={0}
                  size="$3"
                  focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
                  onSubmitEditing={handleAskAI}
                  returnKeyType="search"
                />
              </XStack>
              <TouchableOpacity
                onPress={handleAskAI}
                activeOpacity={0.8}
                style={{
                  backgroundColor: aiQuery.trim() ? PRIMARY : CARD_BORDER,
                  borderRadius: 10,
                  paddingVertical: 11,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Zap size={14} color={aiQuery.trim() ? '#fff' : TEXT_SECONDARY} />
                <SizableText
                  size="$3"
                  color={aiQuery.trim() ? '#fff' : TEXT_SECONDARY}
                  fontWeight="700"
                >
                  {translate(displaySymbol, 'ask')}
                </SizableText>
              </TouchableOpacity>
            </Card>
          </YStack>

          {/* ── Today's Preparation ──────────────────────────────────────── */}
          <YStack gap="$2">
            <SectionLabel icon="📋" label={translate(displaySymbol, 'todays_preparation').toUpperCase()} />
            <XStack gap="$3">
              <PrepCard
                emoji="📖"
                label={translate(displaySymbol, 'midweek')}
                sublabel={translate(displaySymbol, 'life_ministry')}
                color={PRIMARY}
                onPress={goToMeetings}
              />
              <PrepCard
                emoji="🏛️"
                label={translate(displaySymbol, 'watchtower')}
                sublabel={translate(displaySymbol, 'weekend_meeting')}
                color="#7B9E8B"
                onPress={goToMeetings}
              />
              <PrepCard
                emoji="🎯"
                label={translate(displaySymbol, 'study_plan')}
                sublabel={translate(displaySymbol, 'personal')}
                color="#9E7B5A"
                onPress={goToStudy}
              />
            </XStack>
          </YStack>

        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <XStack alignItems="center" gap="$2">
      <SizableText style={{ fontSize: 13 }}>{icon}</SizableText>
      <SizableText size="$2" color={TEXT_SECONDARY} fontWeight="700" letterSpacing={1.2}>
        {label}
      </SizableText>
    </XStack>
  );
}

function PrepCard({
  emoji,
  label,
  sublabel,
  color,
  onPress,
}: {
  emoji: string;
  label: string;
  sublabel: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{ flex: 1 }}
    >
      <Card
        backgroundColor={CARD_BG}
        borderRadius="$4"
        padding="$3"
        borderWidth={1}
        borderColor={CARD_BORDER}
        alignItems="center"
        gap="$2"
        elevation={1}
      >
        <YStack
          width={44}
          height={44}
          borderRadius={22}
          backgroundColor={`${color}22`}
          justifyContent="center"
          alignItems="center"
        >
          <SizableText style={{ fontSize: 22 }}>{emoji}</SizableText>
        </YStack>
        <SizableText size="$2" color={TEXT_PRIMARY} fontWeight="700" textAlign="center">
          {label}
        </SizableText>
        <SizableText size="$1" color={TEXT_SECONDARY} textAlign="center" numberOfLines={2}>
          {sublabel}
        </SizableText>
      </Card>
    </TouchableOpacity>
  );
}
