// ============================================================
// JW Study Assistant — Onboarding (Codex edition)
// ============================================================
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Animated,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  YStack,
  XStack,
  SizableText,
  Paragraph,
  Input,
  ScrollView,
  Spinner,
  Card,
} from '@blinkdotnew/mobile-ui';
import { useTheme, fonts } from '@/constants/theme';

// Inline mini-icon (unicode-based) to avoid Tamagui theme context dependency in onboarding.
function Glyph({ char, size = 14, color }: { char: string; size?: number; color: string }) {
  return (
    <SizableText style={{ fontFamily: fonts.mono, fontSize: size, color, lineHeight: size + 2, fontWeight: '700' }}>
      {char}
    </SizableText>
  );
}

// ─── Types ───────────────────────────────────────────────────
interface Language {
  name: string;
  langCode: string;
  symbol: string;
  direction: string;
}

interface SpiritualProfile {
  spiritualStatus: string;
  ageRange: string;
  maritalStatus: string;
  studyInterests: string;
}

// ─── Defensive helpers ───────────────────────────────────────
const safe = (s: unknown, fallback = ''): string =>
  typeof s === 'string' && s.length > 0 ? s : fallback;

const langBadge = (l: Partial<Language>): string => {
  const src = safe(l.symbol) || safe(l.langCode) || safe(l.name) || '??';
  return src.substring(0, 2).toUpperCase();
};

// ─── Constants ───────────────────────────────────────────────
const FALLBACK_LANGUAGES: Language[] = [
  { name: 'English',    langCode: 'E', symbol: 'en', direction: 'ltr' },
  { name: 'Spanish',    langCode: 'S', symbol: 'es', direction: 'ltr' },
  { name: 'French',     langCode: 'F', symbol: 'fr', direction: 'ltr' },
  { name: 'Portuguese', langCode: 'T', symbol: 'pt', direction: 'ltr' },
  { name: 'German',     langCode: 'X', symbol: 'de', direction: 'ltr' },
  { name: 'Italian',    langCode: 'I', symbol: 'it', direction: 'ltr' },
];

const SPIRITUAL_STATUSES = [
  'Publisher', 'Pioneer', 'Elder', 'Ministerial Servant', 'Bible Student',
  'Interested', 'Returning', 'Other',
];
const AGE_RANGES = ['Under 18', '18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
const MARITAL_STATUSES = ['Single', 'Married', 'Widowed', 'Divorced', 'Prefer not to say'];

// ─── Picker Row (reusable) ───────────────────────────────────
function PickerRow({
  label, value, options, onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <YStack gap="$2">
      <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkSubtle, letterSpacing: 1.5, fontWeight: '700' }}>
        {label.toUpperCase()}
      </SizableText>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.85}
        style={{
          backgroundColor: t.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: open ? t.copperBorder : t.border,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <SizableText style={{ fontFamily: fonts.body, fontSize: 15, color: value ? t.ink : t.inkSubtle }}>
          {value || 'Select…'}
        </SizableText>
        <SizableText style={{ fontFamily: fonts.mono, fontSize: 11, color: t.copper }}>
          {open ? '▴' : '▾'}
        </SizableText>
      </TouchableOpacity>

      {open && (
        <Card backgroundColor={t.surface} borderRadius="$4" borderWidth={1} borderColor={t.border} overflow="hidden">
          {options.map((opt, i) => {
            const selected = opt === value;
            return (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.7}
                onPress={() => { onSelect(opt); setOpen(false); }}
                style={{
                  paddingHorizontal: 16, paddingVertical: 12,
                  borderBottomWidth: i < options.length - 1 ? 1 : 0,
                  borderBottomColor: t.border,
                  backgroundColor: selected ? t.copperSoft : 'transparent',
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <SizableText style={{ fontFamily: fonts.body, fontSize: 14, color: selected ? t.copper : t.ink, fontWeight: selected ? '700' : '400' }}>
                  {opt}
                </SizableText>
                {selected && <Glyph char="✓" size={12} color={t.copper} />}
              </TouchableOpacity>
            );
          })}
        </Card>
      )}
    </YStack>
  );
}

// ─── Hero gradient backdrop ──────────────────────────────────
function CodexBackdrop() {
  const { t, mode } = useTheme();
  // copper warm top → parchment/bg mid → mossy bottom
  const colors = mode === 'dark'
    ? ['rgba(220,159,98,0.16)', 'rgba(14,18,36,0.0)', 'rgba(125,168,142,0.10)']
    : ['rgba(184,117,60,0.20)', 'rgba(244,236,215,0.0)', 'rgba(74,107,87,0.14)'];
  return (
    <>
      <LinearGradient
        colors={colors as any}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        pointerEvents="none"
      />
      {/* corner glow */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -120, left: -120, width: 360, height: 360, borderRadius: 180,
          backgroundColor: mode === 'dark'
            ? 'rgba(220,159,98,0.10)'
            : 'rgba(184,117,60,0.10)',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -140, right: -140, width: 420, height: 420, borderRadius: 210,
          backgroundColor: mode === 'dark'
            ? 'rgba(125,168,142,0.10)'
            : 'rgba(74,107,87,0.08)',
        }}
      />
    </>
  );
}

