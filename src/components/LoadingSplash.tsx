import EXBadge from './EXBadge';

export default function LoadingSplash() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <EXBadge size={96} />
    </div>
  );
}
