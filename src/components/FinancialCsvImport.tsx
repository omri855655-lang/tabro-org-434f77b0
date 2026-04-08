import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseCSV, detectProvider, financialProviders, type ParsedTransaction } from "@/lib/financialProviders";

const FinancialCsvImport = () => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedTransaction[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState({ imported: 0, skipped: 0 });

  const processText = (text: string) => {
    const { headers: h, rows } = parseCSV(text);
    setHeaders(h);

    const detected = detectProvider(h, rows.slice(0, 3));
    const provider = selectedProvider
      ? financialProviders.find(p => p.id === selectedProvider)
      : detected;

    if (provider) {
      setSelectedProvider(provider.id);
      const transactions = provider.parse(rows, h).filter(t => t.amount > 0);
      setParsed(transactions);
      setStep("preview");
    } else {
      setSelectedProvider("custom");
      const custom = financialProviders.find(p => p.id === "custom")!;
      const transactions = custom.parse(rows, h).filter(t => t.amount > 0);
      setParsed(transactions);
      setStep("preview");
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "xlsx" || ext === "xls") {
      try {
        const { read, utils } = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const wb = read(buffer);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csvText = utils.sheet_to_csv(ws);
        processText(csvText);
      } catch (err) {
        console.error("Excel parse error:", err);
        toast.error(lang === "he" ? "שגיאה בקריאת קובץ Excel" : "Error reading Excel file");
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

  const reparse = (providerId: string) => {
    setSelectedProvider(providerId);
    // Re-read from cached data isn't possible, user needs to re-upload
    // But we can try re-parsing if we stored the raw text
  };

  const doImport = async () => {
    if (!user || parsed.length === 0) return;
    setStep("importing");

    let imported = 0;
    let skipped = 0;

    // Insert in batches of 50
    for (let i = 0; i < parsed.length; i += 50) {
      const batch = parsed.slice(i, i + 50).map(tx => ({
        user_id: user.id,
        source_type: "csv" as string,
        provider: selectedProvider,
        external_transaction_id: tx.external_transaction_id || `csv_${Date.now()}_${i}`,
        transaction_date: tx.transaction_date,
        posted_date: tx.posted_date || null,
        amount: tx.amount,
        currency: tx.currency,
        direction: tx.direction,
        description: tx.description,
        merchant: tx.merchant || null,
        category: tx.category || null,
        installment_total: tx.installment_total || null,
        installment_number: tx.installment_number || null,
        month_key: tx.transaction_date?.substring(0, 7) || null,
        raw_data: tx.raw_data || null,
      }));

      const { data, error } = await supabase
        .from("financial_transactions" as any)
        .upsert(batch as any, { onConflict: "user_id,source_type,external_transaction_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("Import batch error:", error);
        skipped += batch.length;
      } else {
        imported += data?.length || 0;
        skipped += batch.length - (data?.length || 0);
      }
    }

    setImportResult({ imported, skipped });
    setStep("done");
    toast.success(`${imported} ${lang === "he" ? "עסקאות יובאו בהצלחה" : "transactions imported successfully"}`);
  };

  const reset = () => {
    setStep("upload");
    setParsed([]);
    setHeaders([]);
    setFileName("");
    setSelectedProvider("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const isRtl = lang === "he" || lang === "ar";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Upload className="h-4 w-4" />
          {lang === "he" ? "ייבוא עסקאות מ-CSV" : "Import Transactions from CSV"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {step === "upload" && (
          <>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder={lang === "he" ? "בחר ספק (או זיהוי אוטומטי)" : "Select provider (or auto-detect)"} />
              </SelectTrigger>
              <SelectContent>
                {financialProviders.filter(p => p.id !== "custom").map(p => (
                  <SelectItem key={p.id} value={p.id}>{isRtl ? p.nameHe : p.name}</SelectItem>
                ))}
                <SelectItem value="custom">{isRtl ? "CSV מותאם אישית" : "Custom CSV"}</SelectItem>
              </SelectContent>
            </Select>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {lang === "he" ? "לחץ או גרור קובץ CSV / Excel" : "Click or drag a CSV / Excel file"}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt,.xlsx,.xls"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          </>
        )}

        {step === "preview" && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{fileName}</Badge>
                <Badge>{parsed.length} {lang === "he" ? "שורות" : "rows"}</Badge>
              </div>
              <Button size="sm" variant="ghost" onClick={reset}>
                {lang === "he" ? "בחר קובץ אחר" : "Choose another file"}
              </Button>
            </div>

            {/* Preview table */}
            <div className="max-h-[250px] overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-1.5 text-right">{lang === "he" ? "תאריך" : "Date"}</th>
                    <th className="p-1.5 text-right">{lang === "he" ? "תיאור" : "Description"}</th>
                    <th className="p-1.5 text-right">{lang === "he" ? "סכום" : "Amount"}</th>
                    <th className="p-1.5 text-right">{lang === "he" ? "סוג" : "Type"}</th>
                    <th className="p-1.5 text-right">{lang === "he" ? "קטגוריה" : "Category"}</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 20).map((tx, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-1.5">{tx.transaction_date}</td>
                      <td className="p-1.5 max-w-[150px] truncate">{tx.description}</td>
                      <td className={`p-1.5 font-medium ${tx.direction === "income" ? "text-green-600" : "text-red-600"}`}>
                        {tx.direction === "income" ? "+" : "-"}₪{tx.amount.toLocaleString()}
                      </td>
                      <td className="p-1.5">{tx.direction === "income" ? (lang === "he" ? "הכנסה" : "Income") : (lang === "he" ? "הוצאה" : "Expense")}</td>
                      <td className="p-1.5">{tx.category || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 20 && (
                <p className="text-xs text-center py-1 text-muted-foreground">
                  +{parsed.length - 20} {lang === "he" ? "שורות נוספות" : "more rows"}
                </p>
              )}
            </div>

            <Button onClick={doImport} className="w-full gap-2">
              <Upload className="h-4 w-4" />
              {lang === "he" ? `ייבא ${parsed.length} עסקאות` : `Import ${parsed.length} transactions`}
            </Button>
          </>
        )}

        {step === "importing" && (
          <div className="text-center py-6">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-sm text-muted-foreground">
              {lang === "he" ? "מייבא עסקאות..." : "Importing transactions..."}
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-6 space-y-3">
            <Check className="h-8 w-8 mx-auto text-green-600" />
            <div>
              <p className="font-medium">{importResult.imported} {lang === "he" ? "עסקאות יובאו" : "transactions imported"}</p>
              {importResult.skipped > 0 && (
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {importResult.skipped} {lang === "he" ? "כפילויות דולגו" : "duplicates skipped"}
                </p>
              )}
            </div>
            <Button variant="outline" onClick={reset}>
              {lang === "he" ? "ייבא קובץ נוסף" : "Import another file"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FinancialCsvImport;
