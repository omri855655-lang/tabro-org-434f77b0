import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { detectProvider, financialProviders, parseCSV, type ParsedTransaction } from "@/lib/financialProviders";
import { applyStatementBillingDate, findStatementTable, nextCsvBillingEstimateDate, sanitizeStatementRows, selectCardRows, statementBillingDate, statementFileCardLastFour, statementRows } from "@/lib/cardStatement";
import { importParsedFinancialTransactions, previewBillingDateChanges, type BillingDateChange } from "@/lib/financialImport";
import { AMEX_CSV_TEMPLATE, decodeStatementText, parseAmexStatement, reconcileAmexStatement } from "@/lib/amexStatement";
import { AmexStatementPreview } from "./AmexStatementPreview";

type CreditCardConnection = Pick<Database["public"]["Tables"]["credit_card_connections"]["Row"],
  "id" | "provider" | "display_name" | "card_last_digits">;
const CREDIT_CARD_CONNECTIONS_EVENT = "tabro-credit-card-connections-changed";

interface CreditCardImportProps {
  requestedProvider?: string;
  onImported?: () => void | Promise<void>;
  suggestedBillingDayForCard?: (card: CreditCardConnection) => number | undefined;
}

const CreditCardImport = ({ onImported, suggestedBillingDayForCard, requestedProvider }: CreditCardImportProps) => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [providerId, setProviderId] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [connections, setConnections] = useState<CreditCardConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [confirmUnidentified, setConfirmUnidentified] = useState(false);
  const [billingDateChoice, setBillingDateChoice] = useState("");
  const [skippedRows, setSkippedRows] = useState(0);
  const [fileError, setFileError] = useState("");
  const [dateChanges, setDateChanges] = useState<BillingDateChange[] | null>(null);
  const [reconciliation, setReconciliation] = useState<ReturnType<typeof reconcileAmexStatement>>([]);
  const importPending = useRef(false);
  const readVersion = useRef(0);

  const isRtl = lang === "he" || lang === "ar";

  const resetFile = useCallback(() => {
    readVersion.current += 1;
    setTransactions([]);
    setFileName("");
    setFileError("");
    setSkippedRows(0);
    setConfirmUnidentified(false);
    setBillingDateChoice("");
    setDateChanges(null);
    setReconciliation([]);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  useEffect(() => { resetFile(); }, [selectedConnectionId, resetFile]);

  useEffect(() => {
    const candidates = connections.filter((card) => !requestedProvider || card.provider === requestedProvider);
    setSelectedConnectionId((current) => candidates.some((card) => card.id === current)
      ? current : candidates.length === 1 ? candidates[0].id : "");
  }, [connections, requestedProvider]);

  useEffect(() => {
    if (!user) { setConnections([]); return; }
    let active = true;

    const loadConnections = async () => {
      const { data, error } = await supabase
        .from("credit_card_connections")
        .select("id,provider,display_name,card_last_digits")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && active) {
        setConnections(data || []);
      }
    };

    loadConnections();

    const handleConnectionsChanged = () => {
      loadConnections();
    };

    window.addEventListener(CREDIT_CARD_CONNECTIONS_EVENT, handleConnectionsChanged);
    return () => {
      active = false;
      window.removeEventListener(CREDIT_CARD_CONNECTIONS_EVENT, handleConnectionsChanged);
    };
  }, [user]);

  const processText = (text: string, name: string) => {
    const { headers, rows, preamble } = findStatementTable(parseCSV(text));
    const source = connections.find((connection) => connection.id === selectedConnectionId);
    const amex = source?.provider === "amex";
    const provider = detectProvider(headers, rows.slice(0, 3)) || financialProviders.find((item) => item.id === "custom");

    if (!provider) {
      setTransactions([]);
      toast.error(isRtl ? "לא זוהה מבנה קובץ נתמך" : "Unsupported file structure");
      return;
    }

    const amexResult = amex ? parseAmexStatement(rows, headers) : null;
    const providerRows = amexResult ? amexResult.transactions : provider.parse(rows, headers);
    setReconciliation(amexResult ? reconcileAmexStatement(rows, headers, providerRows) : []);
    setSkippedRows(amexResult?.skipped || 0);
    setFileError(amexResult?.unsupported ? (isRtl
      ? "לא זוהו עמודות תאריך עסקה, בית עסק וסכום. אפשר להשתמש בתבנית CSV למטה."
      : "Transaction date, merchant and amount columns were not found. Use the CSV template below.") : "");
    const preferredDay = source && suggestedBillingDayForCard?.(source);
    const sortedPurchaseDates = providerRows.map((row) => row.transaction_date).filter(Boolean).sort();
    const latestPurchase = sortedPurchaseDates[sortedPurchaseDates.length - 1];
    const suggestedDate = preferredDay
      ? nextCsvBillingEstimateDate(latestPurchase || format(new Date(), "yyyy-MM-dd"), preferredDay)
      : "";
    setBillingDateChoice(statementBillingDate(preamble, providerRows, name) || suggestedDate);
    const parsed = amex ? providerRows : statementRows(providerRows);
    setProviderId(amex ? "amex" : provider.id);
    setTransactions(parsed);
    setConfirmUnidentified(false);

    if (parsed.length === 0) {
      toast.error(amex ? (isRtl ? "לא נמצאו עסקאות תקינות. בדוק תאריך, סכום ומטבע חיוב בקובץ." : "No valid transactions. Check dates, amounts and billing currencies.")
        : isRtl ? "לא נמצאו הוצאות עם סכום חיוב בשקלים בקובץ" : "No expenses with an ILS billing amount were found");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    resetFile();
    if (file.size > 10 * 1024 * 1024) {
      setFileError(isRtl ? "אפשר לייבא קובץ עד 10MB" : "Maximum file size is 10MB");
      return;
    }
    const version = readVersion.current;
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      try {
        const { read, utils } = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = read(buffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const csvText = utils.sheet_to_csv(worksheet);
        if (version === readVersion.current) processText(csvText, file.name);
      } catch (error) {
        console.error("Credit card excel parse error:", error);
        toast.error(isRtl ? "שגיאה בקריאת קובץ Excel" : "Error reading Excel file");
      }
      return;
    }

    try {
      const text = decodeStatementText(await file.arrayBuffer());
      if (version === readVersion.current) processText(text, file.name);
    } catch {
      if (version === readVersion.current) setFileError(isRtl ? "לא ניתן לקרוא את הקובץ" : "Unable to read file");
    }
  };

  const importTransactions = async (approveDateChanges = false) => {
    const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId);
    if (!user || !selectedConnection?.card_last_digits || !selectedRows.length || importPending.current) return;
    importPending.current = true;
    setImporting(true);

    try {
      const input = {
        userId: user.id,
        parsed: sanitizeStatementRows(applyStatementBillingDate(selectedRows, billingDateChoice)),
        provider: selectedConnection.provider,
        sourceType: "credit_card_import",
        sourceConnectionId: selectedConnection.id,
        accountExternalId: `csv-card:${selectedConnection.id}`,
      };
      if (!approveDateChanges) {
        const changes = await previewBillingDateChanges(input);
        if (changes.length) { setDateChanges(changes); return; }
      }
      const result = await importParsedFinancialTransactions({ ...input, approvedBillingDateChanges: approveDateChanges ? dateChanges || [] : [] });

      await onImported?.();
      toast.success(
        isRtl
          ? `${result.imported} עסקאות נשמרו · ${result.updated} תאריכי חיוב עודכנו · ${result.skipped} עסקאות קיימות דולגו`
          : `${result.imported} transactions saved · ${result.updated} billing dates updated · ${result.skipped} existing transactions skipped`,
      );
      if (result.conflicts) toast.warning(isRtl ? `${result.conflicts} תאריכים לא עודכנו כי הנתונים השתנו. העלה שוב ובדוק את הטיוטה.` : `${result.conflicts} dates were not updated because data changed. Upload again and review.`);
      setTransactions([]);
      setProviderId("");
      setFileName("");
      setConfirmUnidentified(false);
      setBillingDateChoice("");
      setDateChanges(null);
      setReconciliation([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      console.error("Credit card import error:", error);
      toast.error(isRtl ? "שגיאה בייבוא פירוט האשראי" : "Error importing credit card statement");
    } finally {
      setImporting(false);
      importPending.current = false;
    }
  };

  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId);
  const isAmex = selectedConnection?.provider === "amex" || requestedProvider === "amex";
  const visibleConnections = connections.filter((card) => !requestedProvider || card.provider === requestedProvider);
  const fileCard = statementFileCardLastFour(fileName);
  const fileCardMismatch = Boolean(fileCard && selectedConnection && selectedConnection.card_last_digits !== fileCard);
  const cardRows = selectedConnection?.card_last_digits
    ? selectCardRows(transactions, selectedConnection.card_last_digits)
    : null;
  const selectedRows = cardRows && !fileCardMismatch
    ? [...cardRows.matching, ...(confirmUnidentified || fileCard === selectedConnection?.card_last_digits ? cardRows.unidentified : [])]
    : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {isAmex ? "American Express · CSV" : t("importCreditCard")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {isAmex ? (isRtl
              ? "פתרון זמני ללא סיסמה: ייצא פירוט מאמריקן אקספרס, בחר את הכרטיס וסקור את הפילוח לפני שמירה. זהו ייבוא ידני, לא סנכרון חי."
              : "Temporary, password-free import: export your Amex statement, select the card and review categories before saving. This is manual, not live sync.") : isRtl
              ? "בחר את הכרטיס המדויק. ייובאו רק הוצאות שלו עם סכום חיוב בשקלים; רק מועד פירעון שתאשר ייצור חיוב עתידי בתחזית."
              : "Choose the exact card. Only its expenses with an ILS billing amount are imported; a future charge needs a confirmed payment date."}
          </p>
          <Select value={selectedConnectionId} disabled={importing} onValueChange={(value) => { resetFile(); setSelectedConnectionId(value); }}>
            <SelectTrigger className="text-sm">
              <SelectValue
                placeholder={isRtl ? "בחר מקור כרטיס לשיוך הייבוא" : "Choose a card source for this import"}
              />
            </SelectTrigger>
            <SelectContent>
              {visibleConnections.map((connection) => (
                <SelectItem key={connection.id} value={connection.id}>
                  {connection.display_name || connection.provider}
                  {connection.card_last_digits ? ` • ****${connection.card_last_digits}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {visibleConnections.length === 0 && <p className="text-xs text-amber-700">{isRtl ? "קודם צור מקור כרטיס עם ארבע ספרות אחרונות בטופס מקורות הכרטיסים." : "First create a card source with its last four digits in the card sources form."}</p>}
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
        <Button variant="outline" size="sm" disabled={!selectedConnection || importing} onClick={() => fileRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" />{isRtl ? "ייבוא CSV / Excel" : "Import CSV / Excel"}
        </Button>
        {isAmex && <Button variant="ghost" size="sm" disabled={importing} onClick={() => {
          const url = URL.createObjectURL(new Blob([AMEX_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }));
          const link = document.createElement("a");
          link.href = url; link.download = "amex-template.csv"; link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>{isRtl ? "הורדת תבנית CSV ריקה" : "Download blank CSV template"}</Button>}
        {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
        {reconciliation.map(check => <p key={check.currency} role="status" className={`rounded-lg border p-3 text-xs ${check.matches ? 'border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'border-amber-300 text-amber-800 dark:text-amber-300'}`}>
          {isRtl ? `בדיקת הדוח המלא (${check.currency}): נקרא ${check.parsed.toFixed(2)}, סיכום בדוח ${check.reported.toFixed(2)}. ${check.matches ? 'הסכומים תואמים.' : 'יש הפרש; בדוק שורות שנדחו לפני האישור.'}` : `Full statement check (${check.currency}): parsed ${check.parsed.toFixed(2)}, reported ${check.reported.toFixed(2)}. ${check.matches ? 'Totals match.' : 'Mismatch; review excluded rows before confirming.'}`}
        </p>)}
        {skippedRows > 0 && <p role="status" className="text-xs text-amber-700">{isRtl
          ? `${skippedRows} שורות לא ייובאו (למשל סיכומים, ביטולים או סכום, תאריך או מטבע חסרים). בדוק מול הפירוט המקורי לפני אישור.`
          : `${skippedRows} rows excluded (such as totals, voids or missing amount, date or currency). Compare with the original statement before confirming.`}</p>}

        {transactions.length > 0 && (
          <div className="space-y-2">
            {fileCard && !selectedConnection && <p className="text-xs text-amber-700">{isRtl ? `הקובץ שייך לכרטיס ••••${fileCard}. צור או בחר את מקור הכרטיס הזה כדי לייבא.` : `This file belongs to card ••••${fileCard}. Create or choose that card source to import.`}</p>}
            {fileCardMismatch && <p className="text-xs text-amber-700">{isRtl ? `הקובץ שייך לכרטיס ••••${fileCard}, ולא לכרטיס שנבחר. בחר את הכרטיס הנכון.` : `This file belongs to card ••••${fileCard}, not the selected card. Choose the matching card.`}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              {fileName && <Badge variant="outline">{fileName}</Badge>}
              <Badge>{selectedRows.length} {t("transactions")}</Badge>
              {providerId && (
                <Badge variant="secondary">
                  {providerId === "amex" ? "American Express" : (financialProviders.find((item) => item.id === providerId)?.nameHe) || providerId}
                </Badge>
              )}
              <Badge variant="outline">
                {isAmex ? (isRtl ? "הוצאות וזיכויים" : "Expenses and credits") : isRtl ? "הוצאות בלבד" : "Expenses only"}
              </Badge>
            </div>
            {cardRows && cardRows.excluded > 0 && <p className="text-xs text-amber-700">{isRtl ? `${cardRows.excluded} שורות של כרטיסים אחרים לא ייובאו.` : `${cardRows.excluded} rows from other cards will be excluded.`}</p>}
            {cardRows && cardRows.unidentified.length > 0 && !fileCard && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-xs">
                <input type="checkbox" checked={confirmUnidentified} onChange={(event) => setConfirmUnidentified(event.target.checked)} className="mt-0.5" />
                <span>{isRtl
                  ? `אני מאשר ש-${cardRows.unidentified.length} השורות ללא מספר כרטיס בקובץ שייכות רק לכרטיס ••••${selectedConnection?.card_last_digits}.`
                  : `I confirm that the ${cardRows.unidentified.length} rows without a card number belong only to card ••••${selectedConnection?.card_last_digits}.`}</span>
              </label>
            )}
            <label className="block space-y-1 rounded-lg border p-3 text-xs">
              <span className="block font-semibold">{isRtl ? "מתי ייפרע החיוב של הפירוט הזה?" : "When will this statement be charged?"}</span>
              <input type="date" value={billingDateChoice} onChange={(event) => { setBillingDateChoice(event.target.value); setDateChanges(null); }} className="h-9 rounded-md border bg-background px-2" dir="ltr" disabled={importing} />
              <span className="block text-muted-foreground">{isRtl
                ? "אפשר לתקן את התאריך שזוהה בקובץ. אם הוא לא ידוע, השאר ריק: ההוצאות ייובאו, אך לא ייווצר חיוב עתידי. תאריכי חיוב מפורשים לכל עסקה נשמרים בנפרד."
                : "You can correct the detected date. Leave it blank if unknown: expenses import without a future charge. Per-transaction due dates remain separate."}</span>
            </label>
            {isAmex ? <AmexStatementPreview rows={selectedRows} isHe={isRtl} onCategoryChange={(row, category) => {
              if (!importing) setTransactions((current) => current.map((item) => item === row ? { ...item, category } : item));
            }} /> : <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {selectedRows.slice(0, 20).map((tx, i) => (
                <div key={i} className="flex items-center justify-between p-2 text-sm">
                  <div>
                    <span className="font-medium">{tx.description}</span>
                    <span className="text-muted-foreground text-xs ml-2">{tx.category || "-"}</span>
                  </div>
                  <span className="font-mono">
                    {tx.direction === "income" ? "+" : "-"}₪{tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
              {selectedRows.length > 20 && (
                <div className="p-2 text-xs text-muted-foreground text-center">+{selectedRows.length - 20} more</div>
              )}
            </div>}
            {dateChanges !== null && <section className="space-y-3 rounded-xl border border-amber-300 p-3" aria-label={isRtl ? "טיוטת עדכון תאריכי חיוב" : "Billing date update draft"}>
              <h4 className="font-semibold">{isRtl ? `עדכון ${dateChanges.length} תאריכי חיוב קיימים` : `Update ${dateChanges.length} existing billing dates`}</h4>
              <p className="text-xs text-muted-foreground">{isRtl ? "רק תאריכי החיוב המוצגים ישתנו. פילוחים, סכומים וקישורי זיכויים יישמרו. עסקאות חדשות בקובץ יתווספו באותו אישור." : "Only the listed billing dates change. Categories, amounts and refund links stay intact. New file transactions are added with the same confirmation."}</p>
              <div className="max-h-56 space-y-2 overflow-auto">{dateChanges.map(change => <div key={change.id} className="rounded-lg bg-muted p-2 text-xs"><strong className="block">{change.description}</strong><span>{isRtl ? "לפני: " : "Before: "}{change.previousDate || (isRtl ? "ללא תאריך" : "No date")} · {isRtl ? "אחרי: " : "After: "}{change.nextDate}</span></div>)}</div>
              <div className="flex flex-wrap gap-2"><Button size="sm" disabled={importing} onClick={() => void importTransactions(true)}>{isRtl ? "אשר עדכון וייבוא" : "Confirm updates and import"}</Button><Button size="sm" variant="outline" disabled={importing} onClick={() => setDateChanges(null)}>{isRtl ? "חזור לבדיקה" : "Back to review"}</Button></div>
            </section>}
            <Button size="sm" onClick={() => void importTransactions()} disabled={importing || selectedRows.length === 0 || dateChanges !== null}>
              {importing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              {t("confirm")} ({selectedRows.length})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CreditCardImport;
