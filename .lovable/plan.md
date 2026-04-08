

# Plan: Comprehensive Update — Financial Dashboard, Deeply Rename, Landing Page, Onboarding Guide, Translations & Design

This plan addresses all the requests in a single implementation pass.

---

## Summary of Changes

1. **Financial Dashboard Overhaul** — Fix import saving, add Excel/PDF/receipt upload, category breakdown, monthly view, budget planning
2. **Deeply Rename & Fix** — Rename to "ZoneFlow" (or similar), fix broken YouTube videos, allow deleting built-in videos
3. **Landing Page** — Add English translation, show contact emails, apply new design system colors
4. **Onboarding Guide Enhancement** — Add email & budget sections, English support, link from Settings
5. **Translations** — Complete missing Hebrew/English across all modules
6. **Main Dashboard Design** — Apply new design tokens from uploaded DESIGN files, keep customization ability
7. **Admin Landing Page Editor** — Simple admin-editable landing page content

---

## Technical Details

### Step 1: Financial Dashboard — Complete Overhaul
**Files:** `PaymentDashboard.tsx`, `FinancialCsvImport.tsx`, `CreditCardImport.tsx`, `financialImport.ts`

- Fix the core issue: imported transactions from `financial_transactions` must appear in the income/expenses tabs and be editable (category, notes)
- Add Excel (.xlsx/.xls) and PDF upload support to **both** import panels (left CSV import + right credit card import)
- Add receipt scanning via AI (upload image → extract amount, merchant, date using Gemini)
- Redesign the dashboard hero to focus on savings philosophy:
  - Top cards: Total Income | Total Spent (non-savings) | Available to Save | Weekly Budget Remaining
  - Monthly category breakdown pie chart
  - Budget allocation per category with progress bars
  - Alert when overspending in a category
- Add "Quick Add" income/expense form directly on the main tab
- Keep existing customization (DashboardDisplayToolbar) intact

### Step 2: Deeply → "ZoneFlow" Rename & Fixes
**Files:** `DeeplyDashboard.tsx`, `DeeplyMusicPlayer.tsx`, `FloatingMusicMini.tsx`, `audioPresets.ts`, `deeplyAudioState.ts`, `useAudioEngine.ts`, `iosAudioUnlock.ts`, `iosSilentAudio.ts`, `renderPresetToAudio.ts`, tab references in `useUserPreferences.ts`, `useLanguage.tsx`

- Rename "Deeply" to **"ZoneFlow"** across all UI strings and translations (keeping file names as-is to minimize refactor risk)
- Fix YouTube embed issues: ensure iframe `allow` attributes include `autoplay; encrypted-media`
- Add delete button for built-in YouTube videos per category (stored in localStorage as hidden list)
- Ensure all text in the module is translated to English

### Step 3: Landing Page — Bilingual + Contact Emails + Design
**Files:** `Landing.tsx`

- Add language toggle (he/en) on the landing page header
- Translate all FEATURES, HIGHLIGHTS, section headers, and CTA buttons to English
- Add contact section in footer: `info@tabro.org` and `tabro855@gmail.com` with mailto links
- Apply design tokens from uploaded DESIGN_1.md: Indigo primary (#3525cd), Amber secondary (#fea619), Plus Jakarta Sans font, glassmorphism effects, no-line rule for cards
- Keep existing theme switcher functionality

### Step 4: Onboarding Guide Enhancement
**Files:** `OnboardingWizard.tsx`, `SettingsPanel.tsx`

- Add new steps to onboarding:
  - "Email Integration" step explaining Gmail connection
  - "Budget & Finance" step explaining import and tracking
- Add English translations for all onboarding steps
- Add "Restart Guide" button in Settings panel to re-trigger onboarding
- Ensure the guide adapts to current language setting

### Step 5: Complete Translations
**Files:** `useLanguage.tsx` + all component files with hardcoded Hebrew

- Audit and add missing English translations for:
  - Financial guides section
  - ZoneFlow (Deeply) module
  - Email integration UI
  - Dashboard configuration panel
  - All category names and status labels
- Ensure RTL/LTR dir switching works on every component

### Step 6: Main Dashboard Design Refresh
**Files:** `Dashboard.tsx`, `index.css` or `tailwind.config.ts`

- Apply the "Lucid Architect" design philosophy from DESIGN_1.md:
  - Replace 1px borders with tonal surface shifts
  - Use ambient shadows (32-64px blur, 4-6% opacity)
  - Apply Plus Jakarta Sans font
  - Indigo (#3525cd) for structure, Amber (#fea619) for action highlights
- Keep the existing dashboard customization system (hide/show/reorder blocks) completely unchanged
- Update chart colors to use new palette

### Step 7: Admin Landing Page Editor
**Files:** New migration for `landing_content` table, `AdminDashboard.tsx`

- Create a `landing_content` table with key-value pairs for editable landing text (hero title, subtitle, CTA text)
- Add a "Landing Page" section in Admin Dashboard with simple text inputs
- Landing.tsx reads from this table (with fallback to hardcoded defaults)

---

## Database Changes

1. **No schema changes needed** for financial import fixes (table already exists)
2. **New table `landing_content`**: `id uuid PK, key text UNIQUE, value_he text, value_en text, updated_at timestamptz` with admin-only RLS

---

## What Stays Unchanged

- Dashboard customization system (hide/show/reorder) — untouched
- All existing data and preferences
- Authentication flow
- Notification system
- Project management module

