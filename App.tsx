
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Scene3D } from './components/Scene3D';
import { UIOverlay } from './components/UIOverlay';
import { HandTracker } from './components/HandTracker';
import { apiService } from './services/apiService';
import { AppState, EditorMode, GestureType, VoxelMap, VoxelData, TrackingState, HistoryAction, GestureSettings } from './types';
import { COLORS, DEBOUNCE_MS, DEFAULT_GESTURE_SETTINGS, GESTURE_CONFIDENCE_MIN } from './constants';

const App: React.FC = () => {
  // State
  const [voxels, setVoxels] = useState<VoxelMap>(new Map());
  const [mode, setMode] = useState<EditorMode>(EditorMode.BUILD);
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);
  const [currentGesture, setCurrentGesture] = useState<GestureType>(GestureType.NONE);
  const [fps, setFps] = useState<number>(0);
  const [gestureSettings, setGestureSettings] = useState<GestureSettings>(DEFAULT_GESTURE_SETTINGS);
  
  // Undo/Redo Stacks
  const [history, setHistory] = useState<HistoryAction[]>([]);
  const [future, setFuture] = useState<HistoryAction[]>([]);

  // High-Performance Transient  State (No Re-renders for position)
  const handPosRef = useRef<{ x: number, y: number }>({ x: 0.5, y: 0.5 });
  const gridPosRef = useRef<{ x: number, y: number, z: number }>({ x: 0, y: 0, z: 0 });
  const voxelsRef = useRef<VoxelMap>(new Map());
  
  // Cooldown Ref for Action Limiting
  const lastActionTimeRef = useRef<number>(0); 

  // Initialize & Persistence
  useEffect(() => {
    const loadWorld = async () => { 
      // 1. Try LocalStorage first
      const saved = localStorage.getItem('voxelverse_data');
      if (saved) {
          try {
              const parsed = JSON.parse(saved) as VoxelData[];
              const map = new Map<string, VoxelData>();
              parsed.forEach(v => map.set(v.id, v));
              setVoxels(map);
              console.log("Loaded World from the Local of Storage");
              return;
          } catch(e) {
              console.error("Fail to Parse local  Storage", e);
          }
      }

      // 2. Fallback to API/Empty
      const initialVoxels = await apiService.getWorld();
      const map = new Map<string, VoxelData>();
      initialVoxels.forEach(v => map.set(v.id, v));
      setVoxels(map);
    };
    loadWorld();
  }, []);

  // Sync Ref & Auto-Save 
  useEffect(() => {
    voxelsRef.current = voxels;
    
    // Simple debounce save
    const timeout = setTimeout(() => {
        const arr = Array.from(voxels.values());
        localStorage.setItem('voxelverse_data', JSON.stringify(arr));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [voxels]);

  // Action Handlers
  const handlePlaceVoxel = useCallback(async (x: number, y: number, z: number, shouldRecordHistory = true) => {
    const now = performance.now();
    // Enforce cooldown to prevent "spraying" blocks too fast
    if (now - lastActionTimeRef.current < DEBOUNCE_MS) return;
    
    const id = `${x},${y},${z}`;
    if (voxelsRef.current.has(id)) return; 

    lastActionTimeRef.current = now; // Update timestamp

    const newVoxel: VoxelData = { id, x, y, z, color: selectedColor };
    
    voxelsRef.current.set(id, newVoxel);
    setVoxels(prev => {
      const next = new Map(prev);
      next.set(id, newVoxel);
      return next;
    });

    if (shouldRecordHistory) {
      setHistory(prev => [...prev, { type: 'PLACE', voxel: newVoxel }]);
      setFuture([]);
    }

    await apiService.placeVoxel(newVoxel);
  }, [selectedColor]);

  const handleDeleteVoxel = useCallback(async (x: number, y: number, z: number, shouldRecordHistory = true) => {
    const now = performance.now();
    if (now - lastActionTimeRef.current < DEBOUNCE_MS) return;

    const id = `${x},${y},${z}`;
    if (!voxelsRef.current.has(id)) return; 
    
    lastActionTimeRef.current = now;

    const voxelToDelete = voxelsRef.current.get(id)!;
    
    voxelsRef.current.delete(id);
    setVoxels(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

    if (shouldRecordHistory) {
      setHistory(prev => [...prev, { type: 'DELETE', voxel: voxelToDelete }]);
      setFuture([]);
    }

    await apiService.deleteVoxel(id);
  }, []);

  const handleUndo = useCallback(async () => {
    if (history.length === 0) return;
    const action = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setFuture(prev => [...prev, action]);

    if (action.type === 'PLACE') {
      const { id } = action.voxel;
      setVoxels(prev => { const next = new Map(prev); next.delete(id); return next; });
    } else if (action.type === 'DELETE') {
      const { id } = action.voxel;
      setVoxels(prev => { const next = new Map(prev); next.set(id, action.voxel); return next; });
    }
  }, [history]);

  const handleRedo = useCallback(async () => {
    if (future.length === 0) return;
    const action = future[future.length - 1];
    setFuture(prev => prev.slice(0, -1));
    setHistory(prev => [...prev, action]);

    if (action.type === 'PLACE') {
      const { id } = action.voxel;
      setVoxels(prev => { const next = new Map(prev); next.set(id, action.voxel); return next; });
    } else if (action.type === 'DELETE') {
      const { id } = action.voxel;
      setVoxels(prev => { const next = new Map(prev); next.delete(id); return next; });
    }
  }, [future]);

  // Gesture Processor
  const handleTrackingUpdate = useCallback((state: TrackingState) => {
    setCurrentGesture(state.gesture);

    if (state.isTracking) {
      const { x, y, z } = gridPosRef.current;

      // --- INTELLIGENT COLOR SAMPLING ---
      // Enhanced logic: Auto-detect color when grabbing an object in Build Mode
      // We filter out pure white/black as they usually indicate sampling errors or empty space
      if (state.sampledColor && state.sampledColor !== '#ffffff' && state.sampledColor !== '#000000') {
         const shouldUpdateColor = mode === EditorMode.COLOR || (mode === EditorMode.BUILD && state.gesture === GestureType.GRAB);
             
         if (shouldUpdateColor) {
           setSelectedColor(state.sampledColor);
         }
      }

      // --- ACTION LOGIC (gate by confidence) ---
      const minConf = gestureSettings.minConfidence ?? GESTURE_CONFIDENCE_MIN;

      if (state.gesture === GestureType.PINCH && state.confidence >= minConf) {
        // Pinch is primarily for placing
        if (mode === EditorMode.BUILD || mode === EditorMode.COLOR) {
           handlePlaceVoxel(x, y, z, true);
        }
      } 
      else if (state.gesture === GestureType.GRAB && state.confidence >= minConf) {
        // IMPORTANT: GRAB is for DELETE only in DELETE  mode.
        // In Build Mode, GRAB means "Hold Object to Scan Color" (handled above).
        if (mode === EditorMode.DELETE) {
           handleDeleteVoxel(x, y, z, true);
        }
      }
    }
  }, [handlePlaceVoxel, handleDeleteVoxel, mode]);

  // We pass  true to isColorPickingMode if in COLOR mode OR if in BUILD mode (to allow background sampling)
  const isSamplingActive = mode === EditorMode.COLOR || mode === EditorMode.BUILD;

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-10">
        <Scene3D 
          voxels={voxels} 
          selectedColor={selectedColor}
          handPosRef={handPosRef}
          gridPosRef={gridPosRef}
          mode={mode}
          currentGesture={currentGesture}
          onFpsUpdate={setFps}
        />
      </div>

      {/* UI Layer */}
      <UIOverlay 
        mode={mode} 
        setMode={setMode} 
        selectedColor={selectedColor} 
        setColor={setSelectedColor}
        currentGesture={currentGesture}
        voxelCount={voxels.size}
        fps={fps}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
        gestureSettings={gestureSettings}
        onUpdateSettings={setGestureSettings}
      />

      {/* Vision Layer with Bi-directional Communication for Color Picking */}
      <HandTracker 
        onUpdate={handleTrackingUpdate} 
        handPosRef={handPosRef}
        isColorPickingMode={isSamplingActive}
        gestureSettings={gestureSettings}
      />
      
    </div>
  );
};

export default App;
