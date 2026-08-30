import { supabase } from "@/integrations/supabase/client";
import { QUIZ_KEY, QUIZ_DONE_KEY, type QuizAnswers } from "@/components/PreSignupQuiz";

/** Pre-signup quiz answers are cached locally, then written to the profile once an account exists. */

export function saveQuizLocal(a: QuizAnswers) {
  try {
    localStorage.setItem(QUIZ_KEY, JSON.stringify(a));
    localStorage.setItem(QUIZ_DONE_KEY, "1");
  } catch { /* private mode — quiz just repeats before signup */ }
}

export function quizSeen(): boolean {
  try { return localStorage.getItem(QUIZ_DONE_KEY) === "1"; } catch { return false; }
}

function readQuiz(): QuizAnswers | null {
  try {
    const raw = localStorage.getItem(QUIZ_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return null;
    return p as QuizAnswers;
  } catch { return null; }
}

/**
 * Writes cached answers onto the signed-in user's profile exactly once.
 * Safe to call repeatedly: the local cache is cleared on success, and the
 * update never overwrites answers already stored on the profile.
 */
export async function flushQuizToProfile(userId: string): Promise<boolean> {
  const a = readQuiz();
  if (!a || !userId) return false;

  const { data: existing } = await supabase
    .from("profiles")
    .select("onboarding_goal")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) return false; // profile row not created yet — retry on next boot

  if ((existing as any).onboarding_goal) {
    try { localStorage.removeItem(QUIZ_KEY); } catch { /* ignore */ }
    return true;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      onboarding_goal: a.goal || null,
      onboarding_blocker: a.blocker || null,
      onboarding_habit_count: a.habit_count || null,
      acquisition_source: a.source || null,
      onboarding_answered_at: new Date().toISOString(),
      onboarded: true,
    } as any)
    .eq("id", userId);

  if (error) return false;
  try { localStorage.removeItem(QUIZ_KEY); } catch { /* ignore */ }
  return true;
}
