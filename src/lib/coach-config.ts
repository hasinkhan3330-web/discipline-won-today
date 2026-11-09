// Single place to switch Coach AI models/providers. Function logic reads only these constants.
export type CoachModelConfig = { provider: "lovable-gateway"; model: string };

/** Model used for the text Coach conversation (unchanged from before v2). */
export const COACH_CHAT_MODEL: CoachModelConfig = { provider: "lovable-gateway", model: "google/gemini-3.8-flash" };

/** Model used inside create_plan_draft to generate the full plan in one call. */
export const COACH_PLAN_MODEL: CoachModelConfig = { provider: "lovable-gateway", model: "google/gemini-3.8-flash" };

/** Model used by the VoiceCoach live session (stage 3). */
export const COACH_LIVE_MODEL = "models/gemini-2.5-flash-native-audio-latest";

export const PROVIDER_ENDPOINTS: Record<CoachModelConfig["provider"], string> = {
  "lovable-gateway": "https://ai.gateway.lovable.dev/v1/chat/completions",
};

/** Coach tab presentation switch: true = orb screen, false = previous photo-stage UI. */
export const USE_ORB_COACH = true;
