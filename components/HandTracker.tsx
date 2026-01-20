
import React, { useEffect, useRef, useState } from 'react';
import { TrackingState, GestureType, HandLandmark, GestureSettings } from '../types';
import { Camera, CameraOff, Loader2, ScanFace } from 'lucide-react';
import { detectGesture } from '../services/gestureService';
// @ts-ignore
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface HandTrackerProps {
  onUpdate: (state: TrackingState) => void;
  handPosRef: React.MutableRefObject<{x: number, y: number}>;
  isColorPickingMode: boolean;
  gestureSettings: GestureSettings;
}

function toScreenSpace(x: number, y: number, videoWidth: number, videoHeight: number, screenWidth: number, screenHeight: number) {
    if (!videoWidth || !videoHeight || !screenWidth || !screenHeight) return { x, y };
    const videoAspect = videoWidth / videoHeight;
    const screenAspect = screenWidth / screenHeight;
    let sx = x, sy = y;
    if (screenAspect > videoAspect) {
        const scale = screenWidth / videoWidth;
        const visualHeight = videoHeight * scale;
        const topOffset = (screenHeight - visualHeight) / 2;
        sy = ((y * visualHeight) + topOffset) / screenHeight;
    } else {
        const scale = screenHeight / videoHeight;
        const visualWidth = videoWidth * scale;
        const leftOffset = (screenWidth - visualWidth) / 2;
        sx = ((x * visualWidth) + leftOffset) / screenWidth;
    }
    return { x: sx, y: sy };
}

// Helper to convert RGB to Hex
const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (n: number) => {
        const val = Math.round(n);
        return (val < 0 ? 0 : val > 255 ? 255 : val).toString(16).padStart(2, '0');
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Rolling average buffer for color stability
const colorHistory: { r: number, g: number, b: number }[] = [];
const HISTORY_SIZE = 10; 

function sampleColorAt(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): string | undefined {
    const px = Math.floor(Math.max(0, Math.min(1, x)) * width);
    const py = Math.floor(Math.max(0, Math.min(1, y)) * height);
    
    let r = 0, g = 0, b = 0, count = 0;

    try {
        const startX = Math.max(0, px - radius);
        const startY = Math.max(0, py - radius);
        const w = Math.min(width, px + radius) - startX + 1;
        const h = Math.min(height, py + radius) - startY + 1;
        
        if (w <= 0 || h <= 0) return undefined;

        const imageData = ctx.getImageData(startX, startY, w, h);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
        }
    } catch (e) {
        return undefined;
    }

    if (count === 0) return undefined;

    // Add current sample to history
    colorHistory.push({ r: r / count, g: g / count, b: b / count });
    if (colorHistory.length > HISTORY_SIZE) colorHistory.shift();

    // Calculate average of history
    let avgR = 0, avgG = 0, avgB = 0;
    for (const c of colorHistory) {
        avgR += c.r;
        avgG += c.g;
        avgB += c.b;
    }
    avgR /= colorHistory.length;
    avgG /= colorHistory.length;
    avgB /= colorHistory.length;

    // Reject near-white / near-black samples (likely noise or empty background)
    if ((avgR > 245 && avgG > 245 && avgB > 245) || (avgR < 10 && avgG < 10 && avgB < 10)) {
      return undefined;
    }

    return rgbToHex(avgR, avgG, avgB);
}

