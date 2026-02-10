
import { HandLandmark, GestureType, GestureSettings } from '../types';
import { DEFAULT_GESTURE_SETTINGS } from '../constants';

// Helper to calculate Euclidean distance between two 3D points 
const getDistance = (p1: HandLandmark, p2: HandLandmark): number => {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) +
    Math.pow(p1.y - p2.y, 2) +
    Math.pow(p1.z - p2.z, 2)
  );
};

const isRingExtended = (dist: number) => dist > 0.2;
const isPinkyExtended = (dist: number) => dist > 0.2;

export const detectGesture = (
  landmarks: HandLandmark[], 
  settings: GestureSettings = DEFAULT_GESTURE_SETTINGS
): { type: GestureType; confidence: number } => {
  
  if (!landmarks || landmarks.length < 21) {
    return { type: GestureType.NONE, confidence: 0 };
  }

  const { pinchThreshold, grabThreshold } = settings;

  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];
  const wrist = landmarks[0];

  // Distances from wrist (simple extension check)
  const thumbExt = getDistance(wrist, thumbTip);
  const indexExt = getDistance(wrist, indexTip);
  const middleExt = getDistance(wrist, middleTip);
  const ringExt = getDistance(wrist, ringTip);
  const pinkyExt = getDistance(wrist, pinkyTip);

  // 1. PINCH: Thumb tip close to Index tip
  // IMPROVEMENT: Check that other fingers are somewhat open to avoid confusion with Grab/Fist
  const pinchDist = getDistance(thumbTip, indexTip);
  const isPinch = pinchDist < pinchThreshold;
  
  // 2. GRAB (Fist): All fingers close to wrist
  if (indexExt < grabThreshold && middleExt < grabThreshold && ringExt < grabThreshold && pinkyExt < grabThreshold) {
     return { type: GestureType.GRAB, confidence: 0.9 };
  }

  // Check Pinch AFTER Grab to avoid false positives when making a fist
  if (isPinch) {
      return { type: GestureType.PINCH, confidence: 0.95 };
  }

  // 3. VICTORY: Index and Middle extended, others curled
  const isIndexExtended = indexExt > grabThreshold; 
  const isMiddleExtended = middleExt > grabThreshold;
  const isRingCurled = ringExt < 0.2; // Keep looser check for curls in Victory
  const isPinkyCurled = pinkyExt < 0.2;

  if (isIndexExtended && isMiddleExtended && isRingCurled && isPinkyCurled) {
    return { type: GestureType.VICTORY, confidence: 0.85 };
  }

  // 4. POINT: Index extended, others curled (For Color Picking)
  if (isIndexExtended && !isMiddleExtended && isRingCurled && isPinkyCurled) {
    return { type: GestureType.POINT, confidence: 0.8 };
  }

  // 5. THUMBS UP: Thumb extended, others curled
  if (thumbExt > 0.2 && !isIndexExtended && !isMiddleExtended && !isRingExtended(ringExt) && !isPinkyExtended(pinkyExt)) {
      return { type: GestureType.THUMBS_UP, confidence: 0.8 };
  }

  // 6. OPEN HAND: All extended
  if (isIndexExtended && isMiddleExtended && ringExt > 0.2 && pinkyExt > 0.2) {
    return { type: GestureType.OPEN_HAND, confidence: 0.95 };
  }

  return { type: GestureType.NONE, confidence: 0 };
};
