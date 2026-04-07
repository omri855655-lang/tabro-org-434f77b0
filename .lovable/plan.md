

# תוכנית תיקון מקיפה — פיננסים, Gmail, תרגום

## מה שבור ומה שנעשה

### 1. Gmail OAuth — שגיאת `401 invalid_client`
**בעיה**: הגישה הנוכחית משתמשת ב-Edge Function מותאמת (`gmail-auth`) שמנסה לנהל OAuth בעצמה עם `GOOGLE_CLIENT_ID` ו-`GOOGLE_CLIENT_SECRET`. גוגל דוחה את הבקשה כי ה-credentials לא מוגדרים נכון או ה-redirect URI לא מאושר.

**פתרון**: לעבור לגישה הנכונה — `supabase.auth.signInWithOAuth` עם provider `google` ו-scopes של Gmail. ככה Lovable Cloud מנהל את ה-OAuth בצורה מנוהלת, בלי צורך ב-client ID/secret נפרד. אחרי ההסכמה, ניקח את ה-`provider_token` מהסשן ונשמור אותו ב-`email_connections`.

### 2. בנק/אשראי — לא מתחבר
**בעיה**: `salt-edge-connect` הוא placeholder עם callback שביר. Salt Edge דורש הגדרת חשבון מסחרי.

**פתרון**: במקום לנסות Salt Edge חי שלא עובד, נעבור ל**CSV import עובד** כמנגנון ראשי. נבנה מערכת `financial_transactions` מרכזית עם parsers ל-Isracard/MAX/CAL/בנק גנרי, תצוגה מקדימה, מניעת כפילויות, והוספה ידנית.

### 3. שפות — PaymentDashboard ו-SettingsPanel בעברית קשיחה
**בעיה**: `PaymentDashboard.tsx` (712 שורות) לא מייבא כלל את `useLanguage`. כל הטקסט hardcoded בעברית. גם `SettingsPanel.tsx` עם `dir="rtl"` קשיח.

**פתרון**: לשלב `useLanguage()` ו-`t()` בכל הרכיבים הללו. להחליף `dir="rtl"` ב-`dir` דינמי לפי שפה.

---

## שלבי ביצוע

### שלב 1: Gmail OAuth דרך Supabase Auth (לא Edge Function)
- **לעדכן `EmailConnectionDialog.tsx`**: להחליף את הקריאה ל-`gmail-auth` ב-`supabase.auth.signInWithOAuth({ provider: 'google', options: { scopes: 'https://www.googleapis.com/auth/gmail.readonly', redirectTo: window.location.origin } })`
- **לעדכן `useAuth.tsx` או ליצור hook חדש**: אחרי חזרה מ-OAuth, לזהות `provider_token` בסשן ולשמור אותו ב-`email_connections`
- **ליצור Edge Function `sync-gmail-emails`**: שמקבלת JWT, שולפת access_token מ-`email_connections`, קוראת ל-Gmail API, מסווגת עם AI (Lovable AI Gateway — `google/gemini-2.5-flash`), ושומרת ב-`email_analyses`
- **לעדכן `EmailInsightsWidget`**: להציג את התוצאות מ-`email_analyses` מקובצות לפי קטגוריה
- **לטפל בפעולות אוטומטיות**: meeting → `calendar_events`, task → tasks, payment → `payment_tracking`
- Edge Function `gmail-auth` הישנה נשארת (לא מוחקים כלום) אבל כבר לא בשימוש

### שלב 2: מערכת פיננסית — DB חדש
- **migration חדשה** — טבלת `financial_transactions`:
  - `id, user_id, source_type, source_connection_id, provider, external_transaction_id`
  - `transaction_date, posted_date, amount, currency, direction`
  - `description, merchant, category, subcategory`
  - `installment_total, installment_number, billing_day, month_key`
  - `raw_data jsonb, created_at, updated_at`
  - RLS: users access own data only
  - Unique index: `(user_id, source_type, source_connection_id, external_transaction_id)`
