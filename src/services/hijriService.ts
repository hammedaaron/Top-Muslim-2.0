import axios from 'axios';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { DayInfo, HijriDate, FastingStatus } from '../types';

const ALADHAN_BASE_URL = 'https://api.aladhan.com/v1';

export const getHijriDate = async (date: Date): Promise<HijriDate> => {
  const formattedDate = format(date, 'dd-MM-yyyy');
  const cacheKey = `hijri_gToH_${formattedDate}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Error reading from Hijri cache:', e);
  }

  const response = await axios.get(`${ALADHAN_BASE_URL}/gToH/${formattedDate}`);
  const hijri = response.data.data.hijri;

  try {
    localStorage.setItem(cacheKey, JSON.stringify(hijri));
  } catch (e) {
    console.warn('Error writing to Hijri cache:', e);
  }

  return hijri;
};

export const getMonthCalendar = async (year: number, month: number): Promise<any[]> => {
  const cacheKey = `hijri_gToHCalendar_${month}_${year}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Error reading calendar from cache:', e);
  }

  const response = await axios.get(`${ALADHAN_BASE_URL}/gToHCalendar/${month}/${year}`);
  const calendar = response.data.data;

  try {
    localStorage.setItem(cacheKey, JSON.stringify(calendar));
  } catch (e) {
    console.warn('Error saving calendar to cache:', e);
  }

  return calendar;
};

export const findNextFastingDate = async (startDate: Date): Promise<{ date: Date; hijri: HijriDate; reason: string } | null> => {
  let currentYear = startDate.getFullYear();
  let currentMonth = startDate.getMonth() + 1;
  
  // Search through current and next 2 months
  for (let i = 0; i < 3; i++) {
    const calendar = await getMonthCalendar(currentYear, currentMonth);
    
    for (const day of calendar) {
      const dayDate = new Date(day.gregorian.date.split('-').reverse().join('-'));
      
      // Skip days before startDate
      if (dayDate < new Date(startDate.setHours(0, 0, 0, 0))) continue;
      
      const hijri = day.hijri;
      const { status, reason } = getFastingStatus(hijri);
      
      if (status !== 'None') {
        return { date: dayDate, hijri, reason };
      }
      
      if (isSunnahDay(dayDate)) {
        return { date: dayDate, hijri, reason: 'Sunnah (Monday/Thursday)' };
      }
    }
    
    // Move to next month
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  
  return null;
};

export const getFastingStatus = (hijri: HijriDate): { status: FastingStatus; reason: string } => {
  const day = parseInt(hijri.day);
  const month = hijri.month.number;

  // Ramadan
  if (month === 9) {
    return { status: 'Mandatory', reason: 'Ramadan' };
  }

  // Muharram
  if (month === 1) {
    if (day === 9) return { status: 'Recommended', reason: 'Tasu\'a (9th Muharram)' };
    if (day === 10) return { status: 'Recommended', reason: 'Ashura (10th Muharram)' };
    if (day === 11) return { status: 'Recommended', reason: '11th Muharram' };
  }

  // Dhul-Hijjah
  if (month === 12) {
    if (day >= 1 && day <= 9) {
      const reason = day === 9 ? 'Day of Arafah' : 'First 9 days of Dhul-Hijjah';
      return { status: 'Recommended', reason };
    }
  }

  // White Days (13, 14, 15) - except Ramadan and Tashreeq days in Dhul-Hijjah
  if (day === 13 || day === 14 || day === 15) {
    if (month !== 9 && !(month === 12 && day === 13)) {
      return { status: 'Recommended', reason: 'White Day (Ayyam al-Bid)' };
    }
  }

  return { status: 'None', reason: '' };
};

// Monday and Thursday logic
export const isSunnahDay = (date: Date): boolean => {
  const day = date.getDay();
  return day === 1 || day === 4; // 1 = Monday, 4 = Thursday
};

export const getMoonPhase = (hijriDay: number): { phase: string; icon: string; percentage: number } => {
  // Lunar cycle is roughly 29.5 days
  // 1: New Moon
  // 7-8: First Quarter
  // 14-15: Full Moon
  // 21-22: Last Quarter
  // 29-30: Waning Crescent
  
  if (hijriDay === 1) return { phase: 'New Moon (Hilal)', icon: '🌑', percentage: 0 };
  if (hijriDay < 7) return { phase: 'Waxing Crescent', icon: '🌒', percentage: hijriDay * 7 };
  if (hijriDay === 7 || hijriDay === 8) return { phase: 'First Quarter', icon: '🌓', percentage: 50 };
  if (hijriDay < 14) return { phase: 'Waxing Gibbous', icon: '🌔', percentage: 50 + (hijriDay - 8) * 7 };
  if (hijriDay === 14 || hijriDay === 15) return { phase: 'Full Moon (Badr)', icon: '🌕', percentage: 100 };
  if (hijriDay < 22) return { phase: 'Waning Gibbous', icon: '🌖', percentage: 100 - (hijriDay - 15) * 7 };
  if (hijriDay === 22 || hijriDay === 23) return { phase: 'Last Quarter', icon: '🌗', percentage: 50 };
  if (hijriDay < 29) return { phase: 'Waning Crescent', icon: '🌘', percentage: 50 - (hijriDay - 23) * 7 };
  return { phase: 'New Moon (Hilal)', icon: '🌑', percentage: 0 };
};
