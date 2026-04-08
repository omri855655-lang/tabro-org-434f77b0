

# Comprehensive Fix Pass — 7 Parts

## Part 1: Global Design System Tokens

### Files to modify:
- **`index.html`**: Add Google Fonts preconnect + Plus Jakarta Sans + Inter font link in `<head>`
- **`src/index.css`**: Add `:root` CSS variables (`--brand-primary`, `--brand-accent`, `--shadow-ambient`), heading font-family rule, body font-family rule, `.card-surface` utility class
- **`tailwind.config.ts`**: Extend `colors.brand`, `fontFamily.display/body`, `boxShadow.ambient`
- **`src/components/Dashboard.tsx`**: Replace `<Card>` with `<Card className="card-surface">` on stat cards, remove border classes, add `border-l-[3px] border-l-brand-primary` accent
- **`src/components/dashboards/PaymentDashboard.tsx`**: Apply `card-surface` to hero and section cards
- **`src/pages/AdminDashboard.tsx`**: Apply `card-surface` to admin cards

## Part 2: Translations

### `src/hooks/useLanguage.tsx`:
Add ~25 missing translation keys with HE+EN values:
- `books`, `read`, `series_films`, `total_books`, `pending`, `reading`, `watching`
- `books_distribution`, `general_comparison`, `reading_progress`, `watch_progress`
- `no_books_yet`, `no_series_yet`, `customize_dashboard`, `reset`, `normal`, `compact`, `cards_view`
- `expense_breakdown`, `other`, `total`, `completed`, `watched`
- `minutes`, `seconds`
- Email category labels: `catPayment`, `catTask`, `catNewsletter`, `catSocial`, `catOther_email`

### Files to update with `t()` calls:
- **`Dashboard.tsx`**: Replace all hardcoded Hebrew ("ספרים", "נקראו", "סדרות/סרטים", "סה״כ ספרים", etc.) with `t()` 
- **`PaymentDashboard.tsx`** line 618: Replace "פילוח הוצאות" → `t("expense_breakdown")`; line 625: Replace `{cat}` → `{getCategoryLabel(cat)}`; line 299/690: Replace "אחר" → `t("other")`
- **`DeeplyDashboard.tsx`**: Replace roadmap step labels (lines 44-48), timer labels, BG_THEMES names with `t()` calls
- **`EmailIntegration.tsx`**: Replace raw category keys with `t()` labels

## Part 3: Dashboard Design + Chart Toggle

### `Dashboard.tsx`:
1. Remove border classes from stat cards; apply `card-surface` + `border-l-[3px] border-l-[#3525cd]`
2. Add chart type toggle (Bar | Line | Donut) above each chart widget:
   - New state per widget stored in localStorage (`chart_type_booksChart`, etc.)
   - Toggle renders `<PieChart>`, `<BarChart>`, or `<LineChart>` from recharts (already imported)
   - Default: current chart type (Pie for books/shows, Bar for comparison)
3. Do NOT touch `useDashboardConfig`, section ordering, or hide/show logic

## Part 4: Financial Import Fix

### `src/lib/financialImport.ts`:
- After successful insert to `financial_transactions`, no additional `income_expenses` table insert needed (the dashboard already reads from `financial_transactions` directly — verified in PaymentDashboard.tsx lines 183-186)
- The data IS appearing — the bug was already fixed in the previous pass

### `src/components/dashboards/CreditCardImport.tsx`:
- Add `.xlsx, .xls` to accepted file types (SheetJS already in project)

### `PaymentDashboard.tsx`:
- In hero card (line 470 area): Add budget target row when `budgetTarget > 0`:
  `"יעד שבועי: {budgetTarget} ₪ | נותר: {remaining} ₪"`
- Add inline edit button (pencil icon) per transaction row → small form for category + notes
- Add "תשלום קבוע" / "Fixed payment" checkbox to quick-add form
- Show fixed payment count + total in overview

## Part 5: Email Integration

### `src/hooks/useEmailIntegration.ts`:
- Line 58: Change `.limit(50)` → `.limit(120)`

### `src/components/EmailIntegration.tsx`:
- Add category filter dropdown (All | Payment | Task | Newsletter | Social | Other)
- Add sort toggle (Newest | Oldest | By sender)
- Show "Sent" badge when `email_from` matches connected email
- Remove hard 10-item cap; show 30 at a time with "Show more" button

### `src/pages/AdminDashboard.tsx`:
- Add "Company Mailbox" card with:
  - Email log table from `email_send_log` (already fetched via admin-analytics)
  - Filter by recipient, template, status
  - Search bar
  - Compose email form (calls Resend via edge function)

## Part 6: ZoneFlow Mobile Delete

### `src/components/deeply/DeeplyDashboard.tsx`:
- Line 803: Change `opacity-0 group-hover:opacity-100` → `opacity-100 md:opacity-0 md:group-hover:opacity-100`
- Verify localStorage key is `"zoneflow_hidden_videos"` (or standardize it)

### `src/components/SettingsPanel.tsx`:
- Add "Reset hidden ZoneFlow videos" button that clears `zoneflow_hidden_videos` from localStorage

## Part 7: Contact Form Fix

### `supabase/functions/send-contact-form/index.ts`:
- Split single Resend call into two separate calls (one per admin email)
- Add early RESEND_API_KEY check with proper error response

### `src/components/ContactForm.tsx`:
- Show actual error from response body
- On success: "הפנייה נשלחה בהצלחה ל-info@tabro.org"

---

## Files Summary

| File | Changes |
|------|---------|
| `index.html` | Add font imports |
| `src/index.css` | Add design system CSS vars + utilities |
| `tailwind.config.ts` | Extend brand colors, fonts, shadows |
| `src/components/Dashboard.tsx` | Design system + translations + chart toggle |
| `src/components/dashboards/PaymentDashboard.tsx` | Translations + budget display + inline edit + fixed payment |
| `src/components/dashboards/CreditCardImport.tsx` | Add xlsx/xls support |
| `src/components/EmailIntegration.tsx` | Filters, sort, expanded display |
| `src/hooks/useEmailIntegration.ts` | Increase limit to 120 |
| `src/hooks/useLanguage.tsx` | Add ~25 missing translation keys |
| `src/components/deeply/DeeplyDashboard.tsx` | Mobile delete fix |
| `src/components/SettingsPanel.tsx` | Reset hidden videos button |
| `src/components/ContactForm.tsx` | Better error/success messages |
| `supabase/functions/send-contact-form/index.ts` | Split email sends |
| `src/pages/AdminDashboard.tsx` | Company mailbox + design system |

No database schema changes needed. No changes to auth, notifications, or project management.

