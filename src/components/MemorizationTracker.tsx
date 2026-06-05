import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Circle, 
  Flame, 
  Star, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Target, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Info,
  BookOpen,
  RotateCcw,
  Mic,
  Headphones,
  Calculator,
  Search,
  Check,
  CalendarDays
} from 'lucide-react';
import { 
  format, 
  differenceInDays, 
  addDays, 
  isSameDay, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  subDays,
  isAfter,
  isBefore,
  startOfDay
} from 'date-fns';
import confetti from 'canvas-confetti';
import { MemorizationLog, UserProfile } from '../types';
import { localDb, LocalFirstSyncEngine, dbEventBroker } from '../services/db';
import { SURAHS } from '../data/surahData';

// Constants
const TOTAL_PAGES = 604;

interface MemorizationTrackerProps {
  uid: string;
}

export const MemorizationTracker: React.FC<MemorizationTrackerProps> = ({ uid }) => {
  const [logs, setLogs] = useState<Record<string, MemorizationLog>>({});
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'progress' | 'calendar' | 'calculator'>('today');
  
  // States for Calendar tab
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());
  const [clickedDayInfo, setClickedDayInfo] = useState<Date | null>(new Date());
  
  // States for Calculator tab
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Load logs & profile from Local-First DB
  useEffect(() => {
    if (!uid) return;

    const loadLocalData = async () => {
      setLoading(true);
      try {
        // Load Logs
        const localLogsList = await localDb.memorizationLogs.where('uid').equals(uid).toArray();
        const logsMap: Record<string, MemorizationLog> = {};
        localLogsList.forEach((log) => {
          logsMap[log.date] = log;
        });
        setLogs(logsMap);

        // Load Profile
        const userProf = await localDb.users.get(uid);
        if (userProf) {
          setProfile(userProf);
        }
      } catch (err) {
        console.error("Failed to load local data in MemorizationTracker:", err);
      } finally {
        setLoading(false);
      }
    };

    loadLocalData();

    // Subscribe to DB change events
    const unsubscribeDB = dbEventBroker.subscribe(async (collectionName) => {
      if (collectionName === 'memorizationLogs') {
        const localLogsList = await localDb.memorizationLogs.where('uid').equals(uid).toArray();
        const logsMap: Record<string, MemorizationLog> = {};
        localLogsList.forEach((log) => {
          logsMap[log.date] = log;
        });
        setLogs(logsMap);
      } else if (collectionName === 'users') {
        const userProf = await localDb.users.get(uid);
        if (userProf) {
          setProfile(userProf);
        }
      }
    });

    return () => {
      unsubscribeDB();
    };
  }, [uid]);

  // Helper: Update Profile in Sync Engine
  const updateProfileConfig = async (updates: Partial<UserProfile>) => {
    if (!uid || !profile) return;
    const updatedProfile = { ...profile, ...updates };
    setProfile(updatedProfile); // Instant local UI state update
    try {
      await LocalFirstSyncEngine.saveRecord('users', updatedProfile);
    } catch (err) {
      console.error("Failed to save profile configuration:", err);
    }
  };

  // Resolve config variables with precise fallbacks
  const startPage = profile?.memoStartPage ?? 7;
  const dailyType = profile?.memoDailyType ?? 'half';
  const dailyVal = profile?.memoDailyValue ?? (dailyType === 'lines' ? 3 : 1);
  const startDateStr = profile?.memoStartDate ?? todayStr;
  const selectedSurahNum = profile?.memoSelectedSurahNum ?? 1;
  const memorizedSurahs = useMemo(() => profile?.memoMemorizedSurahs ?? [], [profile?.memoMemorizedSurahs]);
  const memorizedSurahsSet = useMemo(() => new Set(memorizedSurahs), [memorizedSurahs]);

  const handleToggleSurahMemorized = async (surahNum: number) => {
    let newMemorized = [...memorizedSurahs];
    if (newMemorized.includes(surahNum)) {
      newMemorized = newMemorized.filter(n => n !== surahNum);
    } else {
      newMemorized.push(surahNum);
      // provide satisfying feedback
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(12);
      }
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.85 },
        colors: ['#10b981', '#34d399', '#fbbf24']
      });
    }
    await updateProfileConfig({ memoMemorizedSurahs: newMemorized });
  };

  const config = useMemo(() => {
    let pagesPerDay = 0.5;
    if (dailyType === 'pages') {
      pagesPerDay = dailyVal;
    } else if (dailyType === 'lines') {
      pagesPerDay = dailyVal / 15;
    } else {
      pagesPerDay = 0.5;
    }

    let parsedStartDate = startOfDay(new Date());
    try {
      if (startDateStr) {
        parsedStartDate = startOfDay(parseISO(startDateStr));
      }
    } catch (e) {
      console.error("Invalid start date provided:", e);
    }

    return {
      startPage,
      dailyType,
      dailyVal,
      pagesPerDay,
      startDate: parsedStartDate,
      startDateStr
    };
  }, [startPage, dailyType, dailyVal, startDateStr]);

  // Calculations & Analytics Sync
  const stats = useMemo(() => {
    const totalMemorizedDays = Object.values(logs).filter(l => l.memorized).length;
    
    // Calculate the set of unique pages memorized dynamically to avoid double counting
    const memorizedPagesSet = new Set<number>();
    
    // 1. Chapters checked off as fully memorized
    SURAHS.forEach(s => {
      if (memorizedSurahsSet.has(s.number)) {
        for (let p = s.startPage; p <= s.endPage; p++) {
          memorizedPagesSet.add(p);
        }
      }
    });
    
    // 2. Base range of pages prior to start page
    for (let p = 1; p < config.startPage; p++) {
      memorizedPagesSet.add(p);
    }

    const baseMemorizedPagesCount = memorizedPagesSet.size;
    
    // Total progress is checked chapters + previous start range target page progress + daily items log
    const currentMemorized = Math.min(TOTAL_PAGES, baseMemorizedPagesCount + (totalMemorizedDays * config.pagesPerDay));
    const pagesRemaining = Math.max(0, TOTAL_PAGES - currentMemorized);

    // Timeline predictions from start date:
    // How many total pages need to be memorized from target starting point?
    const totalPagesRequired = TOTAL_PAGES - baseMemorizedPagesCount;
    const totalDaysRequired = config.pagesPerDay > 0 ? totalPagesRequired / config.pagesPerDay : 0;
    const estimatedCompletionDate = addDays(config.startDate, Math.ceil(totalDaysRequired));

    const today = startOfDay(new Date());
    const daysRemaining = differenceInDays(estimatedCompletionDate, today);

    // Milestones pages calculated based on your starting footprint
    const m25Page = Math.min(TOTAL_PAGES, Math.round(baseMemorizedPagesCount + totalPagesRequired * 0.25));
    const m50Page = Math.min(TOTAL_PAGES, Math.round(baseMemorizedPagesCount + totalPagesRequired * 0.50));
    const m75Page = Math.min(TOTAL_PAGES, Math.round(baseMemorizedPagesCount + totalPagesRequired * 0.75));

    const m25Date = addDays(config.startDate, Math.ceil((totalPagesRequired * 0.25) / config.pagesPerDay));
    const m50Date = addDays(config.startDate, Math.ceil((totalPagesRequired * 0.50) / config.pagesPerDay));
    const m75Date = addDays(config.startDate, Math.ceil((totalPagesRequired * 0.75) / config.pagesPerDay));

    // Streaks
    let perfectStreak = 0;
    let hiddenStreak = 0;

    // Perfect streak check (all 4 checked)
    for (let i = 0; i < 1000; i++) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      const log = logs[d];
      if (log && log.memorized && log.revision && log.hizb && log.juz) {
        perfectStreak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }

    // Hidden streak (just memorized)
    for (let i = 0; i < 1000; i++) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      const log = logs[d];
      if (log && log.memorized) {
        hiddenStreak++;
      } else if (i === 0) {
        continue;
      } else {
        break;
      }
    }

    return {
      currentMemorized,
      pagesRemaining,
      daysRemaining,
      perfectStreak,
      hiddenStreak,
      estimatedCompletionDate,
      percentComplete: (currentMemorized / TOTAL_PAGES) * 100,
      milestones: [
        { percentage: 25, label: "Quarter-mark", page: m25Page, date: m25Date },
        { percentage: 50, label: "Halfway Point", page: m50Page, date: m50Date },
        { percentage: 75, label: "Three-Quarter mark", page: m75Page, date: m75Date },
        { percentage: 100, label: "Complete Quran Memorization!", page: TOTAL_PAGES, date: estimatedCompletionDate }
      ]
    };
  }, [logs, config, memorizedSurahsSet]);

  // Helper string for duration
  const getTimeRemainingString = (targetDate: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(targetDate, today)) {
      return "0 days (Already Completed)";
    }

    let years = targetDate.getFullYear() - today.getFullYear();
    let months = targetDate.getMonth() - today.getMonth();
    let days = targetDate.getDate() - today.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);

    return parts.length > 0 ? parts.join(', ') : "Today";
  };

  const handleToggle = async (task: keyof Omit<MemorizationLog, 'id' | 'uid' | 'date'>) => {
    if (!uid) return;

    const dateStr = todayStr;
    const currentLog = logs[dateStr] || {
      uid,
      date: dateStr,
      memorized: false,
      revision: false,
      hizb: false,
      juz: false
    };

    const logId = `${uid}_${dateStr}`;
    const newLog = { ...currentLog, id: logId, [task]: !currentLog[task] };

    try {
      await LocalFirstSyncEngine.saveRecord('memorizationLogs', newLog);

      if (window.navigator.vibrate) {
        window.navigator.vibrate(10);
      }

      // Confetti on daily completion
      if (!currentLog[task]) {
        const allDone = Object.keys(newLog)
          .filter(k => k !== 'date' && k !== 'id' && k !== 'uid')
          .every(k => newLog[k as keyof typeof newLog] === true);

        if (allDone) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#fbbf24']
          });
        }
      }
    } catch (err) {
      console.error("Local-first toggle failed:", err);
    }
  };

  // Filtered Surahs based on Search Query
  const filteredSurahs = useMemo(() => {
    return SURAHS.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.number.toString().includes(searchQuery)
    );
  }, [searchQuery]);

  const paceStatus = () => {
    if (stats.daysRemaining <= 0) return { label: "Goal Complete!", color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (config.pagesPerDay >= 0.5) return { label: "Great Pace!", color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (config.pagesPerDay >= 0.2) return { label: "Steady Progress", color: 'text-blue-400', bg: 'bg-blue-500/10' };
    return { label: "Pace is relaxed", color: 'text-amber-400', bg: 'bg-amber-500/10' };
  };

  const pace = paceStatus();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Find currently active Surah based on dynamic progress position
  const currentSurah = SURAHS.find(s => s.startPage <= Math.floor(stats.currentMemorized) && s.endPage >= Math.floor(stats.currentMemorized)) || SURAHS[0];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans pb-24 selection:bg-emerald-500/30">
      {/* Header */}
      <header className="p-6 pt-12 space-y-1">
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">
          {format(new Date(), 'EEEE, MMMM do')}
        </p>
        <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Memorization</h1>
      </header>

      {/* Navigation Tabs */}
      <div className="px-6 flex gap-4 border-b border-white/5 overflow-x-auto scrollbar-none">
        {(['today', 'progress', 'calendar', 'calculator'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative shrink-0 ${
              activeTab === tab ? 'text-white font-black' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div 
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      <main className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'today' && (
            <motion.div
              key="today"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Daily Target Info Board */}
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 rounded-[2.5rem] p-8 border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 translate-x-12 -translate-y-6 opacity-5 pointer-events-none">
                  <Calculator className="w-64 h-64 text-emerald-500" />
                </div>
                <div className="space-y-2 relative">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    <Target className="w-3.5 h-3.5" />
                    Today's Target
                  </div>
                  <h3 className="text-3xl font-black text-white leading-tight">
                    {config.dailyType === 'pages' 
                      ? `Memorize ${config.dailyVal} Pages` 
                      : config.dailyType === 'lines'
                        ? `Memorize ${config.dailyVal} Lines`
                        : "Memorize 1/2 Page (Half-Page)"}
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    Scheduled: Page <span className="text-white hover:underline">{Math.floor(stats.currentMemorized)}</span> in Surah <span className="text-white font-semibold">{currentSurah.name}</span>
                  </p>
                </div>
                <div className="bg-white/5 border border-white/5 p-4 rounded-3xl min-w-[150px] text-center md:text-right">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Current Position</p>
                  <p className="text-xl font-black text-white">Page {stats.currentMemorized.toFixed(1)}</p>
                  <p className="text-[10px] text-zinc-400">{stats.percentComplete.toFixed(1)}% of Quran</p>
                </div>
              </div>

              {/* Streak Section */}
              <div className="space-y-4">
                <div className="bg-zinc-900/50 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center space-y-2 border border-white/5 shadow-sm">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Flame className="w-12 h-12 text-orange-500 fill-orange-500" />
                  </motion.div>
                  <h2 className="text-5xl font-black tracking-tighter text-white">
                    {stats.perfectStreak}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    Current Streak 🔥
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 text-zinc-500">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider">Hidden Streak: {stats.hiddenStreak} days ⭐</span>
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 px-2">Daily Tasks</h3>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { 
                      id: 'memorized', 
                      label: config.dailyType === 'pages' 
                        ? `${config.dailyVal} page(s) memorized` 
                        : config.dailyType === 'lines'
                          ? `${config.dailyVal} line(s) memorized`
                          : 'Half page memorized', 
                      icon: BookOpen 
                    },
                    { id: 'revision', label: 'Revision done', icon: RotateCcw },
                    { id: 'hizb', label: 'Hizb recited in Qiyam', icon: Mic },
                    { id: 'juz', label: 'Juz listened', icon: Headphones },
                  ].map(task => {
                    const todayLog = logs[todayStr] || {
                      uid,
                      date: todayStr,
                      memorized: false,
                      revision: false,
                      hizb: false,
                      juz: false
                    };
                    const isChecked = todayLog[task.id as keyof typeof todayLog] as boolean;

                    return (
                      <button
                        key={task.id}
                        onClick={() => handleToggle(task.id as any)}
                        className={`flex items-center justify-between p-6 rounded-3xl border transition-all text-left ${
                          isChecked 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-md' 
                            : 'bg-zinc-900/30 border-white/5 text-zinc-300 hover:border-white/10 hover:bg-zinc-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <task.icon className={`w-6 h-6 ${isChecked ? 'text-emerald-400' : 'text-zinc-600'}`} />
                          <span className="font-bold text-lg">{task.label}</span>
                        </div>
                        {isChecked ? (
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                        ) : (
                          <Circle className="w-8 h-8 text-zinc-800 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Memorized so far</p>
                  <p className="text-2xl font-black text-white">{stats.currentMemorized.toFixed(1)} / 604</p>
                  <p className="text-[10px] text-zinc-500">Pages overall</p>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Remaining</p>
                  <p className="text-2xl font-black text-white">{stats.pagesRemaining.toFixed(1)}</p>
                  <p className="text-[10px] text-zinc-500">Pages left</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'progress' && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Progress Ring */}
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                <div className="relative w-64 h-64">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="128"
                      cy="128"
                      r="110"
                      stroke="currentColor"
                      strokeWidth="24"
                      fill="transparent"
                      className="text-white/5"
                    />
                    <motion.circle
                      cx="128"
                      cy="128"
                      r="110"
                      stroke="currentColor"
                      strokeWidth="24"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 110}
                      initial={{ strokeDashoffset: 2 * Math.PI * 110 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 110 * (1 - stats.percentComplete / 100) }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="text-emerald-500"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-5xl font-black tracking-tighter text-white">{stats.percentComplete.toFixed(1)}%</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Completed</span>
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <p className="text-xl font-bold text-white">{stats.currentMemorized.toFixed(1)} / 604 Pages</p>
                  <p className="text-xs text-zinc-400 font-medium">Starting page configured: {config.startPage}</p>
                </div>
              </div>

              {/* Pace Status */}
              <div className={`p-6 rounded-3xl border border-white/5 ${pace.bg} ${pace.color} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-bold">{pace.label}</span>
                </div>
                <div className="text-xs font-black uppercase tracking-widest">
                  {config.pagesPerDay.toFixed(2)} p/d
                </div>
              </div>

              {/* Projection & Milestone Timeline Card */}
              <div className="bg-zinc-900/50 border border-white/5 text-zinc-100 p-8 rounded-[2.5rem] space-y-8 shadow-xl">
                <div className="flex items-center gap-3">
                  <Target className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-xl font-bold text-white">Estimated Timeline</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Estimated Completion Date</p>
                      <p className="text-2xl font-bold text-white">{format(stats.estimatedCompletionDate, 'MMMM d, yyyy')}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Time remaining</p>
                      <p className="text-sm font-semibold text-emerald-400">{getTimeRemainingString(stats.estimatedCompletionDate)}</p>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500" 
                      style={{ width: `${stats.percentComplete}%` }} 
                    />
                  </div>
                </div>

                {/* Milestones Flow */}
                <div className="space-y-5 pt-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-zinc-400">Roadmap Milestones</h4>
                  <div className="relative border-l-2 border-white/10 pl-6 ml-2 space-y-6">
                    {stats.milestones.map((milestone) => {
                      const isMilestoneReached = stats.currentMemorized >= milestone.page;

                      return (
                        <div key={milestone.percentage} className="relative">
                          <span className={`absolute -left-[1.95rem] top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                            isMilestoneReached 
                              ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                              : 'bg-zinc-900 border-zinc-700'
                          }`}>
                            {isMilestoneReached && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold uppercase tracking-wide ${isMilestoneReached ? 'text-emerald-400 font-extrabold' : 'text-zinc-500'}`}>
                                {milestone.percentage}% {milestone.label}
                              </span>
                              <span className="text-[10px] text-zinc-600 font-bold bg-white/5 px-2 py-0.5 rounded-full">
                                Page {milestone.page}
                              </span>
                            </div>
                            <p className="text-sm font-medium mt-1 text-zinc-300">
                              Estimated on <span className="text-white font-bold">{format(milestone.date, 'MMMM do, yyyy')}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-bold text-white">{format(selectedCalendarDate, 'MMMM yyyy')}</h3>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedCalendarDate(subDays(selectedCalendarDate, 30))} className="p-2 hover:bg-white/5 text-zinc-400 hover:text-white rounded-full transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setSelectedCalendarDate(addDays(selectedCalendarDate, 30))} className="p-2 hover:bg-white/5 text-zinc-400 hover:text-white rounded-full transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Heatmap Grid */}
              <div className="grid grid-cols-7 gap-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={`${d}-${i}`} className="text-center text-[10px] font-black text-zinc-500 uppercase py-2">{d}</div>
                ))}
                
                {Array.from({ length: startOfMonth(selectedCalendarDate).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {eachDayOfInterval({
                  start: startOfMonth(selectedCalendarDate),
                  end: endOfMonth(selectedCalendarDate)
                }).map(date => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const log = logs[dateStr];
                  const isFuture = isAfter(startOfDay(date), startOfDay(new Date()));
                  
                  let color = 'bg-zinc-900/30 border border-white/5 text-zinc-500';
                  if (log) {
                    const perfect = log.memorized && log.revision && log.hizb && log.juz;
                    if (perfect) color = 'bg-emerald-500 text-black font-black shadow-[0_0_10px_rgba(16,185,129,0.3)] border-transparent';
                    else if (log.memorized) color = 'bg-amber-500 text-black font-black border-transparent';
                    else color = 'bg-red-500/20 border border-red-500/30 text-red-400';
                  } else if (!isFuture && isAfter(date, config.startDate)) {
                    color = 'bg-red-500/10 border border-red-500/20 text-red-500/80';
                  } else {
                    color = 'bg-zinc-900/40 border border-white/5 text-zinc-600';
                  }

                  const isClicked = clickedDayInfo && isSameDay(date, clickedDayInfo);

                  return (
                    <motion.button
                      key={dateStr}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setClickedDayInfo(date)}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-bold transition-all relative ${color} ${
                        isSameDay(date, new Date()) ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#0a0a0a]' : ''
                      } ${isClicked ? 'border-emerald-400 border-2' : ''}`}
                    >
                      <span>{format(date, 'd')}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Forecast and details on Clicked Day */}
              {clickedDayInfo && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-zinc-900/40 border border-white/5 rounded-3xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Schedule For {format(clickedDayInfo, 'EEEE, MMM d, yyyy')}
                    </p>
                    <span className="text-[10px] text-zinc-600 font-bold bg-white/5 px-2.5 py-0.5 rounded-full">
                      {isBefore(clickedDayInfo, startOfDay(new Date())) ? "Past Day" : isSameDay(clickedDayInfo, new Date()) ? "Today" : "Predicted Plan"}
                    </span>
                  </div>

                  {(() => {
                    const diffDays = differenceInDays(clickedDayInfo, config.startDate);
                    const predictedPage = Math.min(TOTAL_PAGES, config.startPage + Math.max(0, diffDays) * config.pagesPerDay);
                    const matchingSurah = SURAHS.find(s => s.startPage <= Math.floor(predictedPage) && s.endPage >= Math.floor(predictedPage)) || SURAHS[0];

                    const logForDay = logs[format(clickedDayInfo, 'yyyy-MM-dd')];

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-bold text-zinc-500">Predicted Page Rank</p>
                          <p className="text-lg font-black text-white">Page {predictedPage.toFixed(1)}</p>
                          <p className="text-xs text-zinc-400">Positioning: Surah {matchingSurah.name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-bold text-zinc-500">Day Status / Action Log</p>
                          {logForDay ? (
                            <p className="text-emerald-400 text-sm font-bold flex items-center gap-1.5 mt-0.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              Fulfillment Registered
                            </p>
                          ) : isBefore(clickedDayInfo, startOfDay(new Date())) ? (
                            <p className="text-zinc-500 text-sm font-semibold mt-0.5">No logged tracking</p>
                          ) : (
                            <p className="text-amber-400 text-sm font-semibold mt-0.5">Planned memorizing loop</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Perfect Day</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Memorized</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/20" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Missed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-zinc-900/40 border border-white/5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Future/No Data</span>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'calculator' && (
            <motion.div
              key="calculator"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Calculator Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configuration side */}
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider">Configure Memorization Schedule</h3>
                  
                  {/* Start Date */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Plan Start Date
                    </label>
                    <input 
                      type="date"
                      value={config.startDateStr}
                      onChange={(e) => updateProfileConfig({ memoStartDate: e.target.value })}
                      className="w-full bg-zinc-950/80 border border-white/10 rounded-2xl px-5 py-3 text-white font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none focus:border-transparent cursor-pointer"
                    />
                  </div>

                  {/* Starting point page slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Current Page Position (1-604)
                      </label>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                        Page {config.startPage} / 604
                      </span>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="604"
                      value={config.startPage}
                      onChange={(e) => updateProfileConfig({ memoStartPage: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                    />
                    <div className="flex justify-between text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                      <span>Beginner (Page 1)</span>
                      <span>Halfway (Page 302)</span>
                      <span>Finished (Page 604)</span>
                    </div>
                  </div>

                  {/* Daily Rate selector */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      Daily Memorization Rate Goal
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'half', label: '1/2 Page' },
                        { id: 'pages', label: 'Pages/Day' },
                        { id: 'lines', label: 'Lines/Day' }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            const standardVal = item.id === 'lines' ? 3 : 1;
                            updateProfileConfig({ 
                              memoDailyType: item.id as any,
                              memoDailyValue: standardVal
                            });
                          }}
                          className={`py-3 rounded-2xl text-xs font-bold transition-all border outline-none ${
                            config.dailyType === item.id 
                              ? 'bg-emerald-500 border-emerald-500 text-black font-black shadow-lg shadow-emerald-500/10' 
                              : 'bg-zinc-950/80 border-white/5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Conditional slider values */}
                    {config.dailyType !== 'half' && (
                      <div className="pt-2 animate-fadeIn">
                        <div className="flex justify-between items-center text-xs text-zinc-400 font-semibold mb-2">
                          <span>Set rate requirement:</span>
                          <span className="text-white font-extrabold text-sm">
                            {config.dailyVal} {config.dailyType === 'pages' ? 'Page(s) / day' : 'Line(s) / day'}
                          </span>
                        </div>
                        <input 
                          type="range"
                          min="1"
                          max={config.dailyType === 'pages' ? '15' : '15'}
                          value={config.dailyVal}
                          onChange={(e) => updateProfileConfig({ memoDailyValue: parseInt(e.target.value) })}
                          className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                        />
                        {config.dailyType === 'lines' && (
                          <p className="text-[10px] font-semibold text-zinc-500 leading-relaxed mt-1.5">
                            * Note: Standard Madinah Mushaf possesses 15 lines per page. Selecting {config.dailyVal} lines/day implies a page took {Math.ceil(15 / config.dailyVal)} days to complete. Let's aim high!
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Estimate Analysis Side */}
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between space-y-6 shadow-2xl relative">
                  <div className="space-y-4">
                    <p className="text-zinc-400 text-xs font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-emerald-400" />
                      MEMORIZATION BLUEPRINT FORECAST
                    </p>

                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Estimated Completion Date</p>
                      <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                        {format(stats.estimatedCompletionDate, 'MMMM d, yyyy')}
                      </h1>
                      <div className="text-xs text-emerald-300 font-bold bg-emerald-950/40 border border-emerald-500/20 px-3 py-1.5 rounded-2xl inline-block mt-1">
                        ⌚ {getTimeRemainingString(stats.estimatedCompletionDate)} remaining from today
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-6 grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-zinc-500">Completed Capacity</p>
                      <p className="text-lg font-black text-white">{(TOTAL_PAGES - stats.pagesRemaining).toFixed(0)} Pages</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-zinc-500">Remaining to memorize</p>
                      <p className="text-lg font-black text-white">{stats.pagesRemaining.toFixed(0)} Pages</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-zinc-500">Daily Speed Rate</p>
                      <p className="text-sm font-black text-zinc-300">
                        {config.pagesPerDay.toFixed(2)} Pages/day
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-zinc-500">Days to complete</p>
                      <p className="text-sm font-black text-zinc-300">
                        {stats.daysRemaining > 0 ? `${stats.daysRemaining} days` : "Complete!"}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-zinc-500 italic mt-auto">
                    * The calculations are computed dynamically and are cross-synchronized in real-time with Today targets, progress meters and predictive calendars.
                  </p>
                </div>
              </div>

              {/* Ordained Chapters Directory */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-white uppercase tracking-wider">Ordained Quran Chapters</h3>
                    <p className="text-xs text-zinc-500 font-medium">Select a chapter you have memorized up to, and the calculator's start point is automatically set to the following page.</p>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input 
                      type="text"
                      placeholder="Search Surah name or page..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-zinc-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                  {filteredSurahs.map((surah) => {
                    // Decide if they have memorized "up to" this surah or if it's currently selected
                    const isCheckedMemo = memorizedSurahsSet.has(surah.number);
                    const isMemorizedUpTo = config.startPage > surah.endPage;
                    const isStartingHere = config.startPage >= surah.startPage && config.startPage <= surah.endPage;

                    return (
                      <div
                        key={surah.number}
                        onClick={() => handleToggleSurahMemorized(surah.number)}
                        className={`p-4 rounded-3xl border transition-all text-left flex flex-col justify-between gap-3 group relative overflow-hidden cursor-pointer select-none ${
                          isCheckedMemo
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold'
                            : isStartingHere 
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 ring-1 ring-blue-500/40 font-semibold' 
                              : isMemorizedUpTo 
                                ? 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400' 
                                : 'bg-zinc-900/10 border-white/5 text-zinc-300 hover:border-white/10 hover:bg-zinc-900/30'
                        }`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <span className="text-[10px] font-black text-zinc-500 tracking-wider">
                            SURAH {surah.number}
                          </span>
                          <div className="flex items-center gap-1.5 z-10">
                            {/* Target Button to select active plan starting point */}
                            <button
                              title="Set target plan starting point here"
                              onClick={(e) => {
                                e.stopPropagation(); // prevent toggling memorized status
                                const targetStart = surah.endPage === 604 ? 604 : surah.endPage + 1;
                                updateProfileConfig({ 
                                  memoStartPage: targetStart,
                                  memoSelectedSurahNum: surah.number 
                                });
                                confetti({
                                  particleCount: 20,
                                  spread: 40,
                                  origin: { y: 0.8 }
                                });
                              }}
                              className={`p-1 rounded-md transition-colors ${
                                isStartingHere ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-600 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <Target className="w-3.5 h-3.5" />
                            </button>

                            {/* Checkbox trigger */}
                            <div className="text-zinc-500 group-hover:text-emerald-400 transition-colors">
                              {isCheckedMemo ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4 text-zinc-700 hover:text-zinc-500" />
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-base tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                            {surah.name}
                          </h4>
                          <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                            Pages {surah.startPage} - {surah.endPage}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {isStartingHere && (
                              <span className="text-[8px] font-black tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase">Origin</span>
                            )}
                            {isMemorizedUpTo && !isCheckedMemo && (
                              <span className="text-[8px] font-black tracking-widest text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full uppercase">Passed</span>
                            )}
                            {isCheckedMemo && (
                              <span className="text-[8px] font-black tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase">Memorized</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="p-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-zinc-500">
          <Clock className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Goal Completion target: {format(stats.estimatedCompletionDate, 'MMMM d, yyyy')}
          </span>
        </div>
      </footer>
    </div>
  );
};
