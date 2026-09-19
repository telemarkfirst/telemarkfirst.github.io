export type AnalyticsEventName =
  | 'login'
  | 'sign_up'
  | 'curriculum_start'
  | 'progress_export'
  | 'progress_import'
  | 'lesson_complete'
  | 'lesson_unmark'
  | 'unit_complete'
  | 'unit_skip'
  | 'unit_review'
  | 'unit_unmark'
  | 'simulator_launch'
  | 'simulator_fullscreen'
  | 'content_lock_view'
  | 'content_unlock_attempt'
  | 'content_unlock_success'
  | 'simulator_gate_request'
  | 'quiz_graded'
  | 'calculator_used'
  | 'cad_checked'
  | 'ai_question_asked'
  | 'personalization_complete'
  | 'blocks_placement_complete'
  | 'blocks_challenge_pass'
  | 'blocks_challenge_skip'
  | 'fll_simulator_launch'
  | 'fll_challenge_pass'
  | 'blocks_exit_choice';

type AnalyticsParameters = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (
      command: 'event',
      eventName: AnalyticsEventName,
      parameters?: AnalyticsParameters,
    ) => void;
  }
}

export function trackEvent(
  eventName: AnalyticsEventName,
  parameters: AnalyticsParameters = {},
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', eventName, parameters);
}
