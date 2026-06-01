import { useEffect, useState, useCallback } from 'react';
import { FlatList, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  H2,
  Card,
  Button,
  Separator,
  Spinner,
  Users,
  ChevronRight,
  Plus,
  Calendar,
  BookOpen,
  Bell,
  ClipboardList,
} from '@blinkdotnew/mobile-ui';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import { useAppStore } from '@/store/appStore';
import { translate } from '@/services/i18nService';
import { AppScreen, AppHeader, EmptyState as PremiumEmpty, GradientButton, PremiumCard } from '@/components/premium';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MinistryContact {
  id: string;
  name: string;
  nickname?: string;
  phone?: string;
  address?: string;
  status: 'first-call' | 'return-visit' | 'bible-study' | 'inactive' | 'not-interested';
  topicsDiscussed: string[];
  scripturesUsed: string[];
  publicationsShared: string[];
  questionsAsked: string[];
  notes: string[];
  nextVisitDate?: string;
  reminderEnabled: boolean;
  visits: Array<{ id: string; date: string; notes: string; duration?: number }>;
}

type FilterType = 'all' | 'return-visit' | 'bible-study' | 'first-call';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MinistryContact['status'],
  { label: string; color: string; bg: string }
> = {
  'first-call':     { label: 'First Call',     color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  'return-visit':   { label: 'Return Visit',   color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  'bible-study':    { label: 'Bible Study',    color: '#5B7E6B', bg: 'rgba(91,126,107,0.15)' },
  'inactive':       { label: 'Inactive',       color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' },
  'not-interested': { label: 'Not Interested', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function getFilterTabs(symbol: string): { key: FilterType; label: string }[] {
  return [
    { key: 'all', label: translate(symbol, 'all') },
    { key: 'return-visit', label: translate(symbol, 'filter_return_visits') },
    { key: 'bible-study', label: translate(symbol, 'filter_bible_studies') },
    { key: 'first-call', label: translate(symbol, 'filter_first_call') },
  ];
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({
  contact,
  onPress,
  onVisit,
  onPrepare,
  onRemind,
  displaySymbol,
}: {
  contact: MinistryContact;
  onPress: () => void;
  onVisit: () => void;
  onPrepare: () => void;
  onRemind: () => void;
  displaySymbol: string;
}) {
  const colors = usePremiumTheme();
  const cfg = STATUS_CONFIG[contact.status];
  const statusLabel =
    contact.status === 'return-visit'
      ? translate(displaySymbol, 'return_visit')
      : contact.status === 'bible-study'
        ? translate(displaySymbol, 'bible_study')
        : contact.status === 'first-call'
          ? translate(displaySymbol, 'first_call')
          : contact.status === 'inactive'
            ? translate(displaySymbol, 'inactive')
            : translate(displaySymbol, 'not_interested');
  const lastVisit = contact.visits?.[contact.visits.length - 1]?.date;
  const overdue = isOverdue(contact.nextVisitDate);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Card
        backgroundColor={colors.surface}
        borderRadius="$6"
        borderWidth={1}
        borderColor={colors.border}
        overflow="hidden"
        marginBottom="$3"
      >
        {/* Main row */}
        <XStack padding="$4" gap="$3" alignItems="center">
          {/* Status dot */}
          <YStack
            width={12}
            height={12}
            borderRadius={6}
            backgroundColor={cfg.color}
            marginTop={2}
            flexShrink={0}
          />

          {/* Content */}
          <YStack flex={1} gap="$1">
            <XStack alignItems="center" gap="$2">
              <SizableText size="$5" color={colors.text} fontWeight="700">
                {contact.name || '—'}
              </SizableText>
              {contact.nickname ? (
                <SizableText size="$3" color={colors.textMuted}>
                  "{contact.nickname}"
                </SizableText>
              ) : null}
            </XStack>

            {/* Status badge */}
            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              <YStack
                backgroundColor={cfg.bg}
                paddingHorizontal="$2"
                paddingVertical={2}
                borderRadius="$10"
              >
                <SizableText size="$1" color={cfg.color} fontWeight="700">
                  {statusLabel.toUpperCase()}
                </SizableText>
              </YStack>
              {lastVisit ? (
                <SizableText size="$2" color={colors.textMuted}>
                  {translate(displaySymbol, 'last_visit_label')}: {formatDate(lastVisit)}
                </SizableText>
              ) : (
                <SizableText size="$2" color={colors.textMuted}>
                  {translate(displaySymbol, 'no_visits_yet_label')}
                </SizableText>
              )}
            </XStack>

            {/* Topics */}
            {contact.topicsDiscussed?.length > 0 ? (
              <SizableText size="$2" color="#9CA3AF" numberOfLines={1}>
                📌 {contact.topicsDiscussed.slice(0, 2).join(', ')}
              </SizableText>
            ) : null}
          </YStack>

          <ChevronRight size={18} color="#4B5563" />
        </XStack>

        {/* Next visit row */}
        {contact.nextVisitDate ? (
          <>
            <Separator borderColor="#3A3A3C" />
            <XStack
              paddingHorizontal="$4"
              paddingVertical="$2"
              gap="$2"
              alignItems="center"
              backgroundColor={overdue ? 'rgba(239,68,68,0.08)' : 'transparent'}
            >
              <Calendar size={13} color={overdue ? '#EF4444' : '#9CA3AF'} />
              <SizableText size="$2" color={overdue ? '#EF4444' : '#9CA3AF'}>
                {overdue ? 'Overdue · ' : 'Next visit · '}
                {formatDate(contact.nextVisitDate)}
              </SizableText>
            </XStack>
          </>
        ) : null}

        {/* Action buttons */}
        <Separator borderColor="#3A3A3C" />
        <XStack padding="$2" gap="$2">
          <Button
            flex={1}
            size="$2"
            backgroundColor={colors.tabActiveBg}
            color={colors.primary}
            borderColor={colors.border}
            borderWidth={1}
            borderRadius="$3"
            onPress={(e) => { e.stopPropagation?.(); onVisit(); }}
            pressStyle={{ opacity: 0.75 }}
          >
            {translate(displaySymbol, 'visit_action')}
          </Button>
        </XStack>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ contacts }: { contacts: MinistryContact[] }) {
  const total    = contacts.length;
  const rvCount  = contacts.filter(c => c.status === 'return-visit').length;
  const bsCount  = contacts.filter(c => c.status === 'bible-study').length;
  const niCount  = contacts.filter(c => c.status === 'not-interested').length;

  const stats = [
    { label: 'Total',          value: total,   color: '#F2F2F7' },
    { label: 'Return Visits',  value: rvCount,  color: '#3B82F6' },
    { label: 'Bible Studies',  value: bsCount,  color: '#5B7E6B' },
    { label: 'Not Interested', value: niCount,  color: '#EF4444' },
  ];

  return (
    <XStack gap="$2">
      {stats.map(s => (
        <Card
          key={s.label}
          flex={1}
          backgroundColor="#2C2C2E"
          borderRadius="$3"
          padding="$3"
          borderWidth={1}
          borderColor="#3A3A3C"
          alignItems="center"
          gap="$1"
        >
          <SizableText size="$6" color={s.color} fontWeight="800">
            {s.value}
          </SizableText>
          <SizableText size="$1" color="#9CA3AF" textAlign="center" numberOfLines={2}>
            {s.label}
          </SizableText>
        </Card>
      ))}
    </XStack>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function MinistryEmptyState({ onAdd, displaySymbol }: { onAdd: () => void; displaySymbol: string }) {
  const colors = usePremiumTheme();
  return (
    <PremiumEmpty
      icon={<Users size={36} color={colors.primary} />}
      title={translate(displaySymbol, 'no_ministry_contacts_yet')}
      subtitle={translate(displaySymbol, 'ministry_empty_hint')}
      action={
        <GradientButton onPress={onAdd} icon={<Plus size={16} color="#fff" />}>
          {translate(displaySymbol, 'add_first_contact')}
        </GradientButton>
      }
    />
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MinistryScreen() {
  const router = useRouter();
  const colors = usePremiumTheme();
  const appLanguage = useAppStore((s) => s.appLanguage);
  const displaySymbol = appLanguage?.symbol || 'en';
  const filterTabs = getFilterTabs(displaySymbol);
  const [contacts, setContacts] = useState<MinistryContact[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('jw_sa:contacts');
      setContacts(raw ? JSON.parse(raw) : []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever tab is focused
  useFocusEffect(useCallback(() => {
    loadContacts();
  }, [loadContacts]));

  const filtered = filter === 'all'
    ? contacts
    : contacts.filter(c => c.status === filter);

  return (
    <AppScreen scroll={false} padded={false}>
      <YStack paddingHorizontal="$5" paddingTop="$2" paddingBottom="$2" width="100%">
        <AppHeader
          title={translate(displaySymbol, 'ministry_territory_title')}
          subtitle={translate(displaySymbol, 'territory_people')}
          right={
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/add-contact' as any)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: colors.primary,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Plus size={22} color="#FFFFFF" />
            </TouchableOpacity>
          }
        />
      </YStack>

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={colors.primary} />
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          ListHeaderComponent={
            <YStack gap="$4" paddingTop="$3" paddingBottom="$2">
              {/* Stats */}
              <StatsRow contacts={contacts} />

              {/* Filter tabs */}
              <XStack gap="$2" flexWrap="wrap">
                {filterTabs.map(tab => (
                  <TouchableOpacity
                    key={tab.key}
                    activeOpacity={0.8}
                    onPress={() => setFilter(tab.key)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 20,
                      backgroundColor: filter === tab.key ? colors.tabActiveBg : colors.surface,
                      borderWidth: 1,
                      borderColor: filter === tab.key ? colors.primary : colors.border,
                    }}
                  >
                    <SizableText
                      size="$2"
                      color={filter === tab.key ? colors.primary : colors.textMuted}
                      fontWeight={filter === tab.key ? '700' : '500'}
                    >
                      {tab.label}
                    </SizableText>
                  </TouchableOpacity>
                ))}
              </XStack>

              {/* Section label */}
              {filtered.length > 0 && (
                <SizableText size="$2" color="#9CA3AF" fontWeight="600" letterSpacing={0.5}>
                  {filtered.length} CONTACT{filtered.length !== 1 ? 'S' : ''}
                </SizableText>
              )}
            </YStack>
          }
          ListEmptyComponent={
            <MinistryEmptyState onAdd={() => router.push('/add-contact' as any)} displaySymbol={displaySymbol} />
          }
          renderItem={({ item }) => (
            <ContactCard
              contact={item}
              displaySymbol={displaySymbol}
              onPress={() => router.push(`/contact-detail?id=${item.id}` as any)}
              onVisit={() => router.push(`/add-visit?contactId=${item.id}` as any)}
              onPrepare={() => router.push(`/ministry-prep?contactId=${item.id}` as any)}
              onRemind={() => {}}
            />
          )}
        />
      )}
    </AppScreen>
  );
}
