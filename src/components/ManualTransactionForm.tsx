import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { autoCategorize } from "@/lib/financialProviders";

const CATEGORIES_MAP: Record<string, { he: string; en: string }> = {
  groceries: { he: "סופר", en: "Groceries" },
  food: { he: "אוכל", en: "Food" },
  fuel: { he: "דלק", en: "Fuel" },
  transport: { he: "תחבורה", en: "Transport" },
  shopping: { he: "קניות", en: "Shopping" },
  health: { he: "בריאות", en: "Health" },
  bills: { he: "חשבונות", en: "Bills" },
  salary: { he: "משכורת", en: "Salary" },
  entertainment: { he: "בילויים", en: "Entertainment" },
  insurance: { he: "ביטוחים", en: "Insurance" },
  education: { he: "חינוך", en: "Education" },
  savings: { he: "חיסכון", en: "Savings" },
  other: { he: "אחר", en: "Other" },
};

const ManualTransactionForm = () => {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [direction, setDirection] = useState<"income" | "expense">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const isRtl = lang === "he" || lang === "ar";

  const handleSubmit = async () => {
    if (!user || !description.trim() || !amount) return;
    setSaving(true);

    const { error } = await supabase.from("financial_transactions" as any).insert({
      user_id: user.id,
      source_type: "manual",
      direction,
      description: description.trim(),
      merchant: merchant.trim() || null,
      amount: Math.abs(parseFloat(amount)),
      currency: "ILS",
      category: category || autoCategorize(description) || null,
      transaction_date: date,
      month_key: date.substring(0, 7),
      external_transaction_id: `manual_${Date.now()}`,
    } as any);

    setSaving(false);
    if (error) {
      toast.error(isRtl ? "שגיאה בהוספה" : "Error adding transaction");
      return;
    }

    toast.success(direction === "income"
      ? (isRtl ? "הכנסה נוספה ✅" : "Income added ✅")
      : (isRtl ? "הוצאה נוספה ✅" : "Expense added ✅"));
    setDescription("");
    setAmount("");
    setCategory("");
    setMerchant("");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {isRtl ? "הוספת עסקה ידנית" : "Add Manual Transaction"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={direction === "income" ? "default" : "outline"}
            className={`gap-2 ${direction === "income" ? "bg-green-600 hover:bg-green-700" : ""}`}
            onClick={() => setDirection("income")}
          >
            <TrendingUp className="h-4 w-4" />
            {isRtl ? "הכנסה" : "Income"}
          </Button>
          <Button
            variant={direction === "expense" ? "default" : "outline"}
            className={`gap-2 ${direction === "expense" ? "bg-red-600 hover:bg-red-700" : ""}`}
            onClick={() => setDirection("expense")}
          >
            <TrendingDown className="h-4 w-4" />
            {isRtl ? "הוצאה" : "Expense"}
          </Button>
        </div>

        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={isRtl ? "תיאור העסקה" : "Transaction description"}
        />
        <Input
          value={merchant}
          onChange={e => setMerchant(e.target.value)}
          placeholder={isRtl ? "שם בית עסק (אופציונלי)" : "Merchant name (optional)"}
        />
        <Input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={isRtl ? "סכום" : "Amount"}
          dir="ltr"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue placeholder={isRtl ? "בחר קטגוריה" : "Choose category"} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORIES_MAP).map(([key, labels]) => (
              <SelectItem key={key} value={key}>{isRtl ? labels.he : labels.en}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} dir="ltr" />

        <Button onClick={handleSubmit} disabled={saving || !description.trim() || !amount} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          {saving ? (isRtl ? "שומר..." : "Saving...") : (isRtl ? "הוסף עסקה" : "Add Transaction")}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ManualTransactionForm;