// ─── Codex primary button ────────────────────────────────────
function CodexButton({
  label, onPress, disabled, variant = 'primary', icon, testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'secondary';
  icon?: React.ReactNode;
  testID?: string;
}) {
  const { t } = useTheme();
  const bg =
    disabled ? t.surfaceAlt :
    variant === 'primary' ? t.ink :
    variant === 'secondary' ? t.copper :
    'transparent';
  const fg =
    disabled ? t.inkSubtle :
    variant === 'ghost' ? t.copper :
    t.inkInverse;
  return (
    <TouchableOpacity
      data-testid={testID}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={{
        backgroundColor: bg,
        paddingVertical: 16,
        paddingHorizontal: 22,
        borderRadius: 999,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        borderWidth: variant === 'ghost' ? 1 : 0,
        borderColor: t.copperBorder,
      }}
    >
      <SizableText style={{ fontFamily: fonts.mono, fontSize: 12, color: fg, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
        {label}
      </SizableText>
      {icon}
    </TouchableOpacity>
  );
}

// ─── Step dots ───────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  const { t } = useTheme();
  return (
    <XStack gap="$2" alignItems="center">
      {Array.from({ length: total }).map((_, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <View
            key={i}
            style={{
              width: active ? 22 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: active ? t.copper : done ? t.moss : t.border,
            }}
          />
        );
      })}
    </XStack>
  );
}

// ═════════════════════════════════════════════════════════════
// Step 1 — Welcome
// ═════════════════════════════════════════════════════════════
function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { t } = useTheme();
  return (
    <YStack flex={1} justifyContent="space-between" padding="$6">
      <YStack flex={1} justifyContent="center" alignItems="flex-start" gap="$5">
        {/* Masthead chip */}
        <XStack alignItems="center" gap="$3">
          <View style={{ width: 2, height: 24, backgroundColor: t.copper }} />
          <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkSubtle, letterSpacing: 2.5, fontWeight: '700' }}>
            JW · CODEX · VOL. I
          </SizableText>
        </XStack>

        {/* Editorial headline */}
        <YStack gap="$2">
          <SizableText
            style={{
              fontFamily: fonts.display,
              fontSize: 56,
              lineHeight: 60,
              color: t.ink,
              fontWeight: '500',
              letterSpacing: -1.5,
              fontStyle: 'italic',
            }}
          >
            A quieter{'\n'}way to study.
          </SizableText>
          <SizableText
            style={{
              fontFamily: fonts.body,
              fontSize: 16,
              color: t.inkMuted,
              lineHeight: 24,
              marginTop: 8,
              maxWidth: 380,
            }}
          >
            Your daily text, meetings, ministry, and saved sources — all woven into a single, devotional companion drawn from JW.org and WOL.
          </SizableText>
        </YStack>

        {/* Feature chips with real icons */}
        <YStack gap="$2" marginTop="$3">
          <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, color: t.copper, fontWeight: '700' }}>
            ◆  WHAT'S INSIDE
          </SizableText>
          <XStack gap="$2" flexWrap="wrap">
            {[
              { char: '✦', label: 'Study tools' },
              { char: '◆', label: 'Meeting prep' },
              { char: '◇', label: 'Field ministry' },
              { char: '✧', label: 'Saved library' },
            ].map((f) => (
              <XStack
                key={f.label}
                backgroundColor={t.surface}
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderRadius={999}
                borderWidth={1}
                borderColor={t.border}
                alignItems="center"
                gap="$2"
              >
                <Glyph char={f.char} size={12} color={t.copper} />
                <SizableText style={{ fontFamily: fonts.body, fontSize: 12, color: t.ink, fontWeight: '500' }}>
                  {f.label}
                </SizableText>
              </XStack>
            ))}
          </XStack>
        </YStack>
      </YStack>

      <YStack gap="$4">
        {/* Disclaimer */}
        <XStack
          backgroundColor={t.surface}
          borderRadius="$4"
          padding="$3"
          gap="$2"
          alignItems="flex-start"
          borderLeftWidth={3}
          borderLeftColor={t.moss}
          borderTopWidth={1}
          borderRightWidth={1}
          borderBottomWidth={1}
          borderColor={t.border}
        >
          <Glyph char="✕" size={12} color={t.moss} />
          <SizableText style={{ fontFamily: fonts.body, fontSize: 11, color: t.inkMuted, lineHeight: 16, flex: 1 }}>
            Not affiliated with or endorsed by Jehovah's Witnesses, JW.org, JW Library, or Watch Tower Bible and Tract Society. Organizes study from publicly available JW.org / WOL content.
          </SizableText>
        </XStack>

        <CodexButton
          label="Begin"
          icon={<Glyph char="→" size={14} color={t.inkInverse} />}
          onPress={onNext}
          testID="onboarding-begin-btn"
        />
      </YStack>
    </YStack>
  );
}

