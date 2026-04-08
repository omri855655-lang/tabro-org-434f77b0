import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { detectProvider, financialProviders, parseCSV, type ParsedTransaction } from "@/lib/financialProviders";
import { importParsedFinancialTransactions, IMPORT_SOURCE_CONNECTION_ID } from "@/lib/financialImport";

const CreditCardImport = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [providerId, setProviderId] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const isRtl = lang === "he" || lang === "ar";

  const processText = (text: string) => {
    const { headers, rows } = parseCSV(text);
    const provider = detectProvider(headers, rows.slice(0, 3)) || financialProviders.find((item) => item.id === "custom");

    if (!provider) {
      setTransactions([]);
      toast.error(isRtl ? "לא זוהה מבנה קובץ נתמך" : "Unsupported file structure");
      return;
    }

    const parsed = provider.parse(rows, headers).filter((tx) => tx.amount > 0);
    setProviderId(provider.id);
    setTransactions(parsed);

    if (parsed.length === 0) {
      toast.error(isRtl ? "לא נמצאו עסקאות בקובץ" : "No transactions found in file");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      try {
        const { read, utils } = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = read(buffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const csvText = utils.sheet_to_csv(worksheet);
        processText(csvText);
      } catch (error) {
        console.error("Credit card excel parse error:", error);
        toast.error(isRtl ? "שגיאה בקריאת קובץ Excel" : "Error reading Excel file");
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      processText(text);
    };
    reader.readAsText(file, "UTF-8");
  };

  const importTransactions = async () => {
    if (!user || transactions.length === 0) return;
    setImporting(true);

    try {
      const result = await importParsedFinancialTransactions({
        userId: user.id,
        parsed: transactions,
        provider: providerId || "credit-card",
        sourceType: "credit_card_import",
        sourceConnectionId: IMPORT_SOURCE_CONNECTION_ID,
      });

      toast.success(
        isRtl
          ? `${result.imported} עסקאות אשראי נשמרו`
          : `${result.imported} credit card transactions saved`,
      );
      setTransactions([]);
      setProviderId("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      console.error("Credit card import error:", error);
      toast.error(isRtl ? "שגיאה בייבוא פירוט האשראי" : "Error importing credit card statement");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {t("importCreditCard")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" />{isRtl ? "ייבוא CSV / Excel" : "Import CSV / Excel"}
        </Button>

        {transactions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {fileName && <Badge variant="outline">{fileName}</Badge>}
              <Badge>{transactions.length} {t("transactions")}</Badge>
              {providerId && (
                <Badge variant="secondary">
                  {(financialProviders.find((item) => item.id === providerId)?.nameHe) || providerId}
                </Badge>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {transactions.slice(0, 20).map((tx, i) => (
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
              {transactions.length > 20 && (
                <div className="p-2 text-xs text-muted-foreground text-center">+{transactions.length - 20} more</div>
              )}
            </div>
            <Button size="sm" onClick={importTransactions} disabled={importing}>
              {importing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              {t("confirm")} ({transactions.length})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CreditCardImport;