export const HandTracker: React.FC<HandTrackerProps> = ({ onUpdate, handPosRef, isColorPickingMode, gestureSettings }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isActive, setIsActive] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(false);
  
  const handLandmarkerRef = useRef<any>(null);
  const animationFrameRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastGestureRef = useRef<GestureType>(GestureType.NONE);

  const prevPosRef = useRef<{x: number, y: number}>({ x: 0.5, y: 0.5 });
  const settingsRef = useRef(gestureSettings); 
  const SMOOTHING_FACTOR = 0.6; 

  useEffect(() => {
    settingsRef.current = gestureSettings;
  }, [gestureSettings]);

  // Load model function lifted so it can be retried from UI
  const loadModel = async () => {
    setIsModelLoading(true);
    setModelLoadError(false);
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
      );
      if (handLandmarkerRef.current) {
        try { handLandmarkerRef.current.close(); } catch {}
        handLandmarkerRef.current = null;
      }
      handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
    } catch (err) {
      console.error("Failed to load MediaPipe model:", err);
      setModelLoadError(true);
    } finally {
      setIsModelLoading(false);
    }
  };

  useEffect(() => {
    loadModel();
    return () => { if (handLandmarkerRef.current) handLandmarkerRef.current.close(); };
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!isActive) return;

    const startCamera = async () => {
      try {
        setPermissionError(false);
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = predictWebcam;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setPermissionError(true);
        setIsActive(false);
      }
    };

    const predictWebcam = () => {
      if (!handLandmarkerRef.current || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (video.clientWidth && (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight)) {
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;
      }

      if (video.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = video.currentTime;
          const startTimeMs = performance.now();
          const results = handLandmarkerRef.current.detectForVideo(video, startTimeMs);

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          if (results.landmarks && results.landmarks.length > 0) {
            const landmarks: HandLandmark[] = results.landmarks[0];
            const videoW = video.videoWidth;
            const videoH = video.videoHeight;
            const screenW = canvas.width;
            const screenH = canvas.height;

            // 1. Detect Gesture Early to determine sampling strategy
            const { type: gestureType, confidence } = detectGesture(landmarks, settingsRef.current);
            const isGrabbing = gestureType === GestureType.GRAB;
            const isPointing = gestureType === GestureType.POINT;

            // 2. Cursor Positioning (Visual Interaction Point)
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];
            const pinchCenterX = (indexTip.x + thumbTip.x) / 2;
            const pinchCenterY = (indexTip.y + thumbTip.y) / 2;

            // 3. Object Scanning Center
            let scanCenterX, scanCenterY;

            if (isGrabbing) {
                // Palm Center: Average of Wrist and MCPs
                scanCenterX = (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[13].x + landmarks[17].x) / 5;
                scanCenterY = (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[13].y + landmarks[17].y) / 5;
            } else if (isPointing) {
                // Exact Index Tip
                scanCenterX = indexTip.x;
                scanCenterY = indexTip.y;
            } else {
                // Pinch/Default: Midpoint
                scanCenterX = pinchCenterX;
                scanCenterY = pinchCenterY;
            }

            // Convert Cursor to Screen Space for App Interaction (Navigation)
            const { x: targetX, y: targetY } = toScreenSpace(1 - pinchCenterX, pinchCenterY, videoW, videoH, screenW, screenH);
            const smoothedX = prevPosRef.current.x + (targetX - prevPosRef.current.x) * SMOOTHING_FACTOR;
            const smoothedY = prevPosRef.current.y + (targetY - prevPosRef.current.y) * SMOOTHING_FACTOR;
            
            prevPosRef.current = { x: smoothedX, y: smoothedY };
            handPosRef.current = { x: smoothedX, y: smoothedY };

            // 4. Color Sampling
            let sampledColor = undefined;
            // Convert scan center to screen space for sampling
            const { x: hudScanX, y: hudScanY } = toScreenSpace(1 - scanCenterX, scanCenterY, videoW, videoH, screenW, screenH);

            if (isColorPickingMode) {
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
                ctx.restore();
                
                // Adjustable radius based on mode
                const scanRadius = isGrabbing ? 30 : 8; 
                
              sampledColor = sampleColorAt(ctx, hudScanX, hudScanY, canvas.width, canvas.height, scanRadius);
                ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear video frame after sampling
            }

            const transformedLandmarks = landmarks.map(lm => {
                const coords = toScreenSpace(lm.x, lm.y, videoW, videoH, screenW, screenH);
                return { ...lm, x: coords.x, y: coords.y };
            });

            // 5. Draw HUD
            drawHUD(ctx, transformedLandmarks, canvas.width, canvas.height, isColorPickingMode, {x: hudScanX, y: hudScanY}, isGrabbing, isPointing);

            // 6. Update State
            if (gestureType !== lastGestureRef.current || gestureType === GestureType.PINCH || gestureType === GestureType.GRAB || isColorPickingMode) {
                lastGestureRef.current = gestureType;
                onUpdate({ isTracking: true, landmarks, gesture: gestureType, confidence, sampledColor });
            }
          } else {
             if (lastGestureRef.current !== GestureType.NONE) {
                 lastGestureRef.current = GestureType.NONE;
                 onUpdate({ isTracking: true, landmarks: [], gesture: GestureType.NONE, confidence: 0 });
             }
          }
      }
      if (isActive) animationFrameRef.current = requestAnimationFrame(predictWebcam);
    };

    if (handLandmarkerRef.current) startCamera();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isActive, isModelLoading, isColorPickingMode]); 

  return (
    <>
      <div className={`fixed inset-0 z-0 bg-black transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
         <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover transform -scale-x-100" />
         <canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover transform -scale-x-100 pointer-events-none" />
         <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      { (permissionError || modelLoadError) && (
        <div className="absolute bottom-24 left-6 z-50">
          <div className="flex items-center gap-3 bg-red-900/80 text-white px-4 py-2 rounded-md">
            <div className="text-sm">
              {permissionError ? 'Camera permission denied.' : 'Model failed to load.'}
            </div>
            {permissionError && <button onClick={() => { setPermissionError(false); setIsActive(true); }} className="ml-2 px-3 py-1 bg-white/10 rounded">Retry Camera</button>}
            {modelLoadError && <button onClick={() => { loadModel(); }} className="ml-2 px-3 py-1 bg-white/10 rounded">Reload Model</button>}
          </div>
        </div>
      )}

      <div className="absolute bottom-6 left-6 z-50">
        <div className="flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-full shadow-2xl">
           <button 
             onClick={() => setIsActive(!isActive)}
             disabled={isModelLoading}
             className={`p-3 rounded-full transition-all duration-300 ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-slate-400'}`}
           >
               {isModelLoading ? <Loader2 size={20} className="animate-spin" /> : (isActive ? <ScanFace size={20} /> : <CameraOff size={20} />)}
           </button>
        </div>
      </div>
    </>
  );
};

