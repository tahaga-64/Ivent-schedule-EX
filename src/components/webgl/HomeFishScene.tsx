import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// ─── 魚1匹 ───────────────────────────────────────────────────────────────────

interface FishProps {
  position: [number, number, number];
  color: string;
  phase: number;
  scale?: number;
}

function Fish({ position, color, phase, scale = 1 }: FishProps) {
  const ref = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.65 + phase;
    ref.current.position.y = position[1] + Math.sin(t) * 0.14;
    ref.current.rotation.y = Math.sin(t * 0.4) * 0.25;
    ref.current.rotation.z = Math.sin(t * 1.8) * 0.04;
  });

  return (
    <group ref={ref} position={position} scale={scale}>
      {/* 胴体: 横に伸ばした球 */}
      <mesh scale={[1.5, 0.65, 0.58]}>
        <sphereGeometry args={[0.4, 28, 18]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.35} />
      </mesh>
      {/* 背びれ */}
      <mesh position={[0.1, 0.36, 0]} rotation={[0, 0, 0.2]}>
        <coneGeometry args={[0.1, 0.26, 6]} />
        <meshStandardMaterial color={color} roughness={0.3} transparent opacity={0.7} />
      </mesh>
      {/* 尾びれ */}
      <mesh position={[-0.62, 0, 0]} rotation={[0, 0, Math.PI * 0.5]}>
        <coneGeometry args={[0.24, 0.42, 6]} />
        <meshStandardMaterial color={color} roughness={0.3} transparent opacity={0.8} />
      </mesh>
      {/* 目 */}
      <mesh position={[0.38, 0.09, 0.24]}>
        <sphereGeometry args={[0.07, 14, 14]} />
        <meshStandardMaterial color="#050a1a" />
      </mesh>
      {/* 目の光 */}
      <mesh position={[0.41, 0.12, 0.27]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

// ─── 魚の群れ（スクロール連動） ───────────────────────────────────────────────

interface GroupProps {
  scrollProgressRef: React.MutableRefObject<number>;
}

function FishGroup({ scrollProgressRef }: GroupProps) {
  const ref = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = scrollProgressRef.current;
    ref.current.rotation.y = Math.sin(t * 0.22) * 0.35 + p * Math.PI * 0.85;
    ref.current.rotation.x = Math.sin(t * 0.14) * 0.07;
    ref.current.position.z = p * 1.4;
  });

  return (
    <group ref={ref}>
      <Fish position={[0, 0, 0]}         color="#22c8d8" phase={0}   scale={1.2} />
      <Fish position={[1.4, 0.5, -0.6]}  color="#0e7490" phase={1.8} scale={0.9} />
      <Fish position={[-1.2, -0.4, 0.4]} color="#67e8f9" phase={3.4} scale={0.75} />
      <Sparkles count={55} scale={6} size={2} speed={0.3} color="#4fe3f2" opacity={0.55} />
    </group>
  );
}

// ─── エクスポート ─────────────────────────────────────────────────────────────

interface Props {
  scrollProgressRef: React.MutableRefObject<number>;
}

export default function HomeFishScene({ scrollProgressRef }: Props) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 52, near: 0.1, far: 50 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 6, 4]} intensity={1.6} color="#ffe9c4" />
      <pointLight position={[-4, 2, 4]} intensity={1.4} color="#22c8d8" />
      <FishGroup scrollProgressRef={scrollProgressRef} />
    </Canvas>
  );
}
