// JW Study Assistant — Ministry AI Preparation Screen
import { useState, useEffect, useMemo } from 'react';
import { SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  YStack, XStack, SizableText, Card, Spinner, Separator, toast
} from '@blinkdotnew/mobile-ui';
import { ChevronLeft, Sparkles, Bookmark, Copy, RefreshCw } from '@blinkdotnew/mobile-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateMinistrySuggestion } from '@/services/aiRetrievalService';
import { normalizeAppLanguage } from '@/services/sourceGatewayService';
import { useAppStore } from '@/store/appStore';
import type { MinistryContact } from '@/types';
import { saveSource } from '@/services/storageService';

const PRIMARY = '#5B7E6B';
const BG = '#1C1C1E';
const CARD_BG = '#2C2C2E';
const CARD_BORDER = '#3A3A3C';
const TEXT_PRIMARY = '#F2F2F7';
const TEXT_SECONDARY = '#9CA3AF';
const PRIMARY_SUBTLE = 'rgba(91,126,107,0.15)';

export default function MinistryPrepScreen() {
  const router = useRouter();
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const rawContentLanguage = useAppStore((s) => s.contentLanguage || s.language);
  const contentLanguage = useMemo(() => normalizeAppLanguage(rawContentLanguage), [rawContentLanguage]);

  const [contact, setContact] = useState<MinistryContact | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (contactId) {
      AsyncStorage.getItem('jw_sa:contacts').then((raw) => {
        const contacts = raw ? JSON.parse(raw) : [];
        const found = contacts.find((c: MinistryContact) => c.id === contactId);
        setContact(found || null);
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
  }, [contactId]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setAiSuggestion('');
    try {
      const ministryContact: MinistryContact = contact ?? {
        id: 'general',
        name: 'General ministry',
        status: 'return-visit',
        topicsDiscussed: [],
        scripturesUsed: [],
        publicationsShared: [],
        videosShared: [],
        questionsAsked: [],
        notes: [],
        reminderEnabled: false,
        visits: [],
      };

      const answer = await generateMinistrySuggestion(ministryContact, '', [], contentLanguage.symbol);
      setAiSuggestion(answer.content || '');
    } catch {
      toast('Error', { message: 'Could not generate suggestion. Check your connection.', variant: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!aiSuggestion) return;
    try {
      const saved = {
        id: `saved_${Date.now()}`,
        type: 'answer',
        title: `Ministry suggestion for ${contact?.name || 'contact'}`,
        content: aiSuggestion,
        language: 'en',
        savedAt: new Date().toISOString(),
        syncStatus: 'saved',
      };
      await saveSource(saved as any);
      toast('Saved', { message: 'Suggestion saved to library', variant: 'success' });
    } catch {
      toast('Error', { message: 'Could not save suggestion', variant: 'error' });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <XStack paddingHorizontal="$5" paddingTop="$4" paddingBottom="$2" alignItems="center" gap="$3">
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <SizableText size="$5" color={TEXT_PRIMARY} fontWeight="700" flex={1}>
          Ministry Preparation
        </SizableText>
      </XStack>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Contact info */}
        {contact && (
          <Card backgroundColor={CARD_BG} borderRadius="$4" padding="$4" borderWidth={1} borderColor={CARD_BORDER}>
            <SizableText size="$4" color={TEXT_PRIMARY} fontWeight="700">{contact.name}</SizableText>
            <SizableText size="$3" color={TEXT_SECONDARY}>Status: {contact.status?.replace('-', ' ')}</SizableText>
            {contact.topicsDiscussed?.length > 0 && (
              <SizableText size="$3" color={TEXT_SECONDARY}>Topics: {contact.topicsDiscussed.join(', ')}</SizableText>
            )}
          </Card>
        )}

        {/* JW Sources notice */}
        <Card backgroundColor={PRIMARY_SUBTLE} borderRadius="$4" padding="$3" borderWidth={1} borderColor="rgba(91,126,107,0.3)">
          <XStack alignItems="center" gap="$2">
            <Sparkles size={16} color={PRIMARY} />
            <SizableText size="$2" color={PRIMARY} fontWeight="600">JW Sources Only Mode</SizableText>
          </XStack>
          <SizableText size="$2" color={TEXT_SECONDARY} marginTop="$1">
            AI suggestions are based only on JW.org/WOL content. All suggestions will include source references.
          </SizableText>
        </Card>

        {/* Generate button */}
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={isGenerating}
          activeOpacity={0.8}
          style={{
            backgroundColor: PRIMARY,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: isGenerating ? 0.7 : 1,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {isGenerating ? (
            <Spinner size="small" color="#fff" />
          ) : (
            <Sparkles size={18} color="#fff" />
          )}
          <SizableText size="$4" color="#fff" fontWeight="700">
            {isGenerating ? 'Generating...' : 'Get AI Ministry Suggestions'}
          </SizableText>
        </TouchableOpacity>

        {/* AI Answer */}
        {aiSuggestion !== '' && (
          <Card backgroundColor={CARD_BG} borderRadius="$4" padding="$4" borderWidth={1} borderColor={CARD_BORDER} gap="$3">
            <XStack alignItems="center" gap="$2">
              <Sparkles size={16} color={PRIMARY} />
              <SizableText size="$3" color={PRIMARY} fontWeight="700">Ministry Suggestions</SizableText>
            </XStack>
            <Separator borderColor={CARD_BORDER} />
            <SizableText size="$3" color={TEXT_PRIMARY} lineHeight={22}>
              {aiSuggestion}
            </SizableText>
            <XStack gap="$2" marginTop="$2">
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.7}
                style={{
                  flex: 1, backgroundColor: PRIMARY, borderRadius: 8,
                  paddingVertical: 10, alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', gap: 6,
                }}
              >
                <Bookmark size={14} color="#fff" />
                <SizableText size="$3" color="#fff" fontWeight="600">Save</SizableText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleGenerate}
                activeOpacity={0.7}
                style={{
                  flex: 1, backgroundColor: CARD_BORDER, borderRadius: 8,
                  paddingVertical: 10, alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', gap: 6,
                }}
              >
                <RefreshCw size={14} color={TEXT_SECONDARY} />
                <SizableText size="$3" color={TEXT_SECONDARY} fontWeight="600">Regenerate</SizableText>
              </TouchableOpacity>
            </XStack>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
