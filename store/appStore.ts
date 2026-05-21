// ============================================================
// JW Study Assistant — Zustand App Store (with AsyncStorage persist)
// ============================================================
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Language,
  UserProfile,
  DailyText,
  MeetingWeek,
  MinistryContact,
  PersonalStudyPlan,
  SavedSource,
  Reminder,
} from '../types';
import type { PremiumThemeMode } from '@/constants/premiumTheme';

// -----------------------------------------------------------
// Store shape
// -----------------------------------------------------------
interface AppState {
  // ── Language ──────────────────────────────────────────────
  language: Language | null;
  setLanguage: (lang: Language) => void;
  appLanguage: Language | null;
  setAppLanguage: (lang: Language) => void;
  contentLanguage: Language | null;
  setContentLanguage: (lang: Language) => void;
  theme: PremiumThemeMode;
  setTheme: (theme: PremiumThemeMode) => void;

  // ── User profile ──────────────────────────────────────────
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;

  // ── Onboarding ────────────────────────────────────────────
  isOnboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;

  // ── Saved sources ─────────────────────────────────────────
  savedSources: SavedSource[];
  addSavedSource: (s: SavedSource) => void;
  removeSavedSource: (id: string) => void;

  // ── Daily text ────────────────────────────────────────────
  dailyText: DailyText | null;
  setDailyText: (dt: DailyText) => void;

  // ── Ministry contacts ─────────────────────────────────────
  contacts: MinistryContact[];
  setContacts: (c: MinistryContact[]) => void;
  addContact: (c: MinistryContact) => void;
  updateContact: (c: MinistryContact) => void;

  // ── Study plans ───────────────────────────────────────────
  studyPlans: PersonalStudyPlan[];
  addStudyPlan: (p: PersonalStudyPlan) => void;

  // ── Current meeting week ──────────────────────────────────
  currentMeetingWeek: MeetingWeek | null;
  setCurrentMeetingWeek: (w: MeetingWeek) => void;

  // ── Reminders ─────────────────────────────────────────────
  reminders: Reminder[];
  setReminders: (r: Reminder[]) => void;
}

// -----------------------------------------------------------
// Store implementation
// -----------------------------------------------------------
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // ── Language ───────────────────────────────────────────
      language: null,
      setLanguage: (lang) => set({ language: lang }),
      appLanguage: null,
      setAppLanguage: (lang) => set({ appLanguage: lang }),
      contentLanguage: null,
      setContentLanguage: (lang) => set({ contentLanguage: lang }),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      // ── User profile ───────────────────────────────────────
      userProfile: null,
      setUserProfile: (profile) => set({ userProfile: profile }),

      // ── Onboarding ─────────────────────────────────────────
      isOnboardingComplete: false,
      setOnboardingComplete: (v) => set({ isOnboardingComplete: v }),

      // ── Saved sources ──────────────────────────────────────
      savedSources: [],
      addSavedSource: (s) =>
        set((state) => {
          // Avoid duplicates by id
          const exists = state.savedSources.some((src) => src.id === s.id);
          if (exists) return state;
          return { savedSources: [...state.savedSources, s] };
        }),
      removeSavedSource: (id) =>
        set((state) => ({
          savedSources: state.savedSources.filter((s) => s.id !== id),
        })),

      // ── Daily text ─────────────────────────────────────────
      dailyText: null,
      setDailyText: (dt) => set({ dailyText: dt }),

      // ── Ministry contacts ──────────────────────────────────
      contacts: [],
      setContacts: (c) => set({ contacts: c }),
      addContact: (c) =>
        set((state) => ({
          contacts: [...state.contacts, c],
        })),
      updateContact: (updated) =>
        set((state) => ({
          contacts: state.contacts.map((c) =>
            c.id === updated.id ? updated : c
          ),
        })),

      // ── Study plans ────────────────────────────────────────
      studyPlans: [],
      addStudyPlan: (p) =>
        set((state) => ({
          studyPlans: [...state.studyPlans, p],
        })),

      // ── Current meeting week ───────────────────────────────
      currentMeetingWeek: null,
      setCurrentMeetingWeek: (w) => set({ currentMeetingWeek: w }),

      // ── Reminders ──────────────────────────────────────────
      reminders: [],
      setReminders: (r) => set({ reminders: r }),
    }),
    {
      name: 'jw-study-assistant-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist everything except transient UI state
      partialize: (state) => ({
        language: state.language,
        appLanguage: state.appLanguage,
        contentLanguage: state.contentLanguage,
        theme: state.theme,
        userProfile: state.userProfile,
        isOnboardingComplete: state.isOnboardingComplete,
        savedSources: state.savedSources,
        dailyText: state.dailyText,
        contacts: state.contacts,
        studyPlans: state.studyPlans,
        currentMeetingWeek: state.currentMeetingWeek,
        reminders: state.reminders,
      }),
    }
  )
);

// -----------------------------------------------------------
// Convenience selectors (avoids inline arrow fns in components)
// -----------------------------------------------------------
export const selectLanguage = (s: AppState) => s.language;
export const selectUserProfile = (s: AppState) => s.userProfile;
export const selectIsOnboardingComplete = (s: AppState) => s.isOnboardingComplete;
export const selectSavedSources = (s: AppState) => s.savedSources;
export const selectDailyText = (s: AppState) => s.dailyText;
export const selectContacts = (s: AppState) => s.contacts;
export const selectStudyPlans = (s: AppState) => s.studyPlans;
export const selectCurrentMeetingWeek = (s: AppState) => s.currentMeetingWeek;
export const selectReminders = (s: AppState) => s.reminders;
