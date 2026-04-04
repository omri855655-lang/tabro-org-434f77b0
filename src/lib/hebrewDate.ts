// @ts-ignore - no types for hebrew-date
import hebrewDate from "hebrew-date";

const HEBREW_MONTHS: Record<string, string> = {
  Tishrei: "תשרי",
  Cheshvan: "חשוון",
  Kislev: "כסלו",
  Tevet: "טבת",
  Shvat: "שבט",
  Adar: "אדר",
  "Adar I": "אדר א׳",
  "Adar II": "אדר ב׳",
  Nisan: "ניסן",
  Iyar: "אייר",
  Sivan: "סיוון",
  Tamuz: "תמוז",
  Av: "אב",
  Elul: "אלול",
};

const GEMATRIA_ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const GEMATRIA_TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];

function numberToGematria(n: number): string {
  if (n === 15) return 'ט"ו';
  if (n === 16) return 'ט"ז';
  if (n <= 0) return String(n);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const letters = (GEMATRIA_TENS[tens] || "") + (GEMATRIA_ONES[ones] || "");
  if (letters.length === 1) return letters + "׳";
  return letters.slice(0, -1) + '"' + letters.slice(-1);
}

function yearToGematria(year: number): string {
  const mod = year % 1000;
  const hundreds = Math.floor(mod / 100);
  const tens = Math.floor((mod % 100) / 10);
  const ones = mod % 10;
  const HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
  let result = HUNDREDS[hundreds] || "";
  if (tens === 1 && ones === 5) result += "טו";
  else if (tens === 1 && ones === 6) result += "טז";
  else result += (GEMATRIA_TENS[tens] || "") + (GEMATRIA_ONES[ones] || "");
  if (result.length <= 1) return result + "׳";
  return result.slice(0, -1) + '"' + result.slice(-1);
}

export interface HebrewDateInfo {
  day: number;
  month: string;
  monthName: string;
  year: number;
  dayGematria: string;
  yearGematria: string;
  display: string; // e.g. "י"ז ניסן תשפ"ו"
  short: string;   // e.g. "י"ז ניסן"
}

export function getHebrewDate(date: Date): HebrewDateInfo {
  const hd = hebrewDate(date);
  const monthHeb = HEBREW_MONTHS[hd.month_name] || hd.month_name;
  const dayG = numberToGematria(hd.date);
  const yearG = yearToGematria(hd.year);
  return {
    day: hd.date,
    month: hd.month_name,
    monthName: monthHeb,
    year: hd.year,
    dayGematria: dayG,
    yearGematria: yearG,
    display: `${dayG} ${monthHeb} ${yearG}`,
    short: `${dayG} ${monthHeb}`,
  };
}
