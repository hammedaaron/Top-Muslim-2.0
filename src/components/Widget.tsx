import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Moon, Sun, Flame, Info } from 'lucide-react';
import { format } from 'date-fns';
import { findNextFastingDate, getHijriDate } from '../services/hijriService';
import { HijriDate } from '../types';

interface WidgetProps {
  className?: string;
}

export const Widget: React.FC<WidgetProps> = ({ className }) => {
  const [todayHijri, setTodayHijri] = useState<HijriDate | null>(null);
  const [nextFasting, setNextFasting] = useState<{ date: Date; hijri: HijriDate; reason: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [hijri, next] = await Promise.all([
          getHijriDate(new Date()),
          findNextFastingDate(new Date())
        ]);
        setTodayHijri(hijri);
        setNextFasting(next);
      } catch (error) {
        console.error('Error loading widget data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className={`w-full max-w-sm aspect-square bg-zinc-900/50 border border-white/5 rounded-[2.5rem] p-6 flex items-center justify-center ${className}`}>
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`w-full max-w-sm aspect-square bg-zinc-900 border border-white/5 rounded-[2.5rem] p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden group ${className}`}
    >
      {/* Background Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full group-hover:bg-emerald-500/20 transition-colors duration-500" />
      
      {/* Today Section */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Today</span>
          <Moon className="w-4 h-4 text-zinc-600" />
        </div>
        <div className="space-y-0">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {todayHijri ? `${todayHijri.day} ${todayHijri.month.en}` : format(new Date(), 'dd MMM')}
          </h2>
          <p className="text-xs text-zinc-500 font-medium">
            {format(new Date(), 'EEEE, do MMMM')}
          </p>
        </div>
      </div>

      {/* Next Fasting Section */}
      <div className="bg-white/5 rounded-3xl p-4 space-y-3 border border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <Flame className="w-3 h-3 text-emerald-400" />
          </div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Next Fasting</span>
        </div>
        
        {nextFasting ? (
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-white">
                {format(nextFasting.date, 'do MMM')}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium">
                ({nextFasting.hijri.day} {nextFasting.hijri.month.en})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Info className="w-3 h-3 text-emerald-500/50" />
              <p className="text-[11px] text-zinc-400 leading-tight line-clamp-1">
                {nextFasting.reason}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No upcoming fasts found.</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex -space-x-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-5 h-5 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-emerald-500/50" />
            </div>
          ))}
        </div>
        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Top Muslim Widget</span>
      </div>
    </motion.div>
  );
};
