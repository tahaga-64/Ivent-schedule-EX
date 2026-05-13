export const REGION_STYLE: Record<string, any> = {
  "東日本": { bg:"#dbeafe", text:"#1d4ed8", dot:"#3b82f6", calBg:"#eff6ff", calBorder:"#93c5fd" },
  "西日本": { bg:"#d1fae5", text:"#065f46", dot:"#10b981", calBg:"#f0fdf4", calBorder:"#6ee7b7" },
  "南日本": { bg:"#ffedd5", text:"#9a3412", dot:"#f97316", calBg:"#fff7ed", calBorder:"#fdba74" },
  "中日本": { bg:"#ede9fe", text:"#5b21b6", dot:"#8b5cf6", calBg:"#f5f3ff", calBorder:"#c4b5fd" },
};

export const TYPE_STYLE: Record<string, any> = {
  "水族館":      { bg:"#ecfeff", border:"#67e8f9", text:"#0e7490", icon:"🐟" },
  "職業体験":    { bg:"#fdf2f8", border:"#f0abfc", text:"#86198f", icon:"🎓" },
  "忍者":        { bg:"#f1f5f9", border:"#94a3b8", text:"#475569", icon:"🥷" },
  "DJI":         { bg:"#f0f9ff", border:"#7dd3fc", text:"#0369a1", icon:"🚁" },
  "超メタフェス":{ bg:"#faf5ff", border:"#d8b4fe", text:"#6d28d9", icon:"🎮" },
  "ワークショップ":{ bg:"#fffbeb", border:"#fcd34d", text:"#92400e", icon:"🛠" },
};

export const DAYS_JP = ["日","月","火","水","木","金","土"];

export const DEPT_OPTIONS = ["北海道", "東北", "関東", "中部", "近畿", "四国", "九州", "沖縄"] as const;

export const DEPT_TO_REGION: Record<string, string> = {
  "北海道": "東日本",
  "東北":   "東日本",
  "関東":   "東日本",
  "中部":   "中日本",
  "近畿":   "西日本",
  "四国":   "西日本",
  "九州":   "南日本",
  "沖縄":   "南日本",
};
