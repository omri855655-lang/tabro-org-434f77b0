import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

type DashboardType = "payments" | "shopping" | "nutrition" | "books" | "shows";

const SAMPLE_DATA: Record<DashboardType, { label: string; generator: (userId: string) => Promise<void> }> = {
  payments: {
    label: "תשלומים לדוגמא",
    generator: async (userId) => {
      const items = [
        { title: "משכורת", amount: 15000, payment_type: "income", category: "משכורת", recurring: true, paid: true },
        { title: "שכירות", amount: 4500, payment_type: "expense", category: "דיור", recurring: true, paid: true },
        { title: "חשמל", amount: 350, payment_type: "expense", category: "חשבונות", recurring: true, paid: false },
        { title: "סופר", amount: 1200, payment_type: "expense", category: "אוכל", recurring: false, paid: true },
        { title: "דלק", amount: 400, payment_type: "expense", category: "תחבורה", recurring: false, paid: true },
        { title: "ביטוח בריאות", amount: 250, payment_type: "expense", category: "ביטוחים", recurring: true, paid: true },
        { title: "נטפליקס", amount: 50, payment_type: "expense", category: "בילויים", recurring: true, paid: true },
        { title: "פרילנס", amount: 3000, payment_type: "income", category: "פרילנס", recurring: false, paid: true },
        { title: "ארנונה", amount: 600, payment_type: "expense", category: "חשבונות", recurring: true, paid: false },
        { title: "חיסכון חודשי", amount: 2000, payment_type: "expense", category: "חיסכון", recurring: true, paid: true },
      ];
      await supabase.from("payment_tracking").insert(items.map(i => ({ ...i, user_id: userId })));
    },
  },
  shopping: {
    label: "קניות לדוגמא",
    generator: async (userId) => {
      const items = [
        { title: "חלב", category: "מוצרי חלב", quantity: "2 ליטר", status: "לקנות" },
        { title: "לחם", category: "לחם ומאפים", quantity: "1 יח'", status: "לקנות" },
        { title: "עגבניות", category: "ירקות ופירות", quantity: "1 ק״ג", status: "לקנות" },
        { title: "ביצים", category: "מוצרי חלב", quantity: "תריסר", status: "לקנות" },
        { title: "אורז", category: "שימורים", quantity: "1 ק״ג", status: "לקנות" },
        { title: "סבון כלים", category: "ניקיון", quantity: "1 בקבוק", status: "לקנות" },
      ];
      await supabase.from("shopping_items").insert(items.map(i => ({ ...i, user_id: userId, sheet_name: "ראשי" })));
    },
  },
  nutrition: {
    label: "ארוחות לדוגמא",
    generator: async (userId) => {
      const today = new Date().toISOString().split("T")[0];
      const meals = [
        { meal_type: "ארוחת בוקר", calories: 450, food_items: JSON.stringify(["ביצים", "לחם מלא", "אבוקדו", "קפה"]), log_date: today },
        { meal_type: "ארוחת צהריים", calories: 650, food_items: JSON.stringify(["חזה עוף", "אורז", "סלט ירקות"]), log_date: today },
        { meal_type: "ארוחת ערב", calories: 400, food_items: JSON.stringify(["סלמון", "ירקות מאודים", "קינואה"]), log_date: today },
      ];
      await supabase.from("nutrition_tracking").insert(meals.map(m => ({ ...m, user_id: userId })));
    },
  },
  books: {
    label: "ספרים לדוגמא",
    generator: async (userId) => {
      const books = [
        { title: "אטומיק הביטס", author: "ג'יימס קליר", status: "לקרוא" },
        { title: "חשיבה מהירה ואיטית", author: "דניאל כהנמן", status: "בקריאה" },
        { title: "21 לקחים למאה ה-21", author: "יובל נח הררי", status: "נקרא" },
        { title: "הכוח של עכשיו", author: "אקהרט טולה", status: "לקרוא" },
        { title: "Deep Work", author: "קאל ניופורט", status: "לקרוא" },
      ];
      await supabase.from("books").insert(books.map(b => ({ ...b, user_id: userId })));
    },
  },
  shows: {
    label: "סדרות לדוגמא",
    generator: async (userId) => {
      const shows = [
        { title: "Breaking Bad", type: "סדרה", status: "נצפה", current_season: 5, current_episode: 16 },
        { title: "The Bear", type: "סדרה", status: "בצפייה", current_season: 2, current_episode: 5 },
        { title: "אופנהיימר", type: "סרט", status: "לצפות" },
        { title: "Severance", type: "סדרה", status: "לצפות" },
      ];
      await supabase.from("shows").insert(shows.map(s => ({ ...s, user_id: userId })));
    },
  },
};

interface SampleDataImportProps {
  type: DashboardType;
  size?: "sm" | "default";
}

const SampleDataImport = ({ type, size = "sm" }: SampleDataImportProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const config = SAMPLE_DATA[type];

  const handleImport = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await config.generator(user.id);
      toast.success("נתוני דוגמא יובאו בהצלחה! 🎉");
    } catch {
      toast.error("שגיאה בייבוא הנתונים");
    }
    setLoading(false);
  };

  return (
    <Button variant="outline" size={size} onClick={handleImport} disabled={loading} className="gap-1.5 text-xs">
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      {config.label}
    </Button>
  );
};

export default SampleDataImport;
