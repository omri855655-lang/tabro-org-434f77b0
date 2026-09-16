import { useEffect, useRef, useState } from "react";
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
import { importParsedFinancialTransactions } from "@/lib/financialImport";

type CreditCardConnection = Pick<Database["public"]["Tables"]["credit_card_connections"]["Row"],
  "id" | "provider" | "display_name" | "card_last_digits">;
const CREDIT_CARD_CONNECTIONS_EVENT = "tabro-credit-card-connections-changed";

interface CreditCardImportProps {
  onImported?: () => void | Promise<void>;
  suggestedBillingDayForCard?: (card: CreditCardConnection) => number | undefined;
}

const CreditCardImport = ({ onImported, suggestedBillingDayForCard }: CreditCardImportProps) => {
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

  const isRtl = lang === "he" || lang === "ar";

  useEffect(() => {
    if (!user) return;

    const loadConnections = async () => {
      const { data, error } = await supabase
        .from("credit_card_connections")
        .select("id,provider,display_name,card_last_digits")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error) {
        setConnections(data || []);
      }
    };

    loadConnections();

    const handleConnectionsChanged = () => {
      loadConnections();
    };

    window.addEventListener(CREDIT_CARD_CONNECTIONS_EVENT, handleConnectionsChanged);
    return () => window.removeEventListener(CREDIT_CARD_CONNECTIONS_EVENT, handleConnectionsChanged);
  }, [user]);

  const processText = (text: string, name: string) => {
    const { headers, rows, preamble } = findStatementTable(parseCSV(text));
    const provider = detectProvider(headers, rows.slice(0, 3)) || financialProviders.find((item) => item.id === "custom");

    if (!provider) {
      setTransactions([]);
      toast.error(isRtl ? "לא זוהה מבנה קובץ נתמך" : "Unsupported file structure");
      return;
    }

    const providerRows = provider.parse(rows, headers);
    const fileCard = statementFileCardLastFour(name);
    const source = connections.find((connection) => connection.card_last_digits === fileCard)
      || connections.find((connection) => connection.id === selectedConnectionId);
    const preferredDay = source && suggestedBillingDayForCard?.(source);
    const latestPurchase = providerRows.map((row) => row.transaction_date).filter(Boolean).sort().at(-1);
    const suggestedDate = preferredDay
      ? nextCsvBillingEstimateDate(latestPurchase || format(new Date(), "yyyy-MM-dd"), preferredDay)
      : "";
    setBillingDateChoice(statementBillingDate(preamble, providerRows, name) || suggestedDate);
    const parsed = statementRows(providerRows);
    setProviderId(provider.id);
    setTransactions(parsed);
    setConfirmUnidentified(false);

    if (parsed.length === 0) {
      toast.error(isRtl ? "לא נמצאו הוצאות עם סכום חיוב בשקלים בקובץ" : "No expenses with an ILS billing amount were found");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const fileCard = statementFileCardLastFour(file.name);
    const matchingConnection = connections.find((connection) => connection.card_last_digits === fileCard);
    if (matchingConnection) setSelectedConnectionId(matchingConnection.id);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      try {
        const { read, utils } = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = read(buffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const csvText = utils.sheet_to_csv(worksheet);
        processText(csvText, file.name);
      } catch (error) {
        console.error("Credit card excel parse error:", error);
        toast.error(isRtl ? "שגיאה בקריאת קובץ Excel" : "Error reading Excel file");
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      processText(text, file.name);
    };
    reader.readAsText(file, "UTF-8");
  };

  const importTransactions = async () => {
    const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId);
    if (!user || !selectedConnection?.card_last_digits || !selectedRows.length) return;
    setImporting(true);

    try {
      const result = await importParsedFinancialTransactions({
        userId: user.id,
        parsed: sanitizeStatementRows(applyStatementBillingDate(selectedRows, billingDateChoice)),
        provider: selectedConnection.provider,
        sourceType: "credit_card_import",
        sourceConnectionId: selectedConnection.id,
        accountExternalId: `csv-card:${selectedConnection.id}`,
      });

      await onImported?.();
      toast.success(
        isRtl
          ? `${result.imported} הוצאות אשראי נשמרו`
          : `${result.imported} credit card transactions saved`,
      );
      setTransactions([]);
      setProviderId("");
      setFileName("");
      setConfirmUnidentified(false);
      setBillingDateChoice("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      console.error("Credit card import error:", error);
      toast.error(isRtl ? "שגיאה בייבוא פירוט האשראי" : "Error importing credit card statement");
    } finally {
      setImporting(false);
    }
  };

  const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId);
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
          {t("importCreditCard")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {isRtl
              ? "בחר את הכרטיס המדויק. ייובאו רק הוצאות שלו עם סכום חיוב בשקלים; רק מועד פירעון שתאשר ייצור חיוב עתידי בתחזית."
              : "Choose the exact card. Only its expenses with an ILS billing amount are imported; a future charge needs a confirmed payment date."}
          </p>
          <Select value={selectedConnectionId} onValueChange={(value) => { setSelectedConnectionId(value); setConfirmUnidentified(false); }}>
            <SelectTrigger className="text-sm">
              <SelectValue
                placeholder={isRtl ? "בחר מקור כרטיס לשיוך הייבוא" : "Choose a card source for this import"}
              />
            </SelectTrigger>
            <SelectContent>
              {connections.map((connection) => (
                <SelectItem key={connection.id} value={connection.id}>
                  {connection.display_name || connection.provider}
                  {connection.card_last_digits ? ` • ****${connection.card_last_digits}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {connections.length === 0 && <p className="text-xs text-amber-700">{isRtl ? "קודם צור מקור כרטיס עם ארבע ספרות אחרונות למעלה." : "First create a card source with its last four digits above."}</p>}
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" />{isRtl ? "ייבוא CSV / Excel" : "Import CSV / Excel"}
        </Button>

        {transactions.length > 0 && (
          <div className="space-y-2">
            {fileCard && !selectedConnection && <p className="text-xs text-amber-700">{isRtl ? `הקובץ שייך לכרטיס ••••${fileCard}. צור או בחר את מקור הכרטיס הזה כדי לייבא.` : `This file belongs to card ••••${fileCard}. Create or choose that card source to import.`}</p>}
            {fileCardMismatch && <p className="text-xs text-amber-700">{isRtl ? `הקובץ שייך לכרטיס ••••${fileCard}, ולא לכרטיס שנבחר. בחר את הכרטיס הנכון.` : `This file belongs to card ••••${fileCard}, not the selected card. Choose the matching card.`}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              {fileName && <Badge variant="outline">{fileName}</Badge>}
              <Badge>{selectedRows.length} {t("transactions")}</Badge>
              {providerId && (
                <Badge variant="secondary">
                  {(financialProviders.find((item) => item.id === providerId)?.nameHe) || providerId}
                </Badge>
              )}
              <Badge variant="outline">
                {isRtl ? "הוצאות בלבד" : "Expenses only"}
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
              <input type="date" value={billingDateChoice} onChange={(event) => setBillingDateChoice(event.target.value)} className="h-9 rounded-md border bg-background px-2" dir="ltr" />
              <span className="block text-muted-foreground">{isRtl
                ? "אפשר לתקן את התאריך שזוהה בקובץ. אם הוא לא ידוע, השאר ריק: ההוצאות ייובאו, אך לא ייווצר חיוב עתידי. תאריכי חיוב מפורשים לכל עסקה נשמרים בנפרד."
                : "You can correct the detected date. Leave it blank if unknown: expenses import without a future charge. Per-transaction due dates remain separate."}</span>
            </label>
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
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
            </div>
            <Button size="sm" onClick={importTransactions} disabled={importing || selectedRows.length === 0}>
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
