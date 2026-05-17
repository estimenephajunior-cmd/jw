// ============================================================
// JW Study Assistant — Watchtower Study Screen
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, FlatList } from 'react-native';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  ScrollView,
  BlinkToggleGroup,
  Sheet,
  Spinner,
  Separator,
  toast,
  ChevronLeft,
  BookOpen,
  Zap,
  Play,
  Pause,
  Copy,
  Bookmark,
  CheckCircle,
  AlignLeft,
  Volume2,
} from '@blinkdotnew/mobile-ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { generateWatchtowerAnswer } from '@/services/aiRetrievalService';
import { getPublicationContent, getMediaLinks } from '@/services/jwApiService';
import { saveSource } from '@/services/storageService';
import type { GeneratedAnswer } from '@/types';

// ── Types ─────────────────────────────────────────────────────
type AnswerLength = 'short' | 'medium' | 'long';
type AnswerTone = 'natural' | 'heartfelt' | 'scriptural';

interface BibleRef {
  text: string;       // e.g. "Mat. 5:3"
  href: string;       // absolute WOL URL
}
interface ParsedParagraph {
  id: string;
  number: number;
  text: string;
  dataPid?: string;
  questions: string[];
  bibleRefs: BibleRef[];
}

interface AudioState {
  isLoaded: boolean;
  isPlaying: boolean;
  duration: number;
  position: number;
  url: string | null;
}

const LENGTH_OPTIONS = [
  { label: '30 sec', value: 'short' },
  { label: '1 min', value: 'medium' },
  { label: '2 min', value: 'long' },
];

const TONE_OPTIONS = [
  { label: 'Natural', value: 'natural' },
  { label: 'Heartfelt', value: 'heartfelt' },
  { label: 'Scriptural', value: 'scriptural' },
];

// ── HTML parsing helpers ──────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseParagraphs(html: string, langSymbol: string = 'en'): ParsedParagraph[] {
  if (!html) return [];

  const BASE = 'https://wol.jw.org';

  // ── 1. Index all questions by their data-pid ────────────────
  // Question pattern:  <p ... class="...qu..." ... data-pid="X" ...>...</p>
  const questionsByPid = new Map<string, string>();
  const qRegex = /<p\b([^>]*\bclass="[^"]*\bqu\b[^"]*"[^>]*)>([\s\S]*?)<\/p>/gi;
  let qm: RegExpExecArray | null;
  while ((qm = qRegex.exec(html)) !== null) {
    const attrs = qm[1] ?? '';
    const pidMatch = /data-pid="(\d+)"/.exec(attrs);
    if (!pidMatch) continue;
    const text = stripHtml(qm[2] ?? '').replace(/^\d+\.\s*/, '').trim();
    if (text.length < 8) continue;
    questionsByPid.set(pidMatch[1], text);
  }

  // ── 2. Real study paragraphs: have data-rel-pid="[N]" ───────
  // Pattern: <p id="pX" data-pid="X" data-rel-pid="[Y]">…<span class="parNum" data-pnum="N">…
  const paragraphs: ParsedParagraph[] = [];
  const pRegex = /<p\b([^>]*\bdata-rel-pid="\[(\d+)\][^"]*"[^>]*)>([\s\S]*?)<\/p>/gi;
  let pm: RegExpExecArray | null;
  let fallbackNum = 0;
  while ((pm = pRegex.exec(html)) !== null) {
    const attrs = pm[1] ?? '';
    const relPid = pm[2] ?? '';
    let raw = pm[3] ?? '';

    // skip questions/comments accidentally caught
    if (/\bclass="[^"]*\bqu\b[^"]*"/.test(attrs)) continue;

    // visible paragraph number from <span class="parNum" data-pnum="N">
    const pnumMatch = /<span[^>]*class="[^"]*parNum[^"]*"[^>]*data-pnum="(\d+)"/i.exec(raw)
      ?? /data-pnum="(\d+)"/i.exec(raw);
    const visibleNum = pnumMatch ? parseInt(pnumMatch[1], 10) : ++fallbackNum;

    // remove the <span class="parNum">…</span> (the leading number markup) so we
    // don't render it twice next to the badge.
    raw = raw.replace(/<span[^>]*class="[^"]*parNum[^"]*"[^>]*>[\s\S]*?<\/span>/i, '');

    // extract bible refs (<a class="b" href="...">verse</a>) BEFORE stripping html
    const bibleRefs: BibleRef[] = [];
    const aRegex = /<a\b([^>]*\bclass="[^"]*\bb\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = aRegex.exec(raw)) !== null) {
      const hrefMatch = /href="([^"]+)"/.exec(am[1] ?? '');
      const text = stripHtml(am[2] ?? '').trim();
      if (!hrefMatch || !text) continue;
      const href = hrefMatch[1].startsWith('http')
        ? hrefMatch[1]
        : `${BASE}${hrefMatch[1]}`;
      bibleRefs.push({ text, href });
    }

    const text = stripHtml(raw);
    if (text.length < 30) continue;

    const pidMatch = /data-pid="(\d+)"/.exec(attrs);
    const paragraphPid = pidMatch ? pidMatch[1] : `rel${relPid}`;

    paragraphs.push({
      id: `p-${paragraphPid}`,
      number: visibleNum,
      text,
      dataPid: paragraphPid,
      questions: questionsByPid.get(relPid) ? [questionsByPid.get(relPid)!] : [],
      bibleRefs,
    });
  }

  // Sort by visible number to keep article order
  paragraphs.sort((a, b) => a.number - b.number);

  return paragraphs;
}

