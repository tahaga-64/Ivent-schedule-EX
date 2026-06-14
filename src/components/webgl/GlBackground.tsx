import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Vertex shader ──────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Fragment shader — 2-layer FBM domain warp, ocean palette ──────────────

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uMouse;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    return mix(
      mix(hash(i),              hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    ) * 2.0 - 1.0;
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(0.8660, -0.5000, 0.5000, 0.8660);
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p  = m * p * 2.01;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t  = uTime * 0.045;

    // Subtle mouse warp
    vec2 m = uMouse - 0.5;
    uv += m * 0.05 * (1.0 - length(m));

    // Layer 1 — direction field q
    vec2 q = vec2(
      fbm(uv * 1.5 + t),
      fbm(uv * 1.5 + vec2(5.2, 1.3) + t)
    );

    // Layer 2 — warped by q
    vec2 r = vec2(
      fbm(uv * 1.2 + 4.2 * q + vec2(1.7, 9.2) + t * 0.8),
      fbm(uv * 1.2 + 4.2 * q + vec2(8.3, 2.8) + t * 0.8)
    );

    float f = fbm(uv + 3.0 * r + t * 0.4);
    f = f * 0.5 + 0.5;

    // Palette: deep ocean → ocean blue → teal → bright aqua
    vec3 c0 = vec3(0.016, 0.067, 0.122); // #041122  deep navy
    vec3 c1 = vec3(0.039, 0.227, 0.369); // #0a3a5e  ocean blue
    vec3 c2 = vec3(0.055, 0.455, 0.565); // #0e7490  teal (app accent)
    vec3 c3 = vec3(0.133, 0.784, 0.847); // #22c8d8  bright aqua
    vec3 c4 = vec3(0.310, 0.890, 0.949); // #4fe3f2  ice aqua highlight

    vec3 col = c0;
    col = mix(col, c1, smoothstep(0.15, 0.42, f));
    col = mix(col, c2, smoothstep(0.38, 0.65, f));
    col = mix(col, c3, smoothstep(0.60, 0.82, f) * 0.70);
    col = mix(col, c4, smoothstep(0.78, 1.00, f) * 0.40);

    // Mouse proximity glow — cyan corona
    float md = length(uMouse - vUv);
    col += vec3(0.000, 0.090, 0.130) * (1.0 - smoothstep(0.0, 0.55, md));

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Plane component ────────────────────────────────────────────────────────

function FluidPlane() {
  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5));

  const uniforms = useRef({
    uTime:  { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
  });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.set(
        e.clientX / window.innerWidth,
        1.0 - e.clientY / window.innerHeight,
      );
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame(({ clock }) => {
    uniforms.current.uTime.value = clock.getElapsedTime();
    uniforms.current.uMouse.value.lerp(mouseRef.current, 0.035);
  });

  return (
    <mesh scale={[2, 2, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms.current}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Canvas wrapper ─────────────────────────────────────────────────────────

interface Props {
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export default function GlBackground({ containerRef }: Props) {
  const [vh, setVh] = useState(0);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const update = () => setVh(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return (
    <div
      aria-hidden
      className="sticky top-0 pointer-events-none select-none print:hidden"
      style={{ height: 0, zIndex: 0 }}
    >
      <div style={{ height: vh || '100dvh', position: 'relative' }}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 1], fov: 75, near: 0.1, far: 10 }}
          gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
          style={{ width: '100%', height: '100%' }}
        >
          <FluidPlane />
        </Canvas>
      </div>
    </div>
  );
}
