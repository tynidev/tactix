// UI timing constants for GameAnalysis
// Set CURSOR_HIDE_MS or UI_HIDE_MS to null (or Number.POSITIVE_INFINITY) to disable that auto-hide behavior.

export const CURSOR_HIDE_MS: number | null = null; // Hide cursor after 3s inactivity (null to never hide)
export const UI_HIDE_MS: number | null = null; // Hide overlays after 5s inactivity (null to never hide)
export const FLYOUT_GRACE_MS = 1500; // Grace period after flyout-initiated playback
