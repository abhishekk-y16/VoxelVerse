
// 3D & Voxel Types
export interface VoxelData {
  id: string; // usually "x,y,z"
  x: number;
  y: number;
  z: number;
  color: string;
}

export type VoxelMap = Map<string, VoxelData>;

// Undo/Redo Types
export type ActionType = 'PLACE' | 'DELETE';

export interface HistoryAction {
  type: ActionType;
  voxel: VoxelData;
}

// Gesture & Tracking Types
export enum GestureType {
  NONE = 'NONE',
  OPEN_HAND = 'OPEN_HAND', // Rotate/View
  PINCH = 'PINCH',         // Place / Select
  VICTORY = 'VICTORY',     // Build Mode Helper
  GRAB = 'GRAB',           // Delete Voxel
  THUMBS_UP = 'THUMBS_UP', // Toggle Menu
  POINT = 'POINT'          // Color Picking
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureSettings {
  pinchThreshold: number; // Max distance between thumb and index
  grabThreshold: number;  // Max extension of fingers for fist
  minConfidence?: number; // Minimum confidence required to trigger actions
}

export interface TrackingState {
  isTracking: boolean;
  landmarks: HandLandmark[];
  gesture: GestureType;
  confidence: number;
  sampledColor?: string; // New: Color detected under the finger
}

// Application State Types
export enum EditorMode {
  VIEW = 'VIEW',
  BUILD = 'BUILD',
  DELETE = 'DELETE',
  COLOR = 'COLOR' // New: Real-world color sampling mode
}

export interface AppState {
  mode: EditorMode;
  selectedColor: string;
  voxels: VoxelMap;
  isMenuOpen: boolean;
  fps: number;
}