// (questions are now extracted inside parseParagraphs and paired via data-rel-pid)

// ── Audio player (native only via expo-av) ────────────────────
interface AudioPlayerProps {
  audioUrl: string | null;
  isLoaded: boolean;
  isPlaying: boolean;
  onToggle: () => void;
}
function AudioPlayer({ audioUrl, isLoaded, isPlaying, onToggle }: AudioPlayerProps) {
  if (!audioUrl) return null;

  return (
    <XStack
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      padding="$3"
      borderWidth={1}
      borderColor="#3A3A3C"
      alignItems="center"
      gap="$3"
    >
      <YStack
        width={40}
        height={40}
        borderRadius={20}
        backgroundColor="rgba(91,126,107,0.15)"
        justifyContent="center"
        alignItems="center"
        borderWidth={1}
        borderColor="rgba(91,126,107,0.3)"
      >
        <Volume2 size={18} color="#5B7E6B" />
      </YStack>
      <YStack flex={1} gap="$1">
        <SizableText size="$3" color="#F2F2F7" fontWeight="600">Article Audio</SizableText>
        <SizableText size="$2" color="#6B7280">
          {isLoaded ? 'Ready to play' : 'Loading…'}
        </SizableText>
      </YStack>
      <Button
        size="$3"
        backgroundColor={isPlaying ? 'rgba(239,68,68,0.1)' : 'rgba(91,126,107,0.15)'}
        borderColor={isPlaying ? 'rgba(239,68,68,0.3)' : 'rgba(91,126,107,0.3)'}
        borderWidth={1}
        color={isPlaying ? '#EF4444' : '#5B7E6B'}
        onPress={onToggle}
        disabled={!isLoaded}
        icon={isPlaying ? <Pause size={16} color="#EF4444" /> : <Play size={16} color="#5B7E6B" />}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
    </XStack>
  );
}