- **migration חדשה** — טבלת `financial_sync_logs`:
  - `id, user_id, connection_id, provider, sync_started_at, sync_finished_at`
  - `imported_count, status, error_message`
  - RLS: users access own data only
- **לא נמחק שום טבלה קיימת**

### שלב 3: CSV Import עובד
- **רכיב חדש `FinancialCsvImport.tsx`**:
  - העלאת קובץ CSV/TSV
  - parsers ל-Isracard, MAX, CAL, בנק גנרי, מותאם אישית
  - תצוגה מקדימה של שורות מפורשות
  - וולידציה (עמודות חסרות, סוגים)
  - מניעת כפילויות (לפי external_transaction_id)
  - import ל-`financial_transactions`
  - הודעת הצלחה עם מספר שורות
- **קבצי עזר**:
  - `src/lib/financialProviders.ts` — parser registry
  - `src/lib/transactionNormalizer.ts` — normalization
  - `src/lib/transactionCategorizer.ts` — auto-categorization (keyword-based)

### שלב 4: הוספה ידנית
- **רכיב `ManualTransactionForm.tsx`**: הוספת הכנסה/הוצאה ידנית ל-`financial_transactions`
- עריכת קטגוריה, merchant, תיאור
- שמירה על הפורמט האחיד

### שלב 5: Dashboard מחובר ל-`financial_transactions`
- **עדכון `PaymentDashboard.tsx`**:
  - להוסיף tab חדש "עסקאות" שקורא מ-`financial_transactions`
  - סיכום חודשי: הכנסות, הוצאות, מאזן
  - פילוח לפי קטגוריה
  - חיפוש ופילטור לפי חודש/מקור/ספק
  - תצוגת תשלומים, הצגת עסקאות אחרונות
  - שילוב CSV import ב-tab "בנק ואשראי"
- **PaymentDashboard עדיין עובד עם `payment_tracking`** — הנתונים החדשים נוספים במקביל

### שלב 6: תרגום מלא
- **`PaymentDashboard.tsx`**: להוסיף `useLanguage()`, להחליף כל ~60 מחרוזות hardcoded ב-`t()`, להחליף `dir="rtl"` בדינמי
- **`SettingsPanel.tsx`**: להחליף ~40 מחרוזות hardcoded, להחליף `dir="rtl"` בדינמי
- **`useLanguage.tsx`**: להוסיף מפתחות חסרים לכל 6 השפות
- **CATEGORIES ו-FINANCIAL_GUIDES**: להפוך לדינמיים לפי שפה
- **`formatMonthLabel`**: להשתמש במפתחות תרגום חודשים
- **לסרוק ולתקן**: `OnboardingWizard`, `NotificationSettings`, `BooksManager`, `ShowsManager`, `PodcastsManager`, `Auth.tsx`, `ResetPassword.tsx`

### שלב 7: ארכיטקטורת ספקים
- **`src/lib/financialProviders.ts`**: ממשק `FinancialProvider` עם `parse(text) => Transaction[]`
- מימושים: `IsracardProvider`, `MaxProvider`, `CalProvider`, `GenericBankProvider`, `CustomCsvProvider`
- **`src/lib/financialSyncService.ts`**: orchestration layer עתידי
- הכנה לחיבור עתידי ל-Open Banking ישראלי בלי שבירת דבר

---

## פרטים טכניים

- Gmail OAuth: `supabase.auth.signInWithOAuth` — Google provider כבר מנוהל ע"י Lovable Cloud, אין צורך ב-credentials נפרדים
- AI classification: `google/gemini-2.5-flash` דרך Lovable AI Gateway (בלי API key נוסף)
- כל migration הוא `IF NOT EXISTS` ואדיטיבי בלבד
- עברית נשארת default, RTL דינמי לפי שפה
- Edge Functions קיימות (`gmail-auth`, `salt-edge-connect`, `credit-card-sync`) לא נמחקות
- unique constraint ל-`email_connections` על `(user_id, provider, email_address)` — migration נפרדת

