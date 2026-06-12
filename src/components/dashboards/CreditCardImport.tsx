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
import { detectProvider, financialProviders, parseCSV, type ParsedTransaction } from "@/lib/financialProviders";
import { importParsedFinancialTransactions, IMPORT_SOURCE_CONNECTION_ID } from "@/lib/financialImport";

type CreditCardConnection = Database["public"]["Tables"]["credit_card_connections"]["Row"];
const CREDIT_CARD_CONNECTIONS_EVENT = "tabro-credit-card-connections-changed";

interface CreditCardImportProps {
  onImported?: () => void | Promise<void>;
}

const CreditCardImport = ({ onImported }: CreditCardImportProps) => {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [providerId, setProviderId] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [connections, setConnections] = useState<CreditCardConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState(IMPORT_SOURCE_CONNECTION_ID);

  const isRtl = lang === "he" || lang === "ar";

  useEffect(() => {
    if (!user) return;

    const loadConnections = async () => {
      const { data, error } = await supabase
        .from("credit_card_connections")
        .select("*")
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

  const processText = (text: string) => {
    const { headers, rows } = parseCSV(text);
    const provider = detectProvider(headers, rows.slice(0, 3)) || financialProviders.find((item) => item.id === "custom");

    if (!provider) {
      setTransactions([]);
      toast.error(isRtl ? "לא זוהה מבנה קובץ נתמך" : "Unsupported file structure");
      return;
    }

    const parsed = provider
      .parse(rows, headers)
      .filter((tx) => tx.amount > 0 && tx.direction === "expense");
    setProviderId(provider.id);
    setTransactions(parsed);

    if (parsed.length === 0) {
      toast.error(isRtl ? "לא נמצאו הוצאות בקובץ" : "No expense transactions found in file");
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
      const selectedConnection = connections.find((connection) => connection.id === selectedConnectionId);
      const result = await importParsedFinancialTransactions({
        userId: user.id,
        parsed: transactions,
        provider: selectedConnection?.provider || providerId || "credit-card",
        sourceType: "credit_card_import",
        sourceConnectionId: selectedConnection?.id || IMPORT_SOURCE_CONNECTION_ID,
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
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {isRtl
              ? "הייבוא שומר הוצאות אשראי בלבד, כדי לנתח הוצאה אמיתית ולא לערבב הכנסות."
              : "This import keeps expense rows only so your budget reflects real card spending."}
          </p>
          <Select value={selectedConnectionId} onValueChange={setSelectedConnectionId}>
            <SelectTrigger className="text-sm">
              <SelectValue
                placeholder={isRtl ? "בחר מקור כרטיס לשיוך הייבוא" : "Choose a card source for this import"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={IMPORT_SOURCE_CONNECTION_ID}>
                {isRtl ? "כרטיס כללי / ללא שיוך" : "Generic card / unassigned"}
              </SelectItem>
              {connections.map((connection) => (
                <SelectItem key={connection.id} value={connection.id}>
                  {connection.display_name || connection.provider}
                  {connection.card_last_digits ? ` • ****${connection.card_last_digits}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              <Badge variant="outline">
                {isRtl ? "הוצאות בלבד" : "Expenses only"}
              </Badge>
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
