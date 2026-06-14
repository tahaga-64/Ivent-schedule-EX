import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, RoundedBox, Sparkles } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import * as THREE from 'three';
import { X } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

/* ──────────────────────────────────────────────────────────────────────────
   ルネサンス × ストリートウェア — 没入型シネマティック体験
   4幕構成のスクロールドリブン WebGL シーン
   Act I  闇からの覚醒      (void black)
   Act II ルネサンスの黄金   (burnt sienna / amber)  — スケートボード
   Act III バロックの蒼      (indigo / cobalt)        — スニーカー
   Act IV  夜明けの上昇      (parchment cream)        — ショッピングバッグ
─────────────────────────────────────────────────────────────────────────── */

// ─── 背景シェーダー ───────────────────────────────────────────────────────

const BG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BG_FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uSection;   // 0〜1 のスクロール進捗
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
      mix(hash(i),                  hash(i + vec2(1.0, 0.0)), u.x),
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
      p  = m * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.05;

    vec2 mo = (uMouse - 0.5);
    uv += mo * 0.04 * (1.0 - length(mo));

    // 2層ドメインワープ
    vec2 q = vec2(
      fbm(uv * 1.6 + t),
      fbm(uv * 1.6 + vec2(5.2, 1.3) + t)
    );
    vec2 r = vec2(
      fbm(uv * 1.3 + 4.0 * q + vec2(1.7, 9.2) + t * 0.7),
      fbm(uv * 1.3 + 4.0 * q + vec2(8.3, 2.8) + t * 0.7)
    );
    float f = fbm(uv + 3.0 * r + t * 0.35);
    f = f * 0.5 + 0.5;

    // 4幕パレット
    // Act I  虚空の黒
    vec3 a0 = vec3(0.012, 0.012, 0.020);
    vec3 a1 = vec3(0.055, 0.047, 0.078);
    // Act II ルネサンスの黄金（バーントシエナ → アンバー）
    vec3 b0 = vec3(0.071, 0.035, 0.024);
    vec3 b1 = vec3(0.557, 0.286, 0.090);
    vec3 b2 = vec3(0.886, 0.612, 0.227);
    // Act III バロックの蒼（インディゴ → コバルト）
    vec3 c0 = vec3(0.027, 0.035, 0.090);
    vec3 c1 = vec3(0.110, 0.157, 0.376);
    vec3 c2 = vec3(0.298, 0.420, 0.741);
    // Act IV パーチメントの夜明け（クリーム）
    vec3 d0 = vec3(0.180, 0.157, 0.227);
    vec3 d1 = vec3(0.776, 0.682, 0.557);
    vec3 d2 = vec3(0.949, 0.910, 0.831);

    // セクションごとに 3 区間で補間
    float s = uSection;

    vec3 actI   = mix(a0, a1, smoothstep(0.25, 0.85, f));
    vec3 actII  = mix(b0, b1, smoothstep(0.20, 0.62, f));
         actII  = mix(actII, b2, smoothstep(0.58, 0.95, f) * 0.85);
    vec3 actIII = mix(c0, c1, smoothstep(0.18, 0.60, f));
         actIII = mix(actIII, c2, smoothstep(0.60, 0.95, f) * 0.8);
    vec3 actIV  = mix(d0, d1, smoothstep(0.15, 0.58, f));
         actIV  = mix(actIV, d2, smoothstep(0.55, 0.95, f) * 0.9);

    // 0→0.33→0.66→1 で 4 幕をクロスフェード
    vec3 col;
    col = mix(actI,  actII,  smoothstep(0.10, 0.36, s));
    col = mix(col,   actIII, smoothstep(0.40, 0.64, s));
    col = mix(col,   actIV,  smoothstep(0.68, 0.92, s));

    // ヴィネット風の中心ハイライト
    float d = distance(vUv, vec2(0.5));
    col += (0.06 - d * 0.10) * (0.5 + 0.5 * s);

    gl_FragColor = vec4(col, 1.0);
  }
