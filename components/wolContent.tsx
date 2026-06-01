import React from 'react';
import { Text, Platform, Linking } from 'react-native';
import { Image } from 'expo-image';
import { YStack, XStack, SizableText } from '@blinkdotnew/mobile-ui';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import { premiumSpacing, premiumType } from '@/constants/premiumTheme';
import type { WolReference, WolReferenceToken } from '@/services/wolReferenceService';
import { absoluteWolUrl } from '@/services/wolReferenceService';

function asReference(token: WolReferenceToken): WolReference | null {
  if (!token.href || token.kind === 'text' || token.kind === 'image' || token.kind === 'video') return null;
  return {
    text: token.text,
    href: absoluteWolUrl(token.href),
    kind: token.kind as WolReference['kind'],
  };
}

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

function isInlineMarker(token: WolReferenceToken): boolean {
  return (
    (token.kind === 'footnote' || token.kind === 'crossref') &&
    (token.text === '*' || token.text === '+' || token.text.length <= 2)
  );
}

function markerLabel(token: WolReferenceToken): string {
  if (token.text === '+') return '§';
  if (token.text === '*') return '*';
  return token.text;
}

type TokenBlock =
  | { kind: 'inline'; tokens: WolReferenceToken[] }
  | { kind: 'image'; token: WolReferenceToken }
  | { kind: 'video'; token: WolReferenceToken; href: string };

function groupBlocks(tokens: WolReferenceToken[]): TokenBlock[] {
  const blocks: TokenBlock[] = [];
  let inline: WolReferenceToken[] = [];

  const flush = () => {
    if (inline.length) {
      blocks.push({ kind: 'inline', tokens: inline });
      inline = [];
    }
  };

  for (const token of tokens) {
    if (token.kind === 'image') {
      flush();
      blocks.push({ kind: 'image', token });
    } else if (token.kind === 'video') {
      flush();
      blocks.push({ kind: 'video', token, href: token.href ?? '' });
    } else {
      inline.push(token);
    }
  }
  flush();
  return blocks;
}

export function ReferenceChip({
  label,
  onPress,
  variant = 'bible',
}: {
  label: string;
  onPress?: () => void;
  variant?: 'bible' | 'publication' | 'footnote' | 'crossref';
}) {
  const t = usePremiumTheme();
  const bg =
    variant === 'bible'
      ? t.tabActiveBg
      : variant === 'footnote' || variant === 'crossref'
        ? 'rgba(212,168,79,0.12)'
        : 'rgba(31,77,140,0.10)';
  const color = variant === 'bible' ? t.gold : variant === 'footnote' || variant === 'crossref' ? t.gold : t.primary;

  return (
    <XStack
      alignSelf="flex-start"
      backgroundColor={bg}
      borderRadius={999}
      paddingHorizontal={10}
      paddingVertical={4}
      borderWidth={1}
      borderColor={t.border}
      marginVertical={2}
      marginRight={4}
      onPress={onPress}
      pressStyle={{ opacity: 0.75 }}
    >
      <SizableText fontSize={13} fontWeight="700" color={color}>
        {label}
      </SizableText>
    </XStack>
  );
}

export function WolContentTokens({
  tokens,
  onReference,
  fontSize = 16,
  lineHeight = 26,
}: {
  tokens: WolReferenceToken[];
  onReference?: (ref: WolReference) => void;
  fontSize?: number;
  lineHeight?: number;
}) {
  const colors = usePremiumTheme();
  const blocks = groupBlocks(tokens);

  return (
    <YStack gap={premiumSpacing.md} width="100%">
      {blocks.map((block, blockIndex) => {
        if (block.kind === 'image' && block.token.src) {
          return (
            <YStack key={`img-${blockIndex}`} width="100%" borderRadius={12} overflow="hidden">
              <Image
                source={{ uri: block.token.src }}
                style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surface3 }}
                contentFit="contain"
                transition={150}
              />
            </YStack>
          );
        }

        if (block.kind === 'video' && block.href) {
          return (
            <ReferenceChip
              key={`vid-${blockIndex}`}
              label={block.token.text || 'Video'}
              variant="publication"
              onPress={() => Linking.openURL(block.href).catch(() => {})}
            />
          );
        }

        if (block.kind === 'inline') {
          if (Platform.OS === 'web') {
            return (
              <Text
                key={`inline-${blockIndex}`}
                style={{
                  color: colors.text,
                  fontSize,
                  lineHeight,
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                {block.tokens.map((token, index) => {
                  const ref = asReference(token);
                  if (ref && onReference) {
                    const variant =
                      ref.kind === 'bible' ? 'bible' : ref.kind === 'footnote' || ref.kind === 'crossref' ? 'footnote' : 'publication';
                    if (isInlineMarker(token)) {
                      return (
                        <Text
                          key={index}
                          onPress={() => onReference(ref)}
                          style={{
                            color: colors.gold,
                            fontWeight: '700',
                            fontSize: fontSize - 2,
                          }}
                        >
                          {` ${markerLabel(token)} `}
                        </Text>
                      );
                    }
                    return (
                      <Text
                        key={index}
                        onPress={() => onReference(ref)}
                        style={{
                          color: variant === 'bible' ? colors.gold : colors.primary,
                          fontWeight: '700',
                        }}
                      >
                        {` ${cleanText(token.text)} `}
                      </Text>
                    );
                  }
                  if (token.kind === 'text') {
                    return <Text key={index}>{cleanText(token.text)}</Text>;
                  }
                  return null;
                })}
              </Text>
            );
          }

          return (
            <YStack key={`inline-${blockIndex}`} flexDirection="row" flexWrap="wrap" alignItems="flex-start" gap={2}>
              {block.tokens.map((token, index) => {
                const ref = asReference(token);
                if (ref && onReference) {
                  const variant =
                    ref.kind === 'bible' ? 'bible' : ref.kind === 'footnote' || ref.kind === 'crossref' ? 'footnote' : 'publication';
                  if (isInlineMarker(token)) {
                    return (
                      <ReferenceChip
                        key={index}
                        label={markerLabel(token)}
                        variant={variant === 'bible' ? 'bible' : 'footnote'}
                        onPress={() => onReference(ref)}
                      />
                    );
                  }
                  return (
                    <ReferenceChip
                      key={index}
                      label={cleanText(token.text)}
                      variant={variant}
                      onPress={() => onReference(ref)}
                    />
                  );
                }
                if (token.kind === 'text' && token.text.trim()) {
                  return (
                    <SizableText
                      key={index}
                      color={colors.text}
                      fontSize={fontSize}
                      lineHeight={lineHeight}
                      fontWeight="400"
                    >
                      {cleanText(token.text)}
                    </SizableText>
                  );
                }
                return null;
              })}
            </YStack>
          );
        }

        return null;
      })}
    </YStack>
  );
}

export function WolPlainText({ children }: { children: string }) {
  const colors = usePremiumTheme();
  return (
    <SizableText color={colors.text} {...premiumType.body} lineHeight={26}>
      {children}
    </SizableText>
  );
}
