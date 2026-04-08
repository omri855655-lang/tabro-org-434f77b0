// Audio presets for ZoneFlow - each uses genuinely different synthesis parameters

export interface AudioPreset {
  id: string;
  name: string;
  nameHe: string;
  desc: string;
  category: "focus" | "creative" | "calm" | "study" | "classical" | "deep-focus" | "night-work" | "deep-work" | "flow" | "morning" | "battle" | "noise" | "lofi" | "electric";
  // Core synthesis
  baseFreq: number;
  binauralOffset: number;
  waveform: OscillatorType;
  gainLevel: number;
  // Extended synthesis
  harmonics?: { freq: number; gain: number; wave: OscillatorType; detune?: number; filterFreq?: number; panL?: number; panR?: number }[];
  lfoRate?: number;
  lfoDepth?: number;
  detune?: number;
  // Noise generation
  noiseType?: "white" | "brown" | "pink";
  toneLevel?: number; // volume of tonal layer when combined with noise (0-1)
  // Filters
  filterType?: BiquadFilterType;
  filterFreq?: number;
  filterQ?: number;
  filter2Type?: BiquadFilterType;
  filter2Freq?: number;
  filter2Q?: number;
}

export const CATEGORIES = [
  { id: "focus", name: "ריכוז עמוק", icon: "🧠", color: "violet" },
  { id: "deep-focus", name: "פוקוס עמוק", icon: "🎯", color: "violet" },
  { id: "deep-work", name: "Deep Work", icon: "⚡", color: "violet" },
  { id: "creative", name: "יצירתיות", icon: "🎨", color: "cyan" },
  { id: "flow", name: "זרימה (Flow)", icon: "🌊", color: "cyan" },
  { id: "calm", name: "רוגע ומדיטציה", icon: "🧘", color: "emerald" },
  { id: "study", name: "לימודים וקריאה", icon: "📚", color: "amber" },
  { id: "morning", name: "התחלת יום", icon: "🌅", color: "amber" },
  { id: "night-work", name: "עבודה לילית", icon: "🌙", color: "cyan" },
  { id: "battle", name: "מצב קרב", icon: "🔥", color: "rose" },
  { id: "noise", name: "רעש חוסם", icon: "🔇", color: "emerald" },
  { id: "lofi", name: "Lo-Fi Focus", icon: "🎶", color: "amber" },
  { id: "electric", name: "Electric Flow", icon: "⚡", color: "rose" },
  { id: "classical", name: "מוזיקה קלאסית", icon: "🎵", color: "rose" },
] as const;

