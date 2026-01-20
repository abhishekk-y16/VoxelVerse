
import React, { useState, useEffect } from 'react';
import { EditorMode, GestureType, GestureSettings } from '../types';
import { COLORS } from '../constants';
import { 
  BoxSelect, Trash2, Palette, Undo2, Redo2, Save, Cpu, 
  Maximize2, SlidersHorizontal, Grid3X3, Copy, Rotate3D, 
  Activity, Pipette, MousePointer2, Settings2, Info, ScanEye, X
} from 'lucide-react';

interface UIOverlayProps {
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;
  selectedColor: string;
  setColor: (color: string) => void;
  currentGesture: GestureType;
  voxelCount: number;
  fps?: number;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  gestureSettings: GestureSettings;
  onUpdateSettings: (s: GestureSettings) => void;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({
  mode, setMode, selectedColor, setColor, currentGesture, voxelCount, fps = 0,
  onUndo, onRedo, canUndo, canRedo, gestureSettings, onUpdateSettings
}) => {
  const [pickerMode, setPickerMode] = useState<'grid' | 'sliders'>('grid');
  const [showSettings, setShowSettings] = useState(false);
  
  // Determine if we are actively scanning color from camera
  const isScanning = mode === EditorMode.COLOR || (mode === EditorMode.BUILD && currentGesture === GestureType.GRAB);

  const getGestureColor = (g: GestureType) => {
    switch (g) {
        case GestureType.VICTORY: return 'border-green-500 bg-green-500/20 text-green-200 shadow-[0_0_15px_rgba(34,197,94,0.3)]';
        case GestureType.GRAB: return 'border-red-500 bg-red-500/20 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
        case GestureType.PINCH: return 'border-yellow-400 bg-yellow-400/20 text-yellow-100 shadow-[0_0_15px_rgba(250,204,21,0.3)]';
        case GestureType.OPEN_HAND: return 'border-blue-400 bg-blue-400/20 text-blue-100 shadow-[0_0_15px_rgba(96,165,250,0.3)]';
        case GestureType.POINT: return 'border-fuchsia-400 bg-fuchsia-400/20 text-fuchsia-100 shadow-[0_0_15px_rgba(232,121,249,0.3)]';
        default: return 'border-slate-600 bg-black/60 text-slate-400';
    }
  };

  const gestureLabel = currentGesture === GestureType.NONE ? 'IDLE' : currentGesture.replace('_', ' ');

  return (
    <div className="pointer-events-none select-none text-white">
      
      {/* 1. BRAND HEADER */}
      <div className="absolute top-6 left-8 z-40">
        <h1 className="text-4xl font-black tracking-tighter italic drop-shadow-xl">
            VOXEL<span className="text-cyan-400">VERSE</span>
        </h1>
        <div className="flex items-center gap-2 mt-1 px-2 py-0.5 bg-black/60 rounded-full w-fit backdrop-blur-md border border-white/10">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-mono font-medium text-emerald-400 tracking-widest uppercase">System Online</span>
        </div>
      </div>

      {/* 2. DYNAMIC ISLAND (Gesture Feedback) */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40">
         <div className={`flex items-center gap-5 px-8 py-3 rounded-full backdrop-blur-2xl border-2 transition-all duration-200 ${getGestureColor(currentGesture)}`}>
            <Cpu size={24} strokeWidth={2} className={currentGesture !== GestureType.NONE ? 'animate-pulse' : 'opacity-50'}/>
            
            <div className="flex flex-col items-center w-32">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-60">Gesture Input</span>
                <span className="text-xl font-bold tracking-tight leading-none">{gestureLabel}</span>
            </div>
            
            <div className="h-8 w-px bg-white/20"></div>
            
            <div className="flex gap-4">
                <div className="text-center">
                    <span className="block text-[9px] font-bold uppercase opacity-60">Voxels</span>
                    <span className="font-mono font-bold text-lg leading-none">{voxelCount}</span>
                </div>
                <div className="text-center">
                    <span className="block text-[9px] font-bold uppercase opacity-60">FPS</span>
                    <span className={`font-mono font-bold text-lg leading-none ${fps > 30 ? 'text-green-400' : 'text-yellow-400'}`}>{fps}</span>
                </div>
            </div>
         </div>
      </div>

      {/* 3. RIGHT TOOLBAR */}
      <div className="absolute top-1/2 right-6 -translate-y-1/2 z-40 flex flex-col gap-4 pointer-events-auto">
         
         {/* MODE SELECTOR */}
         <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex flex-col gap-2 shadow-2xl">
            <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-500 tracking-widest text-center">Editor Modes</div>
            
            <ToolButton 
                active={mode === EditorMode.VIEW} 
                onClick={() => setMode(EditorMode.VIEW)} 
                icon={<Rotate3D size={22} />} 
                label="View & Rotate" 
                shortcut="Open Hand"
                color="bg-blue-600"
            />
            <ToolButton 
                active={mode === EditorMode.BUILD} 
                onClick={() => setMode(EditorMode.BUILD)} 
                icon={<BoxSelect size={22} />} 
                label="Build Mode" 
                shortcut="Pinch=Build | Grab=Color"
                color="bg-green-600"
            />
            <ToolButton 
                active={mode === EditorMode.DELETE} 
                onClick={() => setMode(EditorMode.DELETE)} 
                icon={<Trash2 size={22} />} 
                label="Destroy Mode" 
                shortcut="Fist (Hold)"
                color="bg-red-600"
            />
             <ToolButton 
                active={mode === EditorMode.COLOR} 
                onClick={() => setMode(EditorMode.COLOR)} 
                icon={<Pipette size={22} />} 
                label="Color Only" 
                shortcut="Point Finger"
                color="bg-fuchsia-600"
            />
         </div>

         {/* COLOR PALETTE & LIVE SCAN DISPLAY */}
         <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <Palette size={12}/> Material
                </span>
                <div className="flex gap-1 bg-white/5 rounded p-0.5">
                    <button onClick={() => setPickerMode('grid')} className={`p-1 rounded ${pickerMode==='grid'?'bg-white/20 text-white':'text-slate-500'}`}><Grid3X3 size={12}/></button>
                    <button onClick={() => setPickerMode('sliders')} className={`p-1 rounded ${pickerMode==='sliders'?'bg-white/20 text-white':'text-slate-500'}`}><SlidersHorizontal size={12}/></button>
                </div>
            </div>

            {/* LIVE DETECTED COLOR INDICATOR */}
            <div className={`mb-3 flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-300 relative overflow-hidden
                ${isScanning 
                    ? 'bg-fuchsia-500/20 border-fuchsia-500/50 shadow-[0_0_20px_rgba(217,70,239,0.2)]' 
                    : 'bg-white/5 border-white/5'}`
            }>
                {/* Animated Background Scan Line */}
                {isScanning && (
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-fuchsia-500/10 to-transparent animate-[shimmer_2s_infinite] -skew-x-12"></div>
                )}

                <div className="relative z-10">
                    <div className="w-10 h-10 rounded-lg shadow-inner ring-1 ring-white/10 transition-colors duration-75" style={{ backgroundColor: selectedColor }} />
                    {isScanning && (
                         <span className="absolute -top-1 -right-1 flex h-3 w-3">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-3 w-3 bg-fuchsia-500 ring-2 ring-black"></span>
                         </span>
                    )}
                </div>
                
                <div className="flex flex-col flex-1 min-w-0 z-10">
                    <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${isScanning ? 'text-fuchsia-300 animate-pulse' : 'text-slate-400'}`}>
                            {isScanning ? 'LIVE SCANNING...' : 'ACTIVE COLOR'}
                        </span>
                        {isScanning && <ScanEye size={12} className="text-fuchsia-300" />}
                    </div>
                    <span className="font-mono text-base text-white font-bold truncate tracking-wide">
                        {selectedColor.toUpperCase()}
                    </span>
                </div>
                
                <button 
                    className="z-10 text-slate-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors" 
                    onClick={() => navigator.clipboard.writeText(selectedColor)}
                    title="Copy Hex"
                >
                    <Copy size={16}/>
                </button>
            </div>

            {/* PRESET GRID */}
            {pickerMode === 'grid' ? (
                <div className="grid grid-cols-4 gap-2">
                    {COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => setColor(c)}
                            className={`w-9 h-9 rounded-md transition-all duration-200 border-2 ${selectedColor === c ? 'border-white scale-110 shadow-lg ring-2 ring-black/50' : 'border-transparent hover:border-white/50 hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
            ) : (
                <div className="w-[176px] h-[160px] flex flex-col items-center justify-center text-slate-500 gap-2 border border-dashed border-slate-700 rounded-xl">
                    <SlidersHorizontal size={24} className="opacity-50"/>
                    <span className="text-xs">Advanced Mixing Locked</span>
                </div>
            )}
         </div>

         {/* ACTIONS */}
         <div className="flex gap-2 justify-center bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-xl relative">
            <MiniButton icon={<Undo2 size={18} />} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" />
            <MiniButton icon={<Redo2 size={18} />} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" />
            <div className="w-px h-8 bg-white/10 mx-1"></div>
            <MiniButton icon={<Save size={18} />} onClick={() => {}} title="Save World" />
            <MiniButton icon={<Settings2 size={18} />} onClick={() => setShowSettings(!showSettings)} title="Gesture Settings" />
            
            {/* SETTINGS POPOVER */}
            {showSettings && (
                <div className="absolute bottom-full right-0 mb-3 w-64 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl z-50">
                    <div className="flex justify-between items-center mb-3">
                         <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Sensitivity</span>
                         <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-cyan-400 font-mono">PINCH THRESHOLD</span>
                                <span className="text-slate-400">{gestureSettings.pinchThreshold.toFixed(3)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.01" max="0.1" step="0.005"
                                value={gestureSettings.pinchThreshold}
                                onChange={(e) => onUpdateSettings({...gestureSettings, pinchThreshold: parseFloat(e.target.value)})}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                            />
                            <p className="text-[9px] text-slate-500 mt-1">Lower = Harder to trigger pinch</p>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-red-400 font-mono">GRAB THRESHOLD</span>
                                <span className="text-slate-400">{gestureSettings.grabThreshold.toFixed(2)}</span>
                            </div>
                             <input 
                                type="range" 
                                min="0.05" max="0.3" step="0.01"
                                value={gestureSettings.grabThreshold}
                                onChange={(e) => onUpdateSettings({...gestureSettings, grabThreshold: parseFloat(e.target.value)})}
                                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                            />
                            <p className="text-[9px] text-slate-500 mt-1">Lower = Tighter fist required</p>
                        </div>
                    </div>
                </div>
            )}
         </div>

      </div>

      {/* 4. BOTTOM HINTS */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
         <div className="flex items-center gap-6 text-xs font-bold text-slate-300 bg-black/80 px-8 py-3 rounded-full backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
             {mode === EditorMode.BUILD ? (
                 <>
                    <span className={`flex items-center gap-2 transition-colors duration-300 ${isScanning ? 'text-fuchsia-300 font-black animate-pulse' : 'text-fuchsia-300/80'}`}>
                        <ScanEye size={16}/> 
                        {isScanning ? 'SCANNING OBJECT COLOR...' : 'GRAB OBJECT TO SCAN COLOR'}
                    </span>
                    <div className="h-4 w-px bg-white/20"></div>
                    <span className="flex items-center gap-2 text-green-300"><BoxSelect size={16}/> Pinch = Build</span>
                 </>
             ) : (
                <>
                    <span className="flex items-center gap-2"><BoxSelect size={16} className="text-green-400"/> PINCH = Build</span>
                    <div className="h-4 w-px bg-white/20"></div>
                    <span className="flex items-center gap-2"><Trash2 size={16} className="text-red-400"/> FIST = Delete</span>
                </>
             )}
         </div>
      </div>
    </div>
  );
};

const ToolButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; shortcut: string; color: string }> = ({ active, onClick, icon, label, shortcut, color }) => (
    <button 
        onClick={onClick}
        className={`group relative flex h-14 w-full items-center justify-center rounded-xl transition-all duration-200 border-2
        ${active ? `${color} border-white text-white shadow-lg scale-105 z-10` : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10 hover:text-white hover:border-white/20'}`}
    >
        {icon}
        <div className="absolute right-full mr-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 z-50 pointer-events-none">
            <div className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg shadow-xl whitespace-nowrap">
                <div className="font-bold text-white text-sm">{label}</div>
                <div className="text-[10px] font-mono text-cyan-400 mt-1">{shortcut}</div>
            </div>
        </div>
    </button>
);

const MiniButton: React.FC<{ icon: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }> = ({ icon, onClick, disabled, title }) => (
    <button 
        onClick={onClick} disabled={disabled} title={title}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all
          ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/20 hover:scale-105 active:scale-95 text-slate-300 hover:text-white'}`}
    >
        {icon}
    </button>
);
