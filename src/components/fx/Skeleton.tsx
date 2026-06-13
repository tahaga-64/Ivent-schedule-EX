interface Props {
  className?: string;
  /** 角丸 */
  rounded?: string;
}

/**
 * ローディング中のプレースホルダ。Tailwind の animate-pulse でシマー表示。
 * スピナーより「もうすぐ出る」感が伝わり体感速度が上がる。
 */
export default function Skeleton({ className = '', rounded = 'rounded-lg' }: Props) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-slate-200/70 via-slate-100/70 to-slate-200/70 ${rounded} ${className}`}
      aria-hidden="true"
    />
  );
}
