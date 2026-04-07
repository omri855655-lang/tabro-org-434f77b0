import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ParsedTransaction {
  date: string;
  title: string;
  amount: number;
  category?: string;
}

const CreditCardImport = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [importing, setImporting] = useState(false);

  const parseCSV = (text: string): ParsedTransaction[] => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    
    const results: ParsedTransaction[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) continue;
      
      const dateStr = cols[0];
      const title = cols[1];
      const amountStr = cols[2]?.replace(/[^\d.-]/g, '');
      const amount = parseFloat(amountStr);
      
      if (!isNaN(amount) && title) {
        results.push({ date: dateStr, title, amount: Math.abs(amount), category: guessCategory(title) });
      }
    }
    return results;
  };

  const guessCategory = (title: string): string => {
    const lower = title.toLowerCase();
    const rules: [string[], string][] = [
      [['סופר', 'שופרסל', 'רמי לוי', 'מגה', 'יוחננוף', 'חצי חינם', 'פרש', 'שוק'], 'סופר'],
      [['פז', 'סונול', 'דלק', 'דור אלון', 'ten', 'yellow'], 'דלק'],
      [['מסעדה', 'קפה', 'פיצה', 'בורגר', 'סושי', 'wolt', 'מיסטר'], 'אוכל'],
      [['חשמל', 'חברת חשמל'], 'חשמל'],
      [['מים', 'מקורות', 'תאגיד'], 'מים'],
      [['ביטוח', 'הראל', 'מגדל', 'כלל', 'הפניקס', 'מנורה'], 'ביטוחים'],
      [['בזק', 'פרטנר', 'סלקום', 'הוט', 'yes'], 'טלפון'],
      [['zara', 'h&m', 'fox', 'golf', 'castro', 'shein'], 'קניות'],
    ];
    for (const [keywords, cat] of rules) {
      if (keywords.some(k => lower.includes(k))) return cat;
    }
    return 'אחר';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      setTransactions(parsed);
      if (parsed.length === 0) toast.error("לא נמצאו עסקאות בקובץ");
    };
    reader.readAsText(file, 'UTF-8');
  };

  const importTransactions = async () => {
    if (!user || transactions.length === 0) return;
    setImporting(true);
    try {
      const rows = transactions.map(tx => ({
        user_id: user.id,
        title: tx.title,
        amount: tx.amount,
        category: tx.category || null,
        payment_type: 'expense',
        payment_method: 'credit_card',
        due_date: tx.date || null,
        paid: true,
        sheet_name: 'ראשי',
      }));
      
      const { error } = await supabase.from("payment_tracking").insert(rows as any);
      if (error) throw error;
      toast.success(`${transactions.length} ${t('transactions')} imported`);
      setTransactions([]);
    } catch (e: any) {
      toast.error(t('syncError'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {t('importCreditCard')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3 w-3 mr-1" />{t('importCSV')}
        </Button>

        {transactions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{transactions.length} {t('transactions')}</p>
            <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
              {transactions.slice(0, 20).map((tx, i) => (
                <div key={i} className="flex items-center justify-between p-2 text-sm">
                  <div>
                    <span className="font-medium">{tx.title}</span>
                    <span className="text-muted-foreground text-xs ml-2">{tx.category}</span>
                  </div>
                  <span className="font-mono">₪{tx.amount.toFixed(2)}</span>
                </div>
              ))}
              {transactions.length > 20 && (
                <div className="p-2 text-xs text-muted-foreground text-center">+{transactions.length - 20} more</div>
              )}
            </div>
            <Button size="sm" onClick={importTransactions} disabled={importing}>
              {importing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              {t('confirm')} ({transactions.length})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CreditCardImport;