export const AUDIO_PRESETS: AudioPreset[] = [

  // ═══════════════════════════════════════════
  // FOCUS — Clean binaural beats, pure sine, minimal harmonics
  // Designed for: analytical thinking, coding, problem solving
  // ═══════════════════════════════════════════
  {
    id: "gamma-focus",
    name: "Gamma Focus",
    nameHe: "גלי גמא — ריכוז חד",
    desc: "40Hz binaural — תדר גמא לריכוז חד ופתרון בעיות מורכבות",
    category: "focus",
    baseFreq: 200,
    binauralOffset: 40,
    waveform: "sine",
    gainLevel: 0.12,
  },
  {
    id: "beta-high",
    name: "High Beta Alert",
    nameHe: "בטא גבוה — עירנות מקסימלית",
    desc: "30Hz binaural — מעורר ערנות ומהירות עיבוד, כמו קפה למוח",
    category: "focus",
    baseFreq: 250,
    binauralOffset: 30,
    waveform: "sine",
    harmonics: [{ freq: 500, gain: 0.03, wave: "sine" }],
    gainLevel: 0.10,
  },
  {
    id: "beta-active",
    name: "Logic Engine",
    nameHe: "מנוע לוגי — 20Hz",
    desc: "20Hz binaural — חשיבה אנליטית, מתמטיקה, קבלת החלטות",
    category: "focus",
    baseFreq: 180,
    binauralOffset: 20,
    waveform: "sine",
    gainLevel: 0.12,
  },

  // ═══════════════════════════════════════════
  // DEEP FOCUS — Layered tones with subtle filtering for immersion
  // Designed for: extended coding sessions, deep reading, complex analysis
  // Uses higher gamma + subtle harmonic layers for "tunnel" effect
  // ═══════════════════════════════════════════
  {
    id: "deep-focus-40",
    name: "Laser Lock",
    nameHe: "נעילת לייזר — 40Hz",
    desc: "גמא ממוקד עם שכבת רקע עמוקה — כמו מנהרה של ריכוז",
    category: "deep-focus",
    baseFreq: 190,
    binauralOffset: 40,
    waveform: "sine",
    harmonics: [
      { freq: 95, gain: 0.04, wave: "sine", panL: 0.8, panR: 0.6 },
      { freq: 380, gain: 0.02, wave: "sine", panL: 0.6, panR: 0.8 },
    ],
    filterType: "lowpass",
    filterFreq: 600,
    filterQ: 0.5,
    gainLevel: 0.11,
  },
  {
    id: "deep-focus-tunnel",
    name: "Tunnel Vision",
    nameHe: "ראיית מנהרה — 38Hz",
    desc: "שכבות תדרים שמצמצמים את שדה הקשב לנקודה אחת",
    category: "deep-focus",
    baseFreq: 150,
    binauralOffset: 38,
    waveform: "sine",
    harmonics: [
      { freq: 75, gain: 0.05, wave: "triangle", panL: 1, panR: 0.3 },
      { freq: 225, gain: 0.03, wave: "sine", panL: 0.3, panR: 1 },
    ],
    lfoRate: 0.03,
    lfoDepth: 0.12,
    gainLevel: 0.10,
  },
  {
    id: "deep-focus-hyper",
    name: "Hyperfocus Zone",
    nameHe: "אזור היפרפוקוס — 42Hz",
    desc: "גמא גבוה + דרון בס עמוק — שקיעה מוחלטת במשימה",
    category: "deep-focus",
    baseFreq: 195,
    binauralOffset: 42,
    waveform: "sine",
    harmonics: [
      { freq: 65, gain: 0.06, wave: "sine" }, // deep sub bass drone
      { freq: 130, gain: 0.03, wave: "triangle" },
    ],
    gainLevel: 0.10,
  },

  // ═══════════════════════════════════════════
  // DEEP WORK — Warm, enveloping tones that block out the world
  // Inspired by Cal Newport's principles: sustained, distraction-free
  // Uses mid-range binaural with warm filtering
  // ═══════════════════════════════════════════
  {
    id: "deep-work-cal",
    name: "Newport Protocol",
    nameHe: "פרוטוקול ניופורט — 35Hz",
    desc: "בטא-גמא חם ומעטף — לסשנים של 90 דקות ללא הסחה",
    category: "deep-work",
    baseFreq: 160,
    binauralOffset: 35,
    waveform: "sine",
    harmonics: [
      { freq: 80, gain: 0.05, wave: "sine" },
      { freq: 320, gain: 0.02, wave: "triangle", filterFreq: 400 },
    ],
    filterType: "lowpass",
    filterFreq: 500,
    filterQ: 0.7,
    lfoRate: 0.02,
    lfoDepth: 0.08,
    gainLevel: 0.10,
  },
  {
    id: "deep-work-marathon",
    name: "Deep Marathon",
    nameHe: "מרתון עמוק — 28Hz",
    desc: "בטא ממוקד ויציב — מיועד לסשנים ארוכים של 2-4 שעות",
    category: "deep-work",
    baseFreq: 140,
    binauralOffset: 28,
    waveform: "sine",
    harmonics: [
      { freq: 70, gain: 0.04, wave: "sine" },
      { freq: 210, gain: 0.03, wave: "sine" },
      { freq: 280, gain: 0.02, wave: "triangle", filterFreq: 350 },
    ],
    gainLevel: 0.10,
  },
  {
    id: "deep-work-mono",
    name: "Single Task",
    nameHe: "משימה אחת — 32Hz",
    desc: "תדר יחיד נקי — מסייע למונו-טאסקינג מוחלט",
    category: "deep-work",
    baseFreq: 215,
    binauralOffset: 32,
    waveform: "sine",
    // intentionally no harmonics — purity
    gainLevel: 0.11,
  },

  // ═══════════════════════════════════════════
  // CREATIVE — Alpha waves with rich, colorful harmonics
  // Designed for: brainstorming, writing, art, design
  // Uses alpha range (8-12Hz) with complex, shifting tones
  // ═══════════════════════════════════════════
  {
    id: "alpha-creative",
    name: "Alpha Canvas",
    nameHe: "קנבס אלפא — זרימה יצירתית",
    desc: "10Hz binaural עם שכבות צבעוניות — פותח דמיון ויצירתיות",
    category: "creative",
    baseFreq: 300,
    binauralOffset: 10,
    waveform: "sine",
    harmonics: [
      { freq: 450, gain: 0.03, wave: "triangle", panL: 0.9, panR: 0.3 },
      { freq: 600, gain: 0.02, wave: "sine", panL: 0.3, panR: 0.9 },
    ],
    lfoRate: 0.1,
    lfoDepth: 0.3,
    gainLevel: 0.11,
  },
  {
    id: "alpha-low",
    name: "Daydream",
    nameHe: "חלימה בהקיץ — 8Hz",
    desc: "אלפא נמוך — דמיון מודרך, אסוציאציות חופשיות, רעיונות חדשים",
    category: "creative",
    baseFreq: 340,
    binauralOffset: 8,
    waveform: "sine",
    harmonics: [
      { freq: 170, gain: 0.04, wave: "sine" }, // octave below — dreamy depth
      { freq: 510, gain: 0.02, wave: "triangle", detune: 5 }, // slight shimmer
    ],
    lfoRate: 0.07,
    lfoDepth: 0.4,
    gainLevel: 0.10,
  },
  {
    id: "creative-spark",
    name: "Eureka Spark",
    nameHe: "ניצוץ יוריקה — 9Hz",
    desc: "אלפא-תטא — רגע ההברקה, מחשבה מחוץ לקופסה",
    category: "creative",
    baseFreq: 285,
    binauralOffset: 9,
    waveform: "triangle",
    harmonics: [
      { freq: 427, gain: 0.04, wave: "sine", panL: 1, panR: 0.2 },
      { freq: 570, gain: 0.03, wave: "triangle", panL: 0.2, panR: 1, detune: -3 },
      { freq: 142, gain: 0.03, wave: "sine" },
    ],
    lfoRate: 0.08,
    lfoDepth: 0.35,
    gainLevel: 0.09,
  },

  // ═══════════════════════════════════════════
  // FLOW — Smooth, evolving, immersive textures
  // Based on Csikszentmihalyi's flow state principles
  // Uses alpha range with very slow modulation for "timelessness"
  // ═══════════════════════════════════════════
  {
    id: "flow-alpha",
    name: "Flow State",
    nameHe: "מצב זרימה — 11Hz",
    desc: "אלפא מדויק — כניסה למצב Flow: אתגר מותאם + ריכוז מלא",
    category: "flow",
    baseFreq: 220,
    binauralOffset: 11,
    waveform: "sine",
    harmonics: [
      { freq: 330, gain: 0.04, wave: "sine" }, // perfect fifth — consonant, flowing
      { freq: 440, gain: 0.03, wave: "sine" }, // octave
      { freq: 110, gain: 0.03, wave: "sine" }, // sub octave
    ],
    lfoRate: 0.03,
    lfoDepth: 0.2,
    gainLevel: 0.10,
  },
  {
    id: "flow-river",
    name: "River Flow",
    nameHe: "זרימת נהר — 10Hz",
    desc: "אלפא עם מודולציה גלית — כמו נהר שזורם בשקט",
    category: "flow",
    baseFreq: 174,
    binauralOffset: 10,
    waveform: "sine",
    harmonics: [
      { freq: 261, gain: 0.04, wave: "triangle", panL: 0.8, panR: 0.4, detune: 2 },
      { freq: 348, gain: 0.03, wave: "sine", panL: 0.4, panR: 0.8, detune: -2 },
      { freq: 87, gain: 0.05, wave: "sine" },
    ],
    lfoRate: 0.04,
    lfoDepth: 0.3,
    gainLevel: 0.09,
  },
  {
    id: "flow-zen",
    name: "Zen Flow",
    nameHe: "זן — שקט בתנועה",
    desc: "אלפא-תטא — זרימה רגועה, מיינדפולנס בפעולה",
    category: "flow",
    baseFreq: 165,
    binauralOffset: 9,
    waveform: "sine",
    harmonics: [
      { freq: 247, gain: 0.04, wave: "sine" }, // fifth
      { freq: 82, gain: 0.04, wave: "sine" }, // sub octave
    ],
    lfoRate: 0.025,
    lfoDepth: 0.25,
    gainLevel: 0.09,
  },

  // ═══════════════════════════════════════════
  // CALM — Very low frequencies, deep modulation
  // Designed for: meditation, anxiety relief, sleep prep
  // Uses theta/delta range with slow "breathing" modulation
  // ═══════════════════════════════════════════
  {
    id: "theta-calm",
    name: "Deep Theta",
    nameHe: "תטא עמוק — רוגע מלא",
    desc: "6Hz — מדיטציה ורגיעה עמוקה, המוח נרגע לגמרי",
    category: "calm",
    baseFreq: 150,
    binauralOffset: 6,
    waveform: "sine",
    lfoRate: 0.05,
    lfoDepth: 0.5,
    gainLevel: 0.10,
  },
  {
    id: "theta-light",
    name: "Twilight Drift",
    nameHe: "שקיעה — מעבר לשינה",
    desc: "4Hz — הרפיה, מעבר עדין בין ערות לשינה",
    category: "calm",
    baseFreq: 120,
    binauralOffset: 4,
    waveform: "sine",
    harmonics: [
      { freq: 60, gain: 0.04, wave: "sine" }, // deep sub
    ],
    lfoRate: 0.03,
    lfoDepth: 0.6,
    gainLevel: 0.08,
  },
  {
    id: "delta-rest",
    name: "Delta Rest",
    nameHe: "דלתא — מנוחה מוחלטת",
    desc: "2Hz — התאוששות ומנוחת עומק, כמו שינה עמוקה",
    category: "calm",
    baseFreq: 100,
    binauralOffset: 2,
    waveform: "sine",
    lfoRate: 0.02,
    lfoDepth: 0.7,
    gainLevel: 0.07,
  },
  {
    id: "ocean-breath",
    name: "Ocean Breath",
    nameHe: "נשימת אוקיינוס — 3Hz",
    desc: "דלתא-תטא עם נשימה איטית — כמו גלי ים על החוף",
    category: "calm",
    baseFreq: 110,
    binauralOffset: 3,
    waveform: "sine",
    harmonics: [
      { freq: 165, gain: 0.03, wave: "sine", panL: 0.9, panR: 0.4 },
      { freq: 220, gain: 0.02, wave: "sine", panL: 0.4, panR: 0.9 },
      { freq: 55, gain: 0.04, wave: "sine" },
    ],
    lfoRate: 0.04,
    lfoDepth: 0.65,
    gainLevel: 0.07,
  },

  // ═══════════════════════════════════════════
  // STUDY — Clean beta-low, optimized for information retention
  // Designed for: reading, memorization, exam prep
  // Uses lower beta (12-18Hz) for sustained attention without fatigue
  // ═══════════════════════════════════════════
  {
    id: "study-focus",
    name: "Study Mode",
    nameHe: "מצב לימודים — 14Hz",
    desc: "בטא נמוך — קריאה ממושכת, שינון, הבנת טקסטים",
    category: "study",
    baseFreq: 220,
    binauralOffset: 14,
    waveform: "sine",
    gainLevel: 0.11,
  },
  {
    id: "memory-boost",
    name: "Memory Boost",
    nameHe: "חיזוק זיכרון — 12Hz",
    desc: "אלפא-בטא — שיפור קליטת מידע, שימור וארגון בזיכרון",
    category: "study",
    baseFreq: 240,
    binauralOffset: 12,
    waveform: "sine",
    harmonics: [
      { freq: 480, gain: 0.02, wave: "sine" },
      { freq: 120, gain: 0.03, wave: "sine" },
    ],
    gainLevel: 0.10,
  },
  {
    id: "reading-flow",
    name: "Reading Flow",
    nameHe: "זרימת קריאה — 10Hz",
    desc: "אלפא — לקריאה רציפה ארוכה, הבנה שלמה",
    category: "study",
    baseFreq: 260,
    binauralOffset: 10,
    waveform: "sine",
    lfoRate: 0.06,
    lfoDepth: 0.15,
    gainLevel: 0.10,
  },
  {
    id: "exam-prep",
    name: "Exam Prep",
    nameHe: "הכנה למבחן — 18Hz",
    desc: "בטא ממוקד — חזרה אינטנסיבית, שליפת מידע מהירה",
    category: "study",
    baseFreq: 210,
    binauralOffset: 18,
    waveform: "sine",
    harmonics: [{ freq: 420, gain: 0.02, wave: "sine" }],
    gainLevel: 0.11,
  },

  // ═══════════════════════════════════════════
  // MORNING — Bright, ascending, energizing
  // Designed for: wake-up routine, morning energy boost
  // Uses major key harmonics + ascending intervals for "sunrise" feel
  // ═══════════════════════════════════════════
  {
    id: "morning-rise",
    name: "Gentle Rise",
    nameHe: "השכמה עדינה — 15Hz",
    desc: "בטא עדין עם הרמוניות מז׳ור — כמו קרני שמש ראשונות",
    category: "morning",
    baseFreq: 261.63, // C4
    binauralOffset: 15,
    waveform: "sine",
    harmonics: [
      { freq: 329.63, gain: 0.05, wave: "sine" }, // E4 — major third
      { freq: 392.00, gain: 0.04, wave: "sine" }, // G4 — perfect fifth
      { freq: 523.25, gain: 0.02, wave: "triangle" }, // C5 — octave
    ],
    lfoRate: 0.08,
    lfoDepth: 0.15,
    gainLevel: 0.09,
  },
  {
    id: "morning-energy",
    name: "Morning Power",
    nameHe: "אנרגיה בוקרית — 22Hz",
    desc: "בטא אקטיבי + הרמוניות מרוממות — הפעלת גוף ומוח",
    category: "morning",
    baseFreq: 293.66, // D4
    binauralOffset: 22,
    waveform: "triangle",
    harmonics: [
      { freq: 369.99, gain: 0.04, wave: "triangle" }, // F#4
      { freq: 440.00, gain: 0.03, wave: "sine" }, // A4
      { freq: 587.33, gain: 0.02, wave: "triangle" }, // D5
    ],
    gainLevel: 0.10,
  },
  {
    id: "morning-sunshine",
    name: "Sunrise Chords",
    nameHe: "אקורדי זריחה — 18Hz",
    desc: "אקורד מז׳ור 7 — אופטימיות, חיוביות, יום חדש",
    category: "morning",
    baseFreq: 220.00, // A3
    binauralOffset: 18,
    waveform: "sine",
    harmonics: [
      { freq: 277.18, gain: 0.05, wave: "sine" }, // C#4
      { freq: 329.63, gain: 0.04, wave: "sine" }, // E4
      { freq: 415.30, gain: 0.03, wave: "triangle" }, // G#4 — major 7th, bright
      { freq: 440.00, gain: 0.02, wave: "sine" }, // A4
    ],
    lfoRate: 0.06,
    lfoDepth: 0.12,
    gainLevel: 0.08,
  },

  // ═══════════════════════════════════════════
  // NIGHT WORK — Dark, subdued tones that don't strain tired ears
  // Designed for: late night coding, writing, studying
  // Uses lower frequencies, warm filtering, minor keys
  // ═══════════════════════════════════════════
  {
    id: "night-owl",
    name: "Night Owl",
    nameHe: "ינשוף לילה — 25Hz",
    desc: "בטא חשוך ומסונן — עבודה לילית ללא עייפות אוזניים",
    category: "night-work",
    baseFreq: 130,
    binauralOffset: 25,
    waveform: "sine",
    harmonics: [
      { freq: 65, gain: 0.05, wave: "sine" }, // deep bass
      { freq: 195, gain: 0.03, wave: "sine", filterFreq: 250 },
    ],
    filterType: "lowpass",
    filterFreq: 400,
    filterQ: 0.5,
    lfoRate: 0.03,
    lfoDepth: 0.15,
    gainLevel: 0.09,
  },
  {
    id: "night-focus",
    name: "Midnight Focus",
    nameHe: "פוקוס חצות — 30Hz",
    desc: "בטא גבוה חשוך — שומר ריכוז בשעות הקטנות של הלילה",
    category: "night-work",
    baseFreq: 110,
    binauralOffset: 30,
    waveform: "sine",
    harmonics: [
      { freq: 55, gain: 0.06, wave: "sine" }, // very deep
      { freq: 165, gain: 0.03, wave: "triangle", filterFreq: 200 },
    ],
    filterType: "lowpass",
    filterFreq: 350,
    filterQ: 0.7,
    gainLevel: 0.09,
  },
  {
    id: "night-calm-work",
    name: "Quiet Hours",
    nameHe: "שעות שקט — 20Hz",
    desc: "בטא עדין וחשוך — כמו לעבוד לאור נרות",
    category: "night-work",
    baseFreq: 100,
    binauralOffset: 20,
    waveform: "sine",
    harmonics: [
      { freq: 150, gain: 0.03, wave: "sine" }, // fifth above — warmth
      { freq: 50, gain: 0.04, wave: "sine" }, // sub
    ],
    filterType: "lowpass",
    filterFreq: 300,
    filterQ: 0.5,
    lfoRate: 0.02,
    lfoDepth: 0.2,
    gainLevel: 0.08,
  },

  // ═══════════════════════════════════════════
  // BATTLE MODE — Aggressive, driving, intense
  // Designed for: deadlines, urgent work, overcoming procrastination
  // Uses high gamma + harsh waveforms + fast modulation
  // ═══════════════════════════════════════════
  {
    id: "battle-gamma",
    name: "War Mode",
    nameHe: "מצב מלחמה — 45Hz",
    desc: "גמא אגרסיבי עם גל מרובע — כמו סירנת דדליין",
    category: "battle",
    baseFreq: 200,
    binauralOffset: 45,
    waveform: "sawtooth",
    harmonics: [
      { freq: 400, gain: 0.04, wave: "square" },
      { freq: 100, gain: 0.05, wave: "sawtooth" },
    ],
    filterType: "lowpass",
    filterFreq: 800,
    filterQ: 2,
    lfoRate: 0.3,
    lfoDepth: 0.15,
    gainLevel: 0.06,
  },
  {
    id: "battle-adrenaline",
    name: "Adrenaline Rush",
    nameHe: "אדרנלין — 50Hz",
    desc: "גמא גבוה מאוד — מצב חירום, אנרגיה מקסימלית",
    category: "battle",
    baseFreq: 180,
    binauralOffset: 50,
    waveform: "sawtooth",
    harmonics: [
      { freq: 360, gain: 0.03, wave: "sawtooth", detune: 10 },
      { freq: 540, gain: 0.02, wave: "square" },
      { freq: 90, gain: 0.04, wave: "sawtooth", detune: -5 },
    ],
    filterType: "lowpass",
    filterFreq: 1000,
    filterQ: 3,
    lfoRate: 0.5,
    lfoDepth: 0.1,
    gainLevel: 0.05,
  },
  {
    id: "battle-beast",
    name: "Beast Mode",
    nameHe: "מצב חיה — 42Hz",
    desc: "שכבות סינתטיות אגרסיביות — להתגבר על כל מכשול",
    category: "battle",
    baseFreq: 150,
    binauralOffset: 42,
    waveform: "square",
    harmonics: [
      { freq: 300, gain: 0.04, wave: "sawtooth", detune: 7 },
      { freq: 450, gain: 0.03, wave: "square", detune: -3 },
      { freq: 75, gain: 0.05, wave: "sawtooth" },
    ],
    filterType: "lowpass",
    filterFreq: 900,
    filterQ: 2.5,
    gainLevel: 0.05,
  },

  // ═══════════════════════════════════════════
  // NOISE — Real generated noise for distraction blocking
  // Uses actual noise buffers (brown/pink/white) with filtering
  // Designed for: open offices, noisy environments, cafes
  // ═══════════════════════════════════════════
  {
    id: "brown-noise-deep",
    name: "Deep Brown Noise",
    nameHe: "רעש חום עמוק",
    desc: "רעש חום עמוק — כמו רוח חזקה או מפל מים רחוק, חוסם הסחות",
    category: "noise",
    noiseType: "brown",
    baseFreq: 0,
    binauralOffset: 0,
    waveform: "sine",
    filterType: "lowpass",
    filterFreq: 500,
    filterQ: 0.5,
    gainLevel: 0.15,
  },
  {
    id: "brown-noise-warm",
    name: "Warm Brown Cocoon",
    nameHe: "קוקון חום חם",
    desc: "רעש חום מסונן — כמו שמיכה חמה לאוזניים, עוטף ומרגיע",
    category: "noise",
    noiseType: "brown",
    baseFreq: 0,
    binauralOffset: 0,
    waveform: "sine",
    filterType: "lowpass",
    filterFreq: 350,
    filterQ: 0.7,
    lfoRate: 0.02,
    lfoDepth: 0.1,
    gainLevel: 0.14,
  },
  {
    id: "pink-noise-soft",
    name: "Pink Noise Focus",
    nameHe: "רעש ורוד — מיקוד",
    desc: "רעש ורוד — מאוזן יותר מחום, מעולה לריכוז ולימודים",
    category: "noise",
    noiseType: "pink",
    baseFreq: 0,
    binauralOffset: 0,
    waveform: "sine",
    filterType: "lowpass",
    filterFreq: 4000,
    filterQ: 0.3,
    gainLevel: 0.10,
  },
  {
    id: "brown-binaural",
    name: "Brown + Binaural",
    nameHe: "חום + בינאורלי — 14Hz",
    desc: "רעש חום ומעליו שכבת בינאורלי 14Hz — חסימה + ריכוז",
    category: "noise",
    noiseType: "brown",
    baseFreq: 180,
    binauralOffset: 14,
    waveform: "sine",
    toneLevel: 0.25,
    filterType: "lowpass",
    filterFreq: 400,
    filterQ: 0.5,
    gainLevel: 0.12,
  },

  // ═══════════════════════════════════════════
  // LO-FI FOCUS — Warm, detuned, vinyl-like textures
  // Emulates: lo-fi hip hop beats to study/relax to
  // Uses triangle waves, detuning for "imperfection", warm filtering
  // ═══════════════════════════════════════════
  {
    id: "lofi-chill",
    name: "Lo-Fi Chill",
    nameHe: "לו-פיי צ׳יל",
    desc: "טונים חמים ומעט מושחתים — אווירת לו-פיי קלאסית",
    category: "lofi",
    baseFreq: 196.00, // G3 — warm key
    binauralOffset: 8,
    waveform: "triangle",
    harmonics: [
      { freq: 293.66, gain: 0.05, wave: "triangle", detune: 8 }, // D4 — slightly sharp
      { freq: 392.00, gain: 0.03, wave: "sine", detune: -5 }, // G4 — slightly flat
      { freq: 98, gain: 0.06, wave: "triangle" }, // sub bass G2
    ],
    filterType: "lowpass",
    filterFreq: 700,
    filterQ: 1.5,
    lfoRate: 0.06,
    lfoDepth: 0.25,
    gainLevel: 0.08,
  },
  {
    id: "lofi-study",
    name: "Lo-Fi Study",
    nameHe: "לו-פיי לימודים",
    desc: "רקע לו-פיי עדין ונעים — מושלם לשעות לימוד ארוכות",
    category: "lofi",
    baseFreq: 174.61, // F3
    binauralOffset: 10,
    waveform: "triangle",
    harmonics: [
      { freq: 261.63, gain: 0.04, wave: "sine", detune: 6 }, // C4
      { freq: 349.23, gain: 0.03, wave: "triangle", detune: -4 }, // F4
      { freq: 87, gain: 0.05, wave: "triangle" }, // F2 sub
    ],
    filterType: "lowpass",
    filterFreq: 600,
    filterQ: 1.2,
    lfoRate: 0.04,
    lfoDepth: 0.2,
    gainLevel: 0.08,
  },
  {
    id: "lofi-rain",
    name: "Lo-Fi Rain",
    nameHe: "לו-פיי גשם",
    desc: "רעש ורוד מסונן + טונים חמים — כמו גשם על חלון בית קפה",
    category: "lofi",
    noiseType: "pink",
    baseFreq: 185,
    binauralOffset: 7,
    waveform: "triangle",
    toneLevel: 0.4,
    filterType: "bandpass",
    filterFreq: 800,
    filterQ: 0.5,
    harmonics: [
      { freq: 277, gain: 0.03, wave: "triangle", detune: 5 },
      { freq: 370, gain: 0.02, wave: "sine", detune: -3 },
    ],
    lfoRate: 0.05,
    lfoDepth: 0.15,
    gainLevel: 0.10,
  },
  {
    id: "lofi-vinyl",
    name: "Vinyl Warmth",
    nameHe: "חום תקליט",
    desc: "צליל חם ומושחת כמו תקליט ישן — נוסטלגי ומרגיע",
    category: "lofi",
    baseFreq: 220.00, // A3
    binauralOffset: 6,
    waveform: "triangle",
    harmonics: [
      { freq: 330.00, gain: 0.04, wave: "triangle", detune: 12 }, // E4 very detuned
      { freq: 440.00, gain: 0.02, wave: "sine", detune: -8 }, // A4 detuned
      { freq: 110, gain: 0.05, wave: "triangle", detune: 3 }, // A2 sub
    ],
    filterType: "lowpass",
    filterFreq: 550,
    filterQ: 2,
    lfoRate: 0.07,
    lfoDepth: 0.3,
    gainLevel: 0.07,
  },

  // ═══════════════════════════════════════════
  // ELECTRIC FLOW — Synthetic, buzzy, energetic
  // Designed for: coding, gaming, digital art, technical work
  // Uses square/sawtooth with fast modulation and resonant filters
  // ═══════════════════════════════════════════
  {
    id: "electric-pulse",
    name: "Electric Pulse",
    nameHe: "פולס חשמלי — 36Hz",
    desc: "גמא פועם עם אנרגיה סינתטית — לקידוד ועיצוב דיגיטלי",
    category: "electric",
    baseFreq: 165,
    binauralOffset: 36,
    waveform: "square",
    harmonics: [
      { freq: 330, gain: 0.03, wave: "sawtooth", panL: 0.9, panR: 0.3 },
      { freq: 82, gain: 0.04, wave: "square", panL: 0.3, panR: 0.9 },
    ],
    filterType: "lowpass",
    filterFreq: 700,
    filterQ: 3,
    lfoRate: 0.15,
    lfoDepth: 0.2,
    gainLevel: 0.06,
  },
  {
    id: "electric-surge",
    name: "Power Surge",
    nameHe: "גל כוח — 40Hz",
    desc: "אנרגיה סינתטית גולמית — כמו חיבור למפעל חשמל",
    category: "electric",
    baseFreq: 130,
    binauralOffset: 40,
    waveform: "sawtooth",
    harmonics: [
      { freq: 260, gain: 0.03, wave: "square", detune: 15 },
      { freq: 390, gain: 0.02, wave: "sawtooth", detune: -10 },
      { freq: 65, gain: 0.04, wave: "sawtooth" },
    ],
    filterType: "lowpass",
    filterFreq: 800,
    filterQ: 4,
    lfoRate: 0.2,
    lfoDepth: 0.15,
    gainLevel: 0.05,
  },
  {
    id: "electric-neon",
    name: "Neon City",
    nameHe: "עיר ניאון — 33Hz",
    desc: "תדרים עירוניים — כמו לעבוד בלילה בטוקיו",
    category: "electric",
    baseFreq: 146.83, // D3
    binauralOffset: 33,
    waveform: "square",
    harmonics: [
      { freq: 220, gain: 0.03, wave: "sawtooth", panL: 1, panR: 0.2, detune: 8 },
      { freq: 293, gain: 0.02, wave: "square", panL: 0.2, panR: 1, detune: -6 },
      { freq: 73, gain: 0.04, wave: "square" },
    ],
    filterType: "bandpass",
    filterFreq: 500,
    filterQ: 2,
    lfoRate: 0.1,
    lfoDepth: 0.2,
    gainLevel: 0.06,
  },

  // ═══════════════════════════════════════════
  // CLASSICAL — Synthesized harmonic patterns from real compositions
  // Each uses the actual harmonic structure of the piece
  // Pure sine waves in musical intervals
  // ═══════════════════════════════════════════
  {
    id: "mozart-effect",
    name: "Mozart K.448",
    nameHe: "אפקט מוצארט — סונטה לשני פסנתרים",
    desc: "D Major — חשיבה מרחבית, אינטליגנציה, מבנה הרמוני מורכב",
    category: "classical",
    baseFreq: 293.66, // D4
    binauralOffset: 10,
    waveform: "sine",
    harmonics: [
      { freq: 369.99, gain: 0.06, wave: "sine" }, // F#4
      { freq: 440.00, gain: 0.05, wave: "sine" }, // A4
      { freq: 587.33, gain: 0.03, wave: "sine" }, // D5
    ],
    lfoRate: 0.15,
    lfoDepth: 0.2,
    gainLevel: 0.07,
  },
  {
    id: "beethoven-moonlight",
    name: "Moonlight Sonata",
    nameHe: "סונטת אור ירח — בטהובן",
    desc: "C# minor — רגיעה, מיקוד, שלווה דרמטית (Op.27 No.2)",
    category: "classical",
    baseFreq: 138.59, // C#3
    binauralOffset: 6,
    waveform: "sine",
    harmonics: [
      { freq: 164.81, gain: 0.07, wave: "sine" }, // E3 — minor third
      { freq: 207.65, gain: 0.06, wave: "sine" }, // G#3 — perfect fifth
      { freq: 277.18, gain: 0.04, wave: "sine" }, // C#4 — octave
      { freq: 329.63, gain: 0.03, wave: "sine" }, // E4
    ],
    lfoRate: 0.08,
    lfoDepth: 0.35,
    gainLevel: 0.07,
  },
  {
    id: "beethoven-pathetique",
    name: "Pathétique Adagio",
    nameHe: "פתטיק — בטהובן",
    desc: "Ab Major — נוגע ומרגיע, התנועה האיטית (Op.13)",
    category: "classical",
    baseFreq: 207.65, // Ab3
    binauralOffset: 5,
    waveform: "sine",
    harmonics: [
      { freq: 261.63, gain: 0.06, wave: "sine" }, // C4 — major third
      { freq: 311.13, gain: 0.05, wave: "sine" }, // Eb4 — perfect fifth
      { freq: 415.30, gain: 0.03, wave: "sine" }, // Ab4
    ],
    lfoRate: 0.06,
    lfoDepth: 0.4,
    gainLevel: 0.06,
  },
  {
    id: "bach-prelude",
    name: "Bach Prelude C",
    nameHe: "פרלוד בדו מז׳ור — באך",
    desc: "C Major arpeggio — מסדר מחשבות, מבנה מתמטי מושלם (BWV 846)",
    category: "classical",
    baseFreq: 261.63, // C4
    binauralOffset: 8,
    waveform: "triangle",
    harmonics: [
      { freq: 329.63, gain: 0.06, wave: "triangle" }, // E4
      { freq: 392.00, gain: 0.05, wave: "triangle" }, // G4
      { freq: 493.88, gain: 0.04, wave: "sine" }, // B4
    ],
    lfoRate: 0.12,
    lfoDepth: 0.2,
    gainLevel: 0.06,
  },
  {
    id: "bach-air",
    name: "Air on G String",
    nameHe: "אריה על מיתר סול — באך",
    desc: "G Major — שלווה טהורה, כמו מיתרים שרים (BWV 1068)",
    category: "classical",
    baseFreq: 196.00, // G3
    binauralOffset: 6,
    waveform: "sine",
    harmonics: [
      { freq: 246.94, gain: 0.06, wave: "sine" }, // B3
      { freq: 293.66, gain: 0.05, wave: "sine" }, // D4
      { freq: 392.00, gain: 0.03, wave: "sine" }, // G4
    ],
    lfoRate: 0.05,
    lfoDepth: 0.3,
    gainLevel: 0.06,
  },
  {
    id: "chopin-nocturne",
    name: "Nocturne Op.9/2",
    nameHe: "נוקטורן — שופן",
    desc: "Eb Major — שקט לילי רומנטי, מנגינה שרה (Op.9 No.2)",
    category: "classical",
    baseFreq: 311.13, // Eb4
    binauralOffset: 5,
    waveform: "sine",
    harmonics: [
      { freq: 392.00, gain: 0.06, wave: "sine" }, // G4 — major third
      { freq: 466.16, gain: 0.05, wave: "sine" }, // Bb4 — perfect fifth
      { freq: 622.25, gain: 0.03, wave: "sine" }, // Eb5
    ],
    lfoRate: 0.07,
    lfoDepth: 0.35,
    gainLevel: 0.06,
  },
  {
    id: "chopin-raindrop",
    name: "Raindrop Prelude",
    nameHe: "פרלוד טיפות גשם — שופן",
    desc: "Db Major — טפטוף מהפנט, חזרתיות מרגיעה (Op.28 No.15)",
    category: "classical",
    baseFreq: 277.18, // Db4
    binauralOffset: 4,
    waveform: "sine",
    harmonics: [
      { freq: 349.23, gain: 0.05, wave: "sine" }, // F4
      { freq: 415.30, gain: 0.04, wave: "sine" }, // Ab4
      { freq: 554.37, gain: 0.03, wave: "sine" }, // Db5
    ],
    lfoRate: 0.2, // faster — raindrop rhythm
    lfoDepth: 0.3,
    gainLevel: 0.06,
  },
  {
    id: "debussy-reverie",
    name: "Rêverie — Debussy",
    nameHe: "חלימה — דביוסי",
    desc: "F Major — אימפרסיוניזם, חלום צבעוני, אקורדים צפים",
    category: "classical",
    baseFreq: 349.23, // F4
    binauralOffset: 5,
    waveform: "sine",
    harmonics: [
      { freq: 440.00, gain: 0.05, wave: "sine" }, // A4 — major third
      { freq: 523.25, gain: 0.04, wave: "sine" }, // C5 — fifth
      { freq: 174.61, gain: 0.04, wave: "sine" }, // F3 — octave below
    ],
    lfoRate: 0.06,
    lfoDepth: 0.45,
    gainLevel: 0.06,
  },
  {
    id: "debussy-clair",
    name: "Clair de Lune — Debussy",
    nameHe: "אור ירח — דביוסי",
    desc: "Db Major — חלומי, שקט, אור ירח על מים (Suite bergamasque)",
    category: "classical",
    baseFreq: 277.18, // Db4
    binauralOffset: 4,
    waveform: "sine",
    harmonics: [
      { freq: 349.23, gain: 0.06, wave: "sine" }, // F4
      { freq: 415.30, gain: 0.05, wave: "sine" }, // Ab4
      { freq: 523.25, gain: 0.04, wave: "sine" }, // ~C5
      { freq: 138.59, gain: 0.04, wave: "sine" }, // Db3 — deep octave below
    ],
    lfoRate: 0.04,
    lfoDepth: 0.5,
    gainLevel: 0.05,
  },
  {
    id: "debussy-arabesque",
    name: "Arabesque — Debussy",
    nameHe: "ערבסקה — דביוסי",
    desc: "E Major — דפוסים זורמים, קסם ואלגנטיות (No.1)",
    category: "classical",
    baseFreq: 329.63, // E4
    binauralOffset: 6,
    waveform: "sine",
    harmonics: [
      { freq: 415.30, gain: 0.05, wave: "sine" }, // G#4
      { freq: 493.88, gain: 0.04, wave: "sine" }, // B4
      { freq: 164.81, gain: 0.04, wave: "sine" }, // E3
    ],
    lfoRate: 0.1,
    lfoDepth: 0.3,
    gainLevel: 0.06,
  },
  {
    id: "vivaldi-spring",
    name: "Spring — Vivaldi",
    nameHe: "אביב — ויוואלדי",
    desc: "E Major — אנרגיה, שמחת חיים, טבע מתעורר (RV 269)",
    category: "classical",
    baseFreq: 329.63, // E4
    binauralOffset: 10,
    waveform: "triangle",
    harmonics: [
      { freq: 415.30, gain: 0.06, wave: "triangle" }, // G#4
      { freq: 493.88, gain: 0.05, wave: "triangle" }, // B4
      { freq: 659.25, gain: 0.04, wave: "sine" }, // E5
    ],
    lfoRate: 0.18,
    lfoDepth: 0.2,
    gainLevel: 0.07,
  },
  {
    id: "vivaldi-winter",
    name: "Winter — Vivaldi",
    nameHe: "חורף — ויוואלדי",
    desc: "F minor — דרמטי, עוצמתי, קור ויופי (RV 297)",
    category: "classical",
    baseFreq: 174.61, // F3
    binauralOffset: 8,
    waveform: "triangle",
    harmonics: [
      { freq: 207.65, gain: 0.06, wave: "triangle" }, // Ab3 — minor third
      { freq: 261.63, gain: 0.05, wave: "sine" }, // C4 — fifth
      { freq: 349.23, gain: 0.03, wave: "triangle" }, // F4
    ],
    lfoRate: 0.15,
    lfoDepth: 0.25,
    gainLevel: 0.07,
  },
  {
    id: "satie-gymnopedie",
    name: "Gymnopédie No.1 — Satie",
    nameHe: "ג׳ימנופדיה — סאטי",
    desc: "D Major — מינימליסטי, שקט, מושלם ללימודים וקריאה",
    category: "classical",
    baseFreq: 293.66, // D4
    binauralOffset: 6,
    waveform: "sine",
    harmonics: [
      { freq: 369.99, gain: 0.05, wave: "sine" }, // F#4
      { freq: 440.00, gain: 0.04, wave: "sine" }, // A4
      { freq: 146.83, gain: 0.04, wave: "sine" }, // D3
    ],
    lfoRate: 0.04,
    lfoDepth: 0.35,
    gainLevel: 0.06,
  },
  {
    id: "satie-gnossienne",
    name: "Gnossienne No.1 — Satie",
    nameHe: "גנוסיאן — סאטי",
    desc: "F minor — מסתורי, מינימלי, מהפנט",
    category: "classical",
    baseFreq: 174.61, // F3
    binauralOffset: 5,
    waveform: "sine",
    harmonics: [
      { freq: 207.65, gain: 0.05, wave: "sine" }, // Ab3
      { freq: 261.63, gain: 0.04, wave: "sine" }, // C4
      { freq: 349.23, gain: 0.03, wave: "sine" }, // F4
    ],
    lfoRate: 0.05,
    lfoDepth: 0.4,
    gainLevel: 0.06,
  },
  {
    id: "tchaikovsky-swan",
    name: "Swan Lake",
    nameHe: "אגם הברבורים — צ׳ייקובסקי",
    desc: "B minor — דרמטי, עמוק, רגשי (Op.20)",
    category: "classical",
    baseFreq: 246.94, // B3
    binauralOffset: 5,
    waveform: "sine",
    harmonics: [
      { freq: 293.66, gain: 0.06, wave: "sine" }, // D4 — minor third
      { freq: 369.99, gain: 0.05, wave: "sine" }, // F#4 — fifth
      { freq: 493.88, gain: 0.03, wave: "sine" }, // B4
      { freq: 123.47, gain: 0.04, wave: "sine" }, // B2
    ],
    lfoRate: 0.06,
    lfoDepth: 0.4,
    gainLevel: 0.06,
  },
  {
    id: "grieg-morning",
    name: "Morning Mood — Grieg",
    nameHe: "מצב רוח בוקר — גריג",
    desc: "E Major — מנגינת בוקר מעוררת השראה (Peer Gynt Suite)",
    category: "classical",
    baseFreq: 329.63, // E4
    binauralOffset: 8,
    waveform: "sine",
    harmonics: [
      { freq: 415.30, gain: 0.05, wave: "sine" }, // G#4
      { freq: 493.88, gain: 0.04, wave: "sine" }, // B4
      { freq: 164.81, gain: 0.04, wave: "sine" }, // E3
    ],
    lfoRate: 0.1,
    lfoDepth: 0.2,
    gainLevel: 0.07,
  },
  {
    id: "liszt-liebestraum",
    name: "Liebestraum — Liszt",
    nameHe: "חלום אהבה — ליסט",
    desc: "Ab Major — רומנטיקה טהורה, מנגינה עדינה ורגשית (No.3)",
    category: "classical",
    baseFreq: 207.65, // Ab3
    binauralOffset: 5,
    waveform: "sine",
    harmonics: [
      { freq: 261.63, gain: 0.06, wave: "sine" }, // C4
      { freq: 311.13, gain: 0.05, wave: "sine" }, // Eb4
      { freq: 415.30, gain: 0.03, wave: "sine" }, // Ab4
    ],
    lfoRate: 0.07,
    lfoDepth: 0.35,
    gainLevel: 0.06,
  },
];