`;

interface SharedRefs {
  sectionRef: React.MutableRefObject<number>;
  mouseRef: React.MutableRefObject<THREE.Vector2>;
}

function FluidBackdrop({ sectionRef, mouseRef }: SharedRefs) {
  const { viewport } = useThree();
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useRef({
    uTime: { value: 0 },
    uSection: { value: 0 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
  });
  const smoothSection = useRef(0);

  useFrame(({ clock }) => {
    const u = uniforms.current;
    u.uTime.value = clock.getElapsedTime();
    smoothSection.current += (sectionRef.current - smoothSection.current) * 0.06;
    u.uSection.value = smoothSection.current;
    u.uMouse.value.lerp(mouseRef.current, 0.04);
  });

  return (
    <mesh position={[0, 0, -1]} scale={[viewport.width * 1.2, viewport.height * 1.2, 1]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={BG_VERT}
        fragmentShader={BG_FRAG}
        uniforms={uniforms.current}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

// ─── 黄金の塵パーティクル ─────────────────────────────────────────────────

function GoldDust() {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 1400;

  const positions = useRef<Float32Array>(
    (() => {
      const arr = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 14;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 10;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
      }
      return arr;
    })(),
  );

  useFrame(({ clock }) => {
    const pts = ref.current;
    if (!pts) return;
    const t = clock.getElapsedTime();
    const arr = pts.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += 0.004 + (i % 5) * 0.0008;
      arr[i * 3] += Math.sin(t * 0.3 + i) * 0.0015;
      if (arr[i * 3 + 1] > 5) arr[i * 3 + 1] = -5;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.rotation.y = t * 0.02;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions.current, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#f5c869"
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ─── 大気の霧 ─────────────────────────────────────────────────────────────

function FogPlane() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const m = ref.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.05 + Math.sin(clock.getElapsedTime() * 0.4) * 0.02;
    }
  });
  return (
    <mesh ref={ref} position={[0, 0, 1.5]}>
      <planeGeometry args={[20, 14]} />
      <meshBasicMaterial color="#e8c98a" transparent opacity={0.05} depthWrite={false} />
    </mesh>
  );
}

// ─── 幕ごとの表示制御ヘルパー ─────────────────────────────────────────────

function useActVisibility(group: React.RefObject<THREE.Group>, sectionRef: React.MutableRefObject<number>, lo: number, hi: number) {
  const vis = useRef(0);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = sectionRef.current;
    const target = s >= lo && s <= hi ? 1 : 0;
    vis.current += (target - vis.current) * 0.08;
    g.visible = vis.current > 0.01;
    const k = vis.current;
    g.scale.setScalar(0.6 + k * 0.6);
    g.position.y = (1 - k) * -2.5;
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.material) {
        const mat = mesh.material as THREE.Material & { opacity?: number; transparent?: boolean };
        mat.transparent = true;
        mat.opacity = k;
      }
    });
  });
}

// ─── プロダクト: スケートボード (Act II) ─────────────────────────────────

function Skateboard({ sectionRef }: { sectionRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null!);
  useActVisibility(group, sectionRef, 0.18, 0.46);
  return (
    <group ref={group} position={[0, 0, 0]}>
      <Float speed={1.4} rotationIntensity={0.8} floatIntensity={1.2}>
        <group rotation={[Math.PI * 0.12, 0.4, -0.25]}>
          {/* デッキ */}
          <RoundedBox args={[3.4, 0.12, 0.9]} radius={0.06} smoothness={4}>
            <meshStandardMaterial color="#8a3a1a" roughness={0.5} metalness={0.1} />
          </RoundedBox>
          {/* トラック */}
          {[-1.1, 1.1].map((x) => (
            <mesh key={x} position={[x, -0.18, 0]}>
              <boxGeometry args={[0.12, 0.22, 0.7]} />
              <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
            </mesh>
          ))}
          {/* ウィール */}
          {[
            [-1.25, -0.34, 0.32],
            [-1.25, -0.34, -0.32],
            [1.25, -0.34, 0.32],
            [1.25, -0.34, -0.32],
          ].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.16, 0.16, 0.14, 24]} />
              <meshStandardMaterial color="#f3e9d2" roughness={0.4} />
            </mesh>
          ))}
        </group>
      </Float>
    </group>
  );
}

// ─── プロダクト: スニーカー (Act III) ─────────────────────────────────────

function Sneaker({ sectionRef }: { sectionRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null!);
  useActVisibility(group, sectionRef, 0.46, 0.74);
  return (
    <group ref={group} position={[0, 0, 0]}>
      <Float speed={1.6} rotationIntensity={1.0} floatIntensity={1.4}>
        <group rotation={[0.1, -0.5, 0.05]} scale={1.3}>
          {/* アッパー */}
          <RoundedBox args={[1.7, 0.7, 0.8]} radius={0.28} smoothness={5} position={[0, 0.25, 0]}>
            <meshStandardMaterial color="#dfe6f5" roughness={0.35} metalness={0.15} />
          </RoundedBox>
          {/* トゥキャップ */}
          <mesh position={[0.7, 0.12, 0]}>
            <sphereGeometry args={[0.42, 24, 24]} />
            <meshStandardMaterial color="#c2cde8" roughness={0.3} />
          </mesh>
          {/* ソール */}
          <RoundedBox args={[1.95, 0.28, 0.86]} radius={0.13} smoothness={4} position={[0, -0.18, 0]}>
            <meshStandardMaterial color="#1a2540" roughness={0.6} />
          </RoundedBox>
          {/* ゴールドのアイレット */}
          {[-0.2, 0.05, 0.3].map((x) => (
            <mesh key={x} position={[x, 0.45, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.07, 0.025, 12, 24]} />
              <meshStandardMaterial color="#ffd86b" emissive="#a8791a" emissiveIntensity={0.6} metalness={1} roughness={0.2} />
            </mesh>
          ))}
        </group>
      </Float>
    </group>
  );
}

// ─── プロダクト: ショッピングバッグ (Act IV) ──────────────────────────────

function ShoppingBag({ sectionRef }: { sectionRef: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null!);
  useActVisibility(group, sectionRef, 0.74, 1.01);
  return (
    <group ref={group} position={[0, 0, 0]}>
      <Float speed={1.2} rotationIntensity={0.6} floatIntensity={1.0}>
        <group rotation={[0.05, 0.5, 0]}>
          {/* バッグ本体 */}
          <RoundedBox args={[1.6, 2, 0.9]} radius={0.05} smoothness={4}>
            <meshStandardMaterial color="#f4ecdd" roughness={0.7} metalness={0.05} />
          </RoundedBox>
          {/* ゴールドの取っ手 */}
          {[-0.4, 0.4].map((x) => (
            <mesh key={x} position={[x, 1.15, 0.46]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.3, 0.04, 16, 32, Math.PI]} />
              <meshStandardMaterial color="#d4af37" metalness={1} roughness={0.2} emissive="#7a5a14" emissiveIntensity={0.3} />
            </mesh>
          ))}
          {/* 装飾の帯 */}
          <mesh position={[0, 0, 0.46]}>
            <planeGeometry args={[1.6, 0.4]} />
            <meshStandardMaterial color="#1a2540" roughness={0.5} />
          </mesh>
        </group>
      </Float>
    </group>
  );
}

// ─── カメラのゆるやかなドリフト ───────────────────────────────────────────

function CameraDrift({ sectionRef, mouseRef }: SharedRefs) {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime();
    const s = sectionRef.current;
    const mx = (mouseRef.current.x - 0.5) * 0.6;
    const my = (mouseRef.current.y - 0.5) * 0.4;
    camera.position.x += (Math.sin(t * 0.15) * 0.3 + mx - camera.position.x) * 0.03;
    camera.position.y += (Math.cos(t * 0.12) * 0.2 + my + s * 0.5 - camera.position.y) * 0.03;
    camera.position.z = 6;
    camera.lookAt(0, s * 0.3, 0);
  });
  return null;
}

// ─── ポストプロセッシング ─────────────────────────────────────────────────

function Effects() {
  return (
    <EffectComposer>
      <Bloom
        intensity={1.4}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0009, 0.0012)}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.85} />
    </EffectComposer>
  );
}

// ─── シーン全体 ───────────────────────────────────────────────────────────

function Scene({ sectionRef, mouseRef }: SharedRefs) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} color="#ffe9c4" />
      <pointLight position={[-5, -3, 4]} intensity={1.2} color="#6d8bd4" />
      <spotLight position={[0, 6, 6]} angle={0.5} penumbra={1} intensity={1.8} color="#fff3dc" />

      <FluidBackdrop sectionRef={sectionRef} mouseRef={mouseRef} />
      <FogPlane />
      <GoldDust />
      <Sparkles count={60} scale={[12, 8, 4]} size={3} speed={0.3} color="#ffe9b0" opacity={0.6} />

      <Skateboard sectionRef={sectionRef} />
      <Sneaker sectionRef={sectionRef} />
      <ShoppingBag sectionRef={sectionRef} />

      <CameraDrift sectionRef={sectionRef} mouseRef={mouseRef} />
      <Effects />
    </>
  );
}

// ─── HTML セクション ──────────────────────────────────────────────────────

interface ActProps {
  index: number;
  kicker: string;
  title: string;
  body: string;
  align?: 'left' | 'center' | 'right';
}

function Act({ index, kicker, title, body, align = 'center' }: ActProps) {
  const alignCls =
    align === 'left' ? 'items-start text-left' : align === 'right' ? 'items-end text-right' : 'items-center text-center';
  return (
    <section
      data-act={index}
      className={`relative flex min-h-[100svh] w-full flex-col justify-center px-6 sm:px-12 lg:px-24 ${alignCls}`}
    >
      <div className="max-w-3xl">
        <p
          className="exp-kicker mb-4 text-xs font-semibold uppercase tracking-[0.45em] text-amber-200/80"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {kicker}
        </p>
        <h2
          className="exp-title mb-6 text-5xl font-black leading-[0.95] text-white sm:text-7xl lg:text-8xl"
          style={{ fontFamily: "'Playfair Display', serif", textShadow: '0 4px 40px rgba(0,0,0,0.5)' }}
        >
          {title}
        </h2>
        <p
          className="exp-body max-w-xl text-lg font-light leading-relaxed text-white/75 sm:text-xl"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {body}
        </p>
      </div>
    </section>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function ExperienceView({ onBack }: Props) {
  const sectionRef = useRef(0);
  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Google Fonts を動的に注入
  useEffect(() => {
    const id = 'exp-google-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Cormorant+Garamond:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);

  // マウス追跡
  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      mouseRef.current.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Lenis スムーススクロール + GSAP ScrollTrigger
  useEffect(() => {
    const wrapper = scrollRef.current;
    if (!wrapper) return;

    const lenis = new Lenis({
      wrapper,
      content: wrapper.firstElementChild as HTMLElement,
      lerp: 0.08,
      smoothWheel: true,
    });

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    lenis.on('scroll', ScrollTrigger.update);

    const ctx = gsap.context(() => {
      // 全体進捗を sectionRef に反映
      ScrollTrigger.create({
        trigger: wrapper.firstElementChild as HTMLElement,
        scroller: wrapper,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          sectionRef.current = self.progress;
        },
      });

      // 各幕のテキストをスクロールで出現
      gsap.utils.toArray<HTMLElement>('[data-act]').forEach((sec) => {
        const els = sec.querySelectorAll('.exp-kicker, .exp-title, .exp-body');
        gsap.from(els, {
          y: 60,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: {
            trigger: sec,
            scroller: wrapper,
            start: 'top 75%',
            toggleActions: 'play none none reverse',
          },
        });
      });
    }, wrapper);

    return () => {
      ctx.revert();
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-black">
      {/* 戻るボタン */}
      <button
        onClick={onBack}
        className="fixed right-5 top-5 z-[210] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-md transition-all hover:scale-105 hover:bg-black/60 hover:text-white"
        aria-label="閉じる"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
      >
        <X size={20} />
      </button>

      {/* WebGL キャンバス（固定背景） */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <Canvas
          dpr={[1, 1.8]}
          camera={{ position: [0, 0, 6], fov: 55, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={['#050505']} />
          <Scene sectionRef={sectionRef} mouseRef={mouseRef} />
        </Canvas>
      </div>

      {/* スクロールコンテンツ */}
      <div ref={scrollRef} className="relative z-10 h-full w-full overflow-y-auto overscroll-contain">
        <div className="relative">
          <Act
            index={0}
            kicker="Renaissance × Streetwear"
            title="A Digital Renaissance"
            body="古典絵画の静謐と、ストリートカルチャーの衝動。時を超えた二つの美意識が、ひとつの没入空間で溶け合う。スクロールして、デジタルの美術館をさまよう。"
            align="center"
          />
          <Act
            index={1}
            kicker="Act I · The Golden Hour"
            title="Floating Form"
            body="バーントシエナとアンバーに染まるルネサンスの黄金。重力から解き放たれたスケートボードが、油彩の光の中を漂う。"
            align="left"
          />
          <Act
            index={2}
            kicker="Act II · Baroque Blue"
            title="Sacred Motion"
            body="インディゴとコバルトの荘厳。ゴールドのアイレットが灯すように輝き、一足のスニーカーが祭壇の彫像のごとく宙に静止する。"
            align="right"
          />
          <Act
            index={3}
            kicker="Act III · Dawn of Luxury"
            title="The Ascension"
            body="パーチメントの夜明け。光に満ちた空間へ、ラグジュアリーの象徴が静かに上昇する。芸術と未来が交わる瞬間。"
            align="center"
          />
          <section className="flex min-h-[60svh] w-full flex-col items-center justify-center px-6 text-center">
            <p
              className="text-sm uppercase tracking-[0.4em] text-white/40"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Fin
            </p>
            <button
              onClick={onBack}
              className="mt-6 rounded-full border border-white/25 px-8 py-3 text-sm font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              ← 戻る
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
