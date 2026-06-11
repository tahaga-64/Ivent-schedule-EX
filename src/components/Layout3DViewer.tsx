import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { LayoutItemData, CustomCatalogItem } from './LayoutView';

interface Props {
  items: LayoutItemData[];
  customItems: CustomCatalogItem[];
}

const CATALOG_COLORS: Record<string, string> = {
  round_table: '#6366f1',
  long_table:  '#7c3aed',
  fish_tank:   '#0369a1',
  sandbox:     '#b45309',
  yoyo:        '#be123c',
  seating:     '#0f766e',
  pillar:      '#475569',
  entrance:    '#16a34a',
  prize_desk:  '#db2777',
  partition:   '#64748b',
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

export default function Layout3DViewer({ items }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    isDragging: false,
    lastX: 0,
    lastY: 0,
    rotX: 0.45,   // radians, initial tilt
    rotY: 0.5,
    zoom: 1,
    pinchDist: 0,
  });

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    // ─── Scene setup ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x1e293b);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1e293b, 60, 120);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camera.position.set(0, 20, 30);
    camera.lookAt(0, 0, 0);

    // ─── Lighting ─────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    scene.add(sun);

    // ─── Floor ────────────────────────────────────────────────────────────
    const floorGeo = new THREE.PlaneGeometry(50, 50);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid helper
    const grid = new THREE.GridHelper(50, 25, 0x475569, 0x475569);
    scene.add(grid);

    // Room boundary walls (thin planes)
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x4b5563, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const wallW = 50, wallH = 5;
    [
      { pos: [0, wallH / 2, -25] as [number, number, number], rot: [0, 0, 0] as [number, number, number] },
      { pos: [0, wallH / 2, 25] as [number, number, number], rot: [0, Math.PI, 0] as [number, number, number] },
      { pos: [-25, wallH / 2, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number] },
      { pos: [25, wallH / 2, 0] as [number, number, number], rot: [0, -Math.PI / 2, 0] as [number, number, number] },
    ].forEach(({ pos, rot }) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), wallMat);
      wall.position.set(...pos);
      wall.rotation.set(...rot);
      scene.add(wall);
    });

    // ─── Items ────────────────────────────────────────────────────────────
    // Map 0-100% canvas space to -24..+24 world units
    const toWorld = (pct: number, range = 48) => (pct / 100) * range - range / 2;

    items.forEach(item => {
      const wx = toWorld(item.x);
      const wz = toWorld(item.y);
      const ww = Math.max(0.5, (item.wPct / 100) * 48);
      const wd = Math.max(0.5, (item.hPct / 100) * 48);
      const isCircle = item.type === 'round_table';
      const isPillar = item.type === 'pillar';
      const height = isPillar ? 5 : isCircle ? 0.6 : 0.7;
      const [r, g, b] = hexToRgb(item.color || CATALOG_COLORS[item.type] || '#6366f1');

      let geo: THREE.BufferGeometry;
      if (isCircle) {
        geo = new THREE.CylinderGeometry(ww / 2, ww / 2, height, 24);
      } else if (isPillar) {
        geo = new THREE.BoxGeometry(ww, height, wd);
      } else {
        geo = new THREE.BoxGeometry(ww, height, wd);
      }

      const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(r, g, b) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(wx, height / 2, wz);
      mesh.rotation.y = -(item.rotation * Math.PI) / 180;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Top face highlight
      const topMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(Math.min(1, r + 0.2), Math.min(1, g + 0.2), Math.min(1, b + 0.2)),
      });
      let topGeo: THREE.BufferGeometry;
      if (isCircle) {
        topGeo = new THREE.CircleGeometry(ww / 2 - 0.05, 24);
      } else {
        topGeo = new THREE.PlaneGeometry(ww - 0.05, wd - 0.05);
      }
      const top = new THREE.Mesh(topGeo, topMat);
      top.rotation.x = -Math.PI / 2;
      top.position.set(wx, height + 0.01, wz);
      if (!isCircle) top.rotation.y = -(item.rotation * Math.PI) / 180;
      scene.add(top);
    });

    // ─── Camera pivot (rotate around origin) ──────────────────────────────
    const pivot = new THREE.Object3D();
    scene.add(pivot);

    function updateCamera() {
      const s = stateRef.current;
      const radius = 35 / s.zoom;
      camera.position.x = radius * Math.sin(s.rotY) * Math.cos(s.rotX);
      camera.position.y = radius * Math.sin(s.rotX) + 5;
      camera.position.z = radius * Math.cos(s.rotY) * Math.cos(s.rotX);
      camera.lookAt(0, 2, 0);
    }
    updateCamera();

    // ─── Resize ───────────────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);
    // initial
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    camera.updateProjectionMatrix();

    // ─── Render loop ──────────────────────────────────────────────────────
    let animId = 0;
    function animate() {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    // ─── Mouse / Touch interaction ─────────────────────────────────────────
    const el = renderer.domElement;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      stateRef.current.isDragging = true;
      const p = 'touches' in e ? e.touches[0] : e;
      stateRef.current.lastX = p.clientX;
      stateRef.current.lastY = p.clientY;
    }

    function onPointerMove(e: MouseEvent | TouchEvent) {
      if ('touches' in e && e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (stateRef.current.pinchDist > 0) {
          stateRef.current.zoom = Math.max(0.3, Math.min(5, stateRef.current.zoom * (d / stateRef.current.pinchDist)));
        }
        stateRef.current.pinchDist = d;
        updateCamera();
        return;
      }
      stateRef.current.pinchDist = 0;
      if (!stateRef.current.isDragging) return;
      const p = 'touches' in e ? e.touches[0] : e;
      const dx = p.clientX - stateRef.current.lastX;
      const dy = p.clientY - stateRef.current.lastY;
      stateRef.current.rotY += dx * 0.008;
      stateRef.current.rotX = Math.max(-0.1, Math.min(1.4, stateRef.current.rotX + dy * 0.006));
      stateRef.current.lastX = p.clientX;
      stateRef.current.lastY = p.clientY;
      updateCamera();
    }

    function onPointerUp() {
      stateRef.current.isDragging = false;
      stateRef.current.pinchDist = 0;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      stateRef.current.zoom = Math.max(0.3, Math.min(5, stateRef.current.zoom * (e.deltaY > 0 ? 0.93 : 1.07)));
      updateCamera();
    }

    el.addEventListener('mousedown', onPointerDown);
    el.addEventListener('mousemove', onPointerMove);
    el.addEventListener('mouseup', onPointerUp);
    el.addEventListener('mouseleave', onPointerUp);
    el.addEventListener('touchstart', onPointerDown, { passive: true });
    el.addEventListener('touchmove', onPointerMove, { passive: true });
    el.addEventListener('touchend', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      el.removeEventListener('mousedown', onPointerDown);
      el.removeEventListener('mousemove', onPointerMove);
      el.removeEventListener('mouseup', onPointerUp);
      el.removeEventListener('mouseleave', onPointerUp);
      el.removeEventListener('touchstart', onPointerDown);
      el.removeEventListener('touchmove', onPointerMove);
      el.removeEventListener('touchend', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (container.contains(el)) container.removeChild(el);
    };
  }, [items]);

  return <div ref={canvasRef} className="w-full h-full" style={{ touchAction: 'none' }} />;
}
