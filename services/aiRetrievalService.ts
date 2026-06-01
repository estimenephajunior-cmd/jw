// ============================================================
// JW Study Assistant — AI Retrieval Service
// OpenAI / Gemini generation with JW-only rules.
// Grounded flows: search JW/WOL → fetch bodies → generate.
// ============================================================
import { generateAiText } from '@/services/localAiService';
import type {
  UserProfile,
  DailyText,
  MinistryContact,
  GeneratedAnswer,
  PersonalStudyPlan,
  StudyWeek,
  SourceCitation,
} from '../types';
import {
  gatewayFetchSourcesForAi,
  gatewaySearchAll,
  normalizeAppLanguage,
} from '@/services/sourceGatewayService';
import type { Language } from '@/types';

// -----------------------------------------------------------
// JW Sources Only system prompt
// -----------------------------------------------------------
const JW_SYSTEM_PROMPT = `You are a JW Study Assistant. You ONLY answer using the JW.org/WOL/JW Library source content provided to you.

CRITICAL RULES:
1. NEVER invent scripture references, publication names, paragraph numbers, or dates.
2. NEVER answer from general AI knowledge about doctrine or scripture.
3. If provided sources do not contain enough information, say: "I could not find a JW.org/WOL source for that. Please try another search or open JW.org directly."
4. Always show your sources: "Based on sources: [list]"
5. Answer respectfully, simply, and in the same language as the user's question.
6. If video content is the only source, say: "This topic has video content on JW.org. Please view it directly."`;

// -----------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------