export const GUIDES = [
  {
    id: "binaural",
    title: "מה זה Binaural Beats?",
    icon: "🎧",
    content: "כשכל אוזן שומעת תדר קצת שונה, המוח יוצר ״גל פנטום״ בהפרש. למשל: 200Hz באוזן שמאל ו-210Hz בימין = גל אלפא של 10Hz. זה גורם למוח להיכנס למצב ריכוז/רגיעה בהתאם לתדר. חובה להשתמש באוזניות!",
  },
  {
    id: "waves",
    title: "סוגי גלי מוח",
    icon: "🧠",
    content: "דלתא (0.5-4Hz): שינה עמוקה | תטא (4-8Hz): מדיטציה, רגיעה | אלפא (8-13Hz): יצירתיות, זרימה | בטא (13-30Hz): ריכוז, חשיבה | גמא (30-50Hz): ריכוז על, פתרון בעיות",
  },
  {
    id: "brown-noise",
    title: "מה זה Brown Noise?",
    icon: "🔇",
    content: "רעש חום הוא רעש בתדרים נמוכים שמדמה רעש עמוק כמו סופת רוח, נהר סוער או מפל מים. הוא יעיל לחסימת הסחות דעת סביבתיות. Pink Noise יותר מאוזן — מצוין לריכוז. מחקרים מראים ששניהם משפרים שינה ומפחיתים חרדה.",
  },
  {
    id: "lofi-science",
    title: "למה Lo-Fi עובד?",
    icon: "🎶",
    content: "מחקרים הראו שמוזיקה עם ביטים חזרתיים ופשוטים (60-90 BPM) ללא מילים משפרת ריכוז. Lo-Fi Hip Hop מצוין כי: 1) טמפו קבוע 2) בלי מילים שמסיחות 3) חוסר שלמות (חרקרות, הד) מרגיע את המוח 4) חזרתיות יוצרת תחושת ביטחון.",
  },
  {
    id: "mozart",
    title: "אפקט מוצארט",
    icon: "🎹",
    content: "מחקר מ-1993 מצא שהאזנה לסונטה K.448 של מוצארט משפרת חשיבה מרחבית-זמנית. מחקרים נוספים הראו שמוזיקה קלאסית עם מבנה הרמוני מורכב יכולה לשפר ריכוז, זיכרון ולמידה.",
  },
  {
    id: "debussy",
    title: "דביוסי ואימפרסיוניזם",
    icon: "🌸",
    content: "קלוד דביוסי פיתח סגנון אימפרסיוניסטי המשתמש בסולמות שלמים ואקורדים ״צפים״. Clair de Lune, Rêverie ו-Arabesque מפעילים אזורים מוחיים הקשורים לדמיון ויצירתיות — מצוינים לעבודה יצירתית.",
  },
  {
    id: "classical-study",
    title: "מוזיקה קלאסית ולימודים",
    icon: "📖",
    content: "מחקרים מצאו שמוזיקה קלאסית ללא מילים משפרת ריכוז בזמן לימודים ב-12% בממוצע. המפתח: טמפו איטי (60-80 BPM), בלי מילים, עוצמה נמוכה.",
  },
  {
    id: "pomodoro",
    title: "שיטת פומודורו",
    icon: "🍅",
    content: "עבוד 25 דקות → הפסקה 5 דקות → חזור. אחרי 4 סשנים קח הפסקה ארוכה (15-30 דק׳). השיטה מונעת שחיקה ושומרת על ריכוז גבוה לאורך היום.",
  },
  {
    id: "deep-work",
    title: "עבודה עמוקה vs רדודה",
    icon: "⚡",
    content: "עבודה עמוקה = פעילות שדורשת ריכוז מלא (כתיבה, תכנות, לימוד). עבודה רדודה = מיילים, הודעות, פגישות. הפרד ביניהן! עשה את העמוקה כשהאנרגיה הכי גבוהה.",
  },
  {
    id: "headphones",
    title: "למה חייבים אוזניות?",
    icon: "🎧",
    content: "Binaural beats עובדים רק עם אוזניות! כל אוזן צריכה לשמוע תדר שונה. עם רמקולים הצלילים מתערבבים ואין אפקט. השתמש באוזניות סגורות לתוצאה הכי טובה.",
  },
  {
    id: "flow-state",
    title: "איך נכנסים למצב Flow?",
    icon: "🌊",
    content: "מצב Flow קורה כשהמשימה מאתגרת בדיוק נכון. 4 תנאים: 1) יעד ברור 2) פידבק מיידי 3) אתגר מותאם 4) ריכוז ללא הפרעות. Deeply עוזר לך ליצור את התנאי הרביעי.",
  },
  {
    id: "deep-work-rules",
    title: "4 חוקי העבודה העמוקה",
    icon: "📏",
    content: "קל ניופורט: 1) תקבע זמנים לעבודה עמוקה 2) תתרגל שעמום — אמן את המוח לריכוז 3) תהיה סלקטיבי עם רשתות חברתיות 4) תנקז את העבודה הרדודה.",
  },
  {
    id: "second-brain",
    title: "מוח חיצוני (Second Brain)",
    icon: "🗄️",
    content: "שיטת PARA של טיאגו פורטה: Projects, Areas, Resources, Archives. המוח נועד ליצירת רעיונות, לא לאחסון.",
  },
  {
    id: "single-tasking",
    title: "נעילת מוח על משימה",
    icon: "🔒",
    content: "Single-tasking: בחר משימה אחת, סגור הכל, הגדר טיימר, רשום הסחות בצד. מחקרים מראים שמעבר בין משימות גורם לאובדן של 23 דקות ריכוז בכל מעבר!",
  },
  {
    id: "time-blocking",
    title: "תבניות גושי זמן",
    icon: "📦",
    content: "Time Blocking: בוקר = עבודה עמוקה, אחה\"צ = פגישות, גוש 90 דק׳ אופטימלי, הפסקה 15-20 דק׳ בין גושים. קל ניופורט: 'כל דקה ביום צריכה להיות מתוכננת בכוונה.'",
  },
  {
    id: "three-task-rule",
    title: "כלל 3 המשימות",
    icon: "3️⃣",
    content: "בכל יום בחר רק 3 משימות חשובות. זה מונע שיתוק בחירה, יוצר תחושת הישג ומכריח תעדוף אמיתי.",
  },
];

