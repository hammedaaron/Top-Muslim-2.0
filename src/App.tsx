/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO
} from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Moon, 
  Sun, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  LogOut, 
  User,
  Settings,
  Bell,
  Info,
  Flame,
  CalendarDays,
  BellRing,
  Eye,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getMonthCalendar, getFastingStatus, isSunnahDay } from './services/hijriService';
import { UserProfile, FastingLog, DayInfo, FastingStatus } from './types';
import { localDb, dbEventBroker, LocalFirstSyncEngine } from './services/db';
import { Cloud, CloudOff, CloudLightning } from 'lucide-react';
import { Widget } from './components/Widget';
import { MoonSighting } from './components/MoonSighting';
import { MemorizationTracker } from './components/MemorizationTracker';
import { ImanCalculator } from './components/ImanCalculator';
import { FinancialDisclaimer } from './components/FinancialDisclaimer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<{ uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any[]>([]);
  const [fastingLogs, setFastingLogs] = useState<FastingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [selectedDay, setSelectedDay] = useState<DayInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<'fasting' | 'memorization' | 'iman'>('fasting');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved !== 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Start the background sync intervals and listeners on mount
  useEffect(() => {
    LocalFirstSyncEngine.startBackgroundSync();
  }, []);

  // Monitor network and queue size for local-first sync badge
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingQueueSize, setPendingQueueSize] = useState(0);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    const updateQueueSize = async () => {
      try {
        const count = await localDb.syncQueue.count();
        setPendingQueueSize(count);
      } catch (e) {
        console.error("Queue counter fetch skipped:", e);
      }
    };

    updateQueueSize();
    
    // Subscribe to queue changes
    const unsub = dbEventBroker.subscribe(() => {
      updateQueueSize();
    });

    const interval = setInterval(updateQueueSize, 5000);

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      unsub();
      clearInterval(interval);
    };
  }, []);

  // Auth Listener & IndexedDB Synchronized Engine Integration
  useEffect(() => {
    let unsubscribeDB: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (unsubscribeDB) {
        unsubscribeDB();
        unsubscribeDB = null;
      }

      if (firebaseUser) {
        localStorage.removeItem('is_guest_mode');
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL
        });
        
        try {
          // Initialize/load profile locally first
          let localProfile = await localDb.users.get(firebaseUser.uid);
          
          if (!localProfile) {
            localProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || '',
              region: 'global',
              createdAt: new Date().toISOString(),
              reminders: {
                sunnah: true,
                whiteDays: true,
                ramadan: true,
                muharram: true,
                dhulHijjah: true
              }
            };
            await LocalFirstSyncEngine.saveRecord('users', localProfile);
          }
          setProfile(localProfile);

          // Get fasting logs locally first (immediate load!)
          const logs = await localDb.fastingLogs.where('uid').equals(firebaseUser.uid).toArray();
          setFastingLogs(logs);

          // Listen to local DB updates (reactive state layer)
          unsubscribeDB = dbEventBroker.subscribe(async (collectionName) => {
            if (collectionName === 'users') {
              const uProf = await localDb.users.get(firebaseUser.uid);
              if (uProf) setProfile(uProf);
            } else if (collectionName === 'fastingLogs') {
              const uLogs = await localDb.fastingLogs.where('uid').equals(firebaseUser.uid).toArray();
              setFastingLogs(uLogs);
            }
          });

          // Concurrently trigger asynchronous remote sync download in the background (No blocking!)
          LocalFirstSyncEngine.syncRemoteSnapshot(firebaseUser.uid).catch(err => {
            console.error("Delayed background snapshot sync error:", err);
          });

        } catch (err) {
          console.error("Error loading local DB profile:", err);
          setAuthError("Failed to load local database profile.");
        }
      } else {
        const currentlyGuest = localStorage.getItem('is_guest_mode') === 'true';
        if (currentlyGuest) {
          const guestUser = {
            uid: 'guest_user',
            displayName: 'Guest User',
            email: 'guest@example.com',
            photoURL: null
          };
          setUser(guestUser);
          
          let localProfile = await localDb.users.get('guest_user');
          if (!localProfile) {
            localProfile = {
              uid: 'guest_user',
              email: 'guest@example.com',
              displayName: 'Guest User',
              region: 'global',
              createdAt: new Date().toISOString(),
              reminders: {
                sunnah: true,
                whiteDays: true,
                ramadan: true,
                muharram: true,
                dhulHijjah: true
              }
            };
            await LocalFirstSyncEngine.saveRecord('users', localProfile);
          }
          setProfile(localProfile);

          const logs = await localDb.fastingLogs.where('uid').equals('guest_user').toArray();
          setFastingLogs(logs);

          unsubscribeDB = dbEventBroker.subscribe(async (collectionName) => {
            if (collectionName === 'users') {
              const uProf = await localDb.users.get('guest_user');
              if (uProf) setProfile(uProf);
            } else if (collectionName === 'fastingLogs') {
              const uLogs = await localDb.fastingLogs.where('uid').equals('guest_user').toArray();
              setFastingLogs(uLogs);
            }
          });
        } else {
          setUser(null);
          setProfile(null);
          setFastingLogs([]);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDB) unsubscribeDB();
    };
  }, []);

  const handleGuestLogin = async () => {
    setLoading(true);
    localStorage.setItem('is_guest_mode', 'true');
    const guestUser = {
      uid: 'guest_user',
      displayName: 'Guest User',
      email: 'guest@example.com',
      photoURL: null
    };
    setUser(guestUser);

    try {
      let localProfile = await localDb.users.get('guest_user');
      if (!localProfile) {
        localProfile = {
          uid: 'guest_user',
          email: 'guest@example.com',
          displayName: 'Guest User',
          region: 'global',
          createdAt: new Date().toISOString(),
          reminders: {
            sunnah: true,
            whiteDays: true,
            ramadan: true,
            muharram: true,
            dhulHijjah: true
          }
        };
        await LocalFirstSyncEngine.saveRecord('users', localProfile);
      }
      setProfile(localProfile);

      const logs = await localDb.fastingLogs.where('uid').equals('guest_user').toArray();
      setFastingLogs(logs);
    } catch (e) {
      console.error("Local Guest state login setup failure:", e);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    if (user && user.uid === 'guest_user') {
      localStorage.removeItem('is_guest_mode');
      setUser(null);
      setProfile(null);
      setFastingLogs([]);
    } else {
      await logout();
    }
  };

  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Sign in failed:", error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError("Popup was blocked. Please allow popups for this site.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthError("This domain is not authorized for Google Sign-In. Please check Firebase Console.");
      } else if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        // User closed the popup or a request was already pending
        setAuthError(null);
      } else if (error.code === 'auth/invalid-auth-event') {
        setAuthError("The sign-in request was interrupted. Please try again.");
      } else {
        setAuthError(error.message || "Failed to sign in with Google.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  // Calendar Data Fetching
  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const data = await getMonthCalendar(currentDate.getFullYear(), currentDate.getMonth() + 1);
        setCalendarData(data);
      } catch (error) {
        console.error('Error fetching calendar:', error);
      }
    };
    fetchCalendar();
  }, [currentDate]);

  const daysInMonth = useMemo(() => {
    if (!calendarData.length) return [];
    
    return calendarData.map((dayData: any) => {
      const date = parseISO(dayData.gregorian.date.split('-').reverse().join('-'));
      const hijri = dayData.hijri;
      const { status, reason } = getFastingStatus(hijri);
      
      let finalStatus = status;
      let finalReason = reason;

      if (status === 'None' && isSunnahDay(date)) {
        finalStatus = 'Recommended';
        finalReason = 'Sunnah (Monday/Thursday)';
      }

      return {
        date,
        hijri,
        fastingStatus: finalStatus,
        fastingReason: finalReason,
        isToday: isToday(date)
      } as DayInfo;
    });
  }, [calendarData]);

  const handleToggleFast = async (day: DayInfo) => {
    if (!user) return;
    
    const dateStr = format(day.date, 'yyyy-MM-dd');
    const existingLog = fastingLogs.find(log => log.date === dateStr);

    try {
      if (existingLog) {
        if (existingLog.id) {
          await LocalFirstSyncEngine.deleteRecord('fastingLogs', existingLog.id, user.uid);
        }
      } else {
        const logId = `fast_${user.uid}_${dateStr}`;
        const newLog: FastingLog = {
          id: logId,
          uid: user.uid,
          date: dateStr,
          status: 'completed',
          type: day.fastingReason,
          hijriDate: `${day.hijri.day} ${day.hijri.month.en} ${day.hijri.year}`
        };
        await LocalFirstSyncEngine.saveRecord('fastingLogs', newLog);
      }
    } catch (err) {
      console.error("Local-first fasting toggle failed:", err);
    }
  };

  const getLogForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return fastingLogs.find(log => log.date === dateStr);
  };

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

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Atmospheric Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-md w-full text-center space-y-12 relative z-10"
        >
          <div className="space-y-6">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse" />
                <div className="w-24 h-24 bg-zinc-900 border border-white/10 rounded-[2rem] flex items-center justify-center relative">
                  <Moon className="w-12 h-12 text-emerald-400" />
                </div>
              </div>
            </motion.div>
            
            <div className="space-y-3">
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-5xl font-black tracking-tighter uppercase italic"
              >
                Top Muslim
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 0.6 }}
                className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400"
              >
                Become the Muslim You Aspire to Be
              </motion.p>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="space-y-8"
          >
            <p className="text-zinc-400 text-sm leading-relaxed font-medium">
              Designed for intentional Muslims. <br />
              Track prayers, Sunnah fasts, Qur'an memorization, zakat, and Hajj savings with precision and beauty.
            </p>
            
            <div className="space-y-4">
              {authError && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-medium"
                >
                  {authError}
                </motion.div>
              )}

              <button 
                onClick={handleSignIn}
                disabled={signingIn}
                className={cn(
                  "w-full bg-white text-black font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_20px_40px_rgba(255,255,255,0.1)]",
                  signingIn ? "animate-pulse" : "hover:bg-zinc-100"
                )}
              >
                {signingIn ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                    <span className="text-sm uppercase tracking-widest">Enter the Sanctuary</span>
                  </>
                )}
              </button>

              <button 
                onClick={handleGuestLogin}
                className="w-full bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white font-bold py-5 rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] border border-white/5 hover:border-white/10"
              >
                <span className="text-sm uppercase tracking-widest">Continue as Guest</span>
              </button>


            </div>
          </motion.div>

          {/* Landing page disclaimer visibility */}
          <div className="w-full max-w-xl mx-auto mt-8 opacity-90">
            <FinancialDisclaimer />
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            transition={{ delay: 1.2 }}
            className="pt-12"
          >
            <p className="text-[10px] uppercase tracking-widest font-bold">
              v1.0 — Crafted for the Ummah
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen font-sans selection:bg-emerald-500/30 transition-colors duration-300", isDarkMode ? "bg-[#0a0a0a] text-zinc-100" : "bg-zinc-100 text-zinc-900 theme-light")}>
      {/* Header */}
      <header className={cn("sticky top-0 z-50 backdrop-blur-md border-b px-6 py-4 transition-colors duration-300", isDarkMode ? "bg-[#0a0a0a]/80 border-white/5" : "bg-white/80 border-zinc-200")}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-10 h-10 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/20 transition-all cursor-pointer shadow-sm active:scale-95"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <Moon className="w-5 h-5 text-emerald-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
            </button>
            <div className="flex flex-col">
              <h1 className="font-bold text-lg leading-none">Top Muslim</h1>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mt-0.5">Fasting & Prayer Dates</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "p-2 rounded-full transition-colors relative flex items-center justify-center cursor-pointer",
                isDarkMode ? "hover:bg-white/5 text-zinc-400" : "hover:bg-zinc-900/5 text-zinc-600"
              )}
              title={
                !isOnline 
                  ? "Offline - All updates saved locally" 
                  : pendingQueueSize > 0 
                    ? `Syncing (${pendingQueueSize} changes executing)` 
                    : "Fully Synced with Cloud Database"
              }
            >
              <Settings 
                className={cn(
                  "w-5 h-5 transition-transform duration-500",
                  !isOnline 
                    ? "text-amber-500 dark:text-amber-400" 
                    : pendingQueueSize > 0 
                      ? "text-blue-500 dark:text-blue-400 animate-[spin_4s_linear_infinite]" 
                      : "text-emerald-500 dark:text-emerald-400"
                )} 
              />
              {/* Colored Status Circle badge */}
              <span 
                className={cn(
                  "absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2",
                  isDarkMode ? "border-[#0a0a0a]" : "border-white",
                  !isOnline 
                    ? "bg-amber-500" 
                    : pendingQueueSize > 0 
                      ? "bg-blue-500 animate-pulse" 
                      : "bg-emerald-500"
                )}
              />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-red-500/10 rounded-full transition-colors text-zinc-500 hover:text-red-400"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-6">
        {/* Mode Toggle */}
        <div className="flex justify-center">
          <div className="bg-zinc-900/50 p-1 rounded-2xl border border-white/5 flex gap-1 overflow-x-auto max-w-full scrollbar-none">
            <button 
              onClick={() => setAppMode('fasting')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                appMode === 'fasting' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Fasting
            </button>
            <button 
              onClick={() => setAppMode('memorization')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                appMode === 'memorization' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Memorization
            </button>
            <button 
              onClick={() => setAppMode('iman')}
              className={cn(
                "px-4 sm:px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                appMode === 'iman' ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              Iman Calculator
            </button>
          </div>
        </div>
      </div>

      {appMode === 'memorization' ? (
        <MemorizationTracker uid={user.uid} />
      ) : appMode === 'iman' ? (
        <main className="max-w-5xl mx-auto p-6 space-y-8 animate-fadeIn">
          <ImanCalculator uid={user.uid} />
        </main>
      ) : (
        <main className="max-w-5xl mx-auto p-6 space-y-8">
          {/* Quick Glance / Widget Preview */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-500">
              <Sun className="w-5 h-5" />
              <h2 className="text-sm font-bold uppercase tracking-[0.2em]">Quick Glance</h2>
            </div>
            <h3 className="text-4xl font-bold tracking-tight text-white leading-tight">
              Your Fasting <br />
              <span className="text-emerald-500">Companion</span>
            </h3>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-sm">
              Install this app on your Home Screen to quickly check today's Hijri date and upcoming fasting opportunities.
            </p>

          </div>
          
          <div className="flex justify-center lg:justify-end">
            <Widget />
          </div>
        </section>

        {/* Moon Sighting & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {daysInMonth.find(d => d.isToday) && (
            <MoonSighting hijriDay={parseInt(daysInMonth.find(d => d.isToday)!.hijri.day)} />
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Fasts</span>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-3xl font-bold">{fastingLogs.length}</div>
              <p className="text-xs text-zinc-500">Completed this year</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Current Month</span>
                <CalendarDays className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold">
                {daysInMonth[0]?.hijri.month.en || 'Loading...'}
              </div>
              <p className="text-xs text-zinc-500">{daysInMonth[0]?.hijri.year} AH</p>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Next Recommended</span>
              <Bell className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-lg font-semibold truncate">
              {daysInMonth.find(d => d.fastingStatus === 'Recommended' && d.date > new Date())?.fastingReason || 'None soon'}
            </div>
            <p className="text-xs text-zinc-500">Stay prepared</p>
          </motion.div>
        </div>

        {/* Calendar Section */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-[2.5rem] overflow-hidden">
          <div className="p-8 flex items-center justify-between border-b border-white/5">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">{format(currentDate, 'MMMM yyyy')}</h2>
              <p className="text-sm text-zinc-500">
                {daysInMonth[0]?.hijri.month.en} {daysInMonth[0]?.hijri.year} AH
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-3 hover:bg-white/5 rounded-2xl transition-colors focus:ring-2 focus:ring-emerald-500 outline-none"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 text-sm font-medium hover:bg-white/5 rounded-xl transition-colors focus:ring-2 focus:ring-emerald-500 outline-none"
                aria-label="Go to Today"
              >
                Today
              </button>
              <button 
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-3 hover:bg-white/5 rounded-2xl transition-colors focus:ring-2 focus:ring-emerald-500 outline-none"
                aria-label="Next Month"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-white/5" role="row">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-4 text-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest" role="columnheader">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7" role="grid">
            {/* Empty cells for padding */}
            {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square border-r border-b border-white/5 opacity-20" role="gridcell" />
            ))}
            
            {daysInMonth.map((day, i) => {
              const log = getLogForDay(day.date);
              const isRecommended = day.fastingStatus === 'Recommended';
              const isMandatory = day.fastingStatus === 'Mandatory';

              return (
                <motion.button
                  key={i}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                  onClick={() => setSelectedDay(day)}
                  aria-label={`${format(day.date, 'MMMM do')} - ${day.hijri.day} ${day.hijri.month.en}. ${day.fastingStatus !== 'None' ? day.fastingStatus + ': ' + day.fastingReason : ''}`}
                  aria-current={day.isToday ? 'date' : undefined}
                  role="gridcell"
                  className={cn(
                    "relative aspect-square p-3 border-r border-b border-white/5 flex flex-col items-center justify-between transition-all focus:ring-2 focus:ring-emerald-500/50 focus:z-10 outline-none",
                    day.isToday && "bg-emerald-500/5",
                    selectedDay?.date === day.date && "ring-2 ring-emerald-500/50 z-10"
                  )}
                >
                  <div className="w-full flex justify-between items-start">
                    <span className={cn(
                      "text-sm font-medium",
                      day.isToday ? "text-emerald-400" : "text-zinc-400"
                    )}>
                      {format(day.date, 'd')}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-600">
                      {day.hijri.day}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    {isMandatory && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    )}
                    {isRecommended && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                    )}
                    {log && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>

                  {day.isToday && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-500" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Day Details Sidebar/Modal (Simplified as a section) */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-zinc-900/50 border border-white/10 p-8 rounded-[2.5rem] space-y-6"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-3xl font-bold">{format(selectedDay.date, 'EEEE, MMMM do')}</h3>
                  <p className="text-zinc-400 font-medium">
                    {selectedDay.hijri.day} {selectedDay.hijri.month.en} {selectedDay.hijri.year} AH
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedDay(null)}
                  className="p-2 hover:bg-white/5 rounded-full"
                >
                  <ChevronRight className="w-6 h-6 rotate-90" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/5 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3 text-zinc-400">
                    <Info className="w-5 h-5" />
                    <span className="text-sm font-medium uppercase tracking-wider">Fasting Info</span>
                  </div>
                  <div className="space-y-2">
                    <div className={cn(
                      "inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest",
                      selectedDay.fastingStatus === 'Mandatory' ? "bg-emerald-500/20 text-emerald-400" :
                      selectedDay.fastingStatus === 'Recommended' ? "bg-blue-500/20 text-blue-400" :
                      "bg-zinc-800 text-zinc-500"
                    )}>
                      {selectedDay.fastingStatus}
                    </div>
                    {selectedDay.fastingReason && (
                      <p className="text-lg font-medium">{selectedDay.fastingReason}</p>
                    )}
                  </div>
                </div>

                <div className="bg-white/5 p-6 rounded-3xl flex flex-col justify-between">
                  <div className="flex items-center gap-3 text-zinc-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium uppercase tracking-wider">Action</span>
                  </div>
                  <button 
                    onClick={() => handleToggleFast(selectedDay)}
                    className={cn(
                      "mt-4 w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                      getLogForDay(selectedDay.date) 
                        ? "bg-emerald-500 text-black hover:bg-emerald-400" 
                        : "bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    {getLogForDay(selectedDay.date) ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Fast Logged
                      </>
                    ) : (
                      "Mark as Fasted"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      )}

      {/* Settings Drawer */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md h-full bg-zinc-900 border-l border-white/10 p-6 overflow-y-auto flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                    <Settings className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold">Settings</h2>
                </div>
                <button 
                  onClick={() => setShowSettings(false)} 
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  aria-label="Close settings"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-8 flex-1">
                {/* User Profile Summary */}
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ''} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-zinc-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{user.displayName}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                  </div>
                </div>

                {/* Region Settings */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Info className="w-3.5 h-3.5" />
                    <label className="text-[10px] font-bold uppercase tracking-widest">Calculation Region</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['local', 'saudi', 'global'].map((r) => (
                      <button
                        key={r}
                        onClick={async () => {
                          if (!user) return;
                          const updated = { ...profile!, region: r as any };
                          await LocalFirstSyncEngine.saveRecord('users', updated);
                        }}
                        className={cn(
                          "py-2.5 rounded-xl text-xs font-bold capitalize transition-all border",
                          profile?.region === r 
                            ? "bg-emerald-500 border-emerald-500 text-black" 
                            : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">
                    Saudi follows Umm al-Qura. Global uses standard astronomical calculations.
                  </p>
                </div>

                {/* Notification Reminders */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <BellRing className="w-3.5 h-3.5" />
                    <label className="text-[10px] font-bold uppercase tracking-widest">Notification Reminders</label>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'sunnah', label: 'Sunnah Days (Mon/Thu)', icon: Sun },
                      { id: 'whiteDays', label: 'White Days (13, 14, 15)', icon: Moon },
                      { id: 'ramadan', label: 'Ramadan Mandatory', icon: Flame },
                      { id: 'muharram', label: 'Muharram (Ashura/Tasu\'a)', icon: Info },
                      { id: 'dhulHijjah', label: 'Dhul-Hijjah (First 9 Days)', icon: Eye },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={async () => {
                          if (!user || !profile) return;
                          const updatedReminders = {
                            ...profile.reminders,
                            [item.id]: !profile.reminders[item.id as keyof typeof profile.reminders]
                          };
                          const updatedProfile = { ...profile, reminders: updatedReminders };
                          await LocalFirstSyncEngine.saveRecord('users', updatedProfile);
                        }}
                        className={cn(
                          "flex items-center justify-between p-3.5 rounded-xl border transition-all",
                          profile?.reminders?.[item.id as keyof typeof profile.reminders]
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4" />
                          <span className="text-xs font-medium">{item.label}</span>
                        </div>
                        <div className={cn(
                          "w-8 h-4 rounded-full relative transition-all",
                          profile?.reminders?.[item.id as keyof typeof profile.reminders] ? "bg-emerald-500" : "bg-zinc-700"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-200",
                            profile?.reminders?.[item.id as keyof typeof profile.reminders] ? "translate-x-[1.125rem]" : "translate-x-0.5"
                          )} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 mt-auto">
                <button 
                  onClick={handleLogout}
                  className="w-full py-4 rounded-2xl bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="px-6 py-4">
        <FinancialDisclaimer />
      </div>

      <footer className="max-w-5xl mx-auto p-12 text-center space-y-4">
        <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
          Top Muslim — Fasting & Prayer Dates v1.0
        </p>
        <div className="flex justify-center gap-6 text-zinc-500">
          <Moon className="w-4 h-4" />
          <Sun className="w-4 h-4" />
          <CalendarIcon className="w-4 h-4" />
        </div>
      </footer>
    </div>
  );
}
