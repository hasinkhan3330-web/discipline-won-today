import { supabase } from "@/integrations/supabase/client";
import { QUIZ_KEY, QUIZ_DONE_KEY, calculateAssessment, type QuizAnswers } from "@/components/PreSignupQuiz";

/** Pre-signup quiz answers are cached locally, then written to the profile once an account exists. */

export function saveQuizLocal(a: QuizAnswers) {
  try {
    localStorage.setItem(QUIZ_KEY, JSON.stringify(a));
    localStorage.setItem(QUIZ_DONE_KEY, "1");
  } catch { /* private mode — quiz just repeats before signup */ }
}

/** Returning users can skip the quiz; only the "seen" flag is stored. */
export function skipQuizLocal() {
  try { localStorage.setItem(QUIZ_DONE_KEY, "1"); } catch { /* private mode */ }
}

export function quizSeen(): boolean {
  try {
    return localStorage.getItem(QUIZ_DONE_KEY) === "1" || localStorage.getItem("axen.quiz.v1.done") === "1";
  } catch {
    return false;
  }
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

  const results = calculateAssessment(a);
  const { error } = await supabase.from("first_launch_assessments").upsert({
    user_id: userId,
    answers: a,
    baseline_score: results.baseline,
    estimated_daily_lost_hours: results.dailyLost,
    potential_daily_reclaim_hours: results.dailyReclaim,
    completed_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) return false;
  try { localStorage.removeItem(QUIZ_KEY); } catch { /* ignore */ }
  return true;
}
