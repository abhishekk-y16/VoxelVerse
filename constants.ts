
import { GestureSettings } from './types';

export const API_BASE_URL = '/api/v1';

// Expanded Palette (16 Colors for 4x4 Grid)
export const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#06b6d4', // Cyan (Default)
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
  '#ffffff', // White
  '#cbd5e1', // Slate 300
  '#94a3b8', // Slate 400
  '#64748b', // Slate 500
  '#0f172a', // Slate 900
];

export const GRID_SIZE = 30; // Larger grid for drawing text

// Default Settings
export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  pinchThreshold: 0.035, // Tight pinch
  grabThreshold: 0.15    // Tight fist
};

export const GESTURE_CONFIDENCE_MIN = 0.6;
export const DEBOUNCE_MS = 150; // Slight delay between actions to prevent double-clicks
