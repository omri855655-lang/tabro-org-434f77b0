

# Comprehensive Fix Pass — All Remaining Issues

## Issues Identified

### A. PaymentDashboard: Duplicate "overview" TabsContent (CRITICAL BUG)
Lines 471 and 754 both have `<TabsContent value="overview">`. The first contains hero card, budget, charts. The second contains the transaction list (fixed expenses, spending, income). Only one renders — the transaction list at line 754 likely never shows with the hero card, or vice versa. This is why the budget and tabs feel broken.

**Fix**: Merge both into a single `<TabsContent value="overview">` containing hero → budget → 50/30/20 → category breakdown → charts → fixed expenses → spending → income list.

### B. PaymentDashboard: Budget Target Not on Hero Card
Budget remaining is in a separate card below hero (line 536). User wants it ON the hero card.

**Fix**: Add a budget summary row inside the hero card (line 472 area) when `budgetTarget > 0`:
`"יעד {period}: ₪{budgetTarget} | נותר: ₪{remaining}"` using `t()` keys.

### C. PaymentDashboard: Remove DashboardDisplayToolbar
Line 23: `useDashboardDisplay` still imported. Line 124: still used. The toolbar itself was removed from JSX but the import and hook remain.

**Fix**: Remove the import and hook call. The view mode/theme toolbar doesn't work for PaymentDashboard.

### D. PaymentDashboard: Inline Edit for Transactions
No pencil icon on transaction rows. User wants to edit category and notes inline.

**Fix**: Add `Pencil` icon button per row. Clicking toggles an inline form (category select + notes input + save button). Save updates `payment_tracking` or `financial_transactions` depending on `source`.

### E. PaymentDashboard: ~40 Hardcoded Hebrew Strings
Lines using `isRtl ? "..." : "..."` instead of `t()`: "פנוי לחיסכון", "בזבוז", "סומן לחיסכון", "יעד: להכניס ולשמור", "מאזן נטו", "הוצאות שלא שולמו", "בוזבז בפועל", "מתוכנן", "מיובא", "בזבוזים ותנועות", "אחר" fallback at lines 298/690, and many more.

**Fix**: Add ~20 new translation keys to `useLanguage.tsx`, replace all `isRtl ? "..." : "..."` with `t()` calls.

### F. ZoneFlow: Can't Delete Study/Read Videos (Only Music)
Study With Me (line 932): hide button only shows for custom videos (`{isCustom && ...}`). Built-in videos have NO hide button at all. Same for Read With Me (line 1002).

**Fix**: Add the same hide button pattern from the main music section (line 803-809) to Study With Me and Read With Me sections. Non-custom videos get the `opacity-100 md:opacity-0` hide button.

### G. ZoneFlow: Many Hardcoded Hebrew Strings
- BG_THEMES names (lines 21-35): "חשוך", "ירוק בקבוק", etc.
- ROADMAP_STEPS (lines 46-49): "ניקוי רעשים", "סידור המוח", etc.
- Study/Read section titles and descriptions (lines 897-971)
- Timer label "טיימר פומודורו" (line 1048)
- Buttons "הוסף", "ביטול", placeholders "קישור YouTube...", "שם (אופציונלי)"

**Fix**: Add translation keys and replace with `t()` calls.

### H. Admin Mailbox: Send to Any Email
The admin compose form already calls `admin-analytics` with `action: "send_email"`. The edge function already handles this (verified in code). Uses `onboarding@resend.dev` as sender.

**Issue**: `onboarding@resend.dev` can only send to the Resend account owner's email (Gmail). To send to ANY address, need to use the project's verified domain or the Resend connector gateway.

**Fix**: Check if LOVABLE_API_KEY + RESEND_API_KEY are both set, use the connector gateway (`https://connector-gateway.lovable.dev/resend/emails`) for broader delivery. This allows sending to any email.

### I. Contact Form: Edge Function Works But May Not Be Deployed
Testing showed `send-contact-form` returns `{"success": true}`. The code is correct. Need to ensure it's deployed.

**Fix**: Deploy the edge function. The code already handles errors correctly.

### J. Landing Page: No Design System Applied
Still uses old blue/cyan gradients. No glassmorphism, no Indigo/Amber brand colors from the uploaded DESIGN files.

**Fix**: Restyle hero section with Indigo-to-purple gradient, glassmorphism on feature cards, Plus Jakarta Sans for headings. Apply the "Digital Alchemist" aesthetic from the uploaded design specs.

### K. Email Integration: Only Shows 20 Emails
User wants up to 200 emails, 1 month back.

**Fix**: Already has `.limit(120)` in useEmailIntegration.ts. The `displayCount` starts at 30 in EmailIntegration.tsx. Increase initial display to 50, increase limit to 200.

---

## Implementation Plan

### 1. Fix PaymentDashboard Structure & Budget
**File**: `src/components/dashboards/PaymentDashboard.tsx`
- Merge duplicate `<TabsContent value="overview">` into one
- Add budget remaining to hero card
- Remove `useDashboardDisplay` import and usage
- Add inline edit (pencil icon) per transaction row
- Replace all `isRtl ? "..." : "..."` with `t()` keys

### 2. Fix ZoneFlow Delete Buttons + Translations
**File**: `src/components/deeply/DeeplyDashboard.tsx`
- Add hide button for non-custom videos in Study With Me and Read With Me sections
- Replace hardcoded Hebrew in BG_THEMES, ROADMAP_STEPS, section titles, buttons, placeholders with `t()` calls

### 3. Add Translation Keys
**File**: `src/hooks/useLanguage.tsx`
- Add ~30 new keys for PaymentDashboard and DeeplyDashboard strings

### 4. Fix Admin Mailbox Email Delivery
**File**: `supabase/functions/admin-analytics/index.ts`
- Use Resend connector gateway for broader email delivery
- Add reply-to header support

### 5. Restyle Landing Page
**File**: `src/pages/Landing.tsx`
- Apply Indigo-to-purple gradient hero
- Glassmorphism feature cards
- Brand colors and typography

### 6. Increase Email Display Limit
**Files**: `src/hooks/useEmailIntegration.ts`, `src/components/EmailIntegration.tsx`
- Change limit to 200
- Increase initial display count

### 7. Deploy Edge Functions
- Deploy `send-contact-form` and `admin-analytics`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboards/PaymentDashboard.tsx` | Merge tabs, budget on hero, remove toolbar, inline edit, translate strings |
| `src/components/deeply/DeeplyDashboard.tsx` | Hide buttons for study/read videos, translate all hardcoded Hebrew |
| `src/hooks/useLanguage.tsx` | Add ~30 translation keys |
| `supabase/functions/admin-analytics/index.ts` | Use connector gateway for emails |
| `src/pages/Landing.tsx` | Apply design system (gradients, glassmorphism, brand colors) |
| `src/hooks/useEmailIntegration.ts` | Increase limit to 200 |
| `src/components/EmailIntegration.tsx` | Increase initial display |

No database schema changes needed.

