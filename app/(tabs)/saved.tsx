// ============================================================
// JW Study Assistant — Saved Library Screen
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatList, Platform, Linking } from 'react-native';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  Input,
  ScrollView,
  BlinkDialog,
  Spinner,
  toast,
  Bookmark,
  BookOpen,
  FileText,
  BookMarked,
  AlignLeft,
  RefreshCw,
  Search,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  Newspaper,
} from '@blinkdotnew/mobile-ui';
import { useAppStore } from '@/store/appStore';
import { loadSavedSources, deleteSource } from '@/services/storageService';
import { createTranslator } from '@/services/i18nService';
import type { SavedSource, SavedSourceType, SyncStatus } from '@/types';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';

// ── Filter configuration ─────────────────────────────────────
const FILTER_TYPES: { key: 'all' | SavedSourceType; labelKey: string }[] = [
  { key: 'all', labelKey: 'all' },
  { key: 'daily-text', labelKey: 'daily_texts' },
  { key: 'answer', labelKey: 'answers' },
  { key: 'note', labelKey: 'notes' },
  { key: 'article', labelKey: 'articles' },
  { key: 'meeting-part', labelKey: 'meeting_parts' },
  { key: 'watchtower', labelKey: 'watchtower' },
];

// ── Helpers ───────────────────────────────────────────────────
function getTypeIcon(type: SavedSourceType) {
  switch (type) {
    case 'daily-text':   return <BookOpen size={18} color="#5B7E6B" />;
    case 'answer':       return <AlignLeft size={18} color="#7B6B9E" />;
    case 'note':         return <FileText size={18} color="#9E7B5A" />;
    case 'article':      return <Newspaper size={18} color="#5A7B9E" />;
    case 'meeting-part': return <BookMarked size={18} color="#5B7E6B" />;
    case 'watchtower':   return <BookOpen size={18} color="#7B6B9E" />;
    default:             return <Bookmark size={18} color="#9CA3AF" />;
  }
}

