import React, { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  ScrollView,
  Sheet,
  Separator,
  Input,
  SearchBar as BlinkSearchBar,
} from '@blinkdotnew/mobile-ui';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import { premiumRadii, premiumSpacing, premiumType } from '@/constants/premiumTheme';
import { animationValues } from '@/constants/animations';
import type { PremiumTheme } from '@/constants/premiumTheme';
import { WolContentTokens } from '@/components/wolContent';
import type { WolReference, WolReferenceToken } from '@/services/wolReferenceService';

export type { PremiumTheme };

// ─── Screen shell ────────────────────────────────────────────────────────────

export function AppScreen({
  children,
  scroll = false,
  padded = true,
  hero = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  hero?: boolean;
}) {
  const t = usePremiumTheme();
  const content = (
    <YStack
      flex={1}
      width="100%"
      maxWidth="100%"
      alignSelf="center"
      padding={padded ? premiumSpacing.md : undefined}
      gap={padded ? premiumSpacing.lg : undefined}
      paddingBottom={scroll ? 100 : undefined}
    >
      {children}
    </YStack>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, overflow: 'hidden' }} edges={['top', 'left', 'right']}>
      {hero ? (
        <LinearGradient colors={[...t.heroGradient]} style={{ position: 'absolute', inset: 0, height: 320 }} />
      ) : (
        <LinearGradient colors={[t.bg, t.bg2] as [string, string]} style={{ position: 'absolute', inset: 0 }} />
      )}
      <YStack position="absolute" top={-80} right={-60} width={240} height={240} borderRadius={120} backgroundColor={t.glowBlue} opacity={0.35} />
      {scroll ? (
        <ScrollView flex={1} showsVerticalScrollIndicator={false} contentContainerStyle={{ minHeight: '100%' }}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

// ─── Skeleton loaders (no spinners for content) ────────────────────────────────

export function SkeletonBlock({ width = '100%', height = 14 }: { width?: number | string; height?: number }) {
  const t = usePremiumTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.65, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        width: width as number,
        height,
        borderRadius: premiumRadii.sm,
        backgroundColor: t.surface3,
        opacity,
      }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <PremiumCard>
      <SkeletonBlock height={18} width="55%" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} height={12} width={i === lines - 1 ? '70%' : '92%'} />
      ))}
    </PremiumCard>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export function PremiumCard({
  children,
  padded = true,
  glow = false,
  glass = false,
  onPress,
}: {
  children: React.ReactNode;
  padded?: boolean;
  glow?: boolean;
  glass?: boolean;
  onPress?: () => void;
}) {
  const t = usePremiumTheme();
  return (
    <Card
      backgroundColor={glass ? t.glassBg : t.surface}
      borderRadius={premiumRadii.lg}
      padding={padded ? premiumSpacing.md : undefined}
      borderWidth={1}
      borderColor={glow ? t.borderStrong : glass ? t.glassBorder : t.border}
      gap={premiumSpacing.sm}
      onPress={onPress}
      pressStyle={onPress ? { opacity: 0.92, scale: animationValues.scalePressed } : undefined}
      hoverStyle={onPress ? { scale: animationValues.scaleCardHover } : undefined}
      style={Platform.select({ web: { boxShadow: `0 8px 32px ${t.cardShadow}` } as object, default: undefined })}
    >
      {children}
    </Card>
  );
}

export function GlassCard({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <PremiumCard glass onPress={onPress}>
      {children}
    </PremiumCard>
  );
}

// ─── Home greeting (compact) ─────────────────────────────────────────────────

export function HomeGreetingStrip({
  dateLabel,
  title,
  right,
}: {
  dateLabel: string;
  title: string;
  right?: React.ReactNode;
}) {
  const t = usePremiumTheme();
  return (
    <XStack
      width="100%"
      alignItems="center"
      justifyContent="space-between"
      gap={premiumSpacing.md}
      paddingVertical={premiumSpacing.sm}
    >
      <YStack flex={1} gap={2}>
        <SizableText color={t.textMuted} {...premiumType.caption}>
          {dateLabel}
        </SizableText>
        <SizableText color={t.text} fontSize={26} lineHeight={32} fontWeight="700" letterSpacing={-0.6}>
          {title}
        </SizableText>
      </YStack>
      {right}
    </XStack>
  );
}

