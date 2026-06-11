export default function ViewLoadingFallback() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[40vh]">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}
