export interface QuranVerse {
  text: string;
  translation: string;
  reference: string;
}

export interface Hadith {
  text: string;
  source: string;
  benefit: string;
}

export interface HajjCountryData {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  rateToUsd: number; // 1 USD = rateToUsd in local currency
  packages: {
    economy: number;
    standard: number;
    premium: number;
  };
  departureCities: string[];
}

export const QURAN_VERSES: QuranVerse[] = [
  {
    text: "وَأَقِيمُوا۟ ٱلصَّلَوٰةَ وَءَاتُوا۟ ٱلزَّكَوٰةَ وَٱرْكَعُوا۟ مَعَ ٱلرَّٰكِعِينَ",
    translation: "And establish prayer and give Zakat and bow with those who bow [in worship and obedience].",
    reference: "Al-Baqarah 2:43"
  },
  {
    text: "لَن تَنَالُوا۟ ٱلْبِرَّ حَتَّىٰ تُنفِقُوا۟ مِمَّا تُحِبُّونَ ۚ وَمَا تُنفِقُوا۟ مِن شَىْءٍۢ فَإِنَّ ٱللَّهَ بِهِۦ عَلِيمٌ",
    translation: "Never will you attain the good [reward] until you spend [in the way of Allah] from that which you love. And whatever you spend - indeed, Allah is Knowing of it.",
    reference: "Ali 'Imran 3:92"
  },
  {
    text: "مَّثَلُ ٱلَّذِينَ يُنفِقُونَ أَمْوَٰلَهُمْ فِى سَبِيلِ ٱللَّهِ كَمَثَلِ حَبَّةٍ أَنۢبَتَتْ سَبْعَ سَنَابِلَ فِى كُلِّ سُنۢبُلَةٍۢ مِّا۟ئَةُ حَبَّةٍۢ ۗ وَٱللَّهُ يُضَـٰعِفُ لِمَن يَشَآءُ ۗ وَٱللَّهُ وَٰسِعٌ عَلِيمٌ",
    translation: "The example of those who spend their wealth in the way of Allah is like a seed [of grain] which grows seven spikes; in each spike is a hundred grains. And Allah multiplies [His reward] for whom He wills. And Allah is all-Encompassing and Knowing.",
    reference: "Al-Baqarah 2:261"
  },
  {
    text: "وَأَتِمُّوا۟ ٱلْحَجَّ وَٱلْعُمْرَةَ لِلَّهِ",
    translation: "And complete the Hajj and 'Umrah for Allah.",
    reference: "Al-Baqarah 2:196"
  },
  {
    text: "فِيهِ ءَايَـٰتٌۢ بَيِّنَـٰتٌ مَّقَامُ إِبْرَٰهِيمَ ۖ وَمَن دَخَلَهُۥ كَانَ ءَامِنًۭا ۗ وَلِلَّهِ عَلَى ٱلنَّاسِ حِجُّ ٱلْبَيْتِ مَنِ ٱسْتَطَاعَ إِلَيْهِ سَبِيلًۭا",
    translation: "In it are clear signs [such as] the standing place of Abraham. And whoever enters it shall be safe. And [due] to Allah from the people is a pilgrimage to the House - for whoever is able to find thereto a way.",
    reference: "Ali 'Imran 3:97"
  }
];

export const HADITHS: Hadith[] = [
  {
    text: "Islam is built upon five pillars: testifying that there is no true god except Allah and that Muhammad is His Messenger, establishing prayer, paying Zakat, performing Hajj, and fasting during Ramadan.",
    source: "Sahih al-Bukhari",
    benefit: "Charity and Hajj are fundamental building blocks of a Muslim's faith and devotion."
  },
  {
    text: "Charity does not decrease wealth, and the servant who forgives, Allah increases his respect, and the one who humbles himself for Allah, Allah exalts his status.",
    source: "Sahih Muslim",
    benefit: "Paying zakat might feel like letting go of wealth, but in reality, Allah purifies and expands remaining assets."
  },
  {
    text: "An accepted Hajj (Hajj Mabrur) has no reward other than Paradise.",
    source: "Sahih al-Bukhari & Muslim",
    benefit: "Saving up for Hajj and completing it sincerely is one of the ultimate achievements in a believer's life."
  },
  {
    text: "Whoever performs Hajj for Allah's sake and does not have sexual relations with his wife, and does not commit sins or dispute unjustly, then he will return (pure and free from sins) as if he were born anew.",
    source: "Sahih al-Bukhari",
    benefit: "Hajj cleanses the soul completely, giving a practitioner a completely clean spiritual slate."
  }
];