// ═════════════════════════════════════════════════════════════
// Step 2 — Language
// ═════════════════════════════════════════════════════════════
function LanguageStep({
  onNext, selectedLanguage, onSelectLanguage,
}: {
  onNext: () => void;
  selectedLanguage: Language | null;
  onSelectLanguage: (lang: Language) => void;
}) {
  const { t } = useTheme();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [filtered, setFiltered] = useState<Language[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://b.jw-cdn.org/apis/mediator/v1/languages/E/web?clientType=www')
      .then((r) => r.json())
      .then((data) => {
        const langs: Language[] = (data?.languages ?? [])
          .map((l: any): Language => ({
            name: safe(l?.name) || safe(l?.vernacularName) || safe(l?.langCode, 'Unknown'),
            langCode: safe(l?.langCode),
            symbol: safe(l?.symbol),
            direction: safe(l?.direction, 'ltr'),
          }))
          // Skip entries without enough info to render
          .filter((l: Language) => l.name && (l.langCode || l.symbol));
        const sorted = langs.sort((a, b) => a.name.localeCompare(b.name));
        const list = sorted.length > 0 ? sorted : FALLBACK_LANGUAGES;
        setLanguages(list);
        setFiltered(list);
      })
      .catch(() => {
        setLanguages(FALLBACK_LANGUAGES);
        setFiltered(FALLBACK_LANGUAGES);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!query.trim()) setFiltered(languages);
    else {
      const q = query.toLowerCase();
      setFiltered(languages.filter((l) => safe(l.name).toLowerCase().includes(q)));
    }
  }, [query, languages]);

  const renderItem = ({ item }: { item: Language }) => {
    const isSelected =
      !!selectedLanguage &&
      safe(selectedLanguage.langCode) === safe(item.langCode) &&
      safe(selectedLanguage.symbol) === safe(item.symbol);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onSelectLanguage(item)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
          paddingVertical: 14,
          backgroundColor: isSelected ? t.copperSoft : 'transparent',
          borderBottomWidth: 1,
          borderBottomColor: t.border,
        }}
      >
        <XStack alignItems="center" gap="$3" flex={1}>
          <View
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: isSelected ? t.copper : t.surface,
              justifyContent: 'center', alignItems: 'center',
              borderWidth: 1,
              borderColor: isSelected ? t.copper : t.border,
            }}
          >
            <SizableText style={{ fontFamily: fonts.mono, fontSize: 11, color: isSelected ? t.inkInverse : t.inkMuted, fontWeight: '800', letterSpacing: 1 }}>
              {langBadge(item)}
            </SizableText>
          </View>
          <SizableText style={{ fontFamily: fonts.display, fontSize: 16, color: isSelected ? t.copper : t.ink, fontWeight: isSelected ? '700' : '500' }}>
            {safe(item.name, 'Unknown')}
          </SizableText>
        </XStack>
        {isSelected && (
          <View
            style={{
              width: 26, height: 26, borderRadius: 13,
              backgroundColor: t.copper,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Glyph char="✓" size={13} color={t.inkInverse} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <YStack flex={1}>
      <YStack padding="$6" gap="$4" paddingBottom="$3">
        <XStack alignItems="center" gap="$2">
          <View style={{ width: 20, height: 1, backgroundColor: t.copper }} />
          <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.copper, letterSpacing: 2, fontWeight: '700' }}>
            II · LANGUAGE
          </SizableText>
        </XStack>
        <SizableText style={{ fontFamily: fonts.display, fontSize: 36, lineHeight: 40, color: t.ink, fontWeight: '500', letterSpacing: -1, fontStyle: 'italic' }}>
          In which tongue?
        </SizableText>
        <SizableText style={{ fontFamily: fonts.body, fontSize: 14, color: t.inkMuted, lineHeight: 21 }}>
          Choose the language for study materials. You can change this later.
        </SizableText>

        {/* Search */}
        <XStack
          backgroundColor={t.surface}
          borderRadius={999}
          borderWidth={1}
          borderColor={t.border}
          paddingHorizontal="$3"
          paddingVertical={4}
          alignItems="center"
          gap="$2"
        >
          <Glyph char="⌕" size={16} color={t.inkSubtle} />
          <Input
            flex={1}
            value={query}
            onChangeText={setQuery}
            placeholder="Search languages…"
            placeholderTextColor={t.inkSubtle}
            color={t.ink}
            backgroundColor="transparent"
            borderWidth={0}
            size="$4"
            focusStyle={{ borderWidth: 0, outlineWidth: 0 } as any}
            style={{ fontFamily: fonts.body }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 14, color: t.inkSubtle }}>✕</SizableText>
            </TouchableOpacity>
          )}
        </XStack>
      </YStack>

      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
          <Spinner size="large" color={t.copper} />
          <SizableText style={{ fontFamily: fonts.body, fontSize: 13, color: t.inkMuted }}>
            Loading languages…
          </SizableText>
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => `${safe(item.langCode)}-${safe(item.symbol)}-${i}`}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <YStack padding="$6" alignItems="center" gap="$2">
              <Glyph char="🌐" size={24} color={t.inkSubtle} />
              <SizableText style={{ fontFamily: fonts.body, fontSize: 13, color: t.inkMuted, textAlign: 'center' }}>
                No languages match "{query}"
              </SizableText>
            </YStack>
          }
        />
      )}

      <YStack
        padding="$5"
        borderTopWidth={1}
        borderTopColor={t.border}
        backgroundColor={t.bg}
      >
        <CodexButton
          label={selectedLanguage ? `Continue with ${selectedLanguage.name}` : 'Select a language'}
          icon={selectedLanguage ? <Glyph char="→" size={14} color={t.inkInverse} /> : undefined}
          disabled={!selectedLanguage}
          onPress={onNext}
          testID="lang-continue-btn"
        />
      </YStack>
    </YStack>
  );
}

