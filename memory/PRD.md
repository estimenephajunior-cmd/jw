# JW Study Assistant — UI/UX Redesign

## Original Problem Statement
"Redesign the UI UX of jw-study-assistant"

## User Choices
- Visual style: Distinctive, designer-led aesthetic (creative freedom)
- Theme mode: Both light & dark with toggle
- UX flow improvements allowed
- No branding constraints

## Tech Stack
- Expo + React Native (Web/iOS/Android), Expo Router 6, Tamagui via @blinkdotnew/mobile-ui, Zustand, AsyncStorage
- Web served on port 3000 via Metro bundler

## Design Identity — "Codex"
Editorial / devotional aesthetic.
- Light: parchment cream (#F4ECD7), ink (#1B1F36), sage moss (#4A6B57), copper (#B8753C)
- Dark: midnight ink (#0E1224), warm cream text, sage moss bright, copper warm
- Typography: Fraunces (display serif) + JetBrains Mono (caps/labels) + Inter Tight (body) on web; Georgia/Menlo/System on native
- Asymmetric layouts, hairline rules, drop caps, generous whitespace, editorial section numerals (I · II · III · IV)

## Implemented (Date: 2026-01)
- `constants/theme.ts` — Codex design tokens (light + dark) + Zustand `useTheme` store with persistence
- `app/_layout.tsx` — Theme-aware root, Google Fonts injection (web), Tamagui dark/light switch
- `app/index.tsx` — Theme-aware redirect/loading screen
- `app/(tabs)/_layout.tsx` — Redesigned tab bar (copper active tint, mono uppercase labels)
- `app/(tabs)/index.tsx` — Hero redesign: editorial masthead, large day numeral, drop-cap blockquote daily text, side-by-side meeting cards, copper "ASK" pill, return-visit list, footer mark
- `app/(tabs)/settings.tsx` — Wired theme toggle to persist via codex theme store
- `app/(tabs)/study.tsx`, `meetings.tsx`, `ministry.tsx`, `saved.tsx`, `search.tsx` — Theme-aware backgrounds + serif H2 headers (Codex identity)

## Key Features
- Theme toggle in masthead (sun/moon icon) + Settings → Appearance
- Editorial drop-cap on daily scripture
- Section numerals (I · DAILY TEXT, II · MEETINGS, III · ASK, IV · RETURN VISITS)
- Copper accent on call-to-actions, sage on secondary
- Live daily text fetch from WOL with cache + retry

## Not Affected (legacy dark visuals retained inside body)
- `onboarding.tsx`, `daily-text.tsx`, `meeting-prep.tsx`, `watchtower-study.tsx`, contact/visit/profile detail screens — still functional, share base palette
- Inner tab content (cards, list rows in study/meetings/etc) keep prior dark-only styling

## Backlog (P1)
- Token-migrate inner content of meetings/ministry/saved/search/study lists for full light-mode parity
- Onboarding redesign in Codex style
- Detail screens (daily-text, meeting-prep, watchtower-study) editorial reading layout
- Custom selection color, grain texture overlay (already injected via CSS .codex-grain)
- Reanimated entrance animations on home cards

## Dependencies Added
expo-clipboard@~8.0.8, @tamagui/config@^1.114.0, tamagui@^1.114.0, @tamagui/core@^1.114.0, @tamagui/lucide-icons

## Iteration 2 — Functional Bug Fixes (2026-01)

### Fixed
1. **Watchtower paragraph parser** (`app/watchtower-study.tsx`)
   - Was matching every `<p data-pid>` → produced ~40 entries for a 17-paragraph article
   - Now matches only paragraphs with `data-rel-pid="[N]"` (real study paragraphs)
   - Uses `data-pnum` from inner `<span class="parNum">` as visible number
   - Strips the parNum span so the number isn't rendered twice
   - Verified: 17 paragraphs against article 2025560 (matches WOL exactly)
2. **Question pairing**
   - Was assigning questions sequentially (wrong pairings)
   - Now builds a `questionsByPid` map then pairs each paragraph via its `data-rel-pid`
   - Each paragraph shows its real matching question above it
3. **Bible verse refs as tappable chips + inline preview modal**
   - Extracts `<a class="b" href=...>verse</a>` from paragraph HTML pre-strip
   - Renders chips below paragraph text (sage moss styling)
   - Opens a Sheet modal that fetches the verse HTML from WOL and displays clean text
4. **Midweek meeting parser** (`app/(tabs)/meetings.tsx`)
   - Was parsing the meetings HUB page directly — surfaced unrelated H2s like "Étude de La Tour de Garde" and "Autres publications pour les réunions" as if they were parts
   - Now drills: hub → first `/wol/d/...` link → fetch that mwb article → parse H3s under H2 sections
   - Multi-lingual section regex (EN + FR + HT)
   - H2s now used only for section context, not emitted as parts
   - Title-based opening/closing override catches Kantik+priyè rows
   - Dedupes repeated H3s; removed `📖` emoji prefix from bibleRef line
5. **`getPublicationContent` WOL fallback** (`services/jwApiService.ts`)
   - Primary b.jw-cdn.org endpoint returns 404 for some docids
   - Added WOL public HTML fallback wrapped to match the existing `{items:[{content,title}]}` shape
6. **Preview server restarted** — Expo dev server back on port 3000

### Not Touched (deferred)
- Codex redesign of `daily-text.tsx` and `meeting-prep.tsx` detail screens (still using legacy dark palette inside)
- Inner list cards on Library/Study/Meetings for full light-mode parity
