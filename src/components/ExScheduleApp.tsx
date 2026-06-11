/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, Component, ErrorInfo, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { notifyPush, isPushNotificationConfigured } from '../lib/pushNotifications';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Plus,
  Trash2,
  Star,
  ChevronRight,
  Info,
  Save,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  AlertCircle,
  Share2,
  X,
} from 'lucide-react';
import { 
  TRAINING_LABELS, 
  TRAINING_LOCATIONS, 
  MEMBERS, 
  StatusType,
  TYPE_LABEL,
  TYPE_CLASS,
  GoalRow,
  INITIAL_SCHEDULE_DATA,
  getDaysInMonth,
  getStartOffset
} from '../lib/exScheduleConstants';

// Firebase imports（Ivent 側で初期化済みの共有 EX-schedule アプリを利用）
import { exDb as db, exAuth as auth } from '../lib/exSchedule';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';

// --- Types ---
interface MonthData {
  schedule: Record<string, { type: StatusType; detail: string }[]>;
  memos: Record<string, Record<number, string>>;
  dones: Record<string, Record<number, boolean>>;
  goals: Record<string, GoalRow[]>;
  nextPlan: Record<string, string>;
  teamGoal: string;
  overallMemo?: string;
  trainingLabels?: Record<string, string>;
  trainingLocations?: Record<string, string>;
  memberStations?: Record<string, string>;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };
  constructor(props: any) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let message = "申し訳ありません。エラーが発生しました。";
      try {
        const parsed = JSON.parse((this.state.error as any)?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          message = "アクセス権限がありません。管理者にお問い合わせください。";
        }
      } catch {
        // Not a JSON error
      }
      return (
        <div className="min-h-full flex items-center justify-center bg-bg p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-border max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info size={32} />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">エラーが発生しました</h2>
            <p className="text-text2 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent-d transition-colors"
            >
              再読み込み
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- Utilities ---
const getDow = (year: number, month: number, day: number) => {
  const d = new Date(year, month, day).getDay();
  return (d + 6) % 7; // Mon=0 ... Sun=6
};

const getType = (s: string | { type: StatusType; detail: string }): StatusType => {
  if (typeof s === 'object' && s !== null) return s.type;
  if (!s || typeof s !== 'string') return 'rest';
  if (s.startsWith('研修')) return 'training';
  if (s.includes('待機')) return 'standby';
  if (s.includes('イベント')) return 'event';
  if (s === '〇') return 'normal';
  if (s === '◎') return 'request';
  if (s === '未定') return 'rest';
  if (s.includes('海浜幕張') || s.includes('鳥浜') || s.includes('外販')) return 'dispatch';
  if (s.includes('本社')) return 'office';
  if (s.includes('欠勤')) return 'absence';
  return 'other';
};

// --- Components ---

const LocalInput = ({ value, onChange, onBlur, className, size = 10, ...props }: any) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  
  useEffect(() => { 
    if (!isFocused) setLocalValue(value); 
  }, [value, isFocused]);

  // Use 16px to prevent iOS auto-zoom on focus
  const inputFontSize = 16;
  const scale = size / inputFontSize;

  return (
    <div className={`${className} relative flex items-center justify-center`}>
      <input 
        {...props} 
        value={localValue} 
        onChange={(e) => setLocalValue(e.target.value)} 
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          if (localValue !== value) onChange(localValue);
          if (onBlur) onBlur();
        }}
        className="absolute top-0 left-0 origin-top-left bg-transparent border-none outline-none text-center p-0 font-bold"
        style={{ 
          fontSize: `${inputFontSize}px`, 
          transform: `scale(${scale})`,
          width: `${(1 / scale) * 100}%`,
          height: `${(1 / scale) * 100}%`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 'normal'
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
      />
      {/* Invisible placeholder to ensure the parent div has correct height/width */}
      <div 
        className="invisible select-none pointer-events-none whitespace-pre py-0.5 px-1 font-bold"
        style={{ fontSize: `${size}px`, lineHeight: 'normal' }}
      >
        {localValue || ' '}
      </div>
    </div>
  );
};

const LocalTextarea = ({ value, onChange, onBlur, className, rows = 1, ...props }: any) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  
  useEffect(() => { 
    if (!isFocused) setLocalValue(value); 
  }, [value, isFocused]);

  return (
    <div className={`${className} relative`}>
      <textarea 
        {...props} 
        value={localValue} 
        rows={rows * 2} // Since we scale by 0.5
        onChange={(e) => setLocalValue(e.target.value)} 
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          if (localValue !== value) onChange(localValue);
          if (onBlur) onBlur();
        }}
        className="absolute top-0 left-0 w-[200%] h-[200%] origin-top-left bg-transparent border-none outline-none p-2 font-bold resize-none"
        style={{ 
          fontSize: '22px', 
          transform: 'scale(0.5)',
          lineHeight: '1.2'
        }}
      />
      {/* Invisible placeholder to ensure the parent div has correct height based on content and rows */}
      <div 
        className="invisible select-none pointer-events-none whitespace-pre-wrap p-1 font-bold leading-tight"
        style={{ minHeight: `${rows * 1.2}em` }}
      >
        {localValue || ' '}
      </div>
    </div>
  );
};

