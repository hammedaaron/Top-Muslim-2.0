import React from 'react';
import { motion } from 'motion/react';
import { getMoonPhase } from '../services/hijriService';
import { Moon, Info } from 'lucide-react';

interface MoonSightingProps {
  hijriDay: number;
}

export const MoonSighting: React.FC<MoonSightingProps> = ({ hijriDay }) => {
  const { phase, icon, percentage } = getMoonPhase(hijriDay);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
            <Moon className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Moon Sighting</span>
        </div>
        <div className="text-2xl">{icon}</div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold text-white">{phase}</h3>
          <span className="text-[10px] font-mono text-zinc-500">{percentage}% Illuminated</span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
          />
        </div>
      </div>

      <div className="flex items-start gap-2 pt-2">
        <Info className="w-3 h-3 text-zinc-600 mt-0.5" />
        <p className="text-[10px] text-zinc-500 leading-relaxed italic">
          Moon sighting is based on calculated Hijri day {hijriDay}. Actual local sighting may vary by 1-2 days.
        </p>
      </div>
    </motion.div>
  );
};
