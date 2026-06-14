import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { scrollState } from '../../lib/smoothScroll';

// ─── Vertex shader ──────────────────────────────────────────────────────────

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ─── Fragment shader — 2-layer FBM domain warp ──────────────────────────────

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uVelocity;

  varying vec2 vUv;

  // Quintic-smoothed value noise
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

  // 6-octave FBM with slight rotation per octave
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(0.8660, -0.5000, 0.5000, 0.8660); // rotate 30deg
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p  = m * p * 2.01;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t  = uTime * 0.055;

    // Subtle mouse warp (attractive pull toward cursor)
    vec2 m  = uMouse - 0.5;
    uv += m * 0.045 * (1.0 - length(m));

    // Scroll velocity stretches the fluid vertically
    uv.y -= uVelocity * 0.0018;

    // ── Layer 1: direction field q ──
    vec2 q = vec2(
      fbm(uv * 1.6 + t),
      fbm(uv * 1.6 + vec2(5.2, 1.3) + t)
    );

    // ── Layer 2: warped by q ──
    vec2 r = vec2(
      fbm(uv * 1.3 + 4.0 * q + vec2(1.7, 9.2) + t * 0.85),
      fbm(uv * 1.3 + 4.0 * q + vec2(8.3, 2.8) + t * 0.85)
    );

    float f = fbm(uv + 2.8 * r + t * 0.45);
    f = f * 0.5 + 0.5; // remap to [0,1]

    // ── Color palette: near-black → indigo → violet → teal hint ──
    vec3 c0 = vec3(0.006, 0.015, 0.047); // #01030c  near-black
    vec3 c1 = vec3(0.047, 0.039, 0.188); // #0a0a30  deep indigo
    vec3 c2 = vec3(0.118, 0.047, 0.298); // #1e0c4c  dark violet
    vec3 c3 = vec3(0.051, 0.169, 0.357); // #0d2b5b  deep teal-blue

    vec3 col = c0;
    col = mix(col, c1, smoothstep(0.18, 0.50, f));
    col = mix(col, c2, smoothstep(0.44, 0.72, f));
    col = mix(col, c3, smoothstep(0.68, 0.92, f) * 0.38);

    // Mouse proximity glow (subtle cyan corona)
    float md  = length(uMouse - vUv);
    col += vec3(0.014, 0.035, 0.110) * smoothstep(0.55, 0.0, md);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// ─── Plane component ────────────────────────────────────────────────────────

function FluidPlane() {
  const meshRef  = useRef<THREE.Mesh>(null!);
  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5));
  const velRef   = useRef(0);

  const uniforms = useRef<{
    uTime:     { value: number };
    uMouse:    { value: THREE.Vector2 };
    uVelocity: { value: number };
  }>({
    uTime:     { value: 0 },
    uMouse:    { value: new THREE.Vector2(0.5, 0.5) },
    uVelocity: { value: 0 },
  });

  // Mouse tracking (canvas is pointer-events:none → listen on window)
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

  // rAF loop — never calls setState, only mutates refs and uniforms
  useFrame(({ clock }) => {
    const u = uniforms.current;
    u.uTime.value = clock.getElapsedTime();

    // Smooth mouse lerp
    u.uMouse.value.lerp(mouseRef.current, 0.04);

    // Smooth velocity decay
    const target = scrollState.velocity;
    velRef.current += (target - velRef.current) * 0.08;
    u.uVelocity.value = velRef.current;
  });

  return (
    <mesh ref={meshRef} scale={[2, 2, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
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

export default function GlBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none print:hidden"
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 1], fov: 75, near: 0.1, far: 10 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'low-power',
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <FluidPlane />
      </Canvas>
    </div>
  );
}