function generateId(): string {
  return `ans_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function lengthInstruction(length: 'short' | 'medium' | 'long'): string {
  switch (length) {
    case 'short':  return 'Respond in 1–2 concise sentences (under 80 words).';
    case 'long':   return 'Respond in 4–6 detailed sentences (150–250 words), covering key points thoroughly.';
    default:       return 'Respond in 2–4 sentences (80–150 words).';
  }
}

function toneInstruction(tone: 'natural' | 'heartfelt' | 'scriptural'): string {
  switch (tone) {
    case 'heartfelt':  return 'Use a warm, personal, emotionally engaging tone — speak from the heart.';
    case 'scriptural': return 'Use a direct scriptural tone — closely reference the Bible text and publications.';
    default:           return 'Use a natural, conversational tone — as if speaking at a meeting.';
  }
}

function profileContext(profile?: UserProfile): string {
  if (!profile) return '';
  return (
    `\n\nADAPT FOR THIS PERSON:\n` +
    `- Spiritual status: ${profile.spiritualStatus}\n` +
    `- Study style: ${profile.preferredStudyStyle}\n` +
    (profile.spiritualGoals.length ? `- Goals: ${profile.spiritualGoals.join(', ')}\n` : '') +
    (profile.studyInterests.length ? `- Interests: ${profile.studyInterests.join(', ')}\n` : '')
  );
}

function sourcesBlock(retrievedContent: string): string {
  if (!retrievedContent.trim()) return '';
  return `\n\n---\nJW SOURCE CONTENT (use ONLY this):\n${retrievedContent}\n---`;
}

export interface RetrievedJwPack {
  content: string;
  citations: SourceCitation[];
}

/** Search JW.org/WOL and fetch article bodies (same pattern as Search AI Research). */
export async function retrieveJwSourcesForQuery(
  query: string,
  language?: string | Language | null,
  options: { maxResults?: number } = {},
): Promise<RetrievedJwPack> {
  const q = query.trim();
  if (!q) return { content: '', citations: [] };

  const lang = normalizeAppLanguage(
    typeof language === 'string'
      ? { symbol: language, code: language }
      : language ?? null,
  );
  const maxResults = options.maxResults ?? 8;

  try {
    const { data: hits } = await gatewaySearchAll(q, lang, { wolPages: 4, jwLimit: 40 });
    if (!hits.length) return { content: '', citations: [] };

    const selected = hits.slice(0, maxResults);
    const citations: SourceCitation[] = selected.map((hit) => ({
      title: hit.title,
      url: hit.url,
      publication: hit.sourceTag,
    }));

    try {
      const pack = await gatewayFetchSourcesForAi(selected, lang);
      if (pack.content.trim()) {
        return { content: pack.content, citations };
      }
    } catch {
      // fall through to snippets
    }

    const snippetContent = selected
      .map((hit, i) => `[${i + 1}] ${hit.title}\n${hit.snippet}\nURL: ${hit.url}`)
      .join('\n\n');
    return { content: snippetContent, citations };
  } catch {
    return { content: '', citations: [] };
  }
}

function ministrySearchQuery(contact: MinistryContact): string {
  const topics = contact.topicsDiscussed.slice(0, 3).join(' ');
  const lastVisit = contact.visits?.slice(-1)[0];
  const visitTopic =
    lastVisit && 'topicDiscussed' in lastVisit
      ? String((lastVisit as { topicDiscussed?: string }).topicDiscussed ?? '')
      : '';
  const parts = [topics, visitTopic, contact.status.replace(/-/g, ' '), 'ministry bible study']
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.join(' ') || 'bible study return visit';
}

async function ensureRetrievedContent(
  retrievedContent: string,
  sources: SourceCitation[],
  language?: string,
  searchQuery?: string,
): Promise<{ content: string; sources: SourceCitation[] }> {
  let content = retrievedContent;
  let mergedSources = sources;

  if (!content.trim() && searchQuery?.trim()) {
    const pack = await retrieveJwSourcesForQuery(searchQuery, language);
    content = pack.content;
    mergedSources = pack.citations;
  }

  if (mergedSources.some((source) => source.url)) {
    const lang = normalizeAppLanguage(language ? { symbol: language, code: language } : null);
    try {
      const fetched = await gatewayFetchSourcesForAi(mergedSources.map((source) => ({
        title: source.title,
        url: source.url,
        snippet: source.publication || source.paragraph || source.scripture,
      })), lang);
      content = [content, fetched.content].filter((item) => item.trim()).join('\n\n---\n\n');
    } catch {
      // keep existing content
    }
  }

  return { content, sources: mergedSources };
}

// -----------------------------------------------------------
// answerFromJWSources
// -----------------------------------------------------------

/**
 * Answer a general question grounded in retrieved JW source content.
 */
export async function answerFromJWSources(
  question: string,
  retrievedContent: string,
  sources: SourceCitation[],
  profile?: UserProfile,
  language?: string
): Promise<GeneratedAnswer> {
  const langNote = language ? `\nUser's language preference: ${language}` : '';
  const { content: sourceContent } = await ensureRetrievedContent(retrievedContent, sources, language, question);

  const prompt =
    `${JW_SYSTEM_PROMPT}${profileContext(profile)}${langNote}` +
    sourcesBlock(sourceContent) +
    `\n\nQUESTION: ${question}\n\n` +
    `${lengthInstruction('medium')} ${toneInstruction('natural')}\n` +
    `After your answer, append "Based on sources:" followed by the source titles.`;

  const { text } = await generateAiText({ prompt });

  return {
    id: generateId(),
    parentId: 'general',
    parentType: 'general',
    length: 'medium',
    tone: 'natural',
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateMeetingAnswer
// -----------------------------------------------------------

/**
 * Generate a meeting-part answer for a given question/references.
 */
export async function generateMeetingAnswer(
  partTitle: string,
  questions: string[],
  references: string[],
  retrievedContent: string,
  sources: SourceCitation[],
  length: 'short' | 'medium' | 'long',
  tone: 'natural' | 'heartfelt' | 'scriptural'
): Promise<GeneratedAnswer> {
  const searchQuery = [partTitle, ...references, ...questions].filter(Boolean).join(' ');
  const { content: sourceContent } = await ensureRetrievedContent(retrievedContent, sources, undefined, searchQuery);
  const refsText = references.length
    ? `\nRelevant references: ${references.join(', ')}`
    : '';
  const questionsText = questions.length
    ? `\nQuestions to answer:\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
    : '';

  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    sourcesBlock(sourceContent) +
    `\n\nMEETING PART: "${partTitle}"${refsText}${questionsText}\n\n` +
    `Prepare a spoken answer for this meeting part.\n` +
    `${lengthInstruction(length)} ${toneInstruction(tone)}\n` +
    `End with: "Based on sources: [list source titles]"`;

  const { text } = await generateAiText({ prompt });

  return {
    id: generateId(),
    parentId: partTitle,
    parentType: 'meeting-part',
    length,
    tone,
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateBibleReadingCoaching
// -----------------------------------------------------------

/**
 * Generate coaching notes for the midweek Bible Reading assignment.
 * This is not a meeting answer. It mentors the reader on delivery.
 */
export async function generateBibleReadingCoaching(
  partTitle: string,
  references: string[],
  retrievedContent: string,
  sources: SourceCitation[],
  length: 'short' | 'medium' | 'long',
  tone: 'natural' | 'heartfelt' | 'scriptural'
): Promise<GeneratedAnswer> {
  const searchQuery = [partTitle, ...references].filter(Boolean).join(' ');
  const { content: sourceContent } = await ensureRetrievedContent(retrievedContent, sources, undefined, searchQuery);
  const refsText = references.length
    ? `\nAssigned references and study lesson: ${references.join(', ')}`
    : '';

  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    sourcesBlock(sourceContent) +
    `\n\nMEETING PART: "${partTitle}"${refsText}\n\n` +
    `This is the midweek Bible Reading assignment, usually section 3. Do NOT prepare a general comment or answer.\n` +
    `Act as a kind reading coach. Use the assigned Bible passage and the ministry-school lesson/reference from the source content.\n\n` +
    `Your task:\n` +
    `1. Identify the main lesson/rule the student is working on based on.\n` +
    `2. Select only a few specific verses or short phrases from the assigned reading where that lesson can be applied. Do not comment on every verse.\n` +
    `3. For each selected verse/phrase, explain exactly HOW to read it: tone, pace, pause, emphasis, facial expression, gesture, warmth, empathy, confidence, or variation.\n` +
    `4. Keep the guidance practical, like a mentor helping the user practice before the meeting.\n` +
    `5. Use the same language as the assignment/source content.\n\n` +
    `Format the answer with:\n` +
    `- Reading goal\n` +
    `- Practice points, each with verse/phrase + delivery advice\n` +
    `- One short final rehearsal tip\n` +
    `${lengthInstruction(length)} ${toneInstruction(tone)}\n` +
    `End with: "Based on sources: [list source titles]"`;

  const { text } = await generateAiText({ prompt });

  return {
    id: generateId(),
    parentId: partTitle,
    parentType: 'meeting-part',
    length,
    tone,
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateWatchtowerAnswer
// -----------------------------------------------------------

/**
 * Generate an answer for a Watchtower paragraph study question.
 */
export async function generateWatchtowerAnswer(
  paragraphText: string,
  question: string,
  articleContext: string,
  sources: SourceCitation[],
  length: 'short' | 'medium' | 'long',
  tone: 'natural' | 'heartfelt' | 'scriptural'
): Promise<GeneratedAnswer> {
  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    `\n\nARTICLE CONTEXT:\n${articleContext}` +
    `\n\nPARAGRAPH TEXT:\n${paragraphText}` +
    `\n\nSTUDY QUESTION: ${question}\n\n` +
    `Prepare a thoughtful answer for the Watchtower study. If the question is an article review question, use the full article context to identify the paragraphs that answer it before writing. Do not answer generally when the article gives the answer.\n` +
    `${lengthInstruction(length)} ${toneInstruction(tone)}\n` +
    `End with: "Based on sources: [list source titles]"`;

  const { text } = await generateAiText({ prompt });

  return {
    id: generateId(),
    parentId: question,
    parentType: 'watchtower-article',
    length,
    tone,
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateMinistrySuggestion
// -----------------------------------------------------------

/**
 * Generate a ministry suggestion / approach for a specific contact.
 */
export async function generateMinistrySuggestion(
  contactInfo: MinistryContact,
  retrievedContent: string,
  sources: SourceCitation[],
  language?: string,
): Promise<GeneratedAnswer> {
  const { content: sourceContent, sources: groundedSources } = await ensureRetrievedContent(
    retrievedContent,
    sources,
    language,
    ministrySearchQuery(contactInfo),
  );
  const history = contactInfo.visits.length
    ? `\nPrevious visits (${contactInfo.visits.length}):\n` +
      contactInfo.visits
        .slice(-3) // last 3 visits for context
        .map((v) => `  - ${v.date}: "${v.topicDiscussed}" — ${v.outcome}`)
        .join('\n')
    : '';

  const topics = contactInfo.topicsDiscussed.length
    ? `\nTopics already discussed: ${contactInfo.topicsDiscussed.join(', ')}`
    : '';

  const questions = contactInfo.questionsAsked.length
    ? `\nQuestions they have asked: ${contactInfo.questionsAsked.join(', ')}`
    : '';

  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    sourcesBlock(sourceContent) +
    `\n\nMINISTRY CONTACT:\n` +
    `- Status: ${contactInfo.status}\n` +
    `- Name: ${contactInfo.name}${history}${topics}${questions}\n\n` +
    `Suggest a specific approach for the next visit: what topic to discuss, ` +
    `which scripture to use (from provided sources only), and how to open the conversation.\n` +
    `${lengthInstruction('medium')} ${toneInstruction('natural')}\n` +
    `End with: "Based on sources: [list source titles]"`;

  const { text } = await generateAiText({ prompt });

  return {
    id: generateId(),
    parentId: contactInfo.id,
    parentType: 'ministry',
    length: 'medium',
    tone: 'natural',
    content: text,
    sources: groundedSources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateMinistryVisitSuggestions (structured JSON for contact UI)
// -----------------------------------------------------------

export async function generateMinistryVisitSuggestions(
  contact: MinistryContact,
  language?: string,
): Promise<string> {
  const { content: sourceContent } = await retrieveJwSourcesForQuery(
    ministrySearchQuery(contact),
    language,
  );

  if (!sourceContent.trim()) {
    throw new Error('No JW.org/WOL sources found. Try updating contact topics or search JW.org directly.');
  }

  const topicsList = contact.topicsDiscussed.join(', ') || 'general spiritual topics';
  const scripturesList = contact.scripturesUsed.join(', ') || 'none yet';
  const pubList = contact.publicationsShared.join(', ') || 'none yet';

  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    sourcesBlock(sourceContent) +
    `\n\nMINISTRY CONTACT: ${contact.name} (${contact.status}).\n` +
    `Topics discussed: ${topicsList}.\nScriptures used: ${scripturesList}.\nPublications shared: ${pubList}.\n\n` +
    `Suggest the next visit using ONLY the JW source content above.\n` +
    `Respond in JSON only with keys: nextTopic, scripture ({reference, text}), jwOrgResource ({title, type, url}), studyTip, conversationStarter.\n` +
    `Scriptures and resources must appear in the provided sources. For videos, use type "video" and the URL from sources.`;

  const { text } = await generateAiText({ prompt });

  let parsed: Record<string, unknown> | null = null;
  try {
    const jsonMatch = text?.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || text?.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return text;
  }

  const scripture = parsed.scripture as { reference?: string; text?: string } | undefined;
  const jwOrgResource = parsed.jwOrgResource as { title?: string; type?: string; url?: string } | undefined;

  return [
    parsed.nextTopic && `💬 Next Topic\n${parsed.nextTopic}`,
    scripture?.reference && `📖 Scripture\n${scripture.reference} — "${scripture.text ?? ''}"`,
    jwOrgResource?.title && `🌐 JW.org Resource\n${jwOrgResource.title} (${jwOrgResource.type ?? 'article'})${jwOrgResource.url ? `\n${jwOrgResource.url}` : ''}`,
    parsed.conversationStarter && `🗣 Conversation Starter\n${parsed.conversationStarter}`,
    parsed.studyTip && `✨ Study Tip\n${parsed.studyTip}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// -----------------------------------------------------------
// generateStudyPlanWeekTopics
// -----------------------------------------------------------

export async function generateStudyPlanWeekTopics(
  planTitle: string,
  planType: 'weekly' | 'monthly' | 'annual',
  totalWeeks: number,
  profileJson: string,
  language?: string,
): Promise<string[]> {
  const searchQuery = `${planTitle} personal study Jehovah's Witness`;
  const { content: sourceContent } = await retrieveJwSourcesForQuery(searchQuery, language);

  if (!sourceContent.trim()) {
    throw new Error('No JW.org/WOL sources found for this study plan. Try a different title or search JW.org directly.');
  }

  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    sourcesBlock(sourceContent) +
    `\n\nCreate exactly ${totalWeeks} study week topics for a ${planType} personal study plan titled "${planTitle}".\n` +
    `User profile (for pacing only): ${profileJson}\n` +
    `Respond ONLY with a JSON array of ${totalWeeks} strings. Each string is one week topic derived from the JW source content above.\n` +
    `Do not invent publication names or doctrines not in the sources.`;

  const { text } = await generateAiText({ prompt });
  const jsonMatch = text?.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse study topics from AI response.');
  const topics = JSON.parse(jsonMatch[0]) as string[];
  if (!Array.isArray(topics) || topics.length < 1) {
    throw new Error('Invalid study topics returned.');
  }
  return topics.slice(0, totalWeeks);
}

// -----------------------------------------------------------
// generateWeekStudyGuide
// -----------------------------------------------------------

export interface WeekStudyGuide {
  keyPoints: string[];
  suggestedScriptures: string[];
  discussionQuestions: string[];
  personalApplication: string;
  jwSource: string;
}

export async function generateWeekStudyGuide(
  weekNumber: number,
  topic: string,
  language?: string,
): Promise<WeekStudyGuide> {
  const { content: sourceContent } = await retrieveJwSourcesForQuery(topic, language);

  if (!sourceContent.trim()) {
    throw new Error('No JW.org/WOL sources found for this topic. Try another topic or search JW.org directly.');
  }

  const prompt =
    `${JW_SYSTEM_PROMPT}` +
    sourcesBlock(sourceContent) +
    `\n\nGenerate a study guide for Week ${weekNumber}: "${topic}".\n` +
    `Use ONLY the JW source content above. Respond in JSON with keys: keyPoints (string[]), suggestedScriptures (string[]), ` +
    `discussionQuestions (string[]), personalApplication (string), jwSource (string — title/URL from sources).`;

  const { text } = await generateAiText({ prompt });
  const jsonMatch = text?.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || text?.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
  return JSON.parse(jsonStr) as WeekStudyGuide;
}

// -----------------------------------------------------------
// explainDailyText
// -----------------------------------------------------------

/**
 * Explain and meditate on a daily text using provided JW source content.
 */
export async function explainDailyText(
  dailyText: DailyText,
  retrievedContent: string,
  sources: SourceCitation[],
  profile?: UserProfile
): Promise<GeneratedAnswer> {
  const searchQuery = `${dailyText.scripture} ${dailyText.comment.slice(0, 120)}`;
  const { content: sourceContent } = await ensureRetrievedContent(
    retrievedContent,
    sources,
    dailyText.language,
    searchQuery,
  );
  const prompt =
    `${JW_SYSTEM_PROMPT}${profileContext(profile)}` +
    sourcesBlock(sourceContent) +
    `\n\nDAILY TEXT (${dailyText.date}):\n` +
    `Scripture: ${dailyText.scripture}\n` +
    `"${dailyText.scriptureText}"\n\n` +
    `Commentary from JW.org:\n${dailyText.comment}\n\n` +
    `Provide a personal reflection and application of this daily text, ` +
    `drawing only from the provided JW source content above.\n` +
    `${lengthInstruction('medium')} ${toneInstruction('heartfelt')}\n` +
    `End with: "Based on sources: [list source titles]"`;

  const { text } = await generateAiText({ prompt });

  return {
    id: generateId(),
    parentId: dailyText.id,
    parentType: 'daily-text',
    length: 'medium',
    tone: 'heartfelt',
    content: text,
    sources,
    createdAt: nowISO(),
    saved: false,
  };
}

// -----------------------------------------------------------
// generateStudyPlan
// -----------------------------------------------------------

/**
 * Generate a structured personal study plan using JW source content.
 * Returns a fully populated PersonalStudyPlan.
 */
export async function generateStudyPlan(
  profile: UserProfile,
  topics: string[],
  planType: 'weekly' | 'monthly' | 'annual',
  retrievedContent: string
): Promise<PersonalStudyPlan> {
  const weekCount = planType === 'weekly' ? 1 : planType === 'monthly' ? 4 : 52;
  const topicsText = topics.join(', ');

  const prompt =
    `${JW_SYSTEM_PROMPT}${profileContext(profile)}` +
    sourcesBlock(retrievedContent) +
    `\n\nCREATE A ${planType.toUpperCase()} STUDY PLAN:\n` +
    `Topics: ${topicsText}\n` +
    `Number of weeks: ${weekCount}\n\n` +
    `Return a JSON object ONLY (no markdown, no explanation) with this exact structure:\n` +
    `{\n` +
    `  "title": "string",\n` +
    `  "weeks": [\n` +
    `    {\n` +
    `      "weekNumber": number,\n` +
    `      "topic": "string",\n` +
    `      "jwSources": ["string"],\n` +
    `      "scriptures": ["string"],\n` +
    `      "questions": ["string"],\n` +
    `      "reflections": ["string"],\n` +
    `      "notes": "string"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n` +
    `All jwSources and scriptures must come from the provided JW source content above.\n` +
    `Do NOT invent publication names or scripture references not present in the sources.`;

  const { text } = await generateAiText({ prompt });

  // Parse JSON response
  let parsed: { title?: string; weeks?: Array<Partial<StudyWeek>> } = {};
  try {
    // Strip any markdown code fences if present
    const clean = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(clean) as typeof parsed;
  } catch {
    // Fallback: create a minimal plan from the text
    parsed = {
      title: `Study Plan: ${topicsText}`,
      weeks: Array.from({ length: weekCount }, (_, i) => ({
        weekNumber: i + 1,
        topic: topics[i % topics.length] ?? topics[0],
        jwSources: [],
        scriptures: [],
        questions: [],
        reflections: [],
        notes: text,
      })),
    };
  }

  const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const weeks: StudyWeek[] = (parsed.weeks ?? []).map((w, i) => ({
    id: `week_${planId}_${i + 1}`,
    planId,
    weekNumber: w.weekNumber ?? i + 1,
    topic: w.topic ?? topics[i % topics.length] ?? '',
    jwSources: w.jwSources ?? [],
    scriptures: w.scriptures ?? [],
    questions: w.questions ?? [],
    reflections: w.reflections ?? [],
    notes: w.notes ?? '',
    completed: false,
  }));

  return {
    id: planId,
    title: parsed.title ?? `${planType.charAt(0).toUpperCase() + planType.slice(1)} Study Plan`,
    type: planType,
    topics,
    weeks,
    createdAt: nowISO(),
  };
}

// -----------------------------------------------------------
// Default export
// -----------------------------------------------------------
export default {
  retrieveJwSourcesForQuery,
  answerFromJWSources,
  generateMeetingAnswer,
  generateBibleReadingCoaching,
  generateWatchtowerAnswer,
  generateMinistrySuggestion,
  generateMinistryVisitSuggestions,
  generateStudyPlanWeekTopics,
  generateWeekStudyGuide,
  explainDailyText,
  generateStudyPlan,
};