// ═════════════════════════════════════════════════════════════
// Step 3 — Spiritual Profile
// ═════════════════════════════════════════════════════════════
function ProfileStep({
  onNext, profile, onUpdateProfile,
}: {
  onNext: () => void;
  profile: SpiritualProfile;
  onUpdateProfile: (updates: Partial<SpiritualProfile>) => void;
}) {
  const { t } = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack padding="$6" gap="$5" paddingBottom="$8">
          <YStack gap="$2">
            <XStack alignItems="center" gap="$2">
              <View style={{ width: 20, height: 1, backgroundColor: t.copper }} />
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.copper, letterSpacing: 2, fontWeight: '700' }}>
                III · YOUR PROFILE
              </SizableText>
            </XStack>
            <SizableText style={{ fontFamily: fonts.display, fontSize: 36, lineHeight: 40, color: t.ink, fontWeight: '500', letterSpacing: -1, fontStyle: 'italic' }}>
              A little about{'\n'}your study.
            </SizableText>
            <Paragraph style={{ fontFamily: fonts.body, fontSize: 14, color: t.inkMuted, lineHeight: 21 }}>
              Helps personalize suggestions. All fields optional.
            </Paragraph>
          </YStack>

          {/* Privacy badge */}
          <XStack
            backgroundColor={t.mossSoft}
            borderRadius="$4"
            padding="$3"
            gap="$2"
            alignItems="center"
            borderWidth={1}
            borderColor={t.mossBorder}
          >
            <Glyph char="●" size={11} color={t.moss} />
            <SizableText style={{ fontFamily: fonts.body, fontSize: 12, color: t.inkMuted, flex: 1, lineHeight: 17 }}>
              Information stays on your device. Used only to tailor suggestions.
            </SizableText>
          </XStack>

          <YStack gap="$5">
            <PickerRow
              label="Spiritual Status"
              value={profile.spiritualStatus}
              options={SPIRITUAL_STATUSES}
              onSelect={(v) => onUpdateProfile({ spiritualStatus: v })}
            />
            <PickerRow
              label="Age Range"
              value={profile.ageRange}
              options={AGE_RANGES}
              onSelect={(v) => onUpdateProfile({ ageRange: v })}
            />
            <PickerRow
              label="Marital Status"
              value={profile.maritalStatus}
              options={MARITAL_STATUSES}
              onSelect={(v) => onUpdateProfile({ maritalStatus: v })}
            />

            <YStack gap="$2">
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkSubtle, letterSpacing: 1.5, fontWeight: '700' }}>
                STUDY INTERESTS
              </SizableText>
              <YStack
                backgroundColor={t.surface}
                borderRadius="$4"
                borderWidth={1}
                borderColor={t.border}
                padding="$1"
              >
                <Input
                  value={profile.studyInterests}
                  onChangeText={(v) => onUpdateProfile({ studyInterests: v })}
                  placeholder="e.g. prophecy, family worship, young people…"
                  placeholderTextColor={t.inkSubtle}
                  color={t.ink}
                  backgroundColor="transparent"
                  borderWidth={0}
                  size="$4"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  focusStyle={{ borderWidth: 0, outlineWidth: 0 } as any}
                  style={{ minHeight: 80, paddingTop: 10, fontFamily: fonts.body }}
                />
              </YStack>
              <SizableText style={{ fontFamily: fonts.body, fontSize: 11, color: t.inkSubtle, fontStyle: 'italic' }}>
                Separate topics with commas
              </SizableText>
            </YStack>
          </YStack>

          <CodexButton
            label="Continue"
            icon={<Glyph char="→" size={14} color={t.inkInverse} />}
            onPress={onNext}
            testID="profile-continue-btn"
          />

          <YStack alignItems="center" paddingTop="$1">
            <TouchableOpacity onPress={onNext}>
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 11, color: t.inkSubtle, letterSpacing: 1.5, fontWeight: '700' }}>
                SKIP FOR NOW
              </SizableText>
            </TouchableOpacity>
          </YStack>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ═════════════════════════════════════════════════════════════
