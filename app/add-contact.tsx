import { useState } from 'react';
import { TouchableOpacity, ScrollView as RNScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  Input,
  Switch,
  Separator,
  Spinner,
  ArrowLeft,
  Plus,
  X,
  DatePicker,
  BlinkSelect,
  ScrollView,
} from '@blinkdotnew/mobile-ui';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/appStore';
import { createTranslator } from '@/services/i18nService';
import type { MinistryContact } from './(tabs)/ministry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Chip input ───────────────────────────────────────────────────────────────

function ChipInput({
  label,
  chips,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  chips: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (trimmed && !chips.includes(trimmed)) {
      onAdd(trimmed);
      setDraft('');
    }
  };

  return (
    <YStack gap="$2">
      <SizableText size="$3" color="#9CA3AF" fontWeight="600">
        {label}
      </SizableText>
      <XStack gap="$2" alignItems="center">
        <Input
          flex={1}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}…`}
          placeholderTextColor="#4B5563"
          backgroundColor="#2C2C2E"
          borderColor="#3A3A3C"
          color="#F2F2F7"
          size="$3"
          borderRadius="$3"
          onSubmitEditing={handleAdd}
          returnKeyType="done"
        />
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleAdd}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: '#5B7E6B',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Plus size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </XStack>
      {chips.length > 0 && (
        <XStack flexWrap="wrap" gap="$2" paddingTop="$1">
          {chips.map(chip => (
            <XStack
              key={chip}
              backgroundColor="rgba(91,126,107,0.15)"
              borderRadius="$10"
              paddingHorizontal="$3"
              paddingVertical="$1"
              borderWidth={1}
              borderColor="rgba(91,126,107,0.25)"
              alignItems="center"
              gap="$1"
            >
              <SizableText size="$2" color="#5B7E6B">
                {chip}
              </SizableText>
              <TouchableOpacity onPress={() => onRemove(chip)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <X size={12} color="#5B7E6B" />
              </TouchableOpacity>
            </XStack>
          ))}
        </XStack>
      )}
    </YStack>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <YStack gap="$2">
      <XStack gap="$1" alignItems="center">
        <SizableText size="$3" color="#9CA3AF" fontWeight="600">
          {label}
        </SizableText>
        {required && (
          <SizableText size="$3" color="#EF4444">*</SizableText>
        )}
      </XStack>
      {children}
    </YStack>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AddContactScreen() {
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const appLanguage = useAppStore((s) => s.appLanguage);
  const language = useAppStore((s) => s.language);
  const t = createTranslator(appLanguage?.symbol || language?.symbol || 'en');

  const statusOptions = [
    { label: t('first_call'), value: 'first-call' },
    { label: t('return_visit'), value: 'return-visit' },
    { label: t('bible_study'), value: 'bible-study' },
    { label: t('inactive'), value: 'inactive' },
    { label: t('not_interested'), value: 'not-interested' },
  ];

  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<MinistryContact['status']>('first-call');
  const [topics, setTopics] = useState<string[]>([]);
  const [scriptures, setScriptures] = useState<string[]>([]);
  const [publications, setPublications] = useState<string[]>([]);
  const [questions, setQuestions] = useState('');
  const [notes, setNotes] = useState('');
  const [nextVisitDate, setNextVisitDate] = useState<Date | undefined>(undefined);
  const [reminderEnabled, setReminderEnabled] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('name_required'), t('enter_contact_name'));
      return;
    }

    setSaving(true);
    try {
      const raw = await AsyncStorage.getItem('jw_sa:contacts');
      const contacts: MinistryContact[] = raw ? JSON.parse(raw) : [];

      const contact: MinistryContact = {
        id: editId ?? generateId(),
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        status,
        topicsDiscussed: topics,
        scripturesUsed: scriptures,
        publicationsShared: publications,
        questionsAsked: questions.trim() ? [questions.trim()] : [],
        notes: notes.trim() ? [notes.trim()] : [],
        nextVisitDate: nextVisitDate?.toISOString(),
        reminderEnabled,
        visits: [],
      };

      if (editId) {
        const idx = contacts.findIndex(c => c.id === editId);
        if (idx >= 0) {
          contacts[idx] = { ...contacts[idx], ...contact };
        }
      } else {
        contacts.unshift(contact);
      }

      await AsyncStorage.setItem('jw_sa:contacts', JSON.stringify(contacts));
      router.back();
    } catch (err) {
      Alert.alert(t('error'), t('could_not_save_contact_retry'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
      {/* Header */}
      <XStack
        paddingHorizontal="$5"
        paddingTop="$3"
        paddingBottom="$3"
        alignItems="center"
        gap="$3"
        borderBottomWidth={1}
        borderBottomColor="#2C2C2E"
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={{ width: 36, height: 36, justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color="#9CA3AF" />
        </TouchableOpacity>
        <SizableText size="$6" color="#F2F2F7" fontWeight="700" flex={1}>
          {editId ? t('edit_contact') : t('add_contact')}
        </SizableText>
        {saving ? (
          <Spinner size="small" color="#5B7E6B" />
        ) : (
          <Button
            size="$3"
            backgroundColor="#5B7E6B"
            color="#FFFFFF"
            borderRadius="$3"
            onPress={handleSave}
            pressStyle={{ opacity: 0.8 }}
          >
            {t('save')}
          </Button>
        )}
      </XStack>

      {/* Form */}
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$5" gap="$5" paddingBottom={100}>

          {/* Basic Info */}
          <YStack gap="$4">
            <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1.5}>
              {t('basic_info')}
            </SizableText>

            <Field label={t('name')} required>
              <Input
                value={name}
                onChangeText={setName}
                placeholder={t('full_name_placeholder')}
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
              />
            </Field>

            <Field label={t('nickname')}>
              <Input
                value={nickname}
                onChangeText={setNickname}
                placeholder={t('nickname_placeholder')}
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
              />
            </Field>

            <Field label={t('phone')}>
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
                keyboardType="phone-pad"
              />
            </Field>

            <Field label={t('address')}>
              <Input
                value={address}
                onChangeText={setAddress}
                placeholder={t('street_address_placeholder')}
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
              />
            </Field>

            <Field label={t('status')}>
              <BlinkSelect
                items={statusOptions}
                value={status}
                onValueChange={(v) => setStatus(v as MinistryContact['status'])}
                placeholder={t('select_status')}
              />
            </Field>
          </YStack>

          <Separator borderColor="#3A3A3C" />

          {/* Ministry Details */}
          <YStack gap="$4">
            <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1.5}>
              {t('ministry_details')}
            </SizableText>

            <ChipInput
              label={t('topics_discussed')}
              chips={topics}
              onAdd={v => setTopics(prev => [...prev, v])}
              onRemove={v => setTopics(prev => prev.filter(t => t !== v))}
              placeholder={t('topics_placeholder')}
            />

            <ChipInput
              label={t('scriptures_used')}
              chips={scriptures}
              onAdd={v => setScriptures(prev => [...prev, v])}
              onRemove={v => setScriptures(prev => prev.filter(s => s !== v))}
              placeholder={t('scripture_single_placeholder')}
            />

            <ChipInput
              label={t('publications_shared')}
              chips={publications}
              onAdd={v => setPublications(prev => [...prev, v])}
              onRemove={v => setPublications(prev => prev.filter(p => p !== v))}
              placeholder={t('publication_shared_placeholder')}
            />

            <Field label={t('questions_asked')}>
              <Input
                value={questions}
                onChangeText={setQuestions}
                placeholder={t('questions_placeholder')}
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{ minHeight: 72, paddingTop: 10 }}
              />
            </Field>

            <Field label={t('notes')}>
              <Input
                value={notes}
                onChangeText={setNotes}
                placeholder={t('contact_notes_placeholder')}
                placeholderTextColor="#4B5563"
                backgroundColor="#2C2C2E"
                borderColor="#3A3A3C"
                color="#F2F2F7"
                size="$4"
                borderRadius="$3"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{ minHeight: 90, paddingTop: 10 }}
              />
            </Field>
          </YStack>

          <Separator borderColor="#3A3A3C" />

          {/* Visit Scheduling */}
          <YStack gap="$4">
            <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1.5}>
              {t('next_visit')}
            </SizableText>

            <Field label={t('next_visit_date')}>
              <DatePicker
                value={nextVisitDate}
                onDateChange={setNextVisitDate}
                minDate={new Date()}
              />
            </Field>

            <XStack alignItems="center" justifyContent="space-between">
              <YStack gap="$1" flex={1}>
                <SizableText size="$4" color="#F2F2F7" fontWeight="600">
                  {t('enable_reminder')}
                </SizableText>
                <SizableText size="$2" color="#9CA3AF">
                  {t('notify_before_next_visit')}
                </SizableText>
              </YStack>
              <Switch
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
                backgroundColor={reminderEnabled ? '#5B7E6B' : '#3A3A3C'}
              />
            </XStack>
          </YStack>

          {/* Save button (bottom) */}
          <Button
            backgroundColor="#5B7E6B"
            color="#FFFFFF"
            borderRadius="$4"
            size="$5"
            onPress={handleSave}
            pressStyle={{ opacity: 0.8 }}
            disabled={saving}
            marginTop="$2"
          >
            {saving ? t('saving') : editId ? t('update_contact') : t('add_contact')}
          </Button>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
