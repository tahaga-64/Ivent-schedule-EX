import Lenis from 'lenis';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** 現在のスクロール速度をWebGL uniformから参照するための共有値 */
export const scrollState = { velocity: 0 };

let _lenis: Lenis | null = null;
let _wrapper: HTMLElement | null = null;
export const getLenis = () => _lenis;
export const getScrollWrapper = () => _wrapper;

/**
 * <main> 要素に Lenis を適用し、GSAP ScrollTrigger と同期する。
 * @returns cleanup 関数
 */
export function initSmoothScroll(wrapper: HTMLElement, content: HTMLElement): () => void {
  _wrapper = wrapper;
  _lenis = new Lenis({
    wrapper,
    content,
    duration: 1.15,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // @ts-expect-error: autoRaf exists in lenis v1 but may not be in type definitions
    autoRaf: false,
  });

  // GSAP ticker で Lenis の rAF を駆動（GSAP と一本化）
  gsap.ticker.add((time) => {
    _lenis!.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // ScrollTrigger を <main> スクローラーに向ける
  ScrollTrigger.defaults({ scroller: wrapper });

  _lenis.on('scroll', ({ velocity }: { velocity: number }) => {
    scrollState.velocity = velocity;
    ScrollTrigger.update();
  });

  return () => {
    _lenis?.destroy();
    _lenis = null;
    _wrapper = null;
    ScrollTrigger.defaults({ scroller: window });
    ScrollTrigger.getAll().forEach(t => t.kill());
    gsap.ticker.remove(() => {});
  };
}
