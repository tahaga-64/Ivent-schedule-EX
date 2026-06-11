import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check } from 'lucide-react';

export interface UnsavedGuard {
  hasUnsaved: boolean;
  save: () => Promise<boolean>;
  discard: () => void;
  /** true の場合、ページ移動時に確認モーダルなしで自動保存する */
  autoSaveOnNavigate?: boolean;
}

interface UnsavedChangesContextValue {
  registerGuard: (id: string, guard: UnsavedGuard | null) => void;
  runWithGuard: (action: () => void) => void;
  hasAnyUnsaved: boolean;
  showSaveToast: (message?: string) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const guardsRef = useRef<Map<string, UnsavedGuard>>(new Map());
  const [hasAnyUnsaved, setHasAnyUnsaved] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recomputeHasUnsaved = useCallback(() => {
    const any = Array.from(guardsRef.current.values()).some(g => g.hasUnsaved);
    setHasAnyUnsaved(any);
  }, []);

  const showSaveToast = useCallback((message = '保存されました') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setSaveToast(message);
    toastTimerRef.current = setTimeout(() => setSaveToast(null), 3000);
  }, []);

  const registerGuard = useCallback((id: string, guard: UnsavedGuard | null) => {
    if (guard) {
      guardsRef.current.set(id, guard);
    } else {
      guardsRef.current.delete(id);
    }
    recomputeHasUnsaved();
  }, [recomputeHasUnsaved]);

  const getUnsavedGuards = useCallback((): UnsavedGuard[] => {
    return Array.from(guardsRef.current.values()).filter(g => g.hasUnsaved);
  }, []);

  const executeAutoSaveAndContinue = useCallback(async (action: () => void) => {
    const guards = getUnsavedGuards();
    if (guards.length === 0) {
      action();
      return;
    }
    setSaving(true);
    try {
      for (const guard of guards) {
        const ok = await guard.save();
        if (!ok) return;
      }
      recomputeHasUnsaved();
      showSaveToast('保存されました');
      action();
    } finally {
      setSaving(false);
    }
  }, [getUnsavedGuards, recomputeHasUnsaved, showSaveToast]);

  const runWithGuard = useCallback((action: () => void) => {
    const unsaved = getUnsavedGuards();
    if (unsaved.length === 0) {
      action();
      return;
    }
    const allAutoSave = unsaved.every(g => g.autoSaveOnNavigate);
    if (allAutoSave) {
      void executeAutoSaveAndContinue(action);
      return;
    }
    setPendingAction(() => action);
  }, [getUnsavedGuards, executeAutoSaveAndContinue]);

  const closeModal = useCallback(() => {
    setPendingAction(null);
    setSaving(false);
  }, []);

  const handleSaveAndContinue = useCallback(async () => {
    const guards = getUnsavedGuards();
    const action = pendingAction;
    if (guards.length === 0 || !action) return;
    setSaving(true);
    try {
      for (const guard of guards) {
        const ok = await guard.save();
        if (!ok) return;
      }
      recomputeHasUnsaved();
      setPendingAction(null);
      action();
    } finally {
      setSaving(false);
    }
  }, [getUnsavedGuards, pendingAction, recomputeHasUnsaved]);

  const handleDiscardAndContinue = useCallback(() => {
    const guards = getUnsavedGuards();
    const action = pendingAction;
    if (guards.length === 0 || !action) return;
    for (const guard of guards) {
      guard.discard();
    }
    recomputeHasUnsaved();
    setPendingAction(null);
    action();
  }, [getUnsavedGuards, pendingAction, recomputeHasUnsaved]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (getUnsavedGuards().length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [getUnsavedGuards]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <UnsavedChangesContext.Provider value={{ registerGuard, runWithGuard, hasAnyUnsaved, showSaveToast }}>
      {children}
      {createPortal(
        <AnimatePresence>
          {saveToast && (
            <motion.div
              key="save-toast"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black shadow-2xl"
            >
              <Check size={16} />
              {saveToast}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {pendingAction && (
            <motion.div
              key="unsaved-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
            >
              <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={closeModal}
              />
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="relative w-full sm:max-w-md bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl p-6 z-10"
                role="dialog"
                aria-labelledby="unsaved-dialog-title"
                aria-modal="true"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h2 id="unsaved-dialog-title" className="text-base font-black text-slate-900">
                      保存しますか？
                    </h2>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      編集中の内容が保存されていません。ページを移動する前に保存するか確認してください。
                    </p>
                  </div>
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardAndContinue}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    保存しない
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveAndContinue()}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-black transition-colors disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存する'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error('useUnsavedChanges must be used within UnsavedChangesProvider');
  return ctx;
}

/** 編集画面から未保存ガードを登録する */
export function useRegisterUnsavedGuard(
  id: string,
  options: {
    enabled: boolean;
    hasUnsaved: boolean;
    save: () => Promise<boolean>;
    discard: () => void;
    autoSaveOnNavigate?: boolean;
  }
) {
  const { registerGuard } = useUnsavedChanges();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!options.enabled) {
      registerGuard(id, null);
      return;
    }
    registerGuard(id, {
      get hasUnsaved() {
        return optionsRef.current.hasUnsaved;
      },
      save: () => optionsRef.current.save(),
      discard: () => optionsRef.current.discard(),
      get autoSaveOnNavigate() {
        return optionsRef.current.autoSaveOnNavigate;
      },
    });
    return () => registerGuard(id, null);
  }, [id, options.enabled, options.hasUnsaved, registerGuard]);
}