export const MOTIVATION_TIPS = [
  {
    id: "atomic-habits",
    title: "הרגלים אטומיים",
    icon: "⚛️",
    content: "ג'יימס קליר: 'אל תתמקד במטרה, תתמקד במערכת.' שינוי של 1% ביום = שיפור של 37 פעמים בשנה. 4 חוקי ההרגל: 1) הפוך אותו לברור 2) הפוך אותו למושך 3) הפוך אותו לקל 4) הפוך אותו למספק.",
  },
  {
    id: "deep-work",
    title: "עבודה עמוקה",
    icon: "🧠",
    content: "קל ניופורט: '4 שעות עבודה עמוקה ממוקדת שוות יותר מ-8 שעות רדודות.' כללי ברזל: זמן קבוע, מקום קבוע, אפס הסחות.",
  },
  {
    id: "eat-frog",
    title: "אכול את הצפרדע",
    icon: "🐸",
    content: "בריאן טרייסי: 'אם הדבר הראשון שאתה עושה בבוקר זה לאכול צפרדע חיה, השאר של היום יהיה קל.' התחל מהמשימה הכי קשה.",
  },
  {
    id: "tiny-habits",
    title: "צעדים זעירים",
    icon: "👣",
    content: "BJ Fogg: 'אחרי ש[הרגל קיים], אני [צעד זעיר]. תחגוג מיד.' מוטיבציה לא גורמת לפעולה — פעולה גורמת למוטיבציה.",
  },
  {
    id: "war-of-art",
    title: "לנצח את ההתנגדות",
    icon: "⚔️",
    content: "פרספילד: 'ההתנגדות היא הכוח שמונע ממך ליצור. היא הכי חזקה ברגע שאתה הכי קרוב לפריצת דרך.'",
  },
  {
    id: "flow-state",
    title: "מצב זרימה (Flow)",
    icon: "🌊",
    content: "צ'יקסנטמיהאי: 'Flow = אתגר מותאם + יעד ברור + פידבק מיידי. זה מצב האושר האמיתי.'",
  },
  {
    id: "stoic-wisdom",
    title: "חוכמה סטואית",
    icon: "🏛️",
    content: "מרקוס אורליוס: 'שלוט במה שבידיך, קבל את מה שלא.' סנקה: 'אנחנו סובלים יותר בדמיון מאשר במציאות.'",
  },
  {
    id: "meaning-purpose",
    title: "משמעות ומטרה",
    icon: "🎯",
    content: "ויקטור פרנקל: 'מי שיש לו למה לחיות, יכול לשאת כמעט כל איך.' Drive (פינק): 'מוטיבציה = אוטונומיה + שליטה + משמעות.'",
  },
  {
    id: "self-compassion",
    title: "קבלה עצמית",
    icon: "💚",
    content: "ברנה בראון: 'פגיעות = אומץ. להראות שאתה לא מושלם זה הדבר החזק ביותר.'",
  },
  {
    id: "mindset-grit",
    title: "מיינדסט והתמדה",
    icon: "💎",
    content: "קרול דווק: 'מיינדסט מתפתח: אני עדיין לא יודע — במקום אני לא מסוגל.' Grit: 'התמדה + תשוקה > כישרון.'",
  },
  {
    id: "willpower-energy",
    title: "כוח רצון ואנרגיה",
    icon: "⚡",
    content: "כוח רצון הוא שריר — הוא מתעייף אבל אפשר לאמן אותו. שינה, תזונה ומדיטציה מחזקים אותו.",
  },
  {
    id: "antifragile",
    title: "להתחזק מלחץ",
    icon: "🔥",
    content: "טאלב: 'תבנה את עצמך כך שלחץ מחזק אותך במקום לשבור.' סטרס לא הורס אותך — האמונה שסטרס הורס אותך היא מה שמזיק.",
  },
  {
    id: "ownership",
    title: "אחריות מלאה",
    icon: "🎖️",
    content: "Extreme Ownership (ג'וקו): 'קח אחריות מלאה. אין תירוצים. המצב שלך = ההחלטות שלך.'",
  },
  {
    id: "two-minute",
    title: "כלל שתי הדקות",
    icon: "⏱️",
    content: "GTD (דייוויד אלן): 'אם משימה לוקחת פחות משתי דקות — עשה אותה עכשיו. זה מנקה את הראש ויוצר מומנטום.'",
  },
  {
    id: "work-motivation",
    title: "מוטיבציה לעבודה",
    icon: "💼",
    content: "מחקר של MIT מראה שמוטיבציה = אוטונומיה + שליטה + משמעות. גם אם אתה שונא את העבודה, מצא פיסת משמעות אחת קטנה. שאל: 'מה הדבר הכי קטן שאני יכול לעשות עכשיו שייתן לי תחושת שליטה?' מחקרים מראים שתחושת שליטה מפחיתה שחיקה ב-40%.",
  },
  {
    id: "hate-job-tips",
    title: "איך לעבוד כשאתה שונא",
    icon: "😤",
    content: "1) הפרד בין הרגש למעשה — 'אני לא אוהב את זה' ≠ 'אני לא יכול לעשות את זה'. 2) מצא מקצה כוח אחד — עמית טוב, משימה מעניינת, או הפסקת צהריים. 3) הפוך את זה למשחק — כמה מהר תסיים? 4) זכור למה — המשכורת, הניסיון, הצעד הבא. מחקר Stanford: רק שינוי הפרספקטיבה מ'חייב' ל'בוחר' משפר ביצועים ב-23%.",
  },
  {
    id: "difficult-people",
    title: "עבודה עם אנשים קשים",
    icon: "🤝",
    content: "מחקר הרווארד: 70% מהעזיבות קשורות למערכות יחסים בעבודה. טיפים: 1) אל תיקח באופן אישי — ההתנהגות שלהם משקפת אותם, לא אותך. 2) גבולות ברורים — 'אני שמח לעזור כשנדבר בטון מכבד.' 3) תתעד — מיילים > שיחות. 4) חפש בעל ברית — מנטור או עמית שתומך.",
  },
  {
    id: "boring-tasks",
    title: "איך להתמודד עם משימות משעממות",
    icon: "🥱",
    content: "מחקר: משימות שגרתיות מהוות 60% מיום העבודה. טכניקות: 1) Batch Processing — קבץ משימות דומות. 2) הוסף אתגר — 'אני אסיים ב-15 דקות'. 3) תגמול מיידי — אחרי כל משימה, דקה של משהו שאתה אוהב. 4) 'Body Doubling' — עבוד ליד מישהו, גם וירטואלית.",
  },
];

