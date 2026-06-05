export interface HijriDate {
  day: string;
  month: {
    number: number;
    en: string;
    ar: string;
  };
  year: string;
  designation: {
    abbreviated: string;
    expanded: string;
  };
  format: string;
}

export interface GregorianDate {
  date: string;
  format: string;
  day: string;
  month: {
    number: number;
    en: string;
  };
  year: string;
}

export interface CalendarDay {
  gregorian: GregorianDate;
  hijri: HijriDate;
}

export type FastingStatus = 'Recommended' | 'Mandatory' | 'Optional' | 'None';

export interface DayInfo {
  date: Date;
  hijri: HijriDate;
  fastingStatus: FastingStatus;
  fastingReason: string;
  isToday: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  region: 'local' | 'saudi' | 'global';
  createdAt: string;
  reminders: {
    sunnah: boolean;
    whiteDays: boolean;
    ramadan: boolean;
    muharram: boolean;
    dhulHijjah: boolean;
  };
  memoStartPage?: number;
  memoDailyType?: 'pages' | 'half' | 'lines';
  memoDailyValue?: number;
  memoStartDate?: string;
  memoSelectedSurahNum?: number;
  memoMemorizedSurahs?: number[];
}

export interface FastingLog {
  id?: string;
  uid: string;
  date: string; // YYYY-MM-DD
  status: 'completed' | 'missed' | 'planned';
  type: string;
  hijriDate: string;
}

export interface MemorizationLog {
  id?: string;
  uid: string;
  date: string; // YYYY-MM-DD
  memorized: boolean;
  revision: boolean;
  hizb: boolean;
  juz: boolean;
}

export interface ZakatCalculation {
  id?: string;
  uid: string;
  date: string; // YYYY-MM-DD
  cash: number;
  goldGrams: number;
  silverGrams: number;
  goldPrice: number;
  silverPrice: number;
  investments: number;
  liabilities: number;
  totalWealth: number;
  nisabThreshold: number;
  isDue: boolean;
  zakatOwed: number;
  currency: string;
}

export interface SavingsLog {
  id?: string;
  uid: string;
  date: string; // YYYY-MM-DD
  amount: number;
  category: 'zakat' | 'hajj';
  type: 'fixed' | 'flexible';
  notes?: string;
}