const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

function drawHUD(ctx: CanvasRenderingContext2D, landmarks: HandLandmark[], width: number, height: number, isColorPicking: boolean, scanPos: {x:number, y:number}, isGrabbing: boolean, isPointing: boolean) {
    const mainColor = isColorPicking ? 'rgba(217, 70, 239, 0.5)' : 'rgba(34, 211, 238, 0.4)';
    const accentColor = isColorPicking ? '#f0abfc' : '#67e8f9';

    // Draw Skeleton
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = mainColor;
    ctx.beginPath();
    for (const [start, end] of HAND_CONNECTIONS) {
        const p1 = landmarks[start];
        const p2 = landmarks[end];
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
    }
    ctx.stroke();

    // Draw Points
    ctx.fillStyle = accentColor;
    for (const point of landmarks) {
        ctx.beginPath();
        ctx.arc(point.x * width, point.y * height, 2, 0, 2 * Math.PI);
        ctx.fill();
    }

    // --- SCANNER HUD ---
    if (isColorPicking) { 
        const cx = scanPos.x * width;
        const cy = scanPos.y * height;
        
        ctx.strokeStyle = '#ffffff';
        
        if (isGrabbing) {
             // OBJECT DETECTED MODE (Circle around Hand/Palm)
             const radius = 60; // Larger "Object" radius
             
             // Animated pulse ring
             ctx.beginPath();
             ctx.arc(cx, cy, radius, 0, Math.PI * 2);
             ctx.lineWidth = 2;
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
             ctx.stroke();

             ctx.beginPath();
             ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
             ctx.lineWidth = 1;
             ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
             ctx.stroke();
             
             ctx.fillStyle = "rgba(255,255,255,0.9)";
             ctx.font = "bold 12px monospace";
             ctx.fillText("OBJECT DETECTED", cx - 50, cy + radius + 20);
             
        } else if (isPointing) {
            // POINTER MODE (Crosshair at Index Tip)
            const size = 15;
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.moveTo(cx - size, cy);
            ctx.lineTo(cx + size, cy);
            ctx.moveTo(cx, cy - size);
            ctx.lineTo(cx, cy + size);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.font = "10px monospace";
            ctx.fillText("POINTING", cx - 20, cy - size - 10);

        } else {
            // DEFAULT PINCH MODE (Reticle around finger gap)
            const size = 20;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            // Corners
            ctx.moveTo(cx - size, cy - size + 10); ctx.lineTo(cx - size, cy - size); ctx.lineTo(cx - size + 10, cy - size);
            ctx.moveTo(cx + size - 10, cy - size); ctx.lineTo(cx + size, cy - size); ctx.lineTo(cx + size, cy - size + 10);
            ctx.moveTo(cx + size, cy + size - 10); ctx.lineTo(cx + size, cy + size); ctx.lineTo(cx + size - 10, cy + size);
            ctx.moveTo(cx - size + 10, cy + size); ctx.lineTo(cx - size, cy + size); ctx.lineTo(cx - size, cy + size - 10);
            
            ctx.stroke();

            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.font = "10px monospace";
            ctx.fillText("PINCH TO SCAN", cx - 40, cy + size + 15);
        }
    }
}