export const MORNING_HABITS_GUIDE = {
  id: "morning-habits",
  title: "7 הרגלים ידידותיים למוח לבוקר",
  icon: "🌅",
  steps: [
    {
      title: "השקיית המוח (מים לפני קפה)",
      icon: "💧",
      content: "המוח שלך מורכב מכ-75% מים, ואחרי לילה של שינה הוא מיובש. שתיית כוס מים גדולה מיד כשקמים משפרת את המהירות הקוגניטיבית ואת היכולת לעבד מידע. שמור את הקפה לשעה מאוחרת יותר, כשרמות הקורטיזול הטבעיות מתחילות לרדת.",
    },
    {
      title: 'דחיית ה"מתקפה הדיגיטלית"',
      icon: "📵",
      content: 'המנע מבדיקת הודעות, מיילים או רשתות חברתיות ב-30 הדקות הראשונות. כשאתה פותח את היום בטלפון, אתה נכנס למצב "תגובתי" (Reactive) שבו המוח מגיב לדרישות של אחרים במקום להוביל את המטרות שלך. זה יוצר מתח מיותר כבר מהרגע הראשון.',
    },
    {
      title: "חשיפה לאור שמש טבעי",
      icon: "☀️",
      content: "צא למרפסת או פתח חלון ל-5 עד 10 דקות. אור השמש מסנכרן את השעון הביולוגי שלך, מדכא את הורמון השינה (מלטונין) ומעורר הפרשת סרוטונין שמשפר את מצב הרוח והריכוז.",
    },
    {
      title: "תנועה קלה להזרמת חמצן",
      icon: "🏃",
      content: "לא חייבים אימון מפרך. מספיקות 5 דקות של מתיחות, יוגה או הליכה קצרה. תנועה מעלה את קצב הלב ומזרימה חמצן וגלוקוז למוח, מה שמשפר את התפקודים הניהוליים (קבלת החלטות ופתרון בעיות).",
    },
    {
      title: "למידה או קריאה (Brain Feed)",
      icon: "📚",
      content: 'הקדש 10 דקות לקריאת דף מספר, האזנה לפודקאסט מקצועי או למידה של נושא חדש. בשעות הבוקר המוח נמצא במצב של "גמישות מחשבתית" גבוהה, וזה הזמן האידיאלי להטמיע ידע חדש לפני שהיום הופך לעמוס.',
    },
    {
      title: '"לבלוע את הצפרדע" (Eat the Frog)',
      icon: "🐸",
      content: 'המוח שלנו הכי חד וממוקד בשעות המוקדמות. במקום לבזבז את האנרגיה הזו על משימות אדמיניסטרטיביות קלות, הקדש את השעה הראשונה של העבודה למשימה הכי מורכבת או "מפחידה" ברשימה שלך. ברגע שתסיים אותה, תחושת ההישג תלווה אותך ותוריד את רמת הלחץ.',
    },
    {
      title: "חשיפה למים קרים",
      icon: "🧊",
      content: 'שטיפת פנים במים קרים מאוד או סיום המקלחת ב-30 שניות של מים קרים יוצרים "שוק" חיובי למערכת העצבים. זה מעלה את רמות הדופמין והנוראדרנלין באופן טבעי, מה שמעניק ערנות וחדות שנמשכות שעות.',
    },
  ],
};