const Legend = () => (
  <div className="bg-white rounded-xl shadow-sm p-4 border border-border mb-4">
    <div className="flex items-center gap-2 text-xs font-bold text-text mb-3">
      <div className="w-1 h-4 bg-accent rounded-full" />
      凡例 (ステータス)
    </div>
    <div className="flex flex-wrap gap-2">
      {(Object.keys(TYPE_LABEL) as StatusType[]).map(type => (
        <div key={type} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold ${TYPE_CLASS[type]}`}>
          {TYPE_LABEL[type]}
        </div>
      ))}
    </div>
  </div>
);

const TrainingInfo = ({ 
  title,
  labels, 
  locations, 
  onChange 
}: { 
  title: string,
  labels: Record<string, string>, 
  locations: Record<string, string>,
  onChange: (labels: Record<string, string>, locations: Record<string, string>) => void
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localLabels, setLocalLabels] = useState(labels);
  const [localLocations, setLocalLocations] = useState(locations);

  useEffect(() => {
    if (!isEditing) {
      setLocalLabels(labels);
      setLocalLocations(locations);
    }
  }, [labels, locations, isEditing]);

  const handleSave = () => {
    onChange(localLabels, localLocations);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-border mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-bold text-text">
          <div className="w-1 h-4 bg-accent rounded-full" />
          {title}
        </div>
        <button 
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
        >
          {isEditing ? <><Save size={12} /> 保存</> : <><Plus size={12} /> 編集</>}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.keys(TRAINING_LABELS).map((key) => (
          <div key={key} className="flex flex-col p-2 rounded-lg bg-bg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">
                {title.includes('イベント') ? key.replace('研修', 'イベント') : key}
              </span>
              {isEditing ? (
                <input 
                  className="text-xs font-bold text-text bg-white border border-border rounded px-1 w-full"
                  style={{ fontSize: '16px' }}
                  value={localLabels[key] || ''}
                  onChange={(e) => setLocalLabels({...localLabels, [key]: e.target.value})}
                />
              ) : (
                <span className="text-xs font-bold text-text">{labels[key] || '未設定'}</span>
              )}
            </div>
            {isEditing ? (
              <textarea 
                className="text-[10px] text-text2 leading-tight bg-white border border-border rounded px-1 w-full"
                style={{ fontSize: '16px' }}
                value={localLocations[key] || ''}
                onChange={(e) => setLocalLocations({...localLocations, [key]: e.target.value})}
                rows={2}
              />
            ) : (
              <div className="text-[10px] text-text2 leading-tight">
                {locations[key] || '詳細なし'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};


const MemberTabs = ({ members, current, myName, onSelect }: { members: string[], current: string, myName: string, onSelect: (n: string) => void }) => {
  const sorted = myName ? [myName, ...members.filter(m => m !== myName)] : members;
  return (
    <div className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden border border-border">
      <div className="flex overflow-x-auto p-2 gap-1.5 border-b border-border scrollbar-hide">
        {sorted.map(name => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all duration-200 border flex items-center gap-1 ${
              name === current
                ? 'bg-accent border-accent text-white font-black'
                : name === myName
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold'
                  : 'bg-bg border-border2 text-text2 hover:border-accent-m hover:text-accent hover:bg-accent-l'
            }`}
          >
            {name === myName && <span className="text-[10px]">★</span>}
            {name.replace('　', '')}
          </button>
        ))}
      </div>
    </div>
  );
};

export default function AppWrapper({ currentUser }: { currentUser?: User | null }) {
  return (
    <ErrorBoundary>
      <App currentUser={currentUser ?? null} />
    </ErrorBoundary>
  );
}