// Step 4 — Complete
// ═════════════════════════════════════════════════════════════
function CompleteStep({
  onStart, selectedLanguage,
}: {
  onStart: () => void;
  selectedLanguage: Language | null;
}) {
  const { t } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <YStack flex={1} justifyContent="space-between" padding="$6">
      <YStack flex={1} justifyContent="center" alignItems="center" gap="$6">
        {/* Stamped seal */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View
            style={{
              width: 132, height: 132, borderRadius: 66,
              backgroundColor: t.copperSoft,
              justifyContent: 'center', alignItems: 'center',
              borderWidth: 1.5, borderColor: t.copperBorder,
            }}
          >
            <View
              style={{
                width: 92, height: 92, borderRadius: 46,
                backgroundColor: t.copper,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Glyph char="✦" size={38} color={t.inkInverse} />
            </View>
          </View>
        </Animated.View>

        <YStack alignItems="center" gap="$3">
          <XStack alignItems="center" gap="$2">
            <View style={{ width: 14, height: 1, backgroundColor: t.copper }} />
            <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.copper, letterSpacing: 2.5, fontWeight: '700' }}>
              IV · READY
            </SizableText>
            <View style={{ width: 14, height: 1, backgroundColor: t.copper }} />
          </XStack>
          <SizableText
            style={{
              fontFamily: fonts.display,
              fontSize: 38,
              lineHeight: 42,
              color: t.ink,
              fontWeight: '500',
              textAlign: 'center',
              letterSpacing: -1,
              fontStyle: 'italic',
            }}
          >
            Your codex{'\n'}awaits.
          </SizableText>
          <SizableText style={{ fontFamily: fonts.body, fontSize: 14, color: t.inkMuted, textAlign: 'center', lineHeight: 22, maxWidth: 320 }}>
            Open the daily text, meetings, ministry log, and saved library — all from one quiet place.
          </SizableText>
        </YStack>

        {/* Summary cards */}
        <YStack gap="$2" width="100%" maxWidth={360}>
          {selectedLanguage && (
            <XStack
              backgroundColor={t.surface}
              borderRadius="$4"
              padding="$3"
              gap="$3"
              alignItems="center"
              borderWidth={1}
              borderColor={t.border}
            >
              <View
                style={{
                  width: 38, height: 38, borderRadius: 19,
                  backgroundColor: t.copperSoft,
                  borderWidth: 1, borderColor: t.copperBorder,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <SizableText style={{ fontFamily: fonts.mono, fontSize: 11, color: t.copper, fontWeight: '800', letterSpacing: 1 }}>
                  {langBadge(selectedLanguage)}
                </SizableText>
              </View>
              <YStack flex={1}>
                <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkSubtle, letterSpacing: 1.5, fontWeight: '700' }}>
                  STUDY LANGUAGE
                </SizableText>
                <SizableText style={{ fontFamily: fonts.display, fontSize: 16, color: t.ink, fontWeight: '600' }}>
                  {safe(selectedLanguage.name, 'English')}
                </SizableText>
              </YStack>
              <Glyph char="✓" size={14} color={t.moss} />
            </XStack>
          )}
          <XStack
            backgroundColor={t.surface}
            borderRadius="$4"
            padding="$3"
            gap="$3"
            alignItems="center"
            borderWidth={1}
            borderColor={t.border}
          >
            <View
              style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: t.mossSoft,
                borderWidth: 1, borderColor: t.mossBorder,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Glyph char="●" size={12} color={t.moss} />
            </View>
            <YStack flex={1}>
              <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkSubtle, letterSpacing: 1.5, fontWeight: '700' }}>
                PRIVACY
              </SizableText>
              <SizableText style={{ fontFamily: fonts.display, fontSize: 16, color: t.ink, fontWeight: '600' }}>
                Stored on device only
              </SizableText>
            </YStack>
            <Glyph char="✓" size={14} color={t.moss} />
          </XStack>
        </YStack>
      </YStack>

      <CodexButton
        label="Open the Codex"
        icon={<Glyph char="→" size={14} color={t.inkInverse} />}
        onPress={onStart}
        testID="onboarding-finish-btn"
      />
    </YStack>
  );
}