export const DEEP_SHALLOW_WORK_GUIDE = {
  id: "deep-shallow-work",
  title: "מדריך: עבודה עמוקה מול עבודה רדודה",
  icon: "🧠",
  sections: [
    {
      title: "מהי עבודה עמוקה (Deep Work)?",
      icon: "🎯",
      content: "עבודה עמוקה היא פעילות מקצועית שדורשת ריכוז מלא, ללא הסחות דעת. היא יוצרת ערך חדש, משפרת מיומנויות, וקשה לשכפול. דוגמאות: כתיבת קוד מורכב, מחקר מעמיק, כתיבה יצירתית, תכנון אסטרטגי, למידה של נושא חדש. Cal Newport (מחבר 'Deep Work'): 'עבודה עמוקה היא כמו כוח-על בעולם תחרותי — מי ששולט בה מצליח.'",
    },
    {
      title: "מהי עבודה רדודה (Shallow Work)?",
      icon: "📋",
      content: "עבודה רדודה היא משימות לוגיסטיות שלא דורשות ריכוז רב וקל לשכפל אותן. הן הכרחיות אבל לא יוצרות ערך משמעותי. דוגמאות: מיילים, פגישות סטטוס, מילוי טפסים, עדכון גיליונות, שיחות טלפון שגרתיות. הסכנה: אם כל היום שלך הוא עבודה רדודה — אתה עסוק אבל לא באמת מתקדם.",
    },
    {
      title: "איך לזהות מה עמוק ומה רדוד?",
      icon: "🔍",
      content: "שאל את עצמך: 'האם סטודנט מוכשר בן 22 יכול לעשות את המשימה הזו אחרי הדרכה קצרה?' אם כן → רדודה. אם לא → עמוקה. טיפ נוסף: אם אתה יכול לעשות את המשימה תוך כדי שיחת טלפון — היא רדודה.",
    },
    {
      title: "כלל 80/20 לעבודה עמוקה",
      icon: "📊",
      content: "שאף ל-60-80% עבודה עמוקה ו-20-40% רדודה ביום. בפועל, רוב האנשים עושים הפוך. התחל עם בלוק אחד של 90 דקות עבודה עמוקה בבוקר, וצבור את הרדודה לשעות הצהריים.",
    },
    {
      title: "טכניקות לעבודה עמוקה",
      icon: "⚡",
      content: "1) Time Blocking — חסום זמן ביומן לעבודה עמוקה. 2) Ritual — צור טקס התחלה (קפה, מוזיקה, מקום קבוע). 3) Shutdown Ritual — בסוף היום, רשום מה תעשה מחר וסגור מנטלית. 4) כלל ה-4 שעות — המוח מסוגל למקסימום 4 שעות עבודה עמוקה ביום. אל תנסה יותר. 5) Lead Measure — עקוב אחרי שעות עבודה עמוקה ביום, לא אחרי תוצאות.",
    },
    {
      title: "טכניקות לעבודה רדודה יעילה",
      icon: "🏎️",
      content: "1) Batching — קבץ מיילים, שיחות וישיבות לבלוקים. 2) כלל 2 דקות — אם לוקח פחות מ-2 דקות, עשה עכשיו. 3) Templates — צור תבניות למיילים ותשובות חוזרות. 4) הגבל ישיבות — כל ישיבה חייבת אג'נדה ומגבלת זמן. 5) אוטומציה — כל דבר שחוזר על עצמו ניתן לאוטומציה.",
    },
  ],
};