/** Home daily text — verse + reference only; full text on detail screen */
export function HomeDailyFeatured({
  verse,
  reference,
  loading,
  error,
  onOpenFull,
  onRetry,
  labels,
}: {
  verse?: string;
  reference?: string;
  loading?: boolean;
  error?: boolean;
  onOpenFull?: () => void;
  onRetry?: () => void;
  labels: {
    title: string;
    readFull: string;
    retry: string;
    errorTitle: string;
  };
}) {
  const theme = usePremiumTheme();
  return (
    <YStack
      width="100%"
      borderRadius={premiumRadii.xl}
      overflow="hidden"
      borderWidth={1}
      borderColor={theme.border}
      backgroundColor={theme.surface}
      style={Platform.select({ web: { boxShadow: `0 12px 40px ${theme.cardShadow}` } as object, default: undefined })}
    >
      <LinearGradient colors={[...theme.cardGradient]} style={{ width: '100%' }}>
        <YStack padding={premiumSpacing.lg} gap={premiumSpacing.md}>
          <XStack alignItems="center" justifyContent="space-between">
            <SizableText color={theme.gold} {...premiumType.eyebrow}>
              {labels.title}
            </SizableText>
            <YStack width={32} height={3} borderRadius={2} backgroundColor={theme.gold} />
          </XStack>

          {loading ? (
            <YStack gap={premiumSpacing.sm}>
              <SkeletonBlock height={28} width="88%" />
              <SkeletonBlock height={20} width="42%" />
            </YStack>
          ) : error ? (
            <YStack gap={premiumSpacing.md}>
              <SizableText color={theme.warning} fontWeight="700">
                {labels.errorTitle}
              </SizableText>
              <GradientButton onPress={onRetry}>{labels.retry}</GradientButton>
            </YStack>
          ) : (
            <YStack gap={premiumSpacing.md}>
              {verse ? (
                <SizableText
                  color={theme.text}
                  fontSize={20}
                  lineHeight={30}
                  fontWeight="500"
                  numberOfLines={4}
                >
                  {verse}
                </SizableText>
              ) : null}
              {reference ? (
                <SizableText color={theme.gold} fontSize={17} fontWeight="700" letterSpacing={0.2}>
                  {reference}
                </SizableText>
              ) : null}
              {onOpenFull ? (
                <GradientButton onPress={onOpenFull} variant="gold">
                  {labels.readFull}
                </GradientButton>
              ) : null}
            </YStack>
          )}
        </YStack>
      </LinearGradient>
    </YStack>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

export function HeroBanner({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <YStack borderRadius={premiumRadii.xl} overflow="hidden" width="100%">
      <LinearGradient
        colors={['#07111F', '#10223E', '#1F4D8C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: '100%' }}
      >
        <YStack padding={premiumSpacing.md} gap={premiumSpacing.sm}>
          <YStack position="absolute" top={-40} right={-20} width={180} height={180} borderRadius={90} backgroundColor="rgba(212,168,79,0.12)" />
          <XStack justifyContent="space-between" alignItems="flex-start" gap={premiumSpacing.md}>
            <YStack flex={1} gap={premiumSpacing.sm}>
              {eyebrow ? (
                <SizableText color="rgba(246,231,200,0.75)" {...premiumType.eyebrow}>
                  {eyebrow}
                </SizableText>
              ) : null}
              <SizableText color="#FFFFFF" {...premiumType.hero}>
                {title}
              </SizableText>
              {subtitle ? (
                <SizableText size="$3" color="rgba(255,255,255,0.82)" lineHeight={24} maxWidth="100%">
                  {subtitle}
                </SizableText>
              ) : null}
            </YStack>
            {right}
          </XStack>
        </YStack>
      </LinearGradient>
    </YStack>
  );
}

// ─── Daily scripture ─────────────────────────────────────────────────────────

export function DailyScriptureCard({
  quote,
  reference,
  loading,
  error,
  onRead,
  onRetry,
  labels,
}: {
  /** Verse text (main reading) */
  quote?: string;
  /** Scripture citation e.g. Revelation 19:9 */
  reference?: string;
  loading?: boolean;
  error?: boolean;
  onRead?: () => void;
  onRetry?: () => void;
  labels: {
    title: string;
    readFull: string;
    retry: string;
    errorTitle: string;
    tapToLoad: string;
  };
}) {
  const t = usePremiumTheme();
  const hasContent = Boolean(quote || reference);
  return (
    <YStack borderRadius={premiumRadii.xl} overflow="hidden" width="100%">
      <LinearGradient colors={[...t.cardGradient]} style={{ width: '100%' }}>
        <YStack
          padding={premiumSpacing.lg}
          gap={premiumSpacing.md}
          borderWidth={1}
          borderColor={t.border}
          borderRadius={premiumRadii.xl}
        >
          <YStack height={3} width={48} borderRadius={2} backgroundColor={t.gold} />
          <SizableText color={t.gold} {...premiumType.eyebrow}>
            {labels.title}
          </SizableText>
          {loading ? (
            <YStack gap={premiumSpacing.sm}>
              <SkeletonBlock height={32} width="92%" />
              <SkeletonBlock height={18} width="38%" />
            </YStack>
          ) : error ? (
            <YStack gap={premiumSpacing.md}>
              <SizableText color={t.warning} {...premiumType.small} fontWeight="700">
                {labels.errorTitle}
              </SizableText>
              <GradientButton onPress={onRetry}>{labels.retry}</GradientButton>
            </YStack>
          ) : hasContent ? (
            <YStack gap={premiumSpacing.md}>
              {quote ? (
                <SizableText
                  color={t.text}
                  fontSize={22}
                  lineHeight={32}
                  fontWeight="500"
                  letterSpacing={-0.2}
                >
                  {quote}
                </SizableText>
              ) : null}
              {reference ? (
                <SizableText color={t.gold} {...premiumType.h3} fontWeight="700">
                  {reference}
                </SizableText>
              ) : null}
              {onRead ? (
                <XStack
                  alignItems="center"
                  gap="$2"
                  onPress={onRead}
                  pressStyle={{ opacity: 0.75 }}
                  marginTop={8}
                  paddingVertical={8}
                >
                  <SizableText color={t.primary} {...premiumType.small} fontWeight="700">
                    {labels.readFull}
                  </SizableText>
                  <SizableText color={t.primary}>→</SizableText>
                </XStack>
              ) : null}
            </YStack>
          ) : (
            <EmptyState title={labels.tapToLoad} action={onRetry ? <GradientButton onPress={onRetry}>{labels.retry}</GradientButton> : undefined} />
          )}
        </YStack>
      </LinearGradient>
    </YStack>
  );
}

/** Home AI entry — submits to search tab with query + AI mode */
export function HomeAiAsk({
  title,
  hint,
  value,
  onChangeText,
  onSubmit,
  placeholder,
  buttonLabel,
}: {
  title: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  buttonLabel: string;
}) {
  const t = usePremiumTheme();
  return (
    <PremiumCard glass>
      <YStack gap={premiumSpacing.md} width="100%">
        <YStack gap={4}>
          <XStack alignItems="center" gap={premiumSpacing.sm}>
            <YStack width={36} height={36} borderRadius={18} backgroundColor="rgba(212,168,79,0.16)" alignItems="center" justifyContent="center">
              <SizableText fontSize={18}>✦</SizableText>
            </YStack>
            <SizableText color={t.text} {...premiumType.h3}>
              {title}
            </SizableText>
          </XStack>
          {hint ? (
            <SizableText color={t.textMuted} {...premiumType.small}>
              {hint}
            </SizableText>
          ) : null}
        </YStack>
        <SearchBar large value={value} onChangeText={onChangeText} placeholder={placeholder} onSubmitEditing={onSubmit} />
        <GradientButton onPress={onSubmit} disabled={!value.trim()} variant="gold">
          {buttonLabel}
        </GradientButton>
      </YStack>
    </PremiumCard>
  );
}

/** Single tappable row — avoids duplicate cards to the same screen */
export function NavTeaserRow({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const t = usePremiumTheme();
  return (
    <PremiumCard onPress={onPress}>
      <XStack alignItems="center" gap={premiumSpacing.md}>
        <YStack width={48} height={48} borderRadius={24} backgroundColor={t.tabActiveBg} alignItems="center" justifyContent="center">
          {icon}
        </YStack>
        <YStack flex={1} gap={4}>
          <SizableText color={t.text} {...premiumType.h3}>
            {title}
          </SizableText>
          {subtitle ? (
            <SizableText color={t.textMuted} {...premiumType.small} numberOfLines={1}>
              {subtitle}
            </SizableText>
          ) : null}
        </YStack>
        <SizableText color={t.textMuted} fontSize={20}>
          →
        </SizableText>
      </XStack>
    </PremiumCard>
  );
}

// ─── Quick actions ─────────────────────────────────────────────────────────────

export function QuickActionTile({
  title,
  icon,
  onPress,
  accent = 'royal',
}: {
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
  accent?: 'royal' | 'gold' | 'neutral';
}) {
  const t = usePremiumTheme();
  const bg = accent === 'gold' ? 'rgba(212,168,79,0.12)' : accent === 'royal' ? t.tabActiveBg : t.surface2;
  const border = accent === 'gold' ? 'rgba(212,168,79,0.28)' : t.border;
  return (
    <Card
      flex={1}
      minWidth="46%"
      maxWidth="100%"
      backgroundColor={t.surface}
      borderRadius={premiumRadii.lg}
      borderWidth={1}
      borderColor={border}
      padding={premiumSpacing.md}
      gap={premiumSpacing.sm}
      onPress={onPress}
      pressStyle={{ scale: animationValues.scalePressed, opacity: 0.94 }}
      hoverStyle={{ scale: animationValues.scaleCardHover }}
    >
      <YStack width={44} height={44} borderRadius={22} backgroundColor={bg} alignItems="center" justifyContent="center">
        {icon}
      </YStack>
      <SizableText color={t.text} {...premiumType.small} fontWeight="700">
        {title}
      </SizableText>
    </Card>
  );
}

export function QuickActionGrid({ children }: { children: React.ReactNode }) {
  return (
    <XStack flexWrap="wrap" gap={premiumSpacing.sm} width="100%">
      {children}
    </XStack>
  );
}

// ─── Chips & suggestions ───────────────────────────────────────────────────────

export function SuggestionChip({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  const t = usePremiumTheme();
  return (
    <YStack
      paddingHorizontal={premiumSpacing.md}
      paddingVertical={premiumSpacing.sm}
      borderRadius={premiumRadii.pill}
      backgroundColor={active ? t.tabActiveBg : t.surface}
      borderWidth={1}
      borderColor={active ? t.primary : t.border}
      onPress={onPress}
      pressStyle={{ scale: animationValues.scalePressed }}
    >
      <SizableText color={active ? t.primary : t.textMuted} fontSize={14} fontWeight="600">
        {label}
      </SizableText>
    </YStack>
  );
}

// ─── Headers ─────────────────────────────────────────────────────────────────

export function AppHeader({ title, subtitle, right, eyebrow }: { title: string; subtitle?: string; right?: React.ReactNode; eyebrow?: string }) {
  const t = usePremiumTheme();
  return (
    <XStack alignItems="flex-start" justifyContent="space-between" gap={premiumSpacing.md} width="100%">
      <YStack flex={1} gap={premiumSpacing.xs}>
        {eyebrow ? (
          <SizableText color={t.gold} {...premiumType.eyebrow}>
            {eyebrow}
          </SizableText>
        ) : null}
        <SizableText color={t.text} {...premiumType.h1}>
          {title}
        </SizableText>
        {subtitle ? (
          <SizableText color={t.textMuted} {...premiumType.body}>
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
      {right}
    </XStack>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const t = usePremiumTheme();
  return (
    <XStack alignItems="flex-end" justifyContent="space-between" gap={premiumSpacing.sm} width="100%">
      <YStack flex={1} gap={4}>
        <SizableText color={t.text} {...premiumType.h3}>
          {title}
        </SizableText>
        {subtitle ? (
          <SizableText color={t.textMuted} {...premiumType.small}>
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
      {action}
    </XStack>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

export function GradientButton({
  children,
  onPress,
  disabled,
  icon,
  variant = 'gold',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: 'gold' | 'royal';
}) {
  const t = usePremiumTheme();
  const colors = variant === 'royal' ? [...t.accentGradient] : [...t.goldAccentGradient];
  const labelColor = variant === 'royal' ? '#FFFFFF' : t.mode === 'dark' ? brandMidnight : '#FFFFFF';
  return (
    <YStack borderRadius={premiumRadii.md} overflow="hidden" opacity={disabled ? 0.5 : 1} width="100%">
      <LinearGradient colors={colors as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Button
          size="$4"
          minHeight={50}
          borderRadius={premiumRadii.md}
          color={labelColor}
          backgroundColor="transparent"
          disabled={disabled}
          onPress={onPress}
          icon={icon as React.ReactElement}
          pressStyle={{ opacity: 0.88, scale: animationValues.scalePressed }}
        >
          {children}
        </Button>
      </LinearGradient>
    </YStack>
  );
}

const brandMidnight = '#07111F';

export function GhostButton({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  const t = usePremiumTheme();
  return (
    <Button
      size="$4"
      minHeight={48}
      borderRadius={premiumRadii.md}
      backgroundColor={t.surface2}
      borderWidth={1}
      borderColor={t.border}
      color={t.text}
      onPress={onPress}
      pressStyle={{ scale: animationValues.scalePressed, opacity: 0.9 }}
    >
      {children}
    </Button>
  );
}

// ─── Search ──────────────────────────────────────────────────────────────────

export function PremiumSearchBar(props: React.ComponentProps<typeof BlinkSearchBar>) {
  const t = usePremiumTheme();
  return (
    <YStack
      backgroundColor={t.surface}
      borderColor={t.borderStrong}
      borderWidth={1}
      borderRadius={premiumRadii.lg}
      overflow="hidden"
      minHeight={52}
      width="100%"
    >
      <BlinkSearchBar {...props} />
    </YStack>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  large,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmitEditing?: () => void;
  large?: boolean;
}) {
  const t = usePremiumTheme();
  return (
    <XStack
      alignItems="center"
      gap={premiumSpacing.sm}
      backgroundColor={t.surface}
      borderColor={t.borderStrong}
      borderWidth={1}
      borderRadius={premiumRadii.lg}
      paddingHorizontal={premiumSpacing.md}
      minHeight={large ? 56 : 52}
      width="100%"
    >
      <SizableText color={t.textMuted} fontSize={18}>
        ⌕
      </SizableText>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        color={t.text}
        backgroundColor="transparent"
        borderWidth={0}
        flex={1}
        size="$4"
        fontSize={large ? 17 : 16}
        focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
      />
    </XStack>
  );
}

// ─── States ──────────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const t = usePremiumTheme();
  return (
    <YStack alignItems="flex-start" justifyContent="center" gap={premiumSpacing.md} padding={premiumSpacing.lg} width="100%">
      {icon ? (
        <YStack
          width={72}
          height={72}
          borderRadius={36}
          backgroundColor={t.tabActiveBg}
          alignItems="center"
          justifyContent="center"
          borderWidth={1}
          borderColor={t.border}
        >
          {icon}
        </YStack>
      ) : null}
      <YStack gap={premiumSpacing.xs} alignItems="flex-start">
        <SizableText color={t.text} {...premiumType.h3}>
          {title}
        </SizableText>
        {subtitle ? (
          <SizableText color={t.textMuted} {...premiumType.body} maxWidth="100%">
            {subtitle}
          </SizableText>
        ) : null}
      </YStack>
      {action}
    </YStack>
  );
}

export function LoadingState({ label }: { label: string }) {
  const t = usePremiumTheme();
  return (
    <PremiumCard>
      <YStack gap={premiumSpacing.sm}>
        <SizableText color={t.textMuted} {...premiumType.small}>
          {label}
        </SizableText>
        <SkeletonBlock height={14} />
        <SkeletonBlock height={14} width="80%" />
      </YStack>
    </PremiumCard>
  );
}

// ─── Meeting / progress cards ────────────────────────────────────────────────

export function MeetingCard({
  title,
  subtitle,
  progress,
  icon,
  onPress,
  actionLabel,
}: {
  title: string;
  subtitle?: string;
  progress?: number;
  icon?: React.ReactNode;
  onPress?: () => void;
  actionLabel?: string;
}) {
  const t = usePremiumTheme();
  const pct = Math.min(100, Math.max(0, progress ?? 0));
  return (
    <PremiumCard onPress={onPress} glow={Boolean(onPress)}>
      <XStack gap={premiumSpacing.md} alignItems="flex-start">
        {icon ? (
          <YStack width={48} height={48} borderRadius={24} backgroundColor={t.tabActiveBg} alignItems="center" justifyContent="center">
            {icon}
          </YStack>
        ) : null}
        <YStack flex={1} gap={premiumSpacing.xs}>
          <SizableText color={t.text} {...premiumType.h3}>
            {title}
          </SizableText>
          {subtitle ? (
            <SizableText color={t.textMuted} {...premiumType.small}>
              {subtitle}
            </SizableText>
          ) : null}
          {typeof progress === 'number' ? (
            <YStack gap={6} marginTop={premiumSpacing.xs}>
              <YStack height={4} borderRadius={2} backgroundColor={t.surface3} overflow="hidden" width="100%">
                <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.gold, borderRadius: 2 }} />
              </YStack>
              <SizableText color={t.textMuted} {...premiumType.caption}>
                {pct}%
              </SizableText>
            </YStack>
          ) : null}
          {actionLabel ? (
            <SizableText color={t.primary} fontWeight="700" marginTop={4}>
              {actionLabel} →
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    </PremiumCard>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function SettingsRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const t = usePremiumTheme();
  return (
    <YStack width="100%">
      <XStack
        padding={premiumSpacing.md}
        alignItems="center"
        gap={premiumSpacing.md}
        onPress={onPress}
        pressStyle={{ opacity: 0.72 }}
        accessibilityRole="button"
      >
        <YStack
          width={40}
          height={40}
          borderRadius={20}
          backgroundColor={danger ? 'rgba(214,69,69,0.12)' : t.tabActiveBg}
          alignItems="center"
          justifyContent="center"
        >
          {icon}
        </YStack>
        <SizableText size="$4" color={danger ? t.danger : t.text} fontWeight="600" flex={1}>
          {label}
        </SizableText>
        {value ? (
          <SizableText size="$3" color={t.textMuted}>
            {value}
          </SizableText>
        ) : null}
      </XStack>
      <Separator borderColor={t.border} marginLeft={56} />
    </YStack>
  );
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const t = usePremiumTheme();
  return (
    <YStack gap={premiumSpacing.sm} width="100%">
      <SizableText color={t.textMuted} {...premiumType.eyebrow} paddingHorizontal={4}>
        {title}
      </SizableText>
      <PremiumCard padded={false}>
        {children}
      </PremiumCard>
    </YStack>
  );
}

export function ThemeToggle({
  value,
  onChange,
  labels,
}: {
  value: 'dark' | 'light' | 'system';
  onChange: (v: 'dark' | 'light' | 'system') => void;
  labels: { dark: string; light: string; system: string };
}) {
  const t = usePremiumTheme();
  const options: Array<{ key: 'dark' | 'light' | 'system'; label: string }> = [
    { key: 'dark', label: labels.dark },
    { key: 'light', label: labels.light },
    { key: 'system', label: labels.system },
  ];
  return (
    <XStack gap={premiumSpacing.sm} width="100%">
      {options.map((item) => {
        const active = value === item.key;
        return (
          <YStack
            key={item.key}
            flex={1}
            borderRadius={premiumRadii.md}
            padding={premiumSpacing.md}
            alignItems="center"
            backgroundColor={active ? t.tabActiveBg : t.surface2}
            borderWidth={1}
            borderColor={active ? t.primary : t.border}
            onPress={() => onChange(item.key)}
            pressStyle={{ opacity: 0.85, scale: animationValues.scalePressed }}
          >
            <SizableText size="$3" color={active ? t.primary : t.textMuted} fontWeight="700">
              {item.label}
            </SizableText>
          </YStack>
        );
      })}
    </XStack>
  );
}

// ─── Content cards ───────────────────────────────────────────────────────────

export function ContentCard({
  title,
  subtitle,
  children,
  icon,
  action,
  onPress,
}: {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  onPress?: () => void;
}) {
  const t = usePremiumTheme();
  return (
    <PremiumCard glow={Boolean(onPress)} onPress={onPress}>
      {(title || subtitle || icon || action) && (
        <XStack gap={premiumSpacing.md} alignItems="flex-start">
          {icon ? (
            <YStack width={44} height={44} borderRadius={22} backgroundColor={t.tabActiveBg} alignItems="center" justifyContent="center">
              {icon}
            </YStack>
          ) : null}
          <YStack flex={1} gap={4}>
            {title ? (
              <SizableText color={t.text} {...premiumType.h3}>
                {title}
              </SizableText>
            ) : null}
            {subtitle ? (
              <SizableText color={t.textMuted} {...premiumType.small}>
                {subtitle}
              </SizableText>
            ) : null}
          </YStack>
          {action}
        </XStack>
      )}
      {children}
    </PremiumCard>
  );
}

export function PremiumBadge({
  children,
  tone = 'primary',
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'accent' | 'gold' | 'danger' | 'muted';
}) {
  const t = usePremiumTheme();
  const color =
    tone === 'accent' ? t.accent : tone === 'gold' ? t.gold : tone === 'danger' ? t.danger : tone === 'muted' ? t.textMuted : t.primary;
  const bg =
    tone === 'gold' ? 'rgba(212,168,79,0.14)' : tone === 'danger' ? 'rgba(214,69,69,0.12)' : t.tabActiveBg;
  return (
    <YStack paddingHorizontal={12} paddingVertical={6} borderRadius={premiumRadii.pill} backgroundColor={bg} borderWidth={1} borderColor={t.border}>
      <SizableText size="$1" color={color} fontWeight="700" letterSpacing={0.5}>
        {children}
      </SizableText>
    </YStack>
  );
}

export function ReferenceLink({
  children,
  onPress,
  kind = 'bible',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  kind?: 'bible' | 'publication' | 'crossref' | 'footnote';
}) {
  const t = usePremiumTheme();
  const color = kind === 'bible' || kind === 'crossref' ? t.gold : t.primary;
  return (
    <SizableText
      size="$3"
      color={color}
      lineHeight={24}
      fontWeight="700"
      textDecorationLine="underline"
      onPress={onPress}
      pressStyle={{ opacity: 0.68 }}
    >
      {children}
    </SizableText>
  );
}

export function PreviewModal({
  open,
  onClose,
  title,
  label,
  loading,
  loadingLabel,
  children,
  previewTokens,
  onReference,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  label?: string;
  loading?: boolean;
  loadingLabel?: string;
  children?: React.ReactNode;
  previewTokens?: WolReferenceToken[];
  onReference?: (ref: WolReference) => void;
}) {
  const t = usePremiumTheme();
  return (
    <Sheet open={open} onOpenChange={(v: boolean) => { if (!v) onClose(); }} snapPoints={[82]} modal dismissOnSnapToBottom animation="quick">
      <Sheet.Overlay backgroundColor={t.mode === 'dark' ? 'rgba(7,17,31,0.55)' : 'rgba(8,17,32,0.2)'} />
      <Sheet.Frame backgroundColor="transparent" borderTopLeftRadius={premiumRadii.xl} borderTopRightRadius={premiumRadii.xl} overflow="hidden">
        <BlurView intensity={Platform.OS === 'web' ? 24 : 40} tint={t.mode === 'dark' ? 'dark' : 'light'} style={{ flex: 1 }}>
          <YStack
            flex={1}
            backgroundColor={t.glassBg}
            borderTopWidth={1}
            borderColor={t.glassBorder}
          >
            <Sheet.Handle backgroundColor={t.borderStrong} />
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              <YStack padding={premiumSpacing.lg} gap={premiumSpacing.md}>
                <XStack justifyContent="space-between" alignItems="flex-start" gap={premiumSpacing.md}>
                  <YStack flex={1} gap={premiumSpacing.sm}>
                    {label ? (
                      <SizableText color={t.gold} {...premiumType.eyebrow}>
                        {label}
                      </SizableText>
                    ) : null}
                    {title ? (
                      <SizableText color={t.text} {...premiumType.h2}>
                        {title}
                      </SizableText>
                    ) : null}
                  </YStack>
                  <Button circular size="$3" backgroundColor={t.surface2} color={t.textMuted} onPress={onClose}>
                    ×
                  </Button>
                </XStack>
                {loading ? (
                  <LoadingState label={loadingLabel ?? '…'} />
                ) : previewTokens?.length && onReference ? (
                  <WolContentTokens tokens={previewTokens} onReference={onReference} fontSize={17} lineHeight={28} />
                ) : children ? (
                  <YStack gap={premiumSpacing.sm} width="100%">
                    {children}
                  </YStack>
                ) : null}
              </YStack>
            </ScrollView>
          </YStack>
        </BlurView>
      </Sheet.Frame>
    </Sheet>
  );
}
