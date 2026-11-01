import { PDFDocument, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import bidiFactory from "npm:bidi-js@1.0.3";
import { BRIEFING_FONT_BOLD_BASE64, BRIEFING_FONT_RANGES, BRIEFING_FONT_REGULAR_BASE64 } from "./briefingFont.ts";
import type { BriefingItem, BriefingItemKind } from "./dailyBriefing.ts";

// Builds a real, printable A4 Hebrew RTL PDF with an embedded font. Text is wrapped
// in logical order, then reordered for display with the Unicode bidi algorithm, so
// mixed Hebrew/English/numbers read correctly. Content flows onto as many pages as needed.

export interface BriefingPdfInput {
  title: string;
  date: string;
  summary: string;
  recommendation: string;
  items: BriefingItem[];
  generatedAt: Date;
}

const bidi = bidiFactory();
const PAGE = { width: 595.28, height: 841.89, margin: 42 };
const INK = rgb(0.11, 0.12, 0.2);
const MUTED = rgb(0.38, 0.4, 0.48);
const ACCENT = rgb(0.21, 0.15, 0.8);
const WARN = rgb(0.7, 0.18, 0.1);
const RULE = rgb(0.85, 0.86, 0.9);

const decode = (base64: string) => Uint8Array.from(atob(base64), char => char.charCodeAt(0));
const supported = (code: number) => BRIEFING_FONT_RANGES.some(([from, to]) => code >= from && code <= to);

// Keep only glyphs the embedded font can draw; drop niqqud, emoji and control characters.
export function sanitizePdfText(value: string): string {
  let out = "";
  for (const char of (value || "").normalize("NFC").replace(/[\u0591-\u05C7]/g, "").replace(/[\t\r\n]+/g, " ")) {
    const code = char.codePointAt(0) || 0;
    out += supported(code) ? char : "";
  }
  return out.replace(/ {2,}/g, " ").trim();
}

export function visualOrder(line: string): string {
  if (!line) return line;
  const levels = bidi.getEmbeddingLevels(line, "rtl");
  const chars = line.split("");
  for (const [index, mirror] of bidi.getMirroredCharactersMap(line, levels)) chars[index] = mirror;
  for (const [start, end] of bidi.getReorderSegments(line, levels)) {
    const slice = chars.slice(start, end + 1).reverse();
    chars.splice(start, slice.length, ...slice);
  }
  return chars.join("");
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitizePdfText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const fits = (value: string) => font.widthOfTextAtSize(value, size) <= maxWidth;
  for (let word of words) {
    while (!fits(word)) {
      // Break very long tokens (URLs, IDs) character by character.
      let cut = word.length - 1;
      while (cut > 1 && !fits(word.slice(0, cut))) cut--;
      if (line) { lines.push(line); line = ""; }
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const next = line ? `${line} ${word}` : word;
    if (fits(next)) line = next;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

const SECTION_TITLES: Record<BriefingItemKind, string> = {
  task: "משימות",
  event: "לו״ז היום",
  mail: "מיילים שעשויים לדרוש טיפול",
};

export async function buildBriefingPdf(input: BriefingPdfInput): Promise<{ bytes: Uint8Array; pages: number }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(sanitizePdfText(input.title) || "Tabro");
  doc.setLanguage("he-IL");
  doc.setCreator("Tabro");
  doc.setProducer("Tabro daily briefing");
  doc.setCreationDate(input.generatedAt);
  const regular = await doc.embedFont(decode(BRIEFING_FONT_REGULAR_BASE64), { subset: false });
  const bold = await doc.embedFont(decode(BRIEFING_FONT_BOLD_BASE64), { subset: false });
  const right = PAGE.width - PAGE.margin;
  const contentWidth = PAGE.width - PAGE.margin * 2;
  const bottom = PAGE.margin + 28;
  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  let currentSection: BriefingItemKind | null = null;

  const drawLine = (text: string, font: PDFFont, size: number, color = INK, indent = 0) => {
    const visual = visualOrder(text);
    const width = font.widthOfTextAtSize(visual, size);
    page.drawText(visual, { x: right - indent - width, y, size, font, color });
  };
  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
    if (currentSection) {
      drawLine(`${SECTION_TITLES[currentSection]} (המשך)`, bold, 12, ACCENT);
      y -= 20;
    }
  };
  const ensure = (height: number) => { if (y - height < bottom) newPage(); };
  const paragraph = (text: string, font: PDFFont, size: number, color = INK, indent = 0) => {
    const lineHeight = size * 1.45;
    for (const line of wrapText(text, font, size, contentWidth - indent)) {
      ensure(lineHeight);
      drawLine(line, font, size, color, indent);
      y -= lineHeight;
    }
  };

  // Header
  paragraph(input.title, bold, 20, ACCENT);
  paragraph(`${input.date.split("-").reverse().join(".")} · שעון ישראל`, regular, 11, MUTED);
  y -= 4;
  paragraph(input.summary, bold, 12);
  if (input.recommendation) paragraph(input.recommendation, regular, 11);
  paragraph("ההמלצות הן הצעות בלבד, על סמך מה שנשמר אצלך. סיווג מיילים מבוסס על נושא ושולח בלבד ואינו מאמת את ההודעה.", regular, 9, MUTED);
  y -= 6;
  page.drawLine({ start: { x: PAGE.margin, y }, end: { x: right, y }, thickness: 0.8, color: RULE });
  y -= 18;

  if (input.items.length === 0) {
    paragraph("אין משימות פתוחות להיום, משימות דחופות או אירועים שנותרו. אפשר לבדוק את כל המשימות באתר.", regular, 12);
  }

  for (const item of input.items) {
    if (item.kind !== currentSection) {
      ensure(60);
      y -= currentSection ? 8 : 0;
      currentSection = item.kind;
      drawLine(SECTION_TITLES[item.kind], bold, 14, ACCENT);
      y -= 22;
    }
    // Keep at least the title and meta line of a card together.
    ensure(44);
    const top = y + 12;
    paragraph(`${item.label}: ${item.title}`, bold, 11.5, item.urgent ? WARN : INK, 8);
    const metaLabel = item.kind === "event" ? "מיקום" : item.kind === "mail" ? "שולח" : "אחראי / איש קשר";
    paragraph(`מועד: ${item.when || "—"} · ${metaLabel}: ${item.who || "—"}`, regular, 10, MUTED, 8);
    if (item.details) paragraph(item.details, regular, 10, INK, 8);
    if (item.suggestion) paragraph(item.suggestion, regular, 10, ACCENT, 8);
    // Accent bar beside the card on the right edge (only within the current page).
    const barTop = Math.min(top, PAGE.height - PAGE.margin + 10);
    if (barTop > y + 6) page.drawRectangle({ x: right - 2, y: y + 6, width: 2, height: barTop - y - 6, color: item.urgent ? WARN : RULE });
    y -= 10;
  }

  const pages = doc.getPages();
  pages.forEach((p, index) => {
    const footer = visualOrder(sanitizePdfText(`עמוד ${index + 1} מתוך ${pages.length} · Tabro · tabro.org`));
    const width = regular.widthOfTextAtSize(footer, 9);
    p.drawText(footer, { x: (PAGE.width - width) / 2, y: PAGE.margin - 10, size: 9, font: regular, color: MUTED });
  });
  return { bytes: await doc.save(), pages: pages.length };
}
