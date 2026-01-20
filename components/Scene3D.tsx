
import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Effects } from '@react-three/drei';
import * as THREE from 'three';
import { VoxelMap, EditorMode, GestureType } from '../types';

// Extend JSX.IntrinsicElements for React Three Fiber
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      instancedMesh: any;
      boxGeometry: any;
      meshStandardMaterial: any;
      group: any;
      mesh: any;
      meshBasicMaterial: any;
      planeGeometry: any;
      ambientLight: any;
      pointLight: any;
      torusGeometry: any;
    }
  }
}

interface Scene3DProps {
  voxels: VoxelMap;
  selectedColor: string;
  handPosRef: React.MutableRefObject<{ x: number, y: number }>;
  gridPosRef: React.MutableRefObject<{ x: number, y: number, z: number }>;
  mode: EditorMode;
  currentGesture: GestureType;
  onFpsUpdate?: (fps: number) => void;
}

// Lightweight FPS Counter Component
const FpsMonitor: React.FC<{ onUpdate?: (fps: number) => void }> = ({ onUpdate }) => {
  const frames = useRef(0);
  const prevTime = useRef(performance.now());

  useFrame(() => {
    if (!onUpdate) return;
    frames.current++;
    const time = performance.now();
    if (time >= prevTime.current + 500) {
      const fps = Math.round((frames.current * 1000) / (time - prevTime.current));
      onUpdate(fps);
      frames.current = 0;
      prevTime.current = time;
    }
  });

  return null;
};

const VoxelInstances: React.FC<{ voxels: VoxelMap }> = ({ voxels }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const voxelArray = useMemo(() => Array.from(voxels.values()), [voxels]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    if (meshRef.current.count !== voxelArray.length) {
       meshRef.current.count = voxelArray.length;
    }

    voxelArray.forEach((voxel, i) => {
      dummy.position.set(voxel.x, voxel.y, voxel.z);
      // Subtle floating animation offset based on position
      const offset = Math.sin(performance.now() * 0.001 + voxel.x * 0.5) * 0.02;
      dummy.position.y += offset; 
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      meshRef.current!.setColorAt(i, new THREE.Color(voxel.color));
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [voxels, voxelArray, dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 10000]}>
      <boxGeometry args={[0.95, 0.95, 0.95]} />
      {/* Enhanced Material for "Holo" look */}
      <meshStandardMaterial 
        roughness={0.2} 
        metalness={0.8} 
        emissiveIntensity={0.2} // Slight self-glow
        transparent={false}
      />
    </instancedMesh>
  );
};

// Optimized Cursor with Progress Ring
const PreviewCursor: React.FC<{ 
  handPosRef: React.MutableRefObject<{ x: number, y: number }>;
  gridPosRef: React.MutableRefObject<{ x: number, y: number, z: number }>;
  selectedColor: string;
  visible: boolean;
  gesture: GestureType;
  mode: EditorMode;
}> = ({ handPosRef, gridPosRef, selectedColor, visible, gesture, mode }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree(); 

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);
  const intersection = useMemo(() => new THREE.Vector3(), []);

  // Determine cursor appearance based on mode
  const cursorColor = mode === EditorMode.DELETE ? '#ef4444' : selectedColor;

  // Animate the ring based on gesture state
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Raycasting Logic
    const { x: screenX, y: screenY } = handPosRef.current;
    mouse.x = (screenX * 2) - 1;
    mouse.y = -(screenY * 2) + 1;

    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.ray.intersectPlane(plane, intersection);

    if (hit) {
        const gridX = Math.round(hit.x);
        const gridY = Math.round(hit.y);
        const gridZ = 0;
        gridPosRef.current = { x: gridX, y: gridY, z: gridZ };

        // Lerp position for smoothness
        groupRef.current.position.lerp(new THREE.Vector3(gridX, gridY, gridZ), 0.25);
        groupRef.current.visible = visible;

        // Animate Ring
        if (ringRef.current) {
            ringRef.current.rotation.z -= delta * 2;
            const isActive = gesture === GestureType.PINCH || gesture === GestureType.GRAB;
            const targetScale = isActive ? 1.2 : 0.8;
            ringRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        }

        // Pulse Inner Ghost Block
        if (innerRef.current) {
            const pulse = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.05;
            innerRef.current.scale.set(0.8 * pulse, 0.8 * pulse, 0.8 * pulse);
        }
    } else {
        groupRef.current.visible = false;
    }
  });

  return (
    <group ref={groupRef} visible={visible}>
        {/* Core Cursor Box (Wireframe) */}
        <mesh>
            <boxGeometry args={[1.05, 1.05, 1.05]} />
            <meshStandardMaterial 
                color={cursorColor} 
                transparent 
                opacity={0.6} 
                emissive={cursorColor} 
                emissiveIntensity={mode === EditorMode.DELETE ? 2 : 0.8}
                wireframe 
            />
        </mesh>
        
        {/* Inner Ghost Block */}
        <mesh ref={innerRef}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial 
                color={cursorColor} 
                transparent 
                opacity={mode === EditorMode.DELETE ? 0.8 : 0.3} 
                emissive={cursorColor}
                emissiveIntensity={0.2}
            />
        </mesh>

        {/* Rotating Progress Ring */}
        <mesh ref={ringRef} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.8, 0.05, 16, 32]} />
            <meshBasicMaterial color={cursorColor} transparent opacity={0.8} />
        </mesh>
    </group>
  );
};

export const Scene3D: React.FC<Scene3DProps> = ({ 
  voxels, selectedColor, handPosRef, gridPosRef, mode, currentGesture, onFpsUpdate
}) => {
  const canInteract = mode === EditorMode.VIEW;

  return (
    <Canvas camera={{ position: [0, 0, 30], fov: 50 }} gl={{ alpha: true, antialias: true }} dpr={[1, 2]}>
      <FpsMonitor onUpdate={onFpsUpdate} />
      
      {/* Cinematic Lighting */}
      <ambientLight intensity={0.1} />
      <pointLight position={[10, 10, 20]} intensity={1} color="#ffffff" />
      <pointLight position={[-10, -10, 10]} intensity={2} color={selectedColor} distance={50} decay={2} />
      
      <OrbitControls 
        enableRotate={canInteract} 
        enablePan={canInteract} 
        enableZoom={canInteract}
        minDistance={5}
        maxDistance={100}
      />
      
      <VoxelInstances voxels={voxels} />
      
      <PreviewCursor 
        handPosRef={handPosRef} 
        gridPosRef={gridPosRef}
        selectedColor={selectedColor} 
        visible={mode !== EditorMode.VIEW}
        gesture={currentGesture}
        mode={mode}
      />
      
      <Environment preset="city" />
    </Canvas>
  );
};