export const ISLAMIC_FINANCE_TIPS = [
  {
    title: "Always Purify Your Wealth",
    content: "Zakat is not a tax; it is a purification. By paying Zakat, you are acknowledging that all wealth belongs to Allah, and you are returning the portion reserved for the needy."
  },
  {
    title: "Avoid Riba (Usury/Interest)",
    content: "Make sure your savings options are Halal. Explore Islamic banks, standard checking/non-interest accounts, or physically keeping wealth in safe assets like precious metals."
  },
  {
    title: "Be Proactive with Debts",
    content: "Before calculating your Zakatable wealth, list and subtract short-term obligations and current year debts. Try to pay off interest-bearing debts as fast as possible."
  },
  {
    title: "Consistent Small Savings",
    content: "The deeds most loved by Allah are those done regularly, even if they are small. Set a fixed weekly or monthly payment into your Hajj or Zakat savings account."
  }
];

export const HAJJ_COUNTRY_DATA: HajjCountryData[] = [
  {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    symbol: "₦",
    rateToUsd: 1450,
    packages: {
      economy: 6500000,
      standard: 8200000,
      premium: 11000000
    },
    departureCities: ["Abuja", "Lagos", "Kano", "Kaduna"]
  },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    symbol: "$",
    rateToUsd: 1,
    packages: {
      economy: 9500,
      standard: 12500,
      premium: 16500
    },
    departureCities: ["New York (JFK)", "Houston (IAH)", "Chicago (ORD)", "Los Angeles (LAX)"]
  },
  {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    symbol: "£",
    rateToUsd: 0.78,
    packages: {
      economy: 7500,
      standard: 9800,
      premium: 13500
    },
    departureCities: ["London Heathrow", "Manchester", "Birmingham"]
  },
  {
    code: "SA",
    name: "Saudi Arabia (Local)",
    currency: "SAR",
    symbol: "﷼",
    rateToUsd: 3.75,
    packages: {
      economy: 4500,
      standard: 8000,
      premium: 13000
    },
    departureCities: ["Riyadh", "Jeddah", "Dammam", "Madinah"]
  },
  {
    code: "PK",
    name: "Pakistan",
    currency: "PKR",
    symbol: "₨",
    rateToUsd: 278,
    packages: {
      economy: 1100000,
      standard: 1400000,
      premium: 1900000
    },
    departureCities: ["Islamabad", "Karachi", "Lahore", "Peshawar"]
  },
  {
    code: "MY",
    name: "Malaysia",
    currency: "MYR",
    symbol: "RM",
    rateToUsd: 4.70,
    packages: {
      economy: 12500,
      standard: 25000,
      premium: 45000
    },
    departureCities: ["Kuala Lumpur", "Penang", "Johor Bahru"]
  },
  {
    code: "IN",
    name: "India",
    currency: "INR",
    symbol: "₹",
    rateToUsd: 83.5,
    packages: {
      economy: 350000,
      standard: 480000,
      premium: 680000
    },
    departureCities: ["New Delhi", "Mumbai", "Kochi", "Hyderabad"]
  }
];

// Commodity references in USD
export const GOLD_PRICE_USD_PER_GRAM = 144.12; // default state gold price ($12,607.56 / 87.48g)
export const SILVER_PRICE_USD_PER_GRAM = 2.41; // default state silver price ($1,478.28 / 612.36g)

export const NISAB_GOLD_GRAMS = 87.48;  // 87.48 grams of gold (Islamic Relief Standard)
export const NISAB_SILVER_GRAMS = 612.36; // 612.36 grams of silver (Islamic Relief Standard)