function getSyncBadge(status: SyncStatus, t: ReturnType<typeof createTranslator>) {
  switch (status) {
    case 'saved':
      return (
        <XStack
          backgroundColor="rgba(91,126,107,0.15)"
          borderRadius="$10"
          paddingHorizontal="$2"
          paddingVertical="$1"
          gap="$1"
          alignItems="center"
        >
          <CheckCircle size={10} color="#5B7E6B" />
          <SizableText size="$1" color="#5B7E6B" fontWeight="600">{t('saved')}</SizableText>
        </XStack>
      );
    case 'updated':
      return (
        <XStack
          backgroundColor="rgba(90,123,158,0.15)"
          borderRadius="$10"
          paddingHorizontal="$2"
          paddingVertical="$1"
          gap="$1"
          alignItems="center"
        >
          <Clock size={10} color="#5A7B9E" />
          <SizableText size="$1" color="#5A7B9E" fontWeight="600">{t('updated')}</SizableText>
        </XStack>
      );
    case 'needs-refresh':
      return (
        <XStack
          backgroundColor="rgba(245,158,11,0.15)"
          borderRadius="$10"
          paddingHorizontal="$2"
          paddingVertical="$1"
          gap="$1"
          alignItems="center"
        >
          <AlertCircle size={10} color="#F59E0B" />
          <SizableText size="$1" color="#F59E0B" fontWeight="600">{t('needs_refresh')}</SizableText>
        </XStack>
      );
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ── SavedItemCard ─────────────────────────────────────────────
interface SavedItemCardProps {
  item: SavedSource;
  onDelete: (id: string) => void;
  t: ReturnType<typeof createTranslator>;
}

function SavedItemCard({ item, onDelete, t }: SavedItemCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const preview = item.content?.slice(0, 80) + (item.content?.length > 80 ? '…' : '');

  const handleOpen = () => {
    if (item.url) {
      Linking.openURL(item.url).catch(() => {
        toast(t('could_not_open_link'), { message: t('no_url_available'), variant: 'error' });
      });
    } else {
      toast(t('no_link_available'), { message: t('item_no_external_url'), variant: 'warning' });
    }
  };

  return (
    <Card
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="#3A3A3C"
      gap="$3"
    >
      {/* Top row: icon + title + badge */}
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          width={36}
          height={36}
          borderRadius={18}
          backgroundColor="#1C1C1E"
          justifyContent="center"
          alignItems="center"
          borderWidth={1}
          borderColor="#3A3A3C"
          flexShrink={0}
        >
          {getTypeIcon(item.type)}
        </YStack>
        <YStack flex={1} gap="$1">
          <SizableText size="$4" color="#F2F2F7" fontWeight="700" numberOfLines={2}>
            {item.title}
          </SizableText>
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <SizableText size="$2" color="#6B7280">{formatDate(item.savedAt)}</SizableText>
            {getSyncBadge(item.syncStatus, t)}
          </XStack>
        </YStack>
      </XStack>

      {/* Preview text */}
      {preview ? (
        <SizableText size="$3" color="#9CA3AF" numberOfLines={2} lineHeight={20}>
          {preview}
        </SizableText>
      ) : null}

      {/* Actions */}
      <XStack gap="$2" justifyContent="flex-end">
        <Button
          size="$2"
          backgroundColor="rgba(91,126,107,0.15)"
          borderColor="rgba(91,126,107,0.3)"
          borderWidth={1}
          color="#5B7E6B"
          onPress={handleOpen}
          icon={<ExternalLink size={13} color="#5B7E6B" />}
        >
          {t('open')}
        </Button>

        {/* Delete with confirm dialog */}
        <BlinkDialog
          trigger={
            <Button
              size="$2"
              backgroundColor="rgba(239,68,68,0.1)"
              borderColor="rgba(239,68,68,0.25)"
              borderWidth={1}
              color="#EF4444"
              icon={<Trash2 size={13} color="#EF4444" />}
            >
              {t('delete')}
            </Button>
          }
          title={t('delete_saved_item_question')}
          description={t('delete_saved_item_description', { title: item.title })}
          onConfirm={() => { setConfirmOpen(false); onDelete(item.id); }}
          onCancel={() => setConfirmOpen(false)}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
        />
      </XStack>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────
function EmptyState({ t }: { t: ReturnType<typeof createTranslator> }) {
  return (
    <YStack alignItems="center" paddingTop="$12" gap="$4">
      <YStack
        width={80}
        height={80}
        borderRadius={40}
        backgroundColor="#2C2C2E"
        justifyContent="center"
        alignItems="center"
        borderWidth={1}
        borderColor="#3A3A3C"
      >
        <Bookmark size={36} color="#4B5563" />
      </YStack>
      <YStack alignItems="center" gap="$2">
        <SizableText size="$5" color="#F2F2F7" fontWeight="700" textAlign="center">
          {t('nothing_saved_yet')}
        </SizableText>
        <SizableText size="$3" color="#9CA3AF" textAlign="center" maxWidth={280} lineHeight={20}>
          {t('saved_empty_hint')}
        </SizableText>
      </YStack>
    </YStack>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function SavedScreen() {
  const colors = usePremiumTheme();
  const storeItems = useAppStore((s) => s.savedSources);
  const removeSavedSource = useAppStore((s) => s.removeSavedSource);
  const appLanguage = useAppStore((s) => s.appLanguage);
  const language = useAppStore((s) => s.language);
  const t = createTranslator(appLanguage?.symbol || language?.symbol || 'en');

  const [items, setItems] = useState<SavedSource[]>([]);
  const [filter, setFilter] = useState<'all' | SavedSourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Load from AsyncStorage on mount (merge with store)
  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await loadSavedSources();
      // Merge: store may have items not yet in AsyncStorage (e.g. just added)
      const merged = [...stored];
      for (const s of storeItems) {
        if (!merged.find((m) => m.id === s.id)) merged.push(s);
      }
      setItems(merged.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    } catch {
      setItems(storeItems);
    } finally {
      setIsLoading(false);
    }
  }, [storeItems]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Refresh JW content (daily text + meeting week)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Trigger a reload; actual re-fetch is handled by backend services
      await loadItems();
      toast(t('content_refreshed'), { message: t('daily_meeting_updated'), variant: 'success' });
    } catch {
      toast(t('refresh_failed'), { message: t('check_connection_retry'), variant: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Delete item
  const handleDelete = async (id: string) => {
    try {
      await deleteSource(id);
      removeSavedSource(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast(t('item_deleted'), { variant: 'success' });
    } catch {
      toast(t('delete_failed'), { message: t('could_not_remove_item'), variant: 'error' });
    }
  };

  // Filter + search
  const filtered = items.filter((item) => {
    const matchType = filter === 'all' || item.type === filter;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q || item.title.toLowerCase().includes(q) || item.content?.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <YStack flex={1}>
        {/* ── Header ── */}
        <XStack
          paddingHorizontal="$5"
          paddingTop="$4"
          paddingBottom="$2"
          justifyContent="space-between"
          alignItems="center"
        >
          <SizableText size="$8" color={colors.text} fontWeight="900" letterSpacing={-0.6}>
            {t('saved_library')}
          </SizableText>
          <XStack gap="$2">
            <Button
              size="$3"
              chromeless
              onPress={() => setShowSearch((v) => !v)}
              icon={<Search size={20} color={showSearch ? colors.primary : colors.textMuted} />}
            />
            <Button
              size="$3"
              chromeless
              onPress={handleRefresh}
              disabled={isRefreshing}
              icon={
                isRefreshing
                  ? <Spinner size="small" color={colors.primary} />
                  : <RefreshCw size={20} color={colors.textMuted} />
              }
            />
          </XStack>
        </XStack>

        {/* ── Search bar ── */}
        {showSearch && (
          <YStack paddingHorizontal="$5" paddingBottom="$2">
            <Input
              placeholder={t('search_saved_items')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              backgroundColor={colors.surface}
              borderColor={colors.border}
              color={colors.text}
              placeholderTextColor={colors.textMuted}
              borderRadius="$4"
              height={42}
              autoFocus
            />
          </YStack>
        )}

        {/* ── Refresh JW Content button ── */}
        <XStack paddingHorizontal="$5" paddingBottom="$3">
          <Button
            size="$3"
            backgroundColor={colors.glow}
            borderColor={colors.borderStrong}
            borderWidth={1}
            color={colors.primary}
            onPress={handleRefresh}
            disabled={isRefreshing}
            icon={isRefreshing ? <Spinner size="small" color={colors.primary} /> : <RefreshCw size={14} color={colors.primary} />}
            borderRadius="$10"
          >
            {t('refresh_jw_content')}
          </Button>
        </XStack>

        {/* ── Type filter chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          paddingHorizontal="$5"
          paddingBottom="$3"
        >
          <XStack gap="$2">
            {FILTER_TYPES.map((f) => {
              const active = filter === f.key;
              return (
                <YStack
                  key={f.key}
                  backgroundColor={active ? colors.primary : colors.surface}
                  borderRadius="$10"
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderWidth={1}
                  borderColor={active ? colors.primary : colors.border}
                  pressStyle={{ opacity: 0.75 }}
                  onPress={() => setFilter(f.key)}
                >
                  <SizableText
                    size="$3"
                    color={active ? 'white' : colors.textMuted}
                    fontWeight={active ? '700' : '400'}
                  >
                    {t(f.labelKey)}
                  </SizableText>
                </YStack>
              );
            })}
          </XStack>
        </ScrollView>

        {/* ── List ── */}
        {isLoading ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Spinner size="large" color={colors.primary} />
          </YStack>
        ) : filtered.length === 0 ? (
          <ScrollView flex={1} showsVerticalScrollIndicator={false} paddingHorizontal="$5">
            <EmptyState t={t} />
          </ScrollView>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <YStack marginBottom="$3">
                <SavedItemCard item={item} onDelete={handleDelete} t={t} />
              </YStack>
            )}
          />
        )}
      </YStack>
    </SafeAreaView>
  );
}
