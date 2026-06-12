import { useFxLevel } from '../../lib/deviceTier';

export default function UnderwaterBackdrop() {
  const level = useFxLevel();
  const bubbleCount = level === 'full' ? 8 : level === 'lite' ? 4 : 0;

  return (
    <div
      className="absolute inset-0 overflow-hidden -z-10 pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Aqua gradient base */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, var(--aqua-tint) 0%, #f0f9ff 35%, #f8fafc 100%)',
        }}
      />

      {/* Light rays */}
      {level !== 'off' && (
        <>
          <div className="home-ray home-ray-1" />
          <div className="home-ray home-ray-2" />
        </>
      )}

      {/* Ambient bubbles */}
      {bubbleCount > 0 &&
        Array.from({ length: bubbleCount }).map((_, i) => (
          <div
            key={i}
            className="home-bubble"
            style={{
              left: `${10 + ((i * 89 + i * i * 23) % 80)}%`,
              animationDelay: `${((i * 1300) % 8000) / 1000}s`,
              animationDuration: `${8 + ((i * 1700) % 6000) / 1000}s`,
              width: `${3 + ((i * 5) % 8)}px`,
              height: `${3 + ((i * 5) % 8)}px`,
            }}
          />
        ))}
    </div>
  );
}
