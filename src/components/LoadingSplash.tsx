import EXBadge from './EXBadge';

export default function LoadingSplash() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-white"
    >
      <style>{`
        @keyframes ls-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        @keyframes ls-dots {
          0%   { content: '.'; }
          33%  { content: '..'; }
          66%  { content: '...'; }
          100% { content: '.'; }
        }
        .ls-dots::after {
          content: '...';
          animation: ls-dots 1.4s steps(1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .ls-badge { animation: none !important; }
        }
      `}</style>

      <div
        className="ls-badge"
        style={{ animation: 'ls-pulse 2.4s ease-in-out infinite' }}
      >
        <EXBadge size={88} />
      </div>

      <p className="text-sm font-medium text-slate-400 tracking-widest select-none">
        loading<span className="ls-dots" />
      </p>
    </div>
  );
}