export const SLEEP_HABITS_GUIDE = {
  id: "sleep-habits",
  title: "מדריך שינה איכותית — מחקרים וטיפים",
  icon: "😴",
  sections: [
    {
      title: "למה שינה כל כך חשובה?",
      icon: "🧠",
      content: "לפי Matthew Walker ('Why We Sleep'): שינה של פחות מ-7 שעות פוגעת ב-40% ביכולת הלמידה, מעלה סיכון למחלות לב ב-200%, ומחלישה את המערכת החיסונית. במהלך שינה המוח מנקה רעלים (בטא-עמילואיד), מגבש זיכרונות ומתקן תאים. שינה היא לא בזבוז זמן — היא ההשקעה הכי חשובה שלך.",
    },
    {
      title: "כמה שעות שינה צריך?",
      icon: "⏰",
      content: "מבוגרים: 7-9 שעות (מחקר NSF). מתבגרים: 8-10 שעות. ילדים: 9-12 שעות. חשוב: אין 'גנים של שינה קצרה' — פחות מ-1% מהאוכלוסייה באמת מתפקדים עם פחות מ-6 שעות. אם אתה חושב שאתה מהם — כנראה שלא. מחקר UCSD: אנשים שישנו 6.5 שעות דיווחו שהם 'בסדר', אבל מבחני ביצועים הראו ירידה של 25%.",
    },
    {
      title: "טקס שינה (Sleep Ritual)",
      icon: "🌙",
      content: "1) שעה קבועה — לך לישון ותתעורר באותה שעה כל יום, כולל סופ\"ש. 2) 60 דקות לפני — הפחת מסכים (אור כחול מדכא מלטונין ב-50%). 3) 30 דקות לפני — קריאה, מדיטציה, מקלחת חמימה (ירידת הטמפרטורה אחריה מזרזת הירדמות). 4) חדר חשוך ושקט — השתמש באטמי אוזניים ומסכת עיניים. 5) רשום מחשבות — 'Brain Dump' למניעת מחשבות מירוצים.",
    },
    {
      title: "טמפרטורה ואור",
      icon: "🌡️",
      content: "מחקר Stanford: הטמפרטורה האידיאלית לשינה היא 18-19°C. חדר חם מדי (מעל 24°C) מפחית שינת REM ב-20%. אור: חשיפה לאור בוקר (10-15 דקות) מסנכרנת את השעון הביולוגי. בערב, הפחת אורות כחולים — השתמש במצב 'Night Shift' או משקפי סינון.",
    },
    {
      title: "קפאין ואלכוהול",
      icon: "☕",
      content: "קפאין: זמן מחצית חיים של 5-7 שעות. קפה ב-14:00 = כמו חצי כוס ב-20:00. Walker: 'קפאין לא נותן אנרגיה — הוא מסתיר עייפות.' הפסק קפאין 8-10 שעות לפני השינה. אלכוהול: למרות שהוא 'מרדים', הוא מפריע לשינת REM ויוצר שינה מקוטעת. כוס יין 3 שעות לפני השינה מפחיתה איכות שינה ב-25%.",
    },
    {
      title: "מה לעשות כשלא נרדמים?",
      icon: "😫",
      content: "1) כלל 20 הדקות — אם לא נרדמת תוך 20 דקות, קום מהמיטה ועשה משהו רגוע (קריאה באור עמום). 2) טכניקת 4-7-8: שאף 4 שניות, החזק 7, נשוף 8. 3) Body Scan: רפה שרירים מכפות הרגליים עד הראש. 4) 'Cognitive Shuffle': חשוב על מילים אקראיות שלא קשורות זו לזו — זה 'משעמם' את המוח לשינה. 5) אל תסתכל בשעון — זה מגביר חרדה.",
    },
    {
      title: "נמנום (Power Nap)",
      icon: "💤",
      content: "NASA מצאו שנמנום של 26 דקות משפר ביצועים ב-34% וערנות ב-54%. כללים: 1) מקסימום 20-30 דקות. 2) לפני 15:00 (אחרת ישפיע על שינת הלילה). 3) 'Coffee Nap': שתה קפה מיד לפני הנמנום — הקפאין ייכנס לפעולה בדיוק כשתתעורר. 4) אם אתה עייף מדי — עדיף לישון לילה מוקדם.",
    },
  ],
};

