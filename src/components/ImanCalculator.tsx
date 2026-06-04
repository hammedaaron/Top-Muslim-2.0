import React, { useState, useEffect } from "react";
import {
  Coins,
  TrendingUp,
  Calculator,
  Compass,
  DollarSign,
  Briefcase,
  History,
  Send,
  Sparkles,
  HelpCircle,
  Save,
  Trophy,
  Award,
  BookOpen,
  ArrowUpRight,
  TrendingDown,
  ChevronDown,
  Globe,
  RefreshCw,
  Plus,
  Trash2,
  CalendarCheck,
  Check,
  Info,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

import { db } from "../firebase";
import { ZakatCalculation, SavingsLog } from "../types";
import { localDb, LocalFirstSyncEngine, dbEventBroker } from "../services/db";
import {
  HAJJ_COUNTRY_DATA,
  QURAN_VERSES,
  HADITHS,
  ISLAMIC_FINANCE_TIPS,
  GOLD_PRICE_USD_PER_GRAM,
  SILVER_PRICE_USD_PER_GRAM,
  NISAB_GOLD_GRAMS,
  NISAB_SILVER_GRAMS,
  HajjCountryData
} from "../data/imanData";
import { ALL_COUNTRIES } from "../data/allCountries";

interface ExtendedCountry {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  rateToUsd: number;
  defaultMultiplier?: number;
  departureCities?: string[];
}

interface ImanCalculatorProps {
  uid: string;
}

export function ImanCalculator({ uid }: ImanCalculatorProps) {
  // Navigation tabs within Iman Calculator
  const [activeTab, setActiveTab] = useState<"dashboard" | "zakat" | "zakat_tracker" | "hajj" | "hajj_tracker" | "guidance">("dashboard");

  // Currency & Rate settings with ExtendedCountry mapping
  const [selectedCountry, setSelectedCountry] = useState<ExtendedCountry>({
    code: "US",
    name: "United States",
    currency: "USD",
    symbol: "$",
    rateToUsd: 1.0,
    departureCities: ["New York (JFK)", "Chicago", "Houston", "Los Angeles"]
  });
  const [preciousMetalBasis, setPreciousMetalBasis] = useState<"gold" | "silver">("silver"); // Silver is historically standard/accessible Nisab, gold for modern

  // Seach bar inputs & overlay trackers for standard country selection inputs
  const [countrySearchTerm, setCountrySearchTerm] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [hajjSearchTerm, setHajjSearchTerm] = useState("");
  const [showHajjDropdown, setShowHajjDropdown] = useState(false);

  // Flexible editable package costs states (populated with sensible templates but completely customizable by user)
  const [economyPackagePrice, setEconomyPackagePrice] = useState<number>(5500);
  const [standardPackagePrice, setStandardPackagePrice] = useState<number>(8500);
  const [premiumPackagePrice, setPremiumPackagePrice] = useState<number>(14500);

  // Daily live Nisab parameters loaded from proxy search grounding
  const [nisabSource, setNisabSource] = useState<string>("Local Standard (2026 Fallback)");
  const [nisabDateChecked, setNisabDateChecked] = useState<string>("");
  const [fetchingNisab, setFetchingNisab] = useState<boolean>(false);

  // Live precious metal price customization
  const [goldPriceGram, setGoldPriceGram] = useState<number>(GOLD_PRICE_USD_PER_GRAM);
  const [silverPriceGram, setSilverPriceGram] = useState<number>(SILVER_PRICE_USD_PER_GRAM);

  // States for calculation & tracking logs
  const [zakatHistory, setZakatHistory] = useState<ZakatCalculation[]>([]);
  const [savingsLogs, setSavingsLogs] = useState<SavingsLog[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [savingLog, setSavingLog] = useState(false);

  // Custom styled state-based notification system (instead of blocking window.alerts in iframe context)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [calculationToDelete, setCalculationToDelete] = useState<string | null>(null);
  const [savingLogToDelete, setSavingLogToDelete] = useState<string | null>(null);

  // Zakat form inputs (local currency)
  const [cashAsset, setCashAsset] = useState<number>(0);
  const [goldGramsInput, setGoldGramsInput] = useState<number>(0);
  const [silverGramsInput, setSilverGramsInput] = useState<number>(0);
  const [investmentsInput, setInvestmentsInput] = useState<number>(0);
  const [cryptoAsset, setCryptoAsset] = useState<number>(0);
  const [businessInventory, setBusinessInventory] = useState<number>(0);
  const [stocksAsset, setStocksAsset] = useState<number>(0);
  const [rentalIncomeInput, setRentalIncomeInput] = useState<number>(0);
  const [otherAssetsInput, setOtherAssetsInput] = useState<number>(0);

  // Liabilities form inputs
  const [debtsInput, setDebtsInput] = useState<number>(0);
  const [loansInput, setLoansInput] = useState<number>(0);
  const [pendingBills, setPendingBills] = useState<number>(0);
  const [businessExpenses, setBusinessExpenses] = useState<number>(0);

  // Savings inputs
  const [saveAmountInput, setSaveAmountInput] = useState<number>(0);
  const [saveCategory, setSaveCategory] = useState<"zakat" | "hajj">("zakat");
  const [saveType, setSaveType] = useState<"fixed" | "flexible">("fixed");
  const [saveNotes, setSaveNotes] = useState<string>("");

  // Hajj Form Configuration
  const [hajjCountryCode, setHajjCountryCode] = useState<string>("US");
  const [hajjPackageType, setHajjPackageType] = useState<"economy" | "standard" | "premium">("standard");
  const [sponsorSelf, setSponsorSelf] = useState<boolean>(true);
  const [sponsorSpouse, setSponsorSpouse] = useState<boolean>(false);
  const [sponsorParents, setSponsorParents] = useState<number>(0);
  const [sponsorFamilyCount, setSponsorFamilyCount] = useState<number>(0);

  // AI Assistant settings
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [userQuestion, setUserQuestion] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);

  // Spiritual quotes rotator
  const [currentVerseIndex, setCurrentVerseIndex] = useState(0);
  const [currentHadithIndex, setCurrentHadithIndex] = useState(0);

  // Quick helper conversions
  const userRate = selectedCountry.rateToUsd;
  const currencySymbol = selectedCountry.symbol;
  const currencyCode = selectedCountry.currency;

  // Local currency prices
  const goldPriceLocal = goldPriceGram * userRate;
  const silverPriceLocal = silverPriceGram * userRate;

  // Nisab threshold calculations (local currency)
  const nisabGoldLocal = NISAB_GOLD_GRAMS * goldPriceLocal;
  const nisabSilverLocal = NISAB_SILVER_GRAMS * silverPriceLocal;
  const activeNisabThreshold = preciousMetalBasis === "gold" ? nisabGoldLocal : nisabSilverLocal;

  // Fetch live daily Nisab update from server
  const fetchLiveNisabRates = async () => {
    setFetchingNisab(true);
    try {
      const res = await fetch("/api/gemini/nisab");
      const data = await res.json();
      if (data && data.success && data.goldPricePerGramUSD && data.silverPricePerGramUSD) {
        setGoldPriceGram(data.goldPricePerGramUSD);
        setSilverPriceGram(data.silverPricePerGramUSD);
        setNisabSource(data.source || "Islamic Relief (Live Grounded)");
        setNisabDateChecked(data.dateChecked || "");
      }
    } catch (e) {
      console.error("Failed to query daily Nisab tracker:", e);
    } finally {
      setFetchingNisab(false);
    }
  };

  // Run initial daily fetch on hub launch
  useEffect(() => {
    fetchLiveNisabRates();
  }, []);

  // Sync profile/country selection from WorldCountries list
  useEffect(() => {
    const foundWorld = ALL_COUNTRIES.find(c => c.code === hajjCountryCode);
    if (foundWorld) {
      const preset = HAJJ_COUNTRY_DATA.find(c => c.code === hajjCountryCode);
      setSelectedCountry({
        ...foundWorld,
        departureCities: preset?.departureCities || [`${foundWorld.name} Intl Airport`]
      });
    }
  }, [hajjCountryCode]);

  // Synchronize Hajj custom editable prices whenever selectedCountry is changed
  useEffect(() => {
    const preset = HAJJ_COUNTRY_DATA.find(c => c.code === selectedCountry.code);
    if (preset) {
      setEconomyPackagePrice(preset.packages.economy);
      setStandardPackagePrice(preset.packages.standard);
      setPremiumPackagePrice(preset.packages.premium);
    } else {
      // Estimate dynamically based on global USD baseline standard adjusted to their exchange rate
      const rate = selectedCountry.rateToUsd;
      const mult = selectedCountry.defaultMultiplier || 1.0;
      setEconomyPackagePrice(Math.round(4800 * rate * mult));
      setStandardPackagePrice(Math.round(7900 * rate * mult));
      setPremiumPackagePrice(Math.round(13500 * rate * mult));
    }
  }, [selectedCountry]);

  // Rotates spiritual guides every 45 secs
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVerseIndex(prev => (prev + 1) % QURAN_VERSES.length);
      setCurrentHadithIndex(prev => (prev + 1) % HADITHS.length);
    }, 45000);
    return () => clearInterval(interval);
  }, []);

  // Fetch / Sync Savings Logs and Zakat Calculations from Local-First DB
  useEffect(() => {
    if (!uid) return;

    const loadLocalData = async () => {
      try {
        const calcs = await localDb.zakatCalculations.where("uid").equals(uid).toArray();
        const calcsSorted = calcs.sort((a, b) => b.date.localeCompare(a.date));
        setZakatHistory(calcsSorted);

        const savings = await localDb.savingsLogs.where("uid").equals(uid).toArray();
        const savingsSorted = savings.sort((a, b) => b.date.localeCompare(a.date));
        setSavingsLogs(savingsSorted);
      } catch (err) {
        console.error("Failed to load local calculation history:", err);
      }
    };

    loadLocalData();

    // Subscribe to DB Event Broker for live local state updates
    const unsubscribeDB = dbEventBroker.subscribe(async (collectionName) => {
      if (collectionName === "zakatCalculations") {
        const calcs = await localDb.zakatCalculations.where("uid").equals(uid).toArray();
        const calcsSorted = calcs.sort((a, b) => b.date.localeCompare(a.date));
        setZakatHistory(calcsSorted);
      } else if (collectionName === "savingsLogs") {
        const savings = await localDb.savingsLogs.where("uid").equals(uid).toArray();
        const savingsSorted = savings.sort((a, b) => b.date.localeCompare(a.date));
        setSavingsLogs(savingsSorted);
      }
    });

    return () => {
      unsubscribeDB();
    };
  }, [uid]);

  // Calculations for current Zakat form assets and liabilities
  const totalAssetsValue =
    (cashAsset || 0) +
    (goldGramsInput || 0) * goldPriceLocal +
    (silverGramsInput || 0) * silverPriceLocal +
    (investmentsInput || 0) +
    (cryptoAsset || 0) +
    (businessInventory || 0) +
    (stocksAsset || 0) +
    (rentalIncomeInput || 0) +
    (otherAssetsInput || 0);

  const totalLiabilitiesValue =
    (debtsInput || 0) + (loansInput || 0) + (pendingBills || 0) + (businessExpenses || 0);

  const netZakatableWealth = Math.max(0, totalAssetsValue - totalLiabilitiesValue);
  const isZakatDue = netZakatableWealth >= activeNisabThreshold;
  const zakatOwedAmount = isZakatDue ? parseFloat((netZakatableWealth * 0.025).toFixed(2)) : 0;

  // Savings sums
  const totalZakatSavings = savingsLogs
    .filter(log => log.category === "zakat")
    .reduce((sum, current) => sum + current.amount, 0);

  const totalHajjSavings = savingsLogs
    .filter(log => log.category === "hajj")
    .reduce((sum, current) => sum + current.amount, 0);

  // Hajj Price estimate planning (derived dynamically from user-editable local research states)
  const baseHajjPackageCostLocal = 
    hajjPackageType === "economy" ? economyPackagePrice :
    hajjPackageType === "standard" ? standardPackagePrice :
    premiumPackagePrice;

  const sponsorMultiplier =
    (sponsorSelf ? 1 : 0) +
    (sponsorSpouse ? 1 : 0) +
    (sponsorParents || 0) +
    (sponsorFamilyCount || 0);

  const totalHajjCostEstimate = baseHajjPackageCostLocal * sponsorMultiplier;
  const hajjProgressPercent = totalHajjCostEstimate > 0
    ? Math.min(100, Math.round((totalHajjSavings / totalHajjCostEstimate) * 100))
    : 0;

  // Estimated completed months prediction
  const monthlyHajjBudget = savingsLogs
    .filter(log => log.category === "hajj" && log.type === "fixed")
    .map(log => log.amount)
    .reduce((a, b) => a + b, 0) || 120000; // default estimated rate/goal ifIrregular

  const remainingHajjCost = Math.max(0, totalHajjCostEstimate - totalHajjSavings);
  const monthsToHajjGoal = monthlyHajjBudget > 0 ? Math.ceil(remainingHajjCost / monthlyHajjBudget) : 0;

  // Savings Streaks
  const calculateSavingsStreak = () => {
    if (savingsLogs.length === 0) return 0;
    // Calculate simple sequential contributions based on date sorting
    return savingsLogs.length; // standard indicator representation
  };

  // Submit & Save Zakat Calculation (Local First)
  const handleSaveZakatCalculation = async () => {
    setCalculating(true);
    const dateStr = new Date().toISOString().substring(0, 10);
    const calcId = `zakat_${Math.random().toString(36).substring(2, 11)}`;
    const calcData: ZakatCalculation = {
      id: calcId,
      uid,
      date: dateStr,
      cash: cashAsset,
      goldGrams: goldGramsInput,
      silverGrams: silverGramsInput,
      goldPrice: goldPriceGram,
      silverPrice: silverPriceGram,
      investments: investmentsInput,
      liabilities: totalLiabilitiesValue,
      totalWealth: netZakatableWealth,
      nisabThreshold: activeNisabThreshold,
      isDue: isZakatDue,
      zakatOwed: zakatOwedAmount,
      currency: currencyCode
    };

    try {
      await LocalFirstSyncEngine.saveRecord('zakatCalculations', calcData);
      setToast({ message: "Zakat calculation saved locally & syncing!", type: "success" });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to save calculation.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setCalculating(false);
    }
  };

  // Delete Zakat History Record (Local First)
  const handleDeleteZakatCalc = async (id?: string, index?: number) => {
    if (!id) return;
    try {
      await LocalFirstSyncEngine.deleteRecord('zakatCalculations', id, uid);
      setToast({ message: "Calculation deleted!", type: "success" });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error(err);
      setToast({ message: "Could not delete calculation.", type: "error" });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Add Savings Log (Local First)
  const handleAddSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveAmountInput <= 0) return;
    setSavingLog(true);

    const logId = `saving_${Math.random().toString(36).substring(2, 11)}`;
    const logData: SavingsLog = {
      id: logId,
      uid,
      date: new Date().toISOString().substring(0, 10),
      amount: parseFloat(saveAmountInput.toString()),
      category: saveCategory,
      type: saveType,
      notes: saveNotes || ""
    };

    try {
      await LocalFirstSyncEngine.saveRecord('savingsLogs', logData);
      setSaveAmountInput(0);
      setSaveNotes("");
      setToast({ message: "Spiritual savings logged locally and syncing!", type: "success" });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to log savings.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSavingLog(false);
    }
  };

  // Delete Savings Log Row (Local First)
  const handleDeleteSavingsLog = async (id?: string, index?: number) => {
    if (!id) return;
    try {
      await LocalFirstSyncEngine.deleteRecord('savingsLogs', id, uid);
      setToast({ message: "Savings entry removed!", type: "success" });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error(err);
      setToast({ message: "Could not delete entry.", type: "error" });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Call backend AI Advisor Route
  const handleQueryAIAdvisor = async () => {
    setAiLoading(true);
    setAiError(null);
    setAiReport(null);

    try {
      const response = await fetch("/api/gemini/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zakatCalculated: zakatHistory.length > 0,
          zakatOwed: zakatOwedAmount,
          nisabValue: activeNisabThreshold,
          totalWealth: netZakatableWealth,
          zakatSaved: totalZakatSavings,
          hajjSaved: totalHajjSavings,
          hajjCountry: selectedCountry.name,
          hajjPackage: hajjPackageType,
          hajjTotalEstimated: totalHajjCostEstimate,
          monthlyContribution: saveCategory === 'hajj' ? saveAmountInput : monthlyHajjBudget,
          savingsCategory: saveCategory,
          userQuestion: userQuestion || "Analyze my Hajj & Zakat readiness and give spiritual savings advice."
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setAiReport(data.suggestion);
      } else {
        setAiError(data.error || "Failed to receive recommendations from model. Try restarting Server.");
        // fallback
        if (data.suggestion) {
          setAiReport(data.suggestion);
        }
      }
    } catch (err: any) {
      console.error("AI client error:", err);
      setAiError("Network failure connecting to advisor port. Please ensure secrets and dev ports are listening.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-8 bg-[#0a0a0a] text-zinc-100 p-2 sm:p-6 rounded-3xl border border-white/5 shadow-2xl relative">
      {/* Toast Alert overlay */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-[999] px-5 py-4 rounded-2xl border flex items-center gap-3 shadow-2xl backdrop-blur-md max-w-sm ${
              toast.type === "success" 
                ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300" 
                : "bg-rose-950/90 border-rose-500/30 text-rose-300"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${toast.type === "success" ? "bg-emerald-400" : "bg-rose-400"}`} />
            <span className="text-xs font-semibold leading-normal">{toast.message}</span>
            <button 
              type="button"
              onClick={() => setToast(null)}
              className="text-zinc-400 hover:text-white text-xs font-bold leading-none p-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selector Heading Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-950 p-6 rounded-3xl border border-white/5">
        <div>
          <span className="text-[10px] text-amber-500 uppercase tracking-[0.2em] font-bold flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" /> Fard & Spiritual Finance Hub
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            Iman Calculator
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-lg">
            Plan Zakat, estimate Hajj costs, save efficiently, and balance financial stewardship with devotion.
          </p>
        </div>

        {/* Global Currency & Nisab Preferences Config Card */}
        <div className="flex flex-wrap items-center gap-3 bg-zinc-900/60 p-3 rounded-2xl border border-white/5 w-full md:w-auto self-stretch md:self-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2 text-xs relative select-none">
            <Globe className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-400 uppercase tracking-widest font-bold text-[9px]">Country Context:</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowCountryDropdown(!showCountryDropdown);
                  setShowHajjDropdown(false);
                }}
                className="bg-black/50 border border-white/10 text-white rounded-lg px-2.5 py-1 text-xs hover:bg-zinc-800 flex items-center gap-1.5 focus:ring-1 focus:ring-emerald-500 transition font-bold"
              >
                {selectedCountry.name} ({selectedCountry.currency} - {selectedCountry.symbol})
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>
              
              {showCountryDropdown && (
                <div className="absolute right-0 mt-1 w-64 bg-zinc-950 border border-white/10 rounded-xl shadow-2xl z-50 p-2 space-y-2 max-h-80 flex flex-col">
                  {/* Search box inside dropdown */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search country or currency..."
                      value={countrySearchTerm}
                      onChange={(e) => setCountrySearchTerm(e.target.value)}
                      className="w-full bg-black/60 text-white text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-white/10 outline-none focus:border-emerald-500"
                    />
                  </div>
                  
                  <div className="overflow-y-auto flex-1 max-h-56 divide-y divide-white/5 pr-1 scrollbar-thin">
                    {ALL_COUNTRIES.filter(c => 
                      c.name.toLowerCase().includes(countrySearchTerm.toLowerCase()) ||
                      c.currency.toLowerCase().includes(countrySearchTerm.toLowerCase()) ||
                      c.code.toLowerCase().includes(countrySearchTerm.toLowerCase())
                    ).map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setHajjCountryCode(c.code);
                          setShowCountryDropdown(false);
                          setCountrySearchTerm("");
                        }}
                        className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-emerald-500/10 hover:text-emerald-400 transition flex items-center justify-between ${
                          hajjCountryCode === c.code ? "text-emerald-400 font-bold bg-emerald-500/5" : "text-zinc-400"
                        }`}
                      >
                        <span className="truncate max-w-[140px]">{c.name}</span>
                        <span className="text-[9px] text-zinc-500 bg-zinc-900 border border-white/5 px-1.5 py-0.5 rounded font-mono">
                          {c.currency} ({c.symbol})
                        </span>
                      </button>
                    ))}
                    {ALL_COUNTRIES.filter(c => 
                      c.name.toLowerCase().includes(countrySearchTerm.toLowerCase()) ||
                      c.currency.toLowerCase().includes(countrySearchTerm.toLowerCase())
                    ).length === 0 && (
                      <div className="text-[10px] text-zinc-500 italic p-3 text-center">No match</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2 text-xs">
            <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-400 uppercase tracking-widest font-bold text-[9px]">Nisab Basis:</span>
            <div className="flex bg-black rounded-lg p-0.5 border border-white/10 text-[10px]">
              <button
                onClick={() => setPreciousMetalBasis("silver")}
                className={`px-2.5 py-1 rounded-md font-bold uppercase transition ${preciousMetalBasis === "silver" ? "bg-emerald-500 text-black" : "text-zinc-500"}`}
              >
                Silver
              </button>
              <button
                onClick={() => setPreciousMetalBasis("gold")}
                className={`px-2.5 py-1 rounded-md font-bold uppercase transition ${preciousMetalBasis === "gold" ? "bg-amber-500 text-black" : "text-zinc-500"}`}
              >
                Gold
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Primary tab switching panel */}
      <div className="flex overflow-x-auto gap-1 pb-1 scrollbar-none border-b border-white/5">
        {[
          { id: "dashboard", label: "Dashboard", icon: Coins },
          { id: "zakat", label: "Zakat Calculator", icon: Calculator },
          { id: "zakat_tracker", label: "Zakat Savings", icon: TrendingUp },
          { id: "hajj", label: "Hajj Estimator", icon: Compass },
          { id: "hajj_tracker", label: "Hajj Goals", icon: CalendarCheck },
          { id: "guidance", label: "Spiritual Guidance", icon: BookOpen }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-[#10b981]/15 text-emerald-400 border-b-2 border-emerald-500"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.15 }}
        >
          {/* =================== TAB 1: DASHBOARD OVERVIEW =================== */}
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              {/* Dynamic status indicators */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5 space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Zakat Status</span>
                  <div className={`text-xl font-black ${isZakatDue ? "text-amber-500" : "text-emerald-500"}`}>
                    {isZakatDue ? "Zakat is Due" : "Below Nisab"}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Owed: <strong className="text-white">{currencySymbol}{zakatOwedAmount.toLocaleString()}</strong>
                  </p>
                </div>

                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5 space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Active Nisab</span>
                  <div className="text-2xl font-black text-white">
                    {currencySymbol}{Math.round(activeNisabThreshold).toLocaleString()}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Based on <strong className="text-amber-400 uppercase">{preciousMetalBasis}</strong> standard
                  </p>
                </div>

                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5 space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Logged Savings</span>
                  <div className="text-2xl font-black text-white">
                    {currencySymbol}{(totalZakatSavings + totalHajjSavings).toLocaleString()}
                  </div>
                  <p className="text-xs text-zinc-400">
                    Zakat: {currencySymbol}{totalZakatSavings.toLocaleString()} • Hajj: {currencySymbol}{totalHajjSavings.toLocaleString()}
                  </p>
                </div>

                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5 space-y-2 relative overflow-hidden">
                  <div className="absolute right-3 top-3 opacity-10">
                    <Compass className="w-16 h-16 text-emerald-400" />
                  </div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Hajj Progress</span>
                  <div className="text-2xl font-black text-emerald-400">
                    {hajjProgressPercent}%
                  </div>
                  <p className="text-xs text-zinc-400">
                    Saved: {currencySymbol}{totalHajjSavings.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Hajj Kaaba visual journey preview card */}
              <div className="bg-zinc-950 p-6 rounded-3xl border border-white/5 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                <div className="lg:col-span-2 space-y-3">
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                    Hajj Sponsoring Destination Guide
                  </span>
                  <h3 className="text-xl font-black text-white tracking-tight">
                    Sacred Journey of Imam & Haja
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-lg">
                    Estimate total packages for <strong>{sponsorMultiplier} people</strong> under the <strong>{hajjPackageType}</strong> template from {selectedCountry.name}. Your estimated cost updates dynamically based on inflation proxies.
                  </p>

                  <div className="flex gap-4 text-xs">
                    <div>
                      <span className="text-zinc-500">Departing:</span>{" "}
                      <strong className="text-zinc-300">{selectedCountry.departureCities[0] || "Global"}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500">Package target:</span>{" "}
                      <strong className="text-zinc-300">{currencySymbol}{totalHajjCostEstimate.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center space-y-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Est. Completion</span>
                  <div className="text-2xl font-bold text-amber-500">
                    {monthsToHajjGoal > 120 ? "Flexible Mode" : `${monthsToHajjGoal} Months`}
                  </div>
                  <progress
                    className="w-full h-1.5 rounded-full accent-emerald-500 bg-zinc-800"
                    max={100}
                    value={hajjProgressPercent}
                  />
                  <p className="text-[10px] text-zinc-500">Estimated duration based on historical contributions</p>
                </div>
              </div>

              {/* AI Assistant Smart recommendations block */}
              <div className="bg-[#10b981]/5 border border-emerald-500/10 p-6 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="font-black text-sm text-white uppercase tracking-wider">AI Islamic Budgeting Assistant & Insights</h4>
                      <p className="text-[10px] text-zinc-500">Secure reasoning powered by Gemini 3.5 Flash</p>
                    </div>
                  </div>
                  <button
                    onClick={handleQueryAIAdvisor}
                    disabled={aiLoading}
                    className="bg-emerald-500 text-black px-4 py-1.5 rounded-xl font-bold text-xs hover:bg-emerald-400 active:scale-95 transition disabled:opacity-50"
                  >
                    {aiLoading ? "Analyzing..." : "Refresh Insights"}
                  </button>
                </div>

                {aiError && (
                  <div className="p-3 bg-zinc-900 border border-red-500/20 text-red-400 text-xs rounded-xl font-serif">
                    {aiError}
                  </div>
                )}

                {aiReport ? (
                  <div className="max-h-72 overflow-y-auto bg-black/60 p-4 rounded-2xl border border-white/5 text-xs text-zinc-300 leading-relaxed prose prose-invert font-sans scrollbar-thin">
                    <Markdown>{aiReport}</Markdown>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 italic text-center py-6">
                    Click "Refresh Insights" to let Gemini calculate savings advice, inflation warnings, and goal milestones dynamically!
                  </div>
                )}
              </div>

              {/* Quran verse banner block */}
              <div className="bg-zinc-950 p-6 rounded-3xl border border-emerald-500/10 flex flex-col gap-3">
                <p className="text-xl md:text-2xl font-serif font-semibold text-center text-emerald-400/90 leading-normal select-none">
                  {QURAN_VERSES[currentVerseIndex].text}
                </p>
                <p className="text-xs text-zinc-300 text-justify italic mt-1 font-sans">
                  "{QURAN_VERSES[currentVerseIndex].translation}"
                </p>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">
                  — {QURAN_VERSES[currentVerseIndex].reference}
                </span>
              </div>
            </div>
          )}

          {/* =================== TAB 2: ZAKAT CALCULATOR =================== */}
          {activeTab === "zakat" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Daily Live Nisab Sourcing Dashboard Block */}
              <div className="lg:col-span-3 bg-zinc-950 p-5 rounded-3xl border border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <div>
                      <h4 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                        Live Daily Nisab Gold & Silver Tracker
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-sans">
                        Researches official Nisab values every single day via Islamic Relief Worldwide (Live Grounded Search)
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-900 border border-white/5 px-2.5 py-1 rounded-lg">
                      Source: <span className="text-amber-500 font-bold">{nisabSource}</span>
                    </span>
                    {nisabDateChecked && (
                      <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-white/5 px-2.5 py-1 rounded-lg font-mono">
                        Last Active: <span className="text-zinc-300 font-mono font-bold">{nisabDateChecked}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={fetchLiveNisabRates}
                      disabled={fetchingNisab}
                      className="bg-emerald-500 text-black px-3.5 py-1.5 rounded-xl font-black text-xs uppercase tracking-wide flex items-center gap-1.5 hover:bg-emerald-400 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${fetchingNisab ? "animate-spin" : ""}`} />
                      {fetchingNisab ? "Querying..." : "Sync Live Rates"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 text-xs text-zinc-400 leading-normal">
                    <p>
                      <strong>Gold standard</strong> calculates Zakat on a threshold of <strong>{NISAB_GOLD_GRAMS}g</strong>. Today: <strong>{currencySymbol}{Math.round(NISAB_GOLD_GRAMS * goldPriceLocal).toLocaleString()}</strong>
                    </p>
                  </div>
                  
                  <div className="bg-zinc-900/40 p-4 rounded-2xl border border-white/5 text-xs text-zinc-400 leading-normal">
                    <p>
                      <strong>Silver standard</strong> standardizes Zakat on a threshold of <strong>{NISAB_SILVER_GRAMS}g</strong>. Today: <strong>{currencySymbol}{Math.round(NISAB_SILVER_GRAMS * silverPriceLocal).toLocaleString()}</strong>
                    </p>
                  </div>
                  
                  {/* Manual Override inputs */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400">Gold per Gram (USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-zinc-500 text-xs select-none font-mono">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={goldPriceGram || ""}
                        onChange={(e) => setGoldPriceGram(parseFloat(e.target.value) || 0)}
                        className="w-full bg-black/60 text-white text-xs pl-6 pr-3 py-1.5 rounded-xl border border-white/10 focus:border-emerald-500 outline-none transition"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400">Silver per Gram (USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-zinc-500 text-xs select-none font-mono">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={silverPriceGram || ""}
                        onChange={(e) => setSilverPriceGram(parseFloat(e.target.value) || 0)}
                        className="w-full bg-black/60 text-white text-xs pl-6 pr-3 py-1.5 rounded-xl border border-white/10 focus:border-emerald-500 outline-none transition"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Left Column: Form Inputs */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-400" /> Zakatable Assets ({currencyCode})
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 flex items-center justify-between">
                        Cash on Hand & Bank balances
                        <span className="text-[9px] text-zinc-600">Liquid Savings</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs">{currencySymbol}</span>
                        <input
                          type="number"
                          value={cashAsset || ""}
                          onChange={(e) => setCashAsset(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-black/60 text-white text-sm pl-8 pr-4 py-2.5 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 flex items-center justify-between">
                        Gold holdings (Grams)
                        <span className="text-[9px] text-zinc-600">Rate: {currencySymbol}{Math.round(goldPriceLocal)}/g</span>
                      </label>
                      <input
                        type="number"
                        value={goldGramsInput || ""}
                        onChange={(e) => setGoldGramsInput(parseFloat(e.target.value) || 0)}
                        placeholder="0 grams"
                        className="w-full bg-black/60 text-white text-sm px-4 py-2.5 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 flex items-center justify-between">
                        Silver holdings (Grams)
                        <span className="text-[9px] text-zinc-600">Rate: {currencySymbol}{Math.round(silverPriceLocal)}/g</span>
                      </label>
                      <input
                        type="number"
                        value={silverGramsInput || ""}
                        onChange={(e) => setSilverGramsInput(parseFloat(e.target.value) || 0)}
                        placeholder="0 grams"
                        className="w-full bg-black/60 text-white text-sm px-4 py-2.5 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Investments / Business Inventory</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs">{currencySymbol}</span>
                        <input
                          type="number"
                          value={investmentsInput || ""}
                          onChange={(e) => setInvestmentsInput(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-black/60 text-white text-sm pl-8 pr-4 py-2.5 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Crypto currency & Stocks</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs">{currencySymbol}</span>
                        <input
                          type="number"
                          value={cryptoAsset || ""}
                          onChange={(e) => setCryptoAsset(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-black/60 text-white text-sm pl-8 pr-4 py-2.5 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Rental Income / Other Valuables</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs">{currencySymbol}</span>
                        <input
                          type="number"
                          value={otherAssetsInput || ""}
                          onChange={(e) => setOtherAssetsInput(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-black/60 text-white text-sm pl-8 pr-4 py-2.5 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                    <TrendingDown className="w-4 h-4 text-red-400" /> Subtract Liabilities ({currencyCode})
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Short-term Debts / Personal Loans</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs">{currencySymbol}</span>
                        <input
                          type="number"
                          value={debtsInput || ""}
                          onChange={(e) => setDebtsInput(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-black/60 text-white text-sm pl-8 pr-4 py-2.5 rounded-xl border border-white/15 focus:border-red-500 outline-none transition"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Pending Immediate Bills & Expenses</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs">{currencySymbol}</span>
                        <input
                          type="number"
                          value={pendingBills || ""}
                          onChange={(e) => setPendingBills(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full bg-black/60 text-white text-sm pl-8 pr-4 py-2.5 rounded-xl border border-white/15 focus:border-red-500 outline-none transition"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Outcomes & Live Summary */}
              <div className="space-y-6">
                <div className="bg-zinc-950 p-6 rounded-3xl border border-white/10 space-y-6 sticky top-24">
                  <h3 className="text-sm font-black uppercase text-zinc-400 tracking-wider border-b border-white/5 pb-3">
                    Zakat Assessment
                  </h3>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-400 font-bold">Total Assets</span>
                      <strong className="text-white text-sm">{currencySymbol}{Math.round(totalAssetsValue).toLocaleString()}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs text-red-400 font-serif">
                      <span>(-) Total Liabilities</span>
                      <span>-{currencySymbol}{Math.round(totalLiabilitiesValue).toLocaleString()}</span>
                    </div>

                    <div className="h-[1px] bg-white/10" />

                    <div className="flex justify-between items-end">
                      <span className="text-xs text-zinc-400 font-bold">Net Zakatable Wealth</span>
                      <strong className="text-white text-xl font-black">{currencySymbol}{Math.round(netZakatableWealth).toLocaleString()}</strong>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Selected Nisab ({preciousMetalBasis})</span>
                      <strong className="text-zinc-300">{currencySymbol}{Math.round(activeNisabThreshold).toLocaleString()}</strong>
                    </div>
                  </div>

                  {/* Assessment Card Status */}
                  <div className={`p-4 rounded-2xl border text-center space-y-1 ${isZakatDue ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
                    <div className="text-xs uppercase tracking-widest font-black">
                      {isZakatDue ? "Zakat is obligatory" : "Below Nisab Threshold"}
                    </div>
                    {isZakatDue ? (
                      <div>
                        <div className="text-2xl font-black">{currencySymbol}{zakatOwedAmount.toLocaleString()}</div>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          Calculated at 2.5% of net assets held consecutively for one lunar year.
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-400">
                        Zakat is not due because your net assets are currently below the required Nisab threshold.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveZakatCalculation}
                      disabled={calculating}
                      className="w-full bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white font-bold py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5 text-zinc-400" />
                      Save Log
                    </button>
                  </div>
                </div>
              </div>

              {/* Saved calculations history history segment */}
              <div className="lg:col-span-3 mt-6">
                <div className="bg-zinc-900/20 p-6 rounded-3xl border border-white/5 space-y-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-400" /> Saved Calculation History
                  </h3>

                  {zakatHistory.length === 0 ? (
                    <div className="text-xs text-zinc-500 italic py-4">No saved calculations yet. Let one above!</div>
                  ) : (
                    <div className="space-y-3">
                      {zakatHistory.map((calc, idx) => (
                        <div key={calc.id || idx} className="bg-zinc-950 p-4 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <span className="text-[9px] text-zinc-400 font-bold bg-zinc-900 px-2 py-0.5 rounded-full uppercase">
                              {calc.date}
                            </span>
                            <div className="text-xs text-zinc-500 mt-1">
                              Asset Basis: <strong className="text-zinc-300">{calc.currency} {calc.cash.toLocaleString()}</strong> • Liabilities: <strong className="text-zinc-300">{calc.currency} {calc.liabilities.toLocaleString()}</strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Net Zakatable</div>
                              <div className="text-sm font-black text-white">{calc.currency} {Math.round(calc.totalWealth).toLocaleString()}</div>
                            </div>

                            <div className="text-right">
                              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Owed Zakat</div>
                              <div className={`text-sm font-black ${calc.isDue ? "text-amber-500" : "text-emerald-400"}`}>
                                {calc.isDue ? `${calc.currency} ${calc.zakatOwed.toLocaleString()}` : "None"}
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteZakatCalc(calc.id, idx)}
                              className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =================== TAB 3: ZAKAT SAVINGS TRACKER =================== */}
          {activeTab === "zakat_tracker" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Form Input savings logs */}
              <div className="md:col-span-1 bg-zinc-950 p-6 rounded-3xl border border-white/5 h-fit">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                  <Coins className="w-4 h-4 text-emerald-400" /> Save for Zakat
                </h3>

                <form onSubmit={handleAddSavings} className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Contribution ({currencyCode})</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs">{currencySymbol}</span>
                      <input
                        type="number"
                        required
                        value={saveAmountInput || ""}
                        onChange={(e) => setSaveAmountInput(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full bg-black/60 text-white text-sm pl-8 pr-4 py-2.5 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold font-sans">Payment Frequency Style</label>
                    <div className="grid grid-cols-2 bg-black rounded-lg p-0.5 border border-white/10 text-xs">
                      <button
                        type="button"
                        onClick={() => { setSaveType("fixed"); setSaveCategory("zakat"); }}
                        className={`px-3 py-1.5 rounded-md font-bold transition ${saveType === "fixed" ? "bg-emerald-500 text-black" : "text-zinc-500"}`}
                      >
                        Fixed Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSaveType("flexible"); setSaveCategory("zakat"); }}
                        className={`px-3 py-1.5 rounded-md font-bold transition ${saveType === "flexible" ? "bg-emerald-500 text-black" : "text-zinc-500"}`}
                      >
                        Irregular Contribution
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Notes / Memoranda</label>
                    <textarea
                      value={saveNotes}
                      onChange={(e) => setSaveNotes(e.target.value)}
                      placeholder="e.g. Purifying profits from May equity"
                      rows={3}
                      className="w-full bg-black/60 text-white text-xs px-3 py-2 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingLog}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50 mt-2"
                  >
                    <Plus className="w-4 h-4" /> Save Contribution
                  </button>
                </form>
              </div>

              {/* Target progress and list logs */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-black text-sm text-white uppercase tracking-wider">Zakat Savings Status & Records</h3>
                      <p className="text-[10px] text-zinc-500 mt-1">Consistency brings blessings and purifies your balance.</p>
                    </div>

                    <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-2xl flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-emerald-400 animate-pulse" />
                      <div>
                        <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Savings Streak</div>
                        <div className="text-sm font-black text-white">{calculateSavingsStreak()} Months active</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress chart simulation */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase">
                      <span className="text-zinc-500">Goal Readiness: {currencySymbol}{totalZakatSavings.toLocaleString()} Saved</span>
                      <span className="text-amber-500">Estimated Target Owed: {currencySymbol}{zakatOwedAmount.toLocaleString()}</span>
                    </div>

                    <div className="p-3 bg-zinc-950 rounded-2xl border border-white/5">
                      <div className="h-6 bg-zinc-900 rounded-lg overflow-hidden relative">
                        <div
                          style={{
                            width: `${zakatOwedAmount > 0 ? Math.min(100, Math.round((totalZakatSavings / zakatOwedAmount) * 100)) : 100}%`
                          }}
                          className={`h-full bg-gradient-to-r from-emerald-500 to-emerald-400 flex items-center justify-end px-3 transition-all duration-500`}
                        />
                        <span className="absolute inset-y-0 left-3 flex items-center text-[10px] font-bold text-white tracking-widest uppercase">
                          {zakatOwedAmount > 0 ? `${Math.min(100, Math.round((totalZakatSavings / zakatOwedAmount) * 100))}% Complete` : "Fully Prepared / No Zakat Due"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Contributions logging history list */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest border-b border-white/5 pb-2">Contribution Logs</h4>

                    {savingsLogs.filter(log => log.category === "zakat").length === 0 ? (
                      <div className="text-xs text-zinc-500 italic py-4">No Zakat contributions logged. Log your first saving above!</div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {savingsLogs
                          .filter(log => log.category === "zakat")
                          .map((log, idx) => (
                            <div key={log.id || idx} className="bg-zinc-950 p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">{currencySymbol}{log.amount.toLocaleString()}</span>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-900 border border-white/5 text-zinc-500 tracking-wider uppercase font-bold text-[8px]">
                                    {log.type}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1">{log.notes || "Charity and purification deposit"}</p>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="text-[10px] text-zinc-500 font-bold">{log.date}</span>
                                <button
                                  onClick={() => handleDeleteSavingsLog(log.id, idx)}
                                  className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================== TAB 4: HAJJ COST ESTIMATOR =================== */}
          {activeTab === "hajj" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Country & Departure Configuration */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-zinc-950 p-6 rounded-3xl border border-white/10 space-y-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                    <Compass className="w-4 h-4 text-emerald-400" /> Plan Your Pilgrimage
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative select-none">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 flex justify-between items-center">
                        <span>Departure Country</span>
                        <span className="text-[8px] text-amber-500 font-extrabold tracking-widest uppercase">Searchable</span>
                      </label>
                      
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowHajjDropdown(!showHajjDropdown);
                            setShowCountryDropdown(false);
                          }}
                          className="w-full bg-black/50 border border-white/15 text-white rounded-xl px-4 py-2.5 outline-none text-xs focus:ring-1 focus:ring-emerald-500 text-left flex justify-between items-center hover:bg-zinc-900 transition font-bold"
                        >
                          <span className="truncate">{selectedCountry.name} ({selectedCountry.currency} - {selectedCountry.symbol})</span>
                          <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                        </button>
                        
                        {showHajjDropdown && (
                          <div className="absolute left-0 mt-1 w-full bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl z-50 p-2 space-y-2 flex flex-col max-h-80">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500" />
                              <input
                                type="text"
                                autoFocus
                                placeholder="Search country or currency..."
                                value={hajjSearchTerm}
                                onChange={(e) => setHajjSearchTerm(e.target.value)}
                                className="w-full bg-black text-white text-xs pl-8 pr-2.5 py-1.5 rounded-lg border border-white/10 outline-none focus:border-emerald-500"
                              />
                            </div>
                            
                            <div className="overflow-y-auto max-h-56 divide-y divide-white/5 pr-1 scrollbar-thin">
                              {ALL_COUNTRIES.filter(c => 
                                c.name.toLowerCase().includes(hajjSearchTerm.toLowerCase()) ||
                                c.currency.toLowerCase().includes(hajjSearchTerm.toLowerCase()) ||
                                c.code.toLowerCase().includes(hajjSearchTerm.toLowerCase())
                              ).map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => {
                                    setHajjCountryCode(c.code);
                                    setShowHajjDropdown(false);
                                    setHajjSearchTerm("");
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-500/10 hover:text-emerald-400 transition flex items-center justify-between ${
                                    hajjCountryCode === c.code ? "text-emerald-400 font-bold bg-emerald-500/51" : "text-zinc-400"
                                  }`}
                                >
                                  <span>{c.name}</span>
                                  <span className="text-[9px] text-zinc-500 bg-zinc-900 border border-white/5 px-2 py-0.5 rounded font-mono">
                                    {c.currency} ({c.symbol})
                                  </span>
                                </button>
                              ))}
                              {ALL_COUNTRIES.filter(c => 
                                c.name.toLowerCase().includes(hajjSearchTerm.toLowerCase()) ||
                                c.currency.toLowerCase().includes(hajjSearchTerm.toLowerCase())
                              ).length === 0 && (
                                <div className="text-xs text-zinc-500 italic py-4 text-center">No compatible countries found</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Package Type Choice</label>
                      <select
                        value={hajjPackageType}
                        onChange={(e: any) => setHajjPackageType(e.target.value)}
                        className="w-full bg-black/50 border border-white/15 text-white rounded-xl px-4 py-2.5 outline-none text-xs focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="economy">Economy Package (Shared Accommodation, standard transit)</option>
                        <option value="standard">Standard Package (Default Umrah & Hajj guidelines)</option>
                        <option value="premium">Premium Package (5-Star Hotels near Haram, premium dining)</option>
                      </select>
                    </div>
                  </div>

                  {/* Flexible Editable Costs Panel based on User research */}
                  <div className="p-4 bg-zinc-900/40 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
                      <h4 className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5" /> Customize Base Package Estimates (Overwritable)
                      </h4>
                      <span className="text-[8px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">
                        User Research Mode
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      Hajj costs differ greatly by agencies and departure routes. <strong>Tweak or overwrite</strong> any of the values below to match your country's current rates!
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-black text-zinc-500">Economy Package ({currencyCode})</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs font-mono">{currencySymbol}</span>
                          <input
                            type="number"
                            value={economyPackagePrice || ""}
                            onChange={(e) => setEconomyPackagePrice(parseFloat(e.target.value) || 0)}
                            className="w-full bg-black text-white text-xs pl-7 pr-3 py-2 rounded-xl border border-white/10 focus:border-emerald-500 outline-none transition font-semibold font-sans"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-black text-zinc-500">Standard Package ({currencyCode})</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs font-mono">{currencySymbol}</span>
                          <input
                            type="number"
                            value={standardPackagePrice || ""}
                            onChange={(e) => setStandardPackagePrice(parseFloat(e.target.value) || 0)}
                            className="w-full bg-black text-white text-xs pl-7 pr-3 py-2 rounded-xl border border-white/10 focus:border-emerald-500 outline-none transition font-semibold font-sans"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-wider font-black text-zinc-500">Premium Package ({currencyCode})</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs font-mono">{currencySymbol}</span>
                          <input
                            type="number"
                            value={premiumPackagePrice || ""}
                            onChange={(e) => setPremiumPackagePrice(parseFloat(e.target.value) || 0)}
                            className="w-full bg-black text-white text-xs pl-7 pr-3 py-2 rounded-xl border border-white/10 focus:border-emerald-500 outline-none transition font-semibold font-sans"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="h-[1px] bg-white/10" />

                  {/* Sponsoring Matrix (Self, Spouse, Parents, Fam) */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Sponsorship Planning Matrix</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center justify-between p-4 bg-zinc-900/40 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-900 transition">
                        <div>
                          <span className="text-xs font-bold text-white">Sponsor Myself</span>
                          <p className="text-[9px] text-zinc-500">Perform pilgrimage yourself</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={sponsorSelf}
                          onChange={(e) => setSponsorSelf(e.target.checked)}
                          className="rounded text-emerald-500 border-white/10 bg-black w-4.5 h-4.5"
                        />
                      </label>

                      <label className="flex items-center justify-between p-4 bg-zinc-900/40 rounded-2xl border border-white/5 cursor-pointer hover:bg-zinc-900 transition">
                        <div>
                          <span className="text-xs font-bold text-white">Sponsor Spouse</span>
                          <p className="text-[9px] text-zinc-500">Perform pilgrimage with spouse</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={sponsorSpouse}
                          onChange={(e) => setSponsorSpouse(e.target.checked)}
                          className="rounded text-emerald-500 border-white/10 bg-black w-4.5 h-4.5"
                        />
                      </label>

                      <div className="flex items-center justify-between p-4 bg-zinc-900/40 rounded-2xl border border-white/5">
                        <div>
                          <span className="text-xs font-bold text-white">Sponsor Parents</span>
                          <p className="text-[9px] text-zinc-500">Number of parents to support</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSponsorParents(Math.max(0, sponsorParents - 1))}
                            className="w-8 h-8 rounded-lg bg-black hover:bg-zinc-800 flex items-center justify-center font-bold text-white border border-white/10"
                          >
                            -
                          </button>
                          <span className="text-xs font-black min-w-[20px] text-center">{sponsorParents}</span>
                          <button
                            type="button"
                            onClick={() => setSponsorParents(sponsorParents + 1)}
                            className="w-8 h-8 rounded-lg bg-black hover:bg-zinc-800 flex items-center justify-center font-bold text-white border border-white/10"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-zinc-900/40 rounded-2xl border border-white/5">
                        <div>
                          <span className="text-xs font-bold text-white">Other Family members</span>
                          <p className="text-[9px] text-zinc-500">Other children, siblings, etc.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSponsorFamilyCount(Math.max(0, sponsorFamilyCount - 1))}
                            className="w-8 h-8 rounded-lg bg-black hover:bg-zinc-800 flex items-center justify-center font-bold text-white border border-white/10"
                          >
                            -
                          </button>
                          <span className="text-xs font-black min-w-[20px] text-center">{sponsorFamilyCount}</span>
                          <button
                            type="button"
                            onClick={() => setSponsorFamilyCount(sponsorFamilyCount + 1)}
                            className="w-8 h-8 rounded-lg bg-black hover:bg-zinc-800 flex items-center justify-center font-bold text-white border border-white/10"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Costs breakdown list */}
                <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-4">
                  <h4 className="text-xs uppercase tracking-widest font-black text-zinc-500">Estimated Pricing Breakdown</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Visa & Approvals Estimate</span>
                      <strong className="text-white">{currencySymbol}{Math.round(baseHajjPackageCostLocal * 0.12).toLocaleString()}</strong>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Flights & Travel Cost</span>
                      <strong className="text-white">{currencySymbol}{Math.round(baseHajjPackageCostLocal * 0.28).toLocaleString()}</strong>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Madinah & Makkah Hotels</span>
                      <strong className="text-white">{currencySymbol}{Math.round(baseHajjPackageCostLocal * 0.40).toLocaleString()}</strong>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Food & Transportation</span>
                      <strong className="text-white">{currencySymbol}{Math.round(baseHajjPackageCostLocal * 0.20).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estimate Summary card Column */}
              <div className="space-y-6">
                <div className="bg-[#10b981]/5 border border-emerald-500/10 p-6 rounded-3xl space-y-6 sticky top-24">
                  <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider">Hajj Estimate Summary</h3>

                  <div className="space-y-4 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Country Destination</span>
                      <strong className="text-zinc-300">{selectedCountry.name}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Chosen Template Package</span>
                      <strong className="text-zinc-300 capitalize">{hajjPackageType}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Standard Base Fee</span>
                      <strong className="text-zinc-300">{currencySymbol}{baseHajjPackageCostLocal.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Total Sponsoring Count</span>
                      <strong className="text-white">{sponsorMultiplier} Persons</strong>
                    </div>

                    <div className="h-[1px] bg-white/10" />

                    <div className="flex justify-between items-end">
                      <span className="text-zinc-400 font-bold">Total estimated Cost</span>
                      <strong className="text-amber-500 text-xl font-black">
                        {currencySymbol}{totalHajjCostEstimate.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* Future pricing / Inflation adjustments advice */}
                  <div className="p-4 bg-black/50 rounded-2xl border border-white/5 text-[10px] text-zinc-400 leading-relaxed space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-zinc-300 uppercase tracking-widest text-[9px]">
                      <Info className="w-3.5 h-3.5 text-emerald-500" /> Inflation Proxy Advisory
                    </div>
                    <p>
                      Pilgrimage costs are highly dynamic. We project a <strong>8-12% annual inflation adjustment</strong> based on historical flight fluctuations. To cover volatility, strive to exceed your target by 10%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================== TAB 5: HAJJ SAVINGS TRACKER =================== */}
          {activeTab === "hajj_tracker" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Form Input Hajj savings logger */}
              <div className="md:col-span-1 bg-zinc-950 p-6 rounded-3xl border border-white/5 h-fit">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                  <Compass className="w-4 h-4 text-emerald-400" /> Save for Hajj
                </h3>

                <form onSubmit={handleAddSavings} className="space-y-4 mt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Deposit Amount ({currencyCode})</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-zinc-500 text-xs">{currencySymbol}</span>
                      <input
                        type="number"
                        required
                        value={saveAmountInput || ""}
                        onChange={(e) => setSaveAmountInput(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full bg-black/60 text-white text-sm pl-8 pr-4 py-2.5 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Plan Schedule</label>
                    <div className="grid grid-cols-2 bg-black rounded-lg p-0.5 border border-white/10 text-xs">
                      <button
                        type="button"
                        onClick={() => { setSaveType("fixed"); setSaveCategory("hajj"); }}
                        className={`px-3 py-1.5 rounded-md font-bold transition ${saveType === "fixed" ? "bg-emerald-500 text-black" : "text-zinc-500"}`}
                      >
                        Fixed Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSaveType("flexible"); setSaveCategory("hajj"); }}
                        className={`px-3 py-1.5 rounded-md font-bold transition ${saveType === "flexible" ? "bg-emerald-500 text-black" : "text-zinc-500"}`}
                      >
                        Save Anytime
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Logger Note</label>
                    <textarea
                      value={saveNotes}
                      onChange={(e) => setSaveNotes(e.target.value)}
                      placeholder="e.g. Saving Hajj portion from business bonus"
                      rows={3}
                      className="w-full bg-black/60 text-white text-xs px-3 py-2 rounded-xl border border-white/15 focus:border-emerald-500 outline-none transition resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingLog}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4" /> Save Contribution
                  </button>
                </form>
              </div>

              {/* Kaaba Progress Tracking Column */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-6">
                  <h3 className="font-black text-sm text-white uppercase tracking-wider">Hajj Pilgrimage Savings Goal</h3>

                  {/* Kaaba progress UI representation */}
                  <div className="bg-black p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                    <motion.div
                      animate={{ rotateY: 360 }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 bg-zinc-950 rounded-2xl flex flex-col items-center justify-center border-4 border-amber-500/70 shadow-lg relative shrink-0"
                    >
                      <div className="absolute top-4 left-0 right-0 h-4 bg-amber-500" />
                      <div className="text-white font-black text-center text-[10px] uppercase mt-4 tracking-widest">KAABA</div>
                      <div className="text-emerald-400 font-extrabold text-[9px] uppercase tracking-wider mt-1">{hajjProgressPercent}%</div>
                    </motion.div>

                    <div className="space-y-2 w-full">
                      <span className="text-[9px] bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                        Spiritual Journey progress
                      </span>
                      <h4 className="text-base font-black text-white">Your Kaaba Goal Progress Board</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Total saved: <strong className="text-emerald-400">{currencySymbol}{totalHajjSavings.toLocaleString()}</strong> of <strong className="text-amber-500">{currencySymbol}{totalHajjCostEstimate.toLocaleString()}</strong> required for {sponsorMultiplier} people.
                      </p>

                      <progress
                        className="w-full h-2 rounded-full overflow-hidden accent-emerald-500 bg-zinc-800"
                        max={100}
                        value={hajjProgressPercent}
                      />
                    </div>
                  </div>

                  {/* Contribution logs for Hajj category */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest border-b border-white/5 pb-2">Hajj Savings history logs</h4>

                    {savingsLogs.filter(log => log.category === "hajj").length === 0 ? (
                      <div className="text-xs text-zinc-500 italic py-4">No Hajj savings logs recorded. Start budgeting today!</div>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {savingsLogs
                          .filter(log => log.category === "hajj")
                          .map((log, idx) => (
                            <div key={log.id || idx} className="bg-zinc-950 p-4 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">{currencySymbol}{log.amount.toLocaleString()}</span>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-900 border border-white/5 text-zinc-500 tracking-wider font-bold">
                                    {log.type}
                                  </span>
                                </div>
                                <p className="text-[10px] text-zinc-500 mt-1">{log.notes || "Hajj pilgrimage goal savings deposit"}</p>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="text-[10px] text-zinc-500 font-bold">{log.date}</span>
                                <button
                                  onClick={() => handleDeleteSavingsLog(log.id, idx)}
                                  className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================== TAB 6: SPIRITUAL & EDUCATIONAL LAYER =================== */}
          {activeTab === "guidance" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Quran & Hadith list context */}
              <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-6">
                <div>
                  <h3 className="font-black text-sm text-white uppercase tracking-wider">Quranic Verses on Zakat & Pilgrimage</h3>
                  <p className="text-[10px] text-zinc-500 mt-1">Foundational revelation regarding obligatory charity and sacred milestones.</p>
                </div>

                <div className="space-y-6">
                  {QURAN_VERSES.map((verse, idx) => (
                    <div key={idx} className="bg-zinc-950 p-5 rounded-2xl border border-white/5 space-y-3">
                      <p className="text-lg font-serif text-emerald-400 text-right leading-loose">
                        {verse.text}
                      </p>
                      <p className="text-xs text-zinc-300 italic font-sans">
                        "{verse.translation}"
                      </p>
                      <div className="text-[9px] text-zinc-500 font-bold uppercase text-right tracking-widest">
                        — {verse.reference}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hadiths & Islamic finance tips */}
              <div className="space-y-6">
                <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-6">
                  <div>
                    <h3 className="font-black text-sm text-white uppercase tracking-wider">Prophetic Hadiths</h3>
                    <p className="text-[10px] text-zinc-500 mt-1">Authentic traditions from the Prophet Muhammad (PBUH) describing reward and purification.</p>
                  </div>

                  <div className="space-y-4">
                    {HADITHS.map((hadith, idx) => (
                      <div key={idx} className="bg-zinc-950 p-5 rounded-2xl border border-white/5 space-y-2">
                        <p className="text-xs text-zinc-300 italic">
                          "{hadith.text}"
                        </p>
                        <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500">
                          <span className="uppercase tracking-widest text-[8px]">{hadith.source}</span>
                          <span className="text-amber-500 flex items-center gap-1"><Award className="w-3 h-3" /> Focus Insight</span>
                        </div>
                        <p className="text-[10px] text-emerald-500/90 font-sans pt-1 border-t border-white/5 mt-1 leading-relaxed">
                          {hadith.benefit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#10b981]/5 border border-emerald-500/10 p-6 rounded-3xl space-y-4">
                  <h3 className="font-black text-xs text-white uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" /> Halal Islamic Finance Tips
                  </h3>

                  <div className="space-y-3 text-xs leading-relaxed text-zinc-400">
                    {ISLAMIC_FINANCE_TIPS.map((tip, idx) => (
                      <div key={idx} className="space-y-1">
                        <strong className="text-zinc-200 block">{tip.title}</strong>
                        <p className="text-[11px] text-zinc-400">{tip.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