// ═════════════════════════════════════════════════════════════
// Main onboarding screen
// ═════════════════════════════════════════════════════════════
export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const [step, setStep] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [profile, setProfile] = useState<SpiritualProfile>({
    spiritualStatus: '', ageRange: '', maritalStatus: '', studyInterests: '',
  });
  const TOTAL_STEPS = 4;

  const updateProfile = (updates: Partial<SpiritualProfile>) =>
    setProfile((prev) => ({ ...prev, ...updates }));

  const handleComplete = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem('selected_language', JSON.stringify(selectedLanguage)),
        AsyncStorage.setItem('user_profile', JSON.stringify(profile)),
        AsyncStorage.setItem('onboarding_complete', 'true'),
      ]);
    } catch { /* ignore */ }
    router.replace('/(tabs)');
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <WelcomeStep onNext={() => setStep(1)} />;
      case 1: return (
        <LanguageStep
          onNext={() => setStep(2)}
          selectedLanguage={selectedLanguage}
          onSelectLanguage={setSelectedLanguage}
        />
      );
      case 2: return (
        <ProfileStep onNext={() => setStep(3)} profile={profile} onUpdateProfile={updateProfile} />
      );
      case 3: return <CompleteStep onStart={handleComplete} selectedLanguage={selectedLanguage} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} testID="onboarding-screen">
      <CodexBackdrop />
      {/* Header — back / dots / counter */}
      <YStack paddingHorizontal="$6" paddingTop="$2" paddingBottom="$2">
        <XStack alignItems="center" justifyContent="space-between">
          {step > 0 ? (
            <TouchableOpacity
              data-testid="onboarding-back-btn"
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: t.surface,
                borderWidth: 1, borderColor: t.border,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Glyph char="‹" size={22} color={t.ink} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}

          <StepDots current={step} total={TOTAL_STEPS} />

          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderWidth: 1,
              borderColor: t.border,
            }}
          >
            <SizableText style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkMuted, fontWeight: '700', letterSpacing: 1 }}>
              {step + 1} / {TOTAL_STEPS}
            </SizableText>
          </View>
        </XStack>
      </YStack>

      <YStack flex={1}>{renderStep()}</YStack>
    </SafeAreaView>
  );
}