// ── Paragraph card ────────────────────────────────────────────
interface ParagraphCardProps {
  para: ParsedParagraph;
  articleTitle: string;
  onPrepare: (para: ParsedParagraph, question: string) => void;
  onPreviewVerse: (ref: BibleRef) => void;
}
function ParagraphCard({ para, articleTitle, onPrepare, onPreviewVerse }: ParagraphCardProps) {
  return (
    <Card
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="#3A3A3C"
      gap="$3"
    >
      {/* Question above paragraph (matches WOL layout) */}
      {para.questions.length > 0 && (
        <XStack gap="$2" alignItems="flex-start">
          <AlignLeft size={14} color="#C4A840" style={{ marginTop: 3 }} />
          <SizableText size="$3" color="#E5D9A8" flex={1} lineHeight={20} fontStyle="italic">
            {para.number}. {para.questions[0]}
          </SizableText>
        </XStack>
      )}

      {/* Paragraph number + text */}
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          width={28}
          height={28}
          borderRadius={14}
          backgroundColor="rgba(91,126,107,0.2)"
          justifyContent="center"
          alignItems="center"
          flexShrink={0}
          marginTop={2}
        >
          <SizableText size="$2" color="#5B7E6B" fontWeight="700">{para.number}</SizableText>
        </YStack>
        <SizableText size="$3" color="#D1D5DB" flex={1} lineHeight={22}>
          {para.text}
        </SizableText>
      </XStack>

      {/* Bible verse chips */}
      {para.bibleRefs.length > 0 && (
        <YStack gap="$2">
          <Separator borderColor="#3A3A3C" />
          <XStack gap="$2" flexWrap="wrap">
            {para.bibleRefs.map((ref, i) => (
              <Button
                key={`${ref.text}-${i}`}
                size="$2"
                backgroundColor="rgba(91,126,107,0.10)"
                borderColor="rgba(91,126,107,0.35)"
                borderWidth={1}
                color="#7DA88E"
                onPress={() => onPreviewVerse(ref)}
                icon={<BookOpen size={11} color="#7DA88E" />}
              >
                {ref.text}
              </Button>
            ))}
          </XStack>
        </YStack>
      )}

      {/* Prepare answer button */}
      <Button
        size="$2"
        backgroundColor="rgba(91,126,107,0.1)"
        borderColor="rgba(91,126,107,0.25)"
        borderWidth={1}
        color="#5B7E6B"
        alignSelf="flex-start"
        icon={<Zap size={12} color="#5B7E6B" />}
        onPress={() =>
          onPrepare(
            para,
            para.questions[0] ?? `What stood out to you in paragraph ${para.number}?`,
          )
        }
      >
        {para.questions.length > 0 ? 'Prepare Answer' : 'Prepare Comment'}
      </Button>
    </Card>
  );
}

