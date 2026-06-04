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
  Headphones
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
import { MemorizationLog } from '../types';
import { localDb, LocalFirstSyncEngine, dbEventBroker } from '../services/db';

// Constants
const TOTAL_PAGES = 604;
const INITIAL_MEMORIZED = 7;
const DAILY_RATE_GOAL = 0.5;
const DEADLINE = new Date('2029-07-16');
const START_DATE = new Date('2026-04-13');

interface MemorizationTrackerProps {
  uid: string;
}

export const MemorizationTracker: React.FC<MemorizationTrackerProps> = ({ uid }) => {
  const [logs, setLogs] = useState<Record<string, MemorizationLog>>({});
  const [activeTab, setActiveTab] = useState<'today' | 'progress' | 'calendar'>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Load data from Local-First Database
  useEffect(() => {
    if (!uid) return;

    const loadLocalLogs = async () => {
      setLoading(true);
      try {
        const localLogsList = await localDb.memorizationLogs.where('uid').equals(uid).toArray();
        const logsMap: Record<string, MemorizationLog> = {};
        localLogsList.forEach((log) => {
          logsMap[log.date] = log;
        });
        setLogs(logsMap);
      } catch (err) {
        console.error("Failed to load local memorization logs:", err);
      } finally {
        setLoading(false);
      }
    };

    loadLocalLogs();

    // Subscribe to database change events for instant reactive UI rendering
    const unsubscribeDB = dbEventBroker.subscribe(async (collectionName) => {
      if (collectionName === 'memorizationLogs') {
        const localLogsList = await localDb.memorizationLogs.where('uid').equals(uid).toArray();
        const logsMap: Record<string, MemorizationLog> = {};
        localLogsList.forEach((log) => {
          logsMap[log.date] = log;
        });
        setLogs(logsMap);
      }
    });

    return () => {
      unsubscribeDB();
    };
  }, [uid]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLog = logs[todayStr] || {
    uid,
    date: todayStr,
    memorized: false,
    revision: false,
    hizb: false,
    juz: false
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
      // Direct local-first write and sync engine cueing
      await LocalFirstSyncEngine.saveRecord('memorizationLogs', newLog);

      // Haptic feedback (if available)
      if (window.navigator.vibrate) {
        window.navigator.vibrate(10);
      }

      // Check for perfect day
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
      console.error("Local-first memorization toggle failed:", err);
    }
  };

  // Calculations
  const stats = useMemo(() => {
    const totalMemorizedDays = Object.values(logs).filter(l => l.memorized).length;
    const currentMemorized = INITIAL_MEMORIZED + (totalMemorizedDays * 0.5); // Assuming 0.5 page per memorized day
    const pagesRemaining = TOTAL_PAGES - currentMemorized;
    
    const today = startOfDay(new Date());
    const daysRemaining = differenceInDays(DEADLINE, today);
    const requiredPagesPerDay = daysRemaining > 0 ? pagesRemaining / daysRemaining : 0;

    // Streak Calculation
    let perfectStreak = 0;
    let hiddenStreak = 0;
    
    const sortedDates = Object.keys(logs).sort((a, b) => b.localeCompare(a));
    
    // Perfect Streak
    for (let i = 0; i < 1000; i++) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      const log = logs[d];
      if (log && log.memorized && log.revision && log.hizb && log.juz) {
        perfectStreak++;
      } else if (i === 0) {
        continue; // Allow today to be incomplete
      } else {
        break;
      }
    }

    // Hidden Streak
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

    // Projection
    const estimatedCompletionDate = addDays(today, requiredPagesPerDay > 0 ? pagesRemaining / 0.5 : 0);

    return {
      currentMemorized,
      pagesRemaining,
      daysRemaining,
      requiredPagesPerDay,
      perfectStreak,
      hiddenStreak,
      estimatedCompletionDate,
      percentComplete: (currentMemorized / TOTAL_PAGES) * 100
    };
  }, [logs]);

  const getPaceStatus = () => {
    if (stats.requiredPagesPerDay <= 0.5) return { label: "You're on track", color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (stats.requiredPagesPerDay <= 0.7) return { label: "Slightly behind", color: 'text-amber-400', bg: 'bg-amber-500/10' };
    return { label: "Catch up needed", color: 'text-red-400', bg: 'bg-red-500/10' };
  };

  const pace = getPaceStatus();

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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans pb-24 selection:bg-emerald-500/30">
      {/* Header */}
      <header className="p-6 pt-12 space-y-1">
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">
          {format(new Date(), 'EEEE, MMMM do')}
        </p>
        <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Memorization</h1>
      </header>

      {/* Tabs */}
      <div className="px-6 flex gap-4 border-b border-white/5">
        {(['today', 'progress', 'calendar'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-xs font-bold uppercase tracking-widest transition-all relative ${
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
                    { id: 'memorized', label: 'Half page memorized', icon: BookOpen },
                    { id: 'revision', label: 'Revision done', icon: RotateCcw },
                    { id: 'hizb', label: 'Hizb recited in Qiyam', icon: Mic },
                    { id: 'juz', label: 'Juz listened', icon: Headphones },
                  ].map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleToggle(task.id as any)}
                      className={`flex items-center justify-between p-6 rounded-3xl border transition-all ${
                        todayLog[task.id as keyof typeof todayLog] 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-md' 
                          : 'bg-zinc-900/30 border-white/5 text-zinc-300 hover:border-white/10 hover:bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <task.icon className={`w-6 h-6 ${todayLog[task.id as keyof typeof todayLog] ? 'text-emerald-400' : 'text-zinc-600'}`} />
                        <span className="font-bold text-lg">{task.label}</span>
                      </div>
                      {todayLog[task.id as keyof typeof todayLog] ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      ) : (
                        <Circle className="w-8 h-8 text-zinc-800" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Memorized</p>
                  <p className="text-2xl font-black text-white">{stats.currentMemorized.toFixed(1)}</p>
                  <p className="text-[10px] text-zinc-500">Pages so far</p>
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
                  <p className="text-sm text-zinc-500 font-medium">{stats.daysRemaining} days until deadline</p>
                </div>
              </div>

              {/* Pace Status */}
              <div className={`p-6 rounded-3xl border border-white/5 ${pace.bg} ${pace.color} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-bold">{pace.label}</span>
                </div>
                <div className="text-xs font-black uppercase tracking-widest">
                  {stats.requiredPagesPerDay.toFixed(2)} p/d
                </div>
              </div>

              {/* Projection Card */}
              <div className="bg-zinc-900/50 border border-white/5 text-zinc-100 p-8 rounded-[2.5rem] space-y-6 shadow-xl">
                <div className="flex items-center gap-3">
                  <Target className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-xl font-bold text-white">Projection</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Estimated Finish</p>
                      <p className="text-2xl font-bold text-white">{format(stats.estimatedCompletionDate, 'MMMM d, yyyy')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Deadline</p>
                      <p className="text-sm font-medium text-zinc-400">{format(DEADLINE, 'MMM d, yyyy')}</p>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500" 
                      style={{ width: `${Math.min(100, (differenceInDays(new Date(), START_DATE) / differenceInDays(DEADLINE, START_DATE)) * 100)}%` }} 
                    />
                  </div>
                </div>

                <p className="text-sm text-zinc-400 leading-relaxed">
                  {stats.requiredPagesPerDay <= 0.5 
                    ? `You are on pace to finish ${differenceInDays(DEADLINE, stats.estimatedCompletionDate)} days before your deadline.`
                    : `You are behind by ${((stats.requiredPagesPerDay - 0.5) * stats.daysRemaining).toFixed(1)} pages compared to your target rate.`
                  }
                </p>
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
                <h3 className="text-xl font-bold text-white">{format(selectedDate, 'MMMM yyyy')}</h3>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedDate(subDays(selectedDate, 30))} className="p-2 hover:bg-white/5 text-zinc-400 hover:text-white rounded-full transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setSelectedDate(addDays(selectedDate, 30))} className="p-2 hover:bg-white/5 text-zinc-400 hover:text-white rounded-full transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Heatmap Grid */}
              <div className="grid grid-cols-7 gap-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <div key={`${d}-${i}`} className="text-center text-[10px] font-black text-zinc-500 uppercase py-2">{d}</div>
                ))}
                
                {Array.from({ length: startOfMonth(selectedDate).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {eachDayOfInterval({
                  start: startOfMonth(selectedDate),
                  end: endOfMonth(selectedDate)
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
                  } else if (!isFuture && isAfter(date, START_DATE)) {
                    color = 'bg-red-500/10 border border-red-500/20 text-red-500/80';
                  } else {
                    color = 'bg-zinc-900/40 border border-white/5 text-zinc-600';
                  }

                  return (
                    <motion.div
                      key={dateStr}
                      whileTap={{ scale: 0.9 }}
                      className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${color} ${
                        isFuture ? 'opacity-30' : 'cursor-pointer'
                      } ${isSameDay(date, new Date()) ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#0a0a0a]' : ''}`}
                    >
                      {format(date, 'd')}
                    </motion.div>
                  );
                })}
              </div>

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
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="p-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-zinc-500">
          <Clock className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Goal: July 16, 2029</span>
        </div>
      </footer>
    </div>
  );
};