function App({ currentUser }: { currentUser: User | null }) {
  const [activeTab, setActiveTab] = useState<'schedule' | 'overall'>('schedule');
  const lastScheduleNotifyRef = useRef(0);
  const [myName, setMyName] = useState<string>(() => localStorage.getItem('ex_schedule_my_name') || '');
  const [showNamePicker, setShowNamePicker] = useState(() => !localStorage.getItem('ex_schedule_my_name'));
  const [currentSchedMember, setCurrentSchedMember] = useState<string>(() => localStorage.getItem('ex_schedule_my_name') || MEMBERS[0]);
  const schedCalendarRef = useRef<HTMLDivElement>(null);
  const overallTableRef = useRef<HTMLDivElement>(null);
  
  // Initialize from current real date to ensure the app opens with the latest current month always
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  // 注: 元 EX-schedule の URL 同期（?year=&month=）は Ivent に埋め込むと
  // 親アプリの URL/履歴を汚すため除去。月の状態は内部 state のみで保持する。

  // Data States
  const [allData, setAllData] = useState<Record<string, MonthData>>({});
  const [globalStations, setGlobalStations] = useState<Record<string, string>>({});
  const [globalLocations, setGlobalLocations] = useState<Record<number, string>>({});
  const [globalTimes, setGlobalTimes] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveOk, setShowSaveOk] = useState<Record<string, boolean>>({});

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    }
    console.error('Firestore Error detailed: ', JSON.stringify(errInfo));
    
    let userMessage = "通信エラーが発生しました。";
    if (errInfo.error.includes("insufficient permissions") || errInfo.error.includes("permission-denied")) {
      userMessage = "編集権限がありません。管理者にお問い合わせください。";
    } else if (errInfo.error.includes("offline")) {
      userMessage = "オフラインです。接続を確認してください。";
    } else if (errInfo.error.includes("quota exceeded")) {
      userMessage = "月間保存容量（クォータ）を超過しました。明日リセットされます。";
    }
    
    if (operationType === OperationType.GET) {
      setError(userMessage);
    } else {
      setSaveError(userMessage);
      // Auto-clear save error
      setTimeout(() => setSaveError(null), 8000);
    }
    
    setIsLoading(false);
    setIsSaving(false);
  };

  const monthKey = `${currentYear}-${currentMonth + 1}`;

  // Connection Test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();
  }, []);

  // Current Month Data
  const currentMonthData = useMemo(() => {
    const rawData = allData[monthKey] || {} as MonthData;
    
    // Migration: Handle literal dotted keys if they were created by a previous bug
    // e.g. "schedule.Member Name" instead of schedule: { "Member Name": ... }
    const data = { ...rawData };
    if (!data.schedule) data.schedule = {};
    
    Object.keys(data).forEach(key => {
      if (key.includes('.') && (key.startsWith('schedule.') || key.startsWith('memos.') || key.startsWith('dones.') || key.startsWith('goals.'))) {
        const [parent, child] = key.split('.');
        const parentKey = parent as keyof MonthData;
        if (!data[parentKey]) (data as any)[parentKey] = {};
        if (!(data[parentKey] as any)[child]) {
          (data[parentKey] as any)[child] = (data as any)[key];
        }
      }
    });

    const isApril2026 = currentYear === 2026 && currentMonth === 3;
    const isAfterApril2026 = currentYear > 2026 || (currentYear === 2026 && currentMonth > 3);

    const migratedSched: Record<string, { type: StatusType, detail: string }[]> = {};
    
    // Name migration for existing Firestore data
    const OLD_NAME = '岸田　音楓';
    const NEW_NAME = '深瀬　音楓';

    // Migrate schedule
    for (const member of MEMBERS) {
      let s = data.schedule?.[member];
      
      // If data exists under old name but not new name, use old name's data
      if (!s && member === NEW_NAME && data.schedule?.[OLD_NAME]) {
        s = data.schedule[OLD_NAME];
      }

      const daysInMonth = getDaysInMonth(currentYear, currentMonth);
      
      if (Array.isArray(s) && s.length > 0) {
        migratedSched[member] = s.map((item: any) => {
          if (typeof item === 'object' && item !== null) {
            if ('type' in item) return item as { type: StatusType, detail: string };
            const detail = item.detail || item.status || '';
            return { type: getType(detail), detail: String(detail) };
          }
          return { type: getType(item), detail: String(item || '') };
        });
        
        // Ensure correct length
        if (migratedSched[member].length < daysInMonth) {
          const extra = Array(daysInMonth - migratedSched[member].length).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }));
          migratedSched[member] = [...migratedSched[member], ...extra];
        } else if (migratedSched[member].length > daysInMonth) {
          migratedSched[member] = migratedSched[member].slice(0, daysInMonth);
        }
      } else {
        // Fallback to initial data for April 2026 if missing or empty
        if (isApril2026 && INITIAL_SCHEDULE_DATA[member]) {
          const initial = INITIAL_SCHEDULE_DATA[member];
          migratedSched[member] = initial.map(s => ({ type: getType(s), detail: s }));
          
          // Ensure correct length
          if (migratedSched[member].length < daysInMonth) {
            const extra = Array(daysInMonth - migratedSched[member].length).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }));
            migratedSched[member] = [...migratedSched[member], ...extra];
          } else if (migratedSched[member].length > daysInMonth) {
            migratedSched[member] = migratedSched[member].slice(0, daysInMonth);
          }
        } else {
          migratedSched[member] = Array(daysInMonth).fill(null).map(() => ({ type: 'rest', detail: '' }));
        }
      }
    }

    // Migrate other fields
    const migratedMemos = { ...(data.memos || {}) };
    const migratedDones = { ...(data.dones || {}) };
    const migratedGoals = { ...(data.goals || {}) };
    const migratedNextPlan = { ...(data.nextPlan || {}) };
    const migratedStations = { ...(data.memberStations || {}) };

    if (migratedMemos[OLD_NAME] && !migratedMemos[NEW_NAME]) migratedMemos[NEW_NAME] = migratedMemos[OLD_NAME];
    if (migratedDones[OLD_NAME] && !migratedDones[NEW_NAME]) migratedDones[NEW_NAME] = migratedDones[OLD_NAME];
    if (migratedGoals[OLD_NAME] && !migratedGoals[NEW_NAME]) migratedGoals[NEW_NAME] = migratedGoals[OLD_NAME];
    if (migratedNextPlan[OLD_NAME] && !migratedNextPlan[NEW_NAME]) migratedNextPlan[NEW_NAME] = migratedNextPlan[OLD_NAME];
    if (migratedStations[OLD_NAME] && !migratedStations[NEW_NAME]) migratedStations[NEW_NAME] = migratedStations[OLD_NAME];

    return {
      ...data,
      schedule: migratedSched,
      memos: migratedMemos,
      dones: migratedDones,
      goals: migratedGoals,
      nextPlan: migratedNextPlan,
      teamGoal: data.teamGoal || '',
      overallMemo: data.overallMemo || '',
      trainingLabels: data.trainingLabels || (isAfterApril2026 ? {} : TRAINING_LABELS),
      trainingLocations: data.trainingLocations || (isAfterApril2026 ? {} : TRAINING_LOCATIONS),
      memberStations: migratedStations,
    } as MonthData;
  }, [allData, monthKey, currentMonth, currentYear]);

  // Load data from Firestore
  useEffect(() => {
    setIsLoading(true);
    const path = 'months';
    const unsubscribe = onSnapshot(doc(db, path, monthKey), (snapshot) => {
      if (snapshot.exists()) {
        setAllData(prev => ({
          ...prev,
          [monthKey]: snapshot.data() as MonthData
        }));
      }
      setIsLoading(false);
      setError(null);
    }, (err) => {
      console.error('Firestore Error:', err);
      setError(err.message);
      handleFirestoreError(err, OperationType.GET, `${path}/${monthKey}`);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [monthKey]);

  // Load global settings (stations)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.memberStations) {
          setGlobalStations(data.memberStations);
        }
        if (data.dailyLocations) {
          setGlobalLocations(data.dailyLocations);
        }
        if (data.dailyTimes) {
          setGlobalTimes(data.dailyTimes);
        }
      } else {
        // Fallback: If global settings don't exist yet, try to pull from April 2026
        const loadAprilFallback = async () => {
          try {
            const aprilDoc = await getDocFromServer(doc(db, 'months', '2026-4'));
            if (aprilDoc.exists()) {
              const data = aprilDoc.data() as MonthData;
              if (data.memberStations) {
                setGlobalStations(data.memberStations);
              }
            }
          } catch (e) {
            console.error('April fallback failed:', e);
          }
        };
        loadAprilFallback();
      }
    }, (err) => {
      console.error('Global Settings Error:', err);
    });

    return () => unsubscribe();
  }, []);

  // 今日の列を中央にauto-scroll
  useEffect(() => {
    const today = new Date();
    if (currentYear !== today.getFullYear() || currentMonth !== today.getMonth()) return;

    const container =
      activeTab === 'schedule' ? schedCalendarRef.current :
      activeTab === 'overall' ? overallTableRef.current : null;
    if (!container) return;

    // レイアウト確定後（描画＆Firestoreデータ反映後）にスクロール位置を計算する
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const el = container;
        const todayCell = el.querySelector<HTMLElement>('[data-today="true"]');
        if (!todayCell) return;
        // getBoundingClientRect で実測（min-w-max により列幅が可変なため固定値は使わない）
        const cellRect = todayCell.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const cellCenterInContainer = (cellRect.left - elRect.left) + el.scrollLeft + cellRect.width / 2;
        const target = cellCenterInContainer - el.clientWidth / 2;
        el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeTab, currentYear, currentMonth, currentSchedMember, isLoading]);

  const saveData = async (updates: Record<string, any>) => {
    if (!monthKey || monthKey.includes('NaN')) {
      console.error('Invalid monthKey for saving:', monthKey);
      return;
    }
    setIsSaving(true);
    const path = `months/${monthKey}`;
    try {
      const docRef = doc(db, 'months', monthKey);
      
      // Expand dotted keys for potential setDoc usage or debugging
      const expandKeys = (obj: Record<string, any>) => {
        const res: any = {};
        Object.keys(obj).forEach(key => {
          if (key.includes('.')) {
            const parts = key.split('.');
            let current = res;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!current[parts[i]]) current[parts[i]] = {};
              current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = obj[key];
          } else {
            res[key] = obj[key];
          }
        });
        return res;
      };

      const hasDots = Object.keys(updates).some(k => k.includes('.'));
      
      if (hasDots) {
        try {
          // updateDoc is preferred for nested updates
          await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
          });
        } catch (e: any) {
          // If updateDoc fails for ANY reason (doc not found, or nested path doesn't exist, etc.)
          // we fallback to setDoc with merge and expanded keys, which ensures the structure.
          try {
            const expanded = expandKeys({
              ...updates,
              updatedAt: serverTimestamp()
            });
            await setDoc(docRef, expanded, { merge: true });
          } catch (e2) {
            throw e2;
          }
        }
      } else {
        await setDoc(docRef, {
          ...updates,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      console.log('Saved successfully:', updates);
      // スケジュール更新を全購読端末へ通知（更新者名つき・5分スロットルで連発防止）
      if (isPushNotificationConfigured() && currentUser) {
        const now = Date.now();
        if (now - lastScheduleNotifyRef.current > 5 * 60 * 1000) {
          lastScheduleNotifyRef.current = now;
          const who = currentUser.displayName?.trim() || currentUser.email || '担当者';
          notifyPush({
            type: 'schedule_updated',
            title: 'スケジュール更新',
            message: `${who}さんがスケジュールを更新しました`,
          });
        }
      }
    } catch (e: any) {
      console.error('Save failed:', e);
      handleFirestoreError(e, OperationType.WRITE, path);
    } finally {
      setIsSaving(false);
    }
  };

  const triggerSaveOk = (id: string) => {
    setShowSaveOk(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setShowSaveOk(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // --- Handlers ---
  const updateCurrentMonthData = (updates: Partial<MonthData>) => {
    setAllData(prev => ({
      ...prev,
      [monthKey]: { ...(prev[monthKey] || {} as MonthData), ...updates }
    }));
    saveData(updates);
  };

  const handleScheduleTypeChange = (member: string, dayIdx: number, type: StatusType) => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const memberSched = [...(currentMonthData.schedule[member] || Array(daysInMonth).fill(null).map(() => ({ type: 'rest', detail: '' })))];
    memberSched[dayIdx] = { ...memberSched[dayIdx], type };
    // Ensure we handle potential length mismatches
    if (memberSched.length < daysInMonth) {
      const extra = Array(daysInMonth - memberSched.length).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }));
      memberSched.push(...extra);
    }
    const finalSched = memberSched.slice(0, daysInMonth);
    
    // Optimistic update
    setAllData(prev => ({
      ...prev,
      [monthKey]: {
        ...(prev[monthKey] || {} as MonthData),
        schedule: {
          ...(prev[monthKey]?.schedule || {}),
          [member]: finalSched
        }
      }
    }));
    
    // Save using dotted key for efficiency
    saveData({ [`schedule.${member}`]: finalSched });
  };

  const handleScheduleDetailChange = (member: string, dayIdx: number, detail: string) => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const memberSched = [...(currentMonthData.schedule[member] || Array(daysInMonth).fill(null).map(() => ({ type: 'rest', detail: '' })))];
    memberSched[dayIdx] = { ...memberSched[dayIdx], detail };
    // Ensure we handle potential length mismatches
    if (memberSched.length < daysInMonth) {
      const extra = Array(daysInMonth - memberSched.length).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }));
      memberSched.push(...extra);
    }
    const finalSched = memberSched.slice(0, daysInMonth);
    
    // Optimistic update
    setAllData(prev => ({
      ...prev,
      [monthKey]: {
        ...(prev[monthKey] || {} as MonthData),
        schedule: {
          ...(prev[monthKey]?.schedule || {}),
          [member]: finalSched
        }
      }
    }));

    saveData({ [`schedule.${member}`]: finalSched });
  };


  const handleRestoreInitial = () => {
    if (currentYear !== 2026 || currentMonth !== 3) return;
    if (!window.confirm("4月のスケジュールを初期データに復元しますか？（現在の入力内容は上書きされます）")) return;
    
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const newSched: Record<string, { type: StatusType, detail: string }[]> = {};
    for (const member of MEMBERS) {
      const initial = INITIAL_SCHEDULE_DATA[member] || [];
      newSched[member] = initial.map(s => ({ type: getType(s), detail: s }));
      
      // Ensure correct length
      if (newSched[member].length < daysInMonth) {
        const extra = Array(daysInMonth - newSched[member].length).fill(null).map(() => ({ type: 'rest' as StatusType, detail: '' }));
        newSched[member] = [...newSched[member], ...extra];
      } else if (newSched[member].length > daysInMonth) {
        newSched[member] = newSched[member].slice(0, daysInMonth);
      }
    }
    updateCurrentMonthData({ 
      schedule: newSched,
      trainingLabels: TRAINING_LABELS,
      trainingLocations: TRAINING_LOCATIONS
    });
  };


  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    triggerSaveOk('share');
  };

  const handleMemoChange = (member: string, day: number, val: string) => {
    const newMemos = { ...currentMonthData.memos };
    newMemos[member] = { ...(newMemos[member] || {}), [day]: val };
    updateCurrentMonthData({ memos: newMemos });
  };


  const handleTeamGoalSave = () => {
    updateCurrentMonthData({ teamGoal: currentMonthData.teamGoal });
    triggerSaveOk('team-goal');
  };

  const handleIndividualGoalChange = (member: string, index: number, field: keyof GoalRow, val: any) => {
    const newGoals = { ...currentMonthData.goals };
    const memberGoals = [...(newGoals[member] || [])];
    memberGoals[index] = { ...memberGoals[index], [field]: val };
    newGoals[member] = memberGoals;
    updateCurrentMonthData({ goals: newGoals });
  };

  const addGoalRow = (member: string) => {
    const newGoals = { ...currentMonthData.goals };
    const memberGoals = [...(newGoals[member] || [])];
    memberGoals.push({ content: '', person: '', deadline: '', stars: 0, note: '' });
    newGoals[member] = memberGoals;
    updateCurrentMonthData({ goals: newGoals });
  };

  const deleteGoalRow = (member: string, index: number) => {
    const newGoals = { ...currentMonthData.goals };
    const memberGoals = [...(newGoals[member] || [])];
    memberGoals.splice(index, 1);
    newGoals[member] = memberGoals;
    updateCurrentMonthData({ goals: newGoals });
  };

  const handleGoalSave = (member: string) => {
    // Already auto-saving, but can show feedback
    triggerSaveOk('goal');
  };

  const handleNextPlanChange = (member: string, val: string) => {
    const newNextPlan = { ...currentMonthData.nextPlan, [member]: val };
    updateCurrentMonthData({ nextPlan: newNextPlan });
  };

  const handleMemberStationChange = async (member: string, val: string) => {
    const newStations = { ...globalStations, [member]: val };
    setGlobalStations(newStations); // Optimistic update
    
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        memberStations: newStations,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save global station:', err);
    }
  };

  const handleGlobalLocationChange = async (day: number, val: string) => {
    const newLocations = { ...globalLocations, [day]: val };
    setGlobalLocations(newLocations);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        dailyLocations: newLocations,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save global location:', err);
    }
  };

  const handleGlobalTimeChange = async (day: number, val: string) => {
    const newTimes = { ...globalTimes, [day]: val };
    setGlobalTimes(newTimes);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        dailyTimes: newTimes,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('Failed to save global time:', err);
    }
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const startOffset = getStartOffset(currentYear, currentMonth);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-text2 font-bold animate-pulse">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center bg-bg p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-text mb-2">エラーが発生しました</h2>
          <p className="text-text2 text-sm mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent-d transition-all"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-transparent text-text font-sans pb-20">
      {/* 初回名前選択モーダル */}
      {showNamePicker && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-black text-slate-900 mb-1">あなたの名前を選んでください</h2>
            <p className="text-xs text-slate-500 mb-5">選択後、自分のスケジュールが最初に表示されます</p>
            <div className="grid grid-cols-2 gap-2">
              {MEMBERS.map(name => (
                <button
                  key={name}
                  onClick={() => {
                    localStorage.setItem('ex_schedule_my_name', name);
                    setMyName(name);
                    setCurrentSchedMember(name);
                    setShowNamePicker(false);
                  }}
                  className="py-3 px-4 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-800 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 active:scale-95 transition-all"
                >
                  {name.replace('　', '')}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowNamePicker(false)}
              className="mt-4 w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              スキップ
            </button>
          </div>
        </div>
      )}

      {/* Non-blocking Save Error Banner */}
      <AnimatePresence>
        {saveError && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-50 text-red-800 border-b border-red-200 px-4 py-2 text-xs font-bold flex items-center justify-between sticky top-0 z-[100] shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={14} />
              {saveError}
            </div>
            <button onClick={() => setSaveError(null)}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-bg rounded-lg p-1 border border-border">
            <button 
              onClick={() => setCurrentMonth(prev => (prev === 0 ? 11 : prev - 1))}
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-text2 hover:text-accent"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="font-mono text-sm font-bold px-3 min-w-[100px] text-center">
              {currentYear}.{String(currentMonth + 1).padStart(2, '0')}
            </span>
            <button 
              onClick={() => setCurrentMonth(prev => (prev === 11 ? 0 : prev + 1))}
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-text2 hover:text-accent"
            >
              <ChevronRightIcon size={18} />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            {isSaving && (
              <div className="flex items-center gap-1.5 text-[10px] text-accent font-bold animate-pulse">
                <Save size={12} />
                保存中...
              </div>
            )}
            <button 
              onClick={handleShare}
              className="p-2 text-text2 hover:text-accent hover:bg-accent/5 rounded-lg transition-colors relative"
              title="URLをコピー"
            >
              <Share2 size={20} />
              {showSaveOk['share'] && (
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                  コピーしました
                </span>
              )}
            </button>
            <button
              onClick={() => setShowNamePicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 text-[10px] font-bold hover:bg-indigo-100 transition-colors"
              title="自分の名前を変更"
            >
              ★ {myName ? myName.replace('　', '') : '名前設定'}
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-border px-4 flex overflow-x-auto shadow-sm scrollbar-hide">
        <div className="max-w-7xl mx-auto w-full flex">
          {[
            { id: 'schedule', label: 'スケジュール', icon: Calendar },
            { id: 'overall', label: '全体表示', icon: Info },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'text-accent border-accent font-bold bg-accent/5' 
                  : 'text-text2 border-transparent hover:text-accent hover:bg-bg'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="px-2 py-4 md:p-6 max-w-7xl mx-auto w-full flex-grow">
        <AnimatePresence mode="wait">
          {activeTab === 'schedule' && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <MemberTabs
                members={MEMBERS}
                current={currentSchedMember}
                myName={myName}
                onSelect={setCurrentSchedMember}
              />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                  <Legend />
                </div>
                <div className="lg:col-span-2">
                  <TrainingInfo 
                    title={currentMonth >= 4 ? "イベントの詳細" : "研修の詳細"}
                    labels={currentMonthData.trainingLabels || {}} 
                    locations={currentMonthData.trainingLocations || {}}
                    onChange={(labels, locations) => updateCurrentMonthData({ trainingLabels: labels, trainingLocations: locations })}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">{currentYear}年{currentMonth + 1}月</span>
                    {currentYear === 2026 && currentMonth === 3 && (
                      <button
                        onClick={handleRestoreInitial}
                        className="px-3 py-1 rounded-md text-xs transition-all border bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100"
                      >
                        初期データに復元
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-text2 flex items-center gap-1">
                    <ChevronRight size={12} className="animate-pulse" />
                    横スクロールで全体表示
                  </div>
                </div>

                {/* Scrollable Calendar Container */}
                <div ref={schedCalendarRef} className="overflow-x-auto pb-2 -mx-0">
                  <div className="min-w-[700px]">
                    {/* Calendar Grid Header */}
                    <div className="grid grid-cols-7 gap-1 md:gap-2 mb-1">
                      {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => (
                        <div key={day} className={`text-center text-[11px] font-bold py-1 font-mono ${
                          i === 5 ? 'text-blue-600' : i === 6 ? 'text-red-600' : 'text-text2'
                        }`}>
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Grid Body */}
                    <div className="grid grid-cols-7 gap-1 md:gap-2">
                      {/* Offset cells */}
                      {Array.from({ length: startOffset }).map((_, i) => (
                        <div key={`offset-${i}`} className="min-h-[100px] md:min-h-[130px]" />
                      ))}

                      {/* Day cells */}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dow = getDow(currentYear, currentMonth, day);
                        const item = currentMonthData.schedule[currentSchedMember]?.[i] || { type: 'rest', detail: '' };
                        const type = item.type;
                        const detail = item.detail;
                        const isSat = dow === 5;
                        const isSun = dow === 6;
                        const _today = new Date();
                        const isToday = currentYear === _today.getFullYear() && currentMonth === _today.getMonth() && day === _today.getDate();

                        return (
                          <div
                            key={day}
                            data-today={isToday ? 'true' : undefined}
                            className={`border border-border rounded-lg p-1.5 md:p-2 min-h-[100px] md:min-h-[130px] transition-all relative flex flex-col bg-white ${
                              isSun ? 'bg-red-50' : isSat ? 'bg-blue-50' : ''
                            } ${isToday ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-white' : ''}`}
                          >
                            <span className={`font-mono text-sm font-black mb-1.5 flex items-center gap-1.5 ${
                              isSun ? 'text-red-600' : isSat ? 'text-blue-600' : 'text-slate-900'
                            }`}>
                              {day}
                              {isToday && <span className="text-[8px] font-black bg-indigo-500 text-white px-1.5 py-0.5 rounded-full leading-none">今日</span>}
                            </span>

                            <div className="flex flex-col gap-1 mb-1">
                              <select
                                className={`w-full px-1.5 py-1 rounded-full text-[11px] md:text-xs font-bold outline-none border border-transparent focus:border-accent/30 transition-all ${TYPE_CLASS[type]}`}
                                value={type}
                                onChange={(e) => handleScheduleTypeChange(currentSchedMember, i, e.target.value as StatusType)}
                              >
                                {Object.keys(TYPE_LABEL).map(t => (
                                  <option key={t} value={t}>{TYPE_LABEL[t as StatusType]}</option>
                                ))}
                              </select>
                              {(type !== 'normal' && type !== 'request' && type !== 'rest') && (
                                <LocalInput
                                  className="w-full px-1.5 py-0.5 rounded border border-slate-200 text-[11px] md:text-xs text-slate-900 outline-none focus:border-accent bg-slate-50"
                                  size={11}
                                  value={detail}
                                  onChange={(val: string) => handleScheduleDetailChange(currentSchedMember, i, val)}
                                  placeholder="詳細..."
                                  list="status-suggestions"
                                />
                              )}
                            </div>

                            <LocalTextarea
                              className="w-full border border-slate-200 rounded p-1.5 text-[11px] md:text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-accent outline-none resize-none flex-grow mt-1 placeholder:text-slate-400"
                              rows={2}
                              placeholder="メモ..."
                              value={currentMonthData.memos[currentSchedMember]?.[day] || ''}
                              onChange={(val: string) => handleMemoChange(currentSchedMember, day, val)}
                            />

                          </div>
                        );
                      })}
                    </div>
                    <datalist id="status-suggestions">
                      {Object.keys(currentMonthData.trainingLabels || {}).map(k => (
                        <option key={k} value={k}>{currentMonthData.trainingLabels?.[k]}</option>
                      ))}
                      <option value="待機(海浜幕張)" />
                      <option value="待機(鳥浜)" />
                      <option value="海浜幕張" />
                      <option value="鳥浜" />
                      <option value="外販ミステリー1" />
                      <option value="イベントメンバー選抜" />
                      <option value="VR" />
                      <option value="販売" />
                    </datalist>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'overall' && (
            <motion.div
              key="overall"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-white rounded-xl shadow-sm p-2 md:p-5 border border-border">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-text">
                    <div className="w-1 h-4 bg-accent rounded-full" />
                    全体稼働状況 ({currentYear}年{currentMonth + 1}月)
                  </div>
                  <div className="flex items-center gap-2 flex-grow max-w-md">
                    <div className="relative flex-grow">
                      <LocalInput
                        className="w-full px-3 py-2 rounded-lg border border-accent/20 bg-accent-l/30 focus:bg-white outline-none text-xs font-bold text-slate-900"
                        size={12}
                        value={currentMonthData.teamGoal}
                        onChange={(val: string) => updateCurrentMonthData({ teamGoal: val })}
                        placeholder="今月の全体目標を入力..."
                      />
                    </div>
                    {showSaveOk['team-goal'] && (
                      <span className="text-[10px] text-green-600 font-bold whitespace-nowrap">✓ 保存</span>
                    )}
                  </div>
                </div>

                <div ref={overallTableRef} className="overflow-x-auto relative border-b border-border">
                  <table className="w-full text-xs border-separate border-spacing-0 min-w-[max-content]">
                    <thead className="relative z-30">
                      <tr className="bg-slate-100 text-slate-900">
                        <th className="p-1.5 border border-border font-bold sticky left-0 top-0 bg-slate-100 z-50 min-w-[64px] text-xs text-left leading-tight">
                          人 / 累計
                        </th>
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const dow = getDow(currentYear, currentMonth, day);
                          const isSat = dow === 5;
                          const isSun = dow === 6;
                          const _t = new Date();
                          const isToday = currentYear === _t.getFullYear() && currentMonth === _t.getMonth() && day === _t.getDate();
                          return (
                            <th key={day} data-today={isToday ? 'true' : undefined} className={`p-0.5 border font-bold text-center min-w-[52px] min-w-max text-xs sticky top-0 z-30 ${
                              isToday ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-border'
                            } ${
                              isSun ? 'text-red-600 bg-red-50' : isSat ? 'text-blue-600 bg-blue-50' : 'bg-slate-100 text-slate-900'
                            }`}>
                              {day}({['月','火','水','木','金','土','日'][dow]})
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Row for Global Location (場所) */}
                      <tr className="bg-amber-50">
                        <td className="p-1 border border-border sticky left-0 bg-amber-50 z-20 font-bold text-orange-800 text-[10px]">
                          場所 (固定表示)
                        </td>
                        {Array.from({ length: daysInMonth }).map((_, i) => (
                          <td key={i} className="p-0.5 border border-border min-w-[50px] min-w-max">
                            <LocalInput
                              className="w-full px-0.5 py-0.5 rounded border border-orange-200 text-[10px] outline-none focus:border-orange-400 bg-white focus:bg-white h-6 text-center font-bold text-orange-800"
                              size={10}
                              value={globalLocations[i + 1] || ''}
                              onChange={(val: string) => handleGlobalLocationChange(i + 1, val)}
                              placeholder="場所"
                            />
                          </td>
                        ))}
                      </tr>

                      {/* Row for Global Time (時間) */}
                      <tr className="bg-blue-50">
                        <td className="p-1 border border-border sticky left-0 bg-blue-50 z-20 font-bold text-blue-800 text-[10px]">
                          時間 (固定表示)
                        </td>
                        {Array.from({ length: daysInMonth }).map((_, i) => (
                          <td key={i} className="p-0.5 border border-border min-w-[50px] min-w-max">
                            <LocalInput
                              className="w-full px-0.5 py-0.5 rounded border border-blue-200 text-[10px] outline-none focus:border-blue-400 bg-white focus:bg-white h-6 text-center font-bold text-blue-800"
                              size={10}
                              value={globalTimes[i + 1] || ''}
                              onChange={(val: string) => handleGlobalTimeChange(i + 1, val)}
                              placeholder="時間"
                            />
                          </td>
                        ))}
                      </tr>

                      {/* Row for workingCount (稼働数) */}
                      <tr className="bg-bg/50">
                        <td className="p-1 border border-border sticky left-0 bg-bg z-20 font-bold text-text text-[10px]">
                          稼働人数 (合計)
                        </td>
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          let count = 0;
                          MEMBERS.forEach(name => {
                            const item = currentMonthData.schedule[name]?.[i] || { type: 'rest' };
                            if (item.type !== 'normal' && item.type !== 'request' && item.type !== 'rest') {
                              count++;
                            }
                          });
                          return (
                            <td key={i} className="p-0.5 border border-border text-center font-bold text-text text-[11px] min-w-[50px] min-w-max">
                              {count}人
                            </td>
                          );
                        })}
                      </tr>

                      {/* Staff rows */}
                      {MEMBERS.map(name => {
                        const schedule = currentMonthData.schedule[name] || [];
                        const normalCount = schedule.filter(s => s.type === 'normal').length;
                        const requestCount = schedule.filter(s => s.type === 'request').length;
                        return (
                          <tr key={name} className="hover:bg-bg/40 transition-colors">
                            <td className="p-1 border border-border sticky left-0 bg-white z-20 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.08)]">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-between gap-1">
                                  <div className="font-bold text-slate-900 text-[11px] truncate max-w-[48px]">{name.replace('　', '')}</div>
                                  <div className="flex flex-col text-[9px] font-bold leading-tight shrink-0">
                                    <span className="text-slate-500">公{normalCount}</span>
                                    <span className="text-pink-600">希{requestCount}</span>
                                  </div>
                                </div>
                                <LocalInput
                                  className="w-full px-0.5 py-0 rounded border border-slate-200 text-[9px] outline-none focus:border-accent bg-slate-50 text-slate-900 font-normal h-4"
                                  size={9}
                                  value={globalStations[name] || currentMonthData.memberStations?.[name] || ''}
                                  onChange={(val: string) => handleMemberStationChange(name, val)}
                                  placeholder="駅"
                                />
                              </div>
                            </td>
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                              const item = currentMonthData.schedule[name]?.[i] || { type: 'rest', detail: '' };
                              return (
                                <td key={i} className="p-0.5 border border-border min-w-[50px] min-w-max">
                                  <div className="flex flex-col gap-0.5 min-w-full w-max text-center justify-center mx-auto">
                                    <select
                                      className={`w-full px-0.5 py-1 rounded-full text-[11px] font-bold outline-none border border-transparent focus:border-accent/30 transition-all ${TYPE_CLASS[item.type]}`}
                                      value={item.type}
                                      onChange={(e) => handleScheduleTypeChange(name, i, e.target.value as StatusType)}
                                    >
                                      {Object.keys(TYPE_LABEL).map(t => (
                                        <option key={t} value={t}>{TYPE_LABEL[t as StatusType].split('(')[0]}</option>
                                      ))}
                                    </select>
                                    <LocalInput
                                      className="min-w-full w-max px-0.5 py-0.5 rounded border border-slate-200 text-[10px] text-slate-900 outline-none focus:border-accent bg-slate-50 focus:bg-white h-5 text-center justify-center mx-auto"
                                      size={10}
                                      value={item.detail || ''}
                                      onChange={(val: string) => handleScheduleDetailChange(name, i, val)}
                                      placeholder="..."
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 bg-accent-l/20 rounded-xl p-5 border border-accent/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-accent">
                      <Info size={14} />
                      全体メモ / 連絡事項
                    </div>
                    <button 
                      onClick={() => {
                        updateCurrentMonthData({ overallMemo: currentMonthData.overallMemo });
                        triggerSaveOk('overall-memo');
                      }}
                      className="bg-accent text-white px-4 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-accent-d transition-colors"
                    >
                      <Save size={12} />
                      メモを保存
                    </button>
                  </div>
                  <LocalTextarea
                    className="w-full border border-accent/20 rounded-xl p-4 text-xs bg-white focus:border-accent outline-none min-h-[150px] leading-relaxed font-bold text-text"
                    placeholder="全体に向けた連絡事項や、月間の特記事項を入力してください..."
                    value={currentMonthData.overallMemo || ''}
                    onChange={(val: string) => {
                      updateCurrentMonthData({ overallMemo: val });
                    }}
                  />
                  {showSaveOk['overall-memo'] && (
                    <div className="mt-2 text-right text-[10px] text-green-600 font-bold animate-pulse">
                      ✓ 全体メモを保存しました
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="bg-white border-t border-border p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-[10px] text-text3">
          <Info size={12} />
          <span>データはサーバーにリアルタイム保存されます。リンクを知っている全員が閲覧・編集可能です。</span>
        </div>
      </footer>

    </div>
  );
}