// ── Bible verse preview sheet ─────────────────────────────────
interface VerseSheetProps {
  open: boolean;
  verse: BibleRef | null;
  onClose: () => void;
}
function VerseSheet({ open, verse, onClose }: VerseSheetProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !verse) return;
    setText(''); setErr(''); setLoading(true);
    (async () => {
      try {
        // WOL Bible Citation endpoint returns a small fragment with the verse text.
        const res = await fetch(verse.href, { headers: { Accept: 'text/html' } });
        if (!res.ok) throw new Error('http ' + res.status);
        const html = await res.text();
        // Pull the verse content out of the popup body
        const bodyMatch =
          /<div[^>]*class="[^"]*(?:popupBody|cnt|bibleSrc)[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html)
          ?? /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
        let raw = bodyMatch ? bodyMatch[1] : html;
        // strip footnote markers
        raw = raw
          .replace(/<sup[^>]*class="[^"]*(?:fn|fnref)[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
          .replace(/<a[^>]*class="[^"]*fn[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');
        const clean = raw
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<sup[^>]*>(\d+)<\/sup>/gi, ' $1 ')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&[a-z]+;/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (!clean) throw new Error('empty');
        setText(clean.slice(0, 2400));
      } catch (e: any) {
        setErr('Could not load verse. Open on WOL instead.');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, verse]);

  if (!verse) return null;
  return (
    <Sheet
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      snapPoints={[70]}
      modal
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame backgroundColor="#1C1C1E" borderTopLeftRadius="$6" borderTopRightRadius="$6">
        <Sheet.Handle backgroundColor="#3A3A3C" />
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack padding="$4" gap="$3" paddingBottom="$10">
            <XStack alignItems="center" gap="$2">
              <BookOpen size={16} color="#7DA88E" />
              <SizableText size="$2" color="#7DA88E" fontWeight="700" letterSpacing={1.5}>
                BIBLE VERSE
              </SizableText>
            </XStack>
            <SizableText size="$6" color="#F2F2F7" fontWeight="800" style={{ fontFamily: 'Georgia, serif' }}>
              {verse.text}
            </SizableText>
            {loading ? (
              <YStack paddingVertical="$4" alignItems="center">
                <Spinner size="small" color="#7DA88E" />
              </YStack>
            ) : err ? (
              <YStack gap="$2">
                <SizableText size="$3" color="#F59E0B">{err}</SizableText>
                <Button
                  size="$3"
                  backgroundColor="rgba(220,159,98,0.15)"
                  borderColor="rgba(220,159,98,0.35)"
                  borderWidth={1}
                  color="#DC9F62"
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      window.open(verse.href, '_blank');
                    } else {
                      import('react-native').then(({ Linking }) => Linking.openURL(verse.href));
                    }
                  }}
                >
                  Open on WOL
                </Button>
              </YStack>
            ) : (
              <SizableText size="$4" color="#E5E7EB" lineHeight={26} style={{ fontFamily: 'Georgia, serif' }}>
                {text}
              </SizableText>
            )}
          </YStack>
        </ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