export const NUTRITION_GUIDE = {
  id: "nutrition-guide",
  title: "מדריך תזונה לפרודוקטיביות ובריאות",
  icon: "🥗",
  sections: [
    {
      title: "עקרונות תזונה בריאה",
      icon: "🍎",
      content: "1) מזון אמיתי — העדף מזון שלם ולא מעובד. Michael Pollan: 'אכול אוכל, לא יותר מדי, בעיקר צמחים.' 2) מגוון צבעים — כל צבע בירקות ופירות מייצג חומרים מגנים שונים. 3) שתה מים — לפחות 8 כוסות ביום. צמא קל מפחית ריכוז ב-15%. 4) ארוחות קטנות ותכופות — מונע קריסת סוכר ושומר על אנרגיה יציבה.",
    },
    {
      title: "מזונות למוח (Brain Food)",
      icon: "🧠",
      content: "1) שומן אומגה-3 (סלמון, סרדינים, אגוזי מלך) — משפר זיכרון וריכוז. 2) אוכמניות — עשירות באנטיאוקסידנטים שמגנים על תאי מוח. 3) ירוקים כהים (תרד, קייל) — חומצה פולית לתפקוד קוגניטיבי. 4) ביצים — כולין חיוני לנוירוטרנסמיטרים. 5) שוקולד מריר (70%+) — פלבנואידים שמשפרים זרימת דם למוח. 6) כורכום — נוגד דלקת שמגן על המוח.",
    },
    {
      title: "תפריט יומי מומלץ — אנרגטי",
      icon: "📋",
      content: "🌅 בוקר: שייק ירוק (תרד + בננה + חלב שקדים + חמאת בוטנים + זרעי צ'יה) או שיבולת שועל עם אוכמניות ואגוזים. 🕐 ביניים: חופן שקדים + תפוח. 🍽️ צהריים: סלט עם חזה עוף/טופו צלוי, קינואה, ירקות צבעוניים ושמן זית. 🕓 ביניים: גזר וחומוס או יוגורט עם גרנולה. 🌙 ערב: סלמון/דג אפוי עם ירקות צלויים ואורז מלא.",
    },
    {
      title: "תפריט יומי מומלץ — קל ונקי",
      icon: "🥑",
      content: "🌅 בוקר: 2 ביצים עם אבוקדו על לחם מחמצת + עגבנייה. 🕐 ביניים: בננה + חמאת שקדים. 🍽️ צהריים: מרק ירקות עשיר + לחם מלא + סלט טחינה. 🕓 ביניים: ירקות חתוכים (מלפפון, גזר, פלפל) + חומוס. 🌙 ערב: חזה עוף/טופו עם ירקות מוקפצים ואטריות אורז.",
    },
    {
      title: "תפריט צמחוני/טבעוני",
      icon: "🌱",
      content: "🌅 בוקר: טוסט אבוקדו עם זרעי המפ ולימון + שייק מנגו-תרד. 🕐 ביניים: Energy Balls (תמרים + שיבולת שועל + קקאו + חמאת בוטנים). 🍽️ צהריים: בורגול עם עדשים, ירקות צלויים ועשבי תיבול + טחינה. 🕓 ביניים: אדממה + תפוז. 🌙 ערב: קארי ירקות עם חלב קוקוס ואורז בסמטי + טופו.",
    },
    {
      title: "תפריט ים-תיכוני",
      icon: "🫒",
      content: "🌅 בוקר: יוגורט יווני/יוגורט סויה עם אגוזים, דבש ופירות יער. 🕐 ביניים: זיתים, מלפפון ועגבניות שרי. 🍽️ צהריים: דג/קטניות, קינואה או אורז מלא, סלט גדול, טחינה ושמן זית. 🕓 ביניים: פרי + שקדים. 🌙 ערב: חביתה/טופו עם סלט קצוץ, גבינה מלוחה או חומוס ולחם מלא.",
    },
    {
      title: "תפריט עתיר חלבון",
      icon: "💪",
      content: "🌅 בוקר: חביתה/טופו scramble עם גבינה/אבוקדו. 🕐 ביניים: יוגורט חלבון או שייק חלבון + פרי. 🍽️ צהריים: עוף/דג/סייטן עם בטטה וירקות. 🕓 ביניים: קוטג'/אדממה/טונה עם קרקרים מלאים. 🌙 ערב: קציצות הודו/עדשים עם סלט וטחינה. מתאים במיוחד לשובע, אימונים ושמירה על מסת שריר.",
    },
    {
      title: "תפריט להפחתת משקל בעדינות",
      icon: "⚖️",
      content: "המטרה היא לאכול משביע ולא קיצוני: 🌅 בוקר: שיבולת שועל עם זרעי צ'יה ופרי. 🕐 ביניים: תפוח + 10 שקדים. 🍽️ צהריים: קערת חלבון + ירקות + פחמימה אחת מדודה. 🕓 ביניים: יוגורט/חומוס עם ירקות. 🌙 ערב: מרק עשיר, סלט גדול וחלבון קל. שמרי על ארוחות מסודרות, הרבה חלבון וסיבים, ואל תדלגי על ארוחות.",
    },
    {
      title: "תפריט אנטי-דלקתי",
      icon: "🫐",
      content: "התמקדי בדגים שמנים, שמן זית, כורכום, ג'ינג'ר, ירוקים כהים, קטניות, פירות יער ואגוזים. דוגמה: 🌅 בוקר: פודינג צ'יה עם פירות יער. 🍽️ צהריים: סלמון עם קינואה וברוקולי. 🌙 ערב: מרק עדשים, ירקות צלויים וסלט עם שמן זית. הפחיתי סוכר, קמח לבן ומזון אולטרה-מעובד.",
    },
    {
      title: "מה להימנע ממנו",
      icon: "⚠️",
      content: "1) סוכר מזוקק — קריסת אנרגיה אחרי 30 דקות, פוגע בריכוז. 2) מזון מעובד — עשיר בנתרן ושומנים רעים שמעייפים. 3) אלכוהול — פוגע בשינה ובתפקוד קוגניטיבי. 4) קפאין מוגזם — יותר מ-3 כוסות ליום יוצר תלות ומפריע לשינה. 5) ארוחות כבדות לפני השינה — המערכת העיכול עובדת במקום שהגוף ינוח.",
    },
    {
      title: "הידרציה נכונה",
      icon: "💧",
      content: "מחקרים: ירידה של 2% בהידרציה = ירידה של 20% בתפקוד קוגניטיבי. כללים: 1) התחל את הבוקר בכוס מים גדולה. 2) שתה לפני שאתה צמא. 3) 30 מ\"ל לכל ק\"ג משקל גוף ביום (70 ק\"ג = 2.1 ליטר). 4) הוסף לימון, מנטה או מלפפון לטעם. 5) הפחת משקאות ממותקים — הם מייבשים ומעלים סוכר.",
    },
  ],
};
