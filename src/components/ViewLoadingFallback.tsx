export default function ViewLoadingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
    </div>
  );
}