// ── Answer sheet ──────────────────────────────────────────────
interface AnswerSheetProps {
  open: boolean;
  onClose: () => void;
  paragraph: ParsedParagraph | null;
  question: string;
  articleTitle: string;
  onSave: (answer: GeneratedAnswer, para: ParsedParagraph) => Promise<void>;
}
function AnswerSheet({ open, onClose, paragraph, question, articleTitle, onSave }: AnswerSheetProps) {
  const [length, setLength] = useState<AnswerLength>('medium');
  const [tone, setTone] = useState<AnswerTone>('natural');
  const [answer, setAnswer] = useState<GeneratedAnswer | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) { setAnswer(null); setSaved(false); }
  }, [open]);

  const generate = async () => {
    if (!paragraph) return;
    setIsGenerating(true);
    setSaved(false);
    try {
      const result = await generateWatchtowerAnswer(
        paragraph.text,
        question || `What is the main point of paragraph ${paragraph.number}?`,
        articleTitle,
        [],
        length,
        tone,
      );
      setAnswer(result);
    } catch {
      toast('Generation failed', { message: 'Check your connection and try again.', variant: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!answer) return;
    if (Platform.OS !== 'web') {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(answer.content);
    } else {
      try { await navigator.clipboard.writeText(answer.content); } catch { /* ignore */ }
    }
    toast('Copied', { variant: 'success' });
  };

  const handleSave = async () => {
    if (!answer || !paragraph) return;
    setIsSaving(true);
    try {
      await onSave(answer, paragraph);
      setSaved(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      snapPoints={[90]}
      modal
      dismissOnSnapToBottom
    >
      <Sheet.Overlay />
      <Sheet.Frame backgroundColor="#1C1C1E" borderTopLeftRadius="$6" borderTopRightRadius="$6">
        <Sheet.Handle backgroundColor="#3A3A3C" />
        <ScrollView flex={1} showsVerticalScrollIndicator={false}>
          <YStack padding="$4" gap="$4" paddingBottom="$10">
            <SizableText size="$5" color="#F2F2F7" fontWeight="700">
              Prepare Answer
            </SizableText>

            {/* Question preview */}
            {question ? (
              <XStack
                backgroundColor="#2C2C2E"
                borderRadius="$3"
                padding="$3"
                gap="$2"
                borderWidth={1}
                borderColor="#3A3A3C"
              >
                <AlignLeft size={14} color="#7B6B9E" />
                <SizableText size="$3" color="#9CA3AF" flex={1} lineHeight={20}>{question}</SizableText>
              </XStack>
            ) : null}

            {/* Paragraph preview */}
            {paragraph && (
              <YStack
                backgroundColor="#2C2C2E"
                borderRadius="$3"
                padding="$3"
                borderWidth={1}
                borderColor="#3A3A3C"
              >
                <SizableText size="$2" color="#6B7280" marginBottom="$1">¶ {paragraph.number}</SizableText>
                <SizableText size="$3" color="#D1D5DB" lineHeight={20} numberOfLines={4}>
                  {paragraph.text}
                </SizableText>
              </YStack>
            )}

            {/* Length */}
            <YStack gap="$2">
              <SizableText size="$3" color="#9CA3AF" fontWeight="600">Length</SizableText>
              <BlinkToggleGroup
                options={LENGTH_OPTIONS}
                value={length}
                onValueChange={(v) => setLength(v as AnswerLength)}
              />
            </YStack>

            {/* Tone */}
            <YStack gap="$2">
              <SizableText size="$3" color="#9CA3AF" fontWeight="600">Tone</SizableText>
              <BlinkToggleGroup
                options={TONE_OPTIONS}
                value={tone}
                onValueChange={(v) => setTone(v as AnswerTone)}
              />
            </YStack>

            <Button
              backgroundColor="#5B7E6B"
              color="white"
              fontWeight="700"
              size="$4"
              onPress={generate}
              disabled={isGenerating}
              icon={isGenerating ? <Spinner size="small" color="white" /> : <Zap size={16} color="white" />}
            >
              {isGenerating ? 'Generating…' : 'Generate Answer'}
            </Button>

            {/* Generated answer */}
            {answer && !isGenerating && (
              <YStack gap="$3">
                <Separator borderColor="#3A3A3C" />
                <XStack gap="$2" alignItems="center">
                  <Zap size={14} color="#5B7E6B" />
                  <SizableText size="$2" color="#5B7E6B" fontWeight="700">AI ANSWER</SizableText>
                </XStack>
                <SizableText size="$3" color="#F2F2F7" lineHeight={24}>{answer.content}</SizableText>
                <XStack gap="$2">
                  <Button
                    flex={1}
                    size="$3"
                    backgroundColor={saved ? 'rgba(91,126,107,0.2)' : 'rgba(91,126,107,0.1)'}
                    borderColor={saved ? '#5B7E6B' : 'rgba(91,126,107,0.3)'}
                    borderWidth={1}
                    color={saved ? '#5B7E6B' : '#9CA3AF'}
                    onPress={handleSave}
                    disabled={isSaving || saved}
                    icon={saved ? <CheckCircle size={14} color="#5B7E6B" /> : isSaving ? <Spinner size="small" color="#5B7E6B" /> : <Bookmark size={14} color="#9CA3AF" />}
                  >
                    {saved ? 'Saved' : 'Save'}
                  </Button>
                  <Button
                    flex={1}
                    size="$3"
                    backgroundColor="#2C2C2E"
                    borderColor="#3A3A3C"
                    borderWidth={1}
                    color="#9CA3AF"
                    onPress={handleCopy}
                    icon={<Copy size={14} color="#9CA3AF" />}
                  >
                    Copy
                  </Button>
                </XStack>
              </YStack>
            )}
          </YStack>
        </ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function WatchtowerStudyScreen() {
  const router = useRouter();
  const { docId } = useLocalSearchParams<{ docId: string }>();

  const language = useAppStore((s) => s.language);
  const addSavedSource = useAppStore((s) => s.addSavedSource);

  const langCode = language?.code ?? 'E';

  const [paragraphs, setParagraphs] = useState<ParsedParagraph[]>([]);
  const [articleTitle, setArticleTitle] = useState('Watchtower Study');
  const [themeScripture, setThemeScripture] = useState('');
  const [studyDates, setStudyDates] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Answer sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeParagraph, setActiveParagraph] = useState<ParsedParagraph | null>(null);
  const [activeQuestion, setActiveQuestion] = useState('');

  // Bible verse preview state
  const [verseOpen, setVerseOpen] = useState(false);
  const [activeVerse, setActiveVerse] = useState<BibleRef | null>(null);

  // Audio state
  const [audioState, setAudioState] = useState<AudioState>({
    isLoaded: false,
    isPlaying: false,
    duration: 0,
    position: 0,
    url: null,
  });
  const soundRef = useRef<unknown>(null);

  // ── Fetch article content ──────────────────────────────────
  useEffect(() => {
    if (!docId) { setIsLoading(false); return; }
    loadContent();
    loadAudio();
  }, [docId, langCode]);

  const loadContent = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const raw = await getPublicationContent(
        docId!,
        langCode,
        language?.symbol ?? 'en',
        language?.wolRegion ?? 'r1',
        language?.wolLangParam ?? 'lp-e',
      ) as {
        items?: Array<{ content?: string; title?: string; citation?: string }>;
        title?: string;
      };

      const item = raw?.items?.[0];
      const html = item?.content ?? '';
      const title = item?.title ?? raw?.title ?? 'Watchtower Study';

      setArticleTitle(title);

      // Extract scripture from title (common pattern: "Title—Scripture")
      const scriptureMatch = /—([^—]+)$/u.exec(title);
      if (scriptureMatch) {
        setThemeScripture(scriptureMatch[1].trim());
      }

      // Parse paragraphs (also pairs questions and extracts Bible refs)
      const parsed = parseParagraphs(html, langCode.toLowerCase());

      setParagraphs(parsed);

      // Set study dates
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 6);
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      setStudyDates(`${fmt(now)} – ${fmt(weekEnd)}`);

    } catch (err) {
      setLoadError('Could not load article content. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAudio = async () => {
    if (Platform.OS === 'web') return;
    try {
      const media = await getMediaLinks(docId!, langCode) as {
        files?: { MP3?: Array<{ file?: { url?: string } }> };
      };
      const mp3Url = media?.files?.MP3?.[0]?.file?.url;
      if (!mp3Url) return;

      // Dynamically import expo-av (native only)
      const { Audio } = await import('expo-av');
      const { sound } = await Audio.Sound.createAsync({ uri: mp3Url }, { shouldPlay: false });
      soundRef.current = sound;
      const status = await sound.getStatusAsync();
      setAudioState({
        isLoaded: true,
        isPlaying: false,
        duration: status.isLoaded ? (status.durationMillis ?? 0) / 1000 : 0,
        position: 0,
        url: mp3Url,
      });
    } catch {
      // Audio not available — silently ignore
    }
  };

  const handleAudioToggle = async () => {
    if (Platform.OS === 'web') return;
    if (!soundRef.current) return;
    const sound = soundRef.current as { playAsync: () => Promise<void>; pauseAsync: () => Promise<void> };
    try {
      if (audioState.isPlaying) {
        await sound.pauseAsync();
        setAudioState((s) => ({ ...s, isPlaying: false }));
      } else {
        await sound.playAsync();
        setAudioState((s) => ({ ...s, isPlaying: true }));
      }
    } catch {
      toast('Audio playback error', { variant: 'error' });
    }
  };

  const handlePrepare = (para: ParsedParagraph, question: string) => {
    setActiveParagraph(para);
    setActiveQuestion(question);
    setSheetOpen(true);
  };

  const handleSaveAnswer = async (answer: GeneratedAnswer, para: ParsedParagraph) => {
    const source = {
      id: `wt_ans_${answer.id}`,
      type: 'answer' as const,
      title: `WT Answer: ¶${para.number} — ${articleTitle}`,
      content: answer.content,
      language: langCode,
      savedAt: new Date().toISOString(),
      syncStatus: 'saved' as const,
    };
    await saveSource(source);
    addSavedSource(source);
    toast('Answer saved', { message: 'Added to your Saved Library.', variant: 'success' });
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E' }}>
      {/* ── Header ── */}
      <XStack paddingHorizontal="$4" paddingTop="$2" paddingBottom="$2" alignItems="center" gap="$2">
        <Button
          chromeless
          size="$3"
          onPress={() => router.back()}
          icon={<ChevronLeft size={22} color="#9CA3AF" />}
        />
        <YStack flex={1} gap="$1">
          <SizableText size="$4" color="#F2F2F7" fontWeight="700">Watchtower Study</SizableText>
          {studyDates ? (
            <SizableText size="$2" color="#6B7280">{studyDates}</SizableText>
          ) : null}
        </YStack>
      </XStack>

      {isLoading ? (
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$4">
          <Spinner size="large" color="#5B7E6B" />
          <SizableText size="$3" color="#9CA3AF">Loading article…</SizableText>
        </YStack>
      ) : loadError ? (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" gap="$4">
          <SizableText size="$4" color="#EF4444" textAlign="center">{loadError}</SizableText>
          <Button
            backgroundColor="rgba(91,126,107,0.15)"
            borderColor="rgba(91,126,107,0.3)"
            borderWidth={1}
            color="#5B7E6B"
            onPress={loadContent}
          >
            Retry
          </Button>
        </YStack>
      ) : (
        <FlatList
          data={paragraphs}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <YStack gap="$4" paddingBottom="$2" paddingTop="$2">
              {/* Article title + theme scripture */}
              <YStack gap="$2">
                <SizableText size="$6" color="#F2F2F7" fontWeight="800" lineHeight={32}>
                  {articleTitle}
                </SizableText>
                {themeScripture ? (
                  <XStack gap="$2" alignItems="center">
                    <BookOpen size={14} color="#5B7E6B" />
                    <SizableText size="$3" color="#5B7E6B" fontWeight="600" fontStyle="italic">
                      {themeScripture}
                    </SizableText>
                  </XStack>
                ) : null}
              </YStack>

              {/* Audio player */}
              <AudioPlayer
                audioUrl={audioState.url}
                isLoaded={audioState.isLoaded}
                isPlaying={audioState.isPlaying}
                onToggle={handleAudioToggle}
              />

              {/* Paragraphs label */}
              <XStack gap="$2" alignItems="center" paddingTop="$2">
                <AlignLeft size={14} color="#9CA3AF" />
                <SizableText size="$2" color="#9CA3AF" fontWeight="700" letterSpacing={1}>
                  {paragraphs.length} PARAGRAPHS
                </SizableText>
              </XStack>
            </YStack>
          }
          ListEmptyComponent={
            <YStack alignItems="center" paddingTop="$10" gap="$4">
              <BookOpen size={48} color="#4B5563" />
              <SizableText size="$4" color="#9CA3AF" textAlign="center" maxWidth={260}>
                No article content available. Try opening a different Watchtower article.
              </SizableText>
            </YStack>
          }
          renderItem={({ item }) => (
            <YStack marginBottom="$3">
              <ParagraphCard
                para={item}
                articleTitle={articleTitle}
                onPrepare={handlePrepare}
                onPreviewVerse={(ref) => { setActiveVerse(ref); setVerseOpen(true); }}
              />
            </YStack>
          )}
        />
      )}

      {/* Bible verse preview sheet */}
      <VerseSheet
        open={verseOpen}
        verse={activeVerse}
        onClose={() => setVerseOpen(false)}
      />

      {/* Answer preparation sheet */}
      <AnswerSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        paragraph={activeParagraph}
        question={activeQuestion}
        articleTitle={articleTitle}
        onSave={handleSaveAnswer}
      />
    </SafeAreaView>
  );
}
