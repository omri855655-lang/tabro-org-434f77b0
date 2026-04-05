import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShoppingCart, Star, Check, Archive, Sparkles, MessageCircle, Users, ShoppingBasket, History, RotateCcw, Recycle, Download } from "lucide-react";
import { exportToExcel } from "@/lib/exportToExcel";
import { toast } from "sonner";
import { useDashboardChatHistory } from "@/hooks/useDashboardChatHistory";
import AutocompleteInput from "@/components/AutocompleteInput";
import ShoppingShareDialog from "@/components/dashboards/ShoppingShareDialog";
import AiChatPanel from "@/components/AiChatPanel";
import DashboardDisplayToolbar from "@/components/DashboardDisplayToolbar";
import { useDashboardDisplay } from "@/hooks/useDashboardDisplay";

interface ShoppingItem {
  id: string;
  title: string;
  category: string | null;
  quantity: string | null;
  price: number | null;
  status: string;
  notes: string | null;
  sheet_name: string;
  priority: string | null;
  is_dream: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

const SUPERMARKET_CATEGORIES = ["ירקות ופירות", "מוצרי חלב", "בשר ודגים", "לחם ומאפים", "שימורים", "חטיפים ומתוקים", "משקאות", "ניקיון", "היגיינה", "קפואים", "תבלינים", "אחר"];

const QUANTITY_UNITS = ["יח'", "ק״ג", "גרם", "ליטר", "מ״ל", "חבילה", "שקית", "קופסה", "בקבוק", "תריסר"];

const CATEGORY_ITEMS: Record<string, string[]> = {
  "ירקות ופירות": [
    "עגבניות", "מלפפונים", "בצל", "תפוחי אדמה", "גזר", "פלפלים", "חסה", "אבוקדו", "בננות", "תפוחים",
    "תפוזים", "לימון", "אננס", "ענבים", "אפרסקים", "שזיפים", "מנגו", "כוסברה", "פטרוזיליה", "שום",
    "חציל", "קישוא", "ברוקולי", "כרובית", "תרד", "רוקט", "סלרי", "צנונית", "בטטה", "דלעת",
    "פטריות", "שעועית ירוקה", "אפונה טרייה", "אספרגוס", "ארטישוק", "קולורבי", "חזרת", "ג'ינג'ר", "נענע", "בזיליקום",
    "רימון", "אשכולית", "קלמנטינה", "פסיפלורה", "ליצ'י", "אגס", "קיווי", "פטל", "אוכמניות", "תות שדה",
    "דובדבנים", "אבטיח", "מלון", "חבוש", "סברס", "תמרים", "תאנים"
  ],
  "מוצרי חלב": [
    "חלב", "גבינה לבנה", "גבינה צהובה", "קוטג'", "שמנת", "יוגורט", "חמאה", "ביצים", "שוקו", "לבנה",
    "גבינת שמנת", "מוצרלה", "פרמזן", "ריקוטה", "גבינת עיזים", "חלב סויה", "חלב שקדים", "חלב שיבולת שועל",
    "שמנת מתוקה", "שמנת חמוצה", "אשל", "פודינג", "מעדן", "גבינת צפתית", "גבינת בולגרית",
    "חלב ללא לקטוז", "יוגורט יווני", "גבינת חלומי", "גבינת פטה", "גבינת גאודה",
    "ביצים חופש", "ביצי שליו", "ביצים אורגניות", "קפיר", "שמנת לבישול", "פלנרוזה",
    "טופו", "גבינת עמק", "גבינת גליל", "דניאל", "יופלה", "אקטיביה", "פרילי", "גבינת קממבר",
    "חלב מועשר", "חלב 1%", "חלב 3%", "חלב מלא", "שוקו בננה", "שוקו מוקה"
  ],
  "בשר ודגים": [
    "חזה עוף", "שניצל", "בשר טחון", "סטייק", "נקניקיות", "סלמון", "טונה", "דג אמנון", "שוקיים", "כנפיים",
    "פרגית", "כבד עוף", "קציצות", "המבורגר", "פילה דג", "דג דניס", "דג ברמונדי", "שרימפס",
    "בשר צלעות", "אנטריקוט", "צוואר כבש", "כתף כבש", "חזה הודו", "נקניק מרגז",
    "פסטרמה", "סלמי", "ג'מבון", "טונה טרייה", "דג בורי", "נתחי סלמון", "פילה סול",
    "עוף שלם", "ירכי עוף", "עוף מעושן", "הודו מעושן", "קבב", "שישליק", "שווארמה",
    "בשר בקר טחון", "אסאדו", "צלי בקר", "נתחי חזה", "עוף קפוא", "דגיגונים",
    "קלמרי", "פילה מושט", "דג לברק", "נקניקיות עוף", "קציצות דגים", "ג'חנון בשרי"
  ],
  "לחם ומאפים": [
    "לחם לבן", "לחם מלא", "פיתות", "חלה", "לחמניות", "טורטיה", "בייגלה", "קרואסון",
    "לחם שיפון", "לחם כוסמין", "לחם דל פחמימות", "מאפינס", "פוקאצ'ה", "ג'בטה", "לחם חלב",
    "בורקס", "סמבוסק", "מלאווח", "ג'חנון", "קובנה", "עוגיות חמאה", "עוגיות שוקולד צ'יפס",
    "לחם תירס", "לחם אורגני", "לחם ללא גלוטן", "בגט", "ברול", "פרנה",
    "לחם שום", "פיצה אישית", "קלצונה", "עוגת שמרים", "רוגלך", "שטרודל",
    "כיסונים", "פרנה מרוקאית", "לחם מקמח מלא", "לחם דגנים", "באגט צרפתי", "פיתה דרוזית",
    "לחם שיפון כהה", "לאפה", "בריוש", "סופגנייה", "דונאט", "חלה ממולאת", "מפרום", "ספינג'"
  ],
  "שימורים": [
    "טונה בפחית", "תירס", "זיתים", "חומוס", "רסק עגבניות", "שימורי ירקות", "אפונה",
    "שעועית לבנה", "שעועית אדומה", "עדשים", "חמוצים", "מלפפון חמוץ", "פלפל קלוי",
    "עגבניות מרוסקות", "עגבניות שלמות קלופות", "פטריות שימורים", "ארטישוק שימורים",
    "קפרס", "אנשובי", "סרדינים", "מקרל", "רוטב עגבניות", "רוטב פסטה",
    "משחת עגבניות", "במבה בפחית", "קרנצ'יט", "תמר הינדי", "חרוסת", "ממרח חציל",
    "טחינה מוכנה", "חומוס מוכן", "פול מדמס", "לובייה", "תפוחי עץ שימורים",
    "דובדבני מרשינו", "אננס שימורים", "אפרסקים שימורים", "קומפוט", "ריבת תות",
    "ריבת חלב", "דבש", "סילאן", "חלבה", "ממרח שוקולד", "חמאת בוטנים",
    "חמאת שקדים", "טונה בשמן", "טונה במים", "טונה ברוטב", "זיתי קלמטה"
  ],
  "חטיפים ומתוקים": [
    "שוקולד", "ביסלי", "במבה", "עוגיות", "גלידה", "דובונים", "צ'יפס", "אגוזים", "חטיף אנרגיה",
    "שוקולד מריר", "שוקולד חלב", "שוקולד לבן", "ופלים", "מרשמלו", "סוכריות", "פופקורן",
    "קרקרים", "בייגלה פריך", "פריטלים", "טפוצ'יפס", "דוריטוס", "שקדי מרק",
    "בוטנים", "קשיו", "שקדים", "אגוזי מלך", "פיסטוק", "חמוציות", "צימוקים",
    "גרנולה", "חטיפי גרנולה", "שוקוריקו", "קינדר", "סניקרס", "מארס",
    "פרינגלס", "טוויגים", "ציפס אהוי", "תפוצ'י בצל", "עמבה צ'יפס",
    "עוגיות אוראו", "חטיף חלבה", "חלווה", "מציות", "קרמבו", "שוקובון",
    "סוכריות גומי", "מסטיק", "סוכריות רכות", "קולה חמוצה", "בנד"
  ],
  "משקאות": [
    "מים מינרליים", "קולה", "מיץ תפוזים", "בירה", "יין", "סודה", "קפה", "תה",
    "מיץ ענבים", "מיץ תפוחים", "מיץ אשכולית", "מיץ גזר", "מיץ לימון", "מיץ רימון",
    "פנטה", "ספרייט", "שוופס", "XL", "רד בול", "פריגת", "מיץ טרופי",
    "תה ירוק", "תה שחור", "תה קמומיל", "תה נענע", "קפה טורקי", "קפה נמס",
    "קפסולות קפה", "חלב שוקולד", "מילקשייק", "סמוזי", "מים בטעמים",
    "יין אדום", "יין לבן", "יין רוזה", "בירה כהה", "בירה ללא אלכוהול",
    "וודקה", "ויסקי", "ג'ין", "רום", "ליקר", "ערק", "משקה אנרגיה",
    "מיץ פטל", "לימונענע", "קומבוצ'ה", "מים מוגזים", "טוניק"
  ],
  "ניקיון": [
    "אקונומיקה", "סבון כלים", "מרכך כביסה", "אבקת כביסה", "מגבונים", "שקיות זבל", "ניקוי רצפה",
    "נוזל כביסה", "ניקוי חלונות", "ניקוי שירותים", "ספוגים", "מטליות", "נייר סופג",
    "מטאטא", "מגב", "אבקת ניקוי", "ג'ל ניקוי", "מרכך בדים", "תרסיס ניקוי",
    "ניקוי שמנים", "מסיר אבנית", "מסיר עובש", "מטהר אוויר", "נרות ריחניים",
    "שקיות ואקום", "כפפות חד פעמיות", "מסכות", "נוזל ידיים אנטיבקטריאלי",
    "קולב כביסה", "דלי", "מברשת אסלה", "אבקת מדיח", "טבליות למדיח",
    "סבון רצפות", "כלור", "ניקוי תנור", "מגבות מטבח", "ניילון נצמד",
    "נייר אלומיניום", "שקיות סנדוויץ'", "שקיות אשפה גדולות", "פלסטיק למיקרו",
    "שמן לניקוי", "חומר ניקוי רב-שימושי", "שטיח לאמבטיה", "וילון מקלחת",
    "ברז מסנן", "מסנן מים"
  ],
  "היגיינה": [
    "סבון ידיים", "שמפו", "מברשת שיניים", "משחת שיניים", "דאודורנט", "נייר טואלט", "טישו",
    "מי פה", "חוט דנטלי", "קרם לחות", "קרם שיזוף", "ג'ל רחצה", "קצף גילוח",
    "סכיני גילוח", "תחבושות", "פלסטרים", "כדורי כביסה ריחניים", "בושם",
    "מברשת שיער", "גומיות לשיער", "מסרק", "לק", "אצטון", "תחליב גוף",
    "שמן גוף", "קרם ידיים", "קרם רגליים", "מסכת פנים", "פילינג",
    "מזלג ציפורניים", "פצירה", "מקלות אוזניים", "כרית חמה", "מדחום",
    "ויטמינים", "משככי כאבים", "אופמול", "נורופן", "אקמול", "טיפות עיניים",
    "טיפות אף", "קרם פצעים", "ג'ל אלוורה", "שמן עץ התה", "קרם אנטי-אייג'ינג",
    "סרום פנים", "שמפו ילדים", "סבון ילדים", "חיתולים", "מגבונים לתינוק"
  ],
  "קפואים": [
    "פיצה קפואה", "ירקות קפואים", "שניצלים קפואים", "גלידה", "בצק עלים", "המבורגר קפוא",
    "פירות קפואים", "קוביות בצל", "שום קפוא", "תרד קפוא", "אפונה קפואה", "שעועית קפואה",
    "בורקס קפוא", "סמבוסק קפוא", "קרפ קפוא", "בלינצ'ס קפואים", "ספרינג רולס",
    "נגיסי עוף", "פינגרס עוף", "דגיגונים קפואים", "פילה דג קפוא", "שרימפס קפואים",
    "לחם קפוא", "חלות קפואות", "מאפים קפואים", "עוגה קפואה", "פנקייק קפוא",
    "תפוחי אדמה קפואים", "צ'יפס קפוא", "ירקות מוקפצים", "אורז קפוא מוכן",
    "פסטה קפואה מוכנה", "לזניה קפואה", "מרק קפוא", "ג'חנון קפוא", "מלאווח קפוא",
    "סופגניות קפואות", "רוגלך קפוא", "קנלוני קפוא", "גלידת סורבה", "ארטיק",
    "שלגון", "מגנום", "קרטיב", "גלידת יוגורט", "פירות יער קפואים",
    "ברוקולי קפוא", "כרובית קפואה", "עדשים קפואים"
  ],
  "תבלינים": [
    "מלח", "פלפל שחור", "פפריקה", "כורכום", "שום אבקה", "בצל אבקה", "קינמון", "שמן זית", "חומץ",
    "כמון", "קרדמון", "ציפורן", "אגוז מוסקט", "ג'ינג'ר טחון", "פלפל חריף", "סומאק",
    "זעתר", "מיקס תבלינים", "תבלין לאורז", "תבלין לעוף", "תבלין לבשר",
    "רוזמרין", "אורגנו", "טימין", "מרווה", "כוסברה טחונה", "שומר",
    "פפריקה מעושנת", "מלח גס", "מלח ים", "פלפל לבן", "עלי דפנה",
    "שמן קנולה", "שמן חמניות", "שמן אגוזים", "שמן שומשום", "חומץ בלסמי",
    "חומץ תפוחים", "רוטב סויה", "רוטב צ'ילי", "הריסה", "שטה", "עמבה",
    "חרדל", "מיונז", "קטשופ", "רוטב ברביקיו", "רוטב טריאקי",
    "סוכר", "סוכר חום", "סוכרזית", "סטיביה", "מלח שום", "מלח בצל",
    "בהראט", "חוואייג'", "ראס אל חנות"
  ],
};

const ShoppingDashboard = () => {
  const { viewMode, themeKey, setViewMode, setTheme } = useDashboardDisplay("shopping");
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newQuantityUnit, setNewQuantityUnit] = useState("יח'");
  const [newPrice, setNewPrice] = useState("");
  const [activeTab, setActiveTab] = useState("shopping");
  const [aiChat, setAiChat] = useState("");
  const aiChatHistory = useDashboardChatHistory("shopping");
  const [aiLoading, setAiLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSheetName, setShareSheetName] = useState("ראשי");
  const [customItemInputs, setCustomItemInputs] = useState<Record<string, string>>({});
  const [customCatalog, setCustomCatalog] = useState<Record<string, string[]>>(() => {
    try { return JSON.parse(localStorage.getItem("shopping-custom-catalog") || "{}"); } catch { return {}; }
  });
  // Quantity editing inline
  const [editingQuantity, setEditingQuantity] = useState<string | null>(null);
  const [editQtyValue, setEditQtyValue] = useState("");
  const [editQtyUnit, setEditQtyUnit] = useState("יח'");

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });

    const allItems = (data as any[]) || [];

    // 24h auto-reset: items marked "נקנה" over 24h ago → reset to "לקנות"
    const now = new Date();
    const toReset: string[] = [];
    const processed = allItems.map(item => {
      if (item.status === "נקנה" && item.updated_at) {
        const checkedAt = new Date(item.updated_at);
        const hoursDiff = (now.getTime() - checkedAt.getTime()) / (1000 * 60 * 60);
        if (hoursDiff >= 24) {
          toReset.push(item.id);
          return { ...item, status: "לקנות" };
        }
      }
      return item;
    });

    // Batch reset in DB
    if (toReset.length > 0) {
      await supabase.from("shopping_items").update({ status: "לקנות" }).in("id", toReset);
      toast.info(`${toReset.length} פריטים חזרו לרשימה (עברו 24 שעות)`);
    }

    setItems(processed);
    setLoading(false);
  }, [user]);

  const fetchArchivedItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", true)
      .order("updated_at", { ascending: false })
      .limit(200);
    setArchivedItems((data as any[]) || []);
  }, [user]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { if (activeTab === "history" || activeTab === "recycle") fetchArchivedItems(); }, [activeTab, fetchArchivedItems]);

  const addItem = async (isDream: boolean, sheetName = "ראשי") => {
    if (!user || !newTitle.trim()) return;
    const qtyStr = newQuantity.trim() ? `${newQuantity.trim()} ${newQuantityUnit}` : null;
    const { error } = await supabase.from("shopping_items").insert({
      user_id: user.id,
      title: newTitle.trim(),
      category: newCategory.trim() || null,
      quantity: qtyStr,
      price: newPrice ? parseFloat(newPrice) : null,
      is_dream: isDream,
      sheet_name: sheetName,
    });
    if (error) { toast.error("שגיאה"); return; }
    setNewTitle(""); setNewCategory(""); setNewQuantity(""); setNewPrice("");
    toast.success(isDream ? "נוסף לרשימת חלומות" : sheetName === "סופר" ? "נוסף לרשימת סופר" : "נוסף לרשימת קניות");
    fetchItems();
  };

  const toggleStatus = async (id: string, current: string) => {
    const next = current === "לקנות" ? "נקנה" : "לקנות";
    await supabase.from("shopping_items").update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: next, updated_at: new Date().toISOString() } : i));
  };

  const deleteItem = async (id: string) => {
    // Soft delete: move to recycle bin (archived + status "נמחק")
    await supabase.from("shopping_items").update({ archived: true, status: "נמחק", updated_at: new Date().toISOString() }).eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("הפריט הועבר לסל המחזור");
  };

  const archiveItem = async (id: string) => {
    await supabase.from("shopping_items").update({ archived: true }).eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("הועבר לארכיון");
  };

  const restoreItem = async (id: string) => {
    await supabase.from("shopping_items").update({ archived: false, status: "לקנות" }).eq("id", id);
    setArchivedItems(prev => prev.filter(i => i.id !== id));
    fetchItems();
    toast.success("הפריט שוחזר לרשימה");
  };

  const updateItemQuantity = async (id: string) => {
    const qtyStr = editQtyValue.trim() ? `${editQtyValue.trim()} ${editQtyUnit}` : null;
    await supabase.from("shopping_items").update({ quantity: qtyStr }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qtyStr } : i));
    setEditingQuantity(null);
    toast.success("כמות עודכנה");
  };

  const addCustomItemToCategory = async (cat: string, titleOverride?: string) => {
    const inputKey = `header-${cat}`;
    const title = titleOverride || customItemInputs[inputKey]?.trim();
    if (!title) return;
    const updated = { ...customCatalog };
    if (!updated[cat]) updated[cat] = [];
    if (!updated[cat].includes(title)) {
      updated[cat] = [...updated[cat], title];
      setCustomCatalog(updated);
      localStorage.setItem("shopping-custom-catalog", JSON.stringify(updated));
    }
    if (!titleOverride) {
      setCustomItemInputs(prev => ({ ...prev, [inputKey]: "" }));
    }
    toast.success(`${title} נשמר בקטלוג של ${cat}`);
  };

  const getCategoryItemsList = (cat: string): string[] => {
    const builtIn = CATEGORY_ITEMS[cat] || [];
    const custom = customCatalog[cat] || [];
    return [...builtIn, ...custom.filter(c => !builtIn.includes(c))];
  };

  const addCatalogItemToList = async (cat: string, title: string) => {
    if (!user) return;

    await supabase.from("shopping_items").insert({
      user_id: user.id,
      title,
      category: cat,
      sheet_name: "סופר",
      is_dream: false,
    });

    fetchItems();
    toast.success(`${title} נוסף לרשימה`);
  };

  const archivedGroups = useMemo(() => {
    // History = archived items that were NOT deleted (status != "נמחק")
    const historyItems = archivedItems.filter(i => i.status !== "נמחק");
    const groups = historyItems.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
      const key = new Date(item.updated_at).toLocaleDateString("he-IL");
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
    return Object.entries(groups).sort((a, b) => new Date(b[1][0].updated_at).getTime() - new Date(a[1][0].updated_at).getTime());
  }, [archivedItems]);

  // Recycle bin items (deleted within 7 days)
  const recycleBinItems = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return archivedItems.filter(i => i.status === "נמחק" && new Date(i.updated_at) > sevenDaysAgo);
  }, [archivedItems]);

  // Auto-purge items older than 7 days from recycle bin
  useEffect(() => {
    if (!user) return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const toPurge = archivedItems.filter(i => i.status === "נמחק" && new Date(i.updated_at) <= sevenDaysAgo);
    if (toPurge.length > 0) {
      supabase.from("shopping_items").delete().in("id", toPurge.map(i => i.id)).then(() => {
        setArchivedItems(prev => prev.filter(i => !toPurge.some(p => p.id === i.id)));
      });
    }
  }, [archivedItems, user]);

  const restoreArchivedGroup = async (groupItems: ShoppingItem[]) => {
    if (!user || groupItems.length === 0) return;

    const payload = groupItems.map(item => ({
      user_id: user.id,
      title: item.title,
      category: item.category,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes,
      sheet_name: item.sheet_name,
      priority: item.priority,
      is_dream: item.is_dream,
      status: "לקנות",
      archived: false,
    }));

    const { error } = await supabase.from("shopping_items").insert(payload);
    if (error) {
      toast.error("שגיאה בשחזור הקנייה");
      return;
    }

    fetchItems();
    toast.success(`שוחזרו ${groupItems.length} פריטים לרשימה`);
  };

  const sendAiMessage = async (chatInput: string) => {
    if (!chatInput.trim()) return;
    const userMsg = { role: "user", content: chatInput };
    aiChatHistory.setMessages(prev => [...prev, userMsg]);
    setAiLoading(true);
    try {
      const dreamItems = items.filter(i => i.is_dream);
      const shoppingItems = items.filter(i => !i.is_dream && i.sheet_name !== "סופר");
      const superItems = items.filter(i => i.sheet_name === "סופר");
      const context = `רשימת קניות: ${shoppingItems.map(i => `${i.title} (${i.status})`).join(", ")}. רשימת סופר: ${superItems.map(i => `${i.title} (${i.status}${i.category ? ", " + i.category : ""})`).join(", ")}. רשימת חלומות: ${dreamItems.map(i => `${i.title} (מחיר: ${i.price || "לא ידוע"})`).join(", ")}.`;
      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: chatInput,
          taskCategory: "shopping",
          conversationHistory: [...aiChatHistory.messages, userMsg].slice(-20),
          customPrompt: `אתה יועץ קניות חכם. עזור למשתמש עם רשימת הקניות, הסופר והחלומות שלו. ${context}\n\nהמשתמש שואל: ${chatInput}`,
        },
      });
      if (error) throw error;
      aiChatHistory.setMessages(prev => [...prev, { role: "assistant", content: data?.suggestion || "אין תשובה" }]);
    } catch {
      aiChatHistory.setMessages(prev => [...prev, { role: "assistant", content: "שגיאה בתקשורת עם AI" }]);
    }
    setAiLoading(false);
  };

  const shoppingItems = items.filter(i => !i.is_dream && i.sheet_name !== "סופר");
  const supermarketItems = items.filter(i => !i.is_dream && i.sheet_name === "סופר");
  const dreamItems = items.filter(i => i.is_dream);
  const totalPrice = shoppingItems.filter(i => i.price).reduce((sum, i) => sum + (i.price || 0), 0);
  const superTotal = supermarketItems.filter(i => i.price).reduce((sum, i) => sum + (i.price || 0), 0);
  const dreamTotal = dreamItems.filter(i => i.price).reduce((sum, i) => sum + (i.price || 0), 0);

  const availableSheets = [...new Set(items.map(i => i.sheet_name))];

  const archiveAllItems = async (sheetName?: string) => {
    if (!user) return;
    const toArchive = sheetName
      ? items.filter(i => i.sheet_name === sheetName && !i.is_dream)
      : items.filter(i => !i.is_dream);
    if (toArchive.length === 0) { toast.info("אין פריטים לשליחה"); return; }
    const ids = toArchive.map(i => i.id);
    await supabase.from("shopping_items").update({ archived: true }).in("id", ids);
    setItems(prev => prev.filter(i => !ids.includes(i.id)));
    toast.success(`${ids.length} פריטים נשלחו להיסטוריה`);
  };

  const renderItemList = (itemList: ShoppingItem[], emptyMsg: string, showCustomInput = false) => {
    // Only show categories that have items
    const itemCats = [...new Set(itemList.map(i => i.category || "כללי"))];
    // If showCustomInput, also show categories from SUPERMARKET_CATEGORIES that have catalog items
    const cats = showCustomInput
      ? [...new Set([...itemCats, ...SUPERMARKET_CATEGORIES.filter(c => itemList.some(i => (i.category || "כללי") === c))])]
      : itemCats;

    if (cats.length === 0 && !showCustomInput) return <p className="text-center text-muted-foreground py-6">{emptyMsg}</p>;
    if (itemList.length === 0 && !showCustomInput) return <p className="text-center text-muted-foreground py-6">{emptyMsg}</p>;

    return cats.map(cat => {
      const catItems = itemList.filter(i => (i.category || "כללי") === cat);
      if (catItems.length === 0) return null;
      return (
        <Card key={cat}>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {cat}
              {catItems.length > 0 && <Badge variant="secondary" className="text-[10px]">{catItems.length}</Badge>}
              <div className="flex-1" />
              {showCustomInput && (
                <div className="flex items-center gap-1">
                  <Input
                    placeholder="+ פריט חדש"
                    value={customItemInputs[`header-${cat}`] || ""}
                    onChange={e => setCustomItemInputs(prev => ({ ...prev, [`header-${cat}`]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const title = customItemInputs[`header-${cat}`]?.trim();
                        if (title && user) {
                          supabase.from("shopping_items").insert({
                            user_id: user.id,
                            title,
                            category: cat,
                            sheet_name: "סופר",
                            is_dream: false,
                          }).then(() => {
                            setCustomItemInputs(prev => ({ ...prev, [`header-${cat}`]: "" }));
                            fetchItems();
                            toast.success(`${title} נוסף ל-${cat}`);
                          });
                        }
                      }
                    }}
                    className="w-28 h-6 text-[10px] px-2"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      const title = customItemInputs[`header-${cat}`]?.trim();
                      if (title && user) {
                        supabase.from("shopping_items").insert({
                          user_id: user.id,
                          title,
                          category: cat,
                          sheet_name: "סופר",
                          is_dream: false,
                        }).then(() => {
                          setCustomItemInputs(prev => ({ ...prev, [`header-${cat}`]: "" }));
                          fetchItems();
                          toast.success(`${title} נוסף ל-${cat}`);
                        });
                      }
                    }}
                    disabled={!customItemInputs[`header-${cat}`]?.trim()}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 px-2 space-y-1">
            {catItems.map(item => (
              <div key={item.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${item.status === "נקנה" ? "bg-green-50 dark:bg-green-950/20 opacity-60" : "bg-card"}`}>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => toggleStatus(item.id, item.status)}>
                  {item.status === "נקנה" ? <Check className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 border-2 rounded" />}
                </Button>
                <span className={`flex-1 text-sm ${item.status === "נקנה" ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                {editingQuantity === item.id ? (
                  <div className="flex items-center gap-1">
                    <Input value={editQtyValue} onChange={e => setEditQtyValue(e.target.value)} className="w-12 h-6 text-[10px] px-1" placeholder="כמות" onKeyDown={e => e.key === "Enter" && updateItemQuantity(item.id)} autoFocus />
                    <Select value={editQtyUnit} onValueChange={setEditQtyUnit}>
                      <SelectTrigger className="w-16 h-6 text-[10px] px-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{QUANTITY_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => updateItemQuantity(item.id)}><Check className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-accent" onClick={() => {
                    const parts = (item.quantity || "").split(" ");
                    setEditQtyValue(parts[0] || "1");
                    setEditQtyUnit(parts.slice(1).join(" ") || "יח'");
                    setEditingQuantity(item.id);
                  }}>
                    {item.quantity || "כמות"}
                  </Badge>
                )}
                {item.price && <span className="text-xs text-muted-foreground">₪{item.price}</span>}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => archiveItem(item.id)}><Archive className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
            {/* Add permanent catalog item input at the bottom of each category */}
            {showCustomInput && (
              <div className="flex items-center gap-1 mt-1 p-1">
                <Input
                  placeholder="הוספת פריט קבוע..."
                  value={customItemInputs[`perm-${cat}`] || ""}
                  onChange={e => setCustomItemInputs(prev => ({ ...prev, [`perm-${cat}`]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const title = customItemInputs[`perm-${cat}`]?.trim();
                      if (title) {
                        addCustomItemToCategory(cat, title);
                        setCustomItemInputs(prev => ({ ...prev, [`perm-${cat}`]: "" }));
                      }
                    }
                  }}
                  className="flex-1 h-7 text-xs"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => {
                    const title = customItemInputs[`perm-${cat}`]?.trim();
                    if (title) {
                      addCustomItemToCategory(cat, title);
                      setCustomItemInputs(prev => ({ ...prev, [`perm-${cat}`]: "" }));
                    }
                  }}
                  disabled={!customItemInputs[`perm-${cat}`]?.trim()}
                >
                  <Plus className="h-3 w-3" />קבוע
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    });
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <ShoppingCart className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold flex-1">קניות וחלומות</h2>
        <DashboardDisplayToolbar viewMode={viewMode} themeKey={themeKey} onViewModeChange={setViewMode} onThemeChange={setTheme} />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportToExcel(
          items.map(i => ({ title: i.title, category: i.category || '', quantity: i.quantity || '', price: i.price, status: i.status, notes: i.notes || '' })),
          [{ key: 'title', label: 'פריט' }, { key: 'category', label: 'קטגוריה' }, { key: 'quantity', label: 'כמות' }, { key: 'price', label: 'מחיר' }, { key: 'status', label: 'סטטוס' }, { key: 'notes', label: 'הערות' }],
          'קניות'
        )}>
          <Download className="h-3.5 w-3.5" />ייצוא
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShareSheetName("ראשי"); setShareOpen(true); }}>
          <Users className="h-4 w-4" />שיתוף
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="shopping" className="flex-1 gap-1"><ShoppingCart className="h-3.5 w-3.5" />קניות ({shoppingItems.length})</TabsTrigger>
          <TabsTrigger value="supermarket" className="flex-1 gap-1"><ShoppingBasket className="h-3.5 w-3.5" />סופר ({supermarketItems.length})</TabsTrigger>
          <TabsTrigger value="dreams" className="flex-1 gap-1"><Star className="h-3.5 w-3.5" />חלומות ({dreamItems.length})</TabsTrigger>
          <TabsTrigger value="history" className="flex-1 gap-1"><History className="h-3.5 w-3.5" />היסטוריה</TabsTrigger>
          <TabsTrigger value="recycle" className="flex-1 gap-1"><Recycle className="h-3.5 w-3.5" />סל מחזור{recycleBinItems.length > 0 ? ` (${recycleBinItems.length})` : ""}</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 gap-1"><Sparkles className="h-3.5 w-3.5" />יועץ AI</TabsTrigger>
        </TabsList>

        {/* General shopping */}
        <TabsContent value="shopping" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="מוצר חדש..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem(false)} className="flex-1 min-w-[150px]" />
                <AutocompleteInput fieldName="shopping-category" value={newCategory} onChange={setNewCategory} placeholder="קטגוריה" className="w-28" />
                <div className="flex gap-1">
                  <Input placeholder="כמות" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} className="w-16" />
                  <Select value={newQuantityUnit} onValueChange={setNewQuantityUnit}>
                    <SelectTrigger className="w-20 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUANTITY_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="מחיר" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-24" dir="ltr" />
                <Button onClick={() => addItem(false)} size="icon"><Plus className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>

          {totalPrice > 0 && (
            <div className="text-sm text-muted-foreground text-left">סה"כ משוער: ₪{totalPrice.toFixed(0)}</div>
          )}

          {renderItemList(shoppingItems, "אין פריטים ברשימת הקניות")}
        </TabsContent>

        {/* Supermarket */}
        <TabsContent value="supermarket" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="מוצר לסופר..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem(false, "סופר")} className="flex-1 min-w-[150px]" />
                <AutocompleteInput fieldName="supermarket-category" value={newCategory} onChange={setNewCategory} placeholder="קטגוריה" className="w-32" />
                <div className="flex gap-1">
                  <Input placeholder="כמות" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} className="w-16" />
                  <Select value={newQuantityUnit} onValueChange={setNewQuantityUnit}>
                    <SelectTrigger className="w-20 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUANTITY_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="מחיר" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-24" dir="ltr" />
                <Button onClick={() => addItem(false, "סופר")} size="icon"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {SUPERMARKET_CATEGORIES.map(cat => (
                  <Badge key={cat} variant={newCategory === cat ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => setNewCategory(newCategory === cat ? "" : cat)}>{cat}</Badge>
                ))}
              </div>
              {newCategory && getCategoryItemsList(newCategory).length > 0 && (
                <div className="mt-2 p-2 rounded-lg border bg-muted/30">
                  <p className="text-[10px] text-muted-foreground mb-1">לחץ להוספה מהירה:</p>
                  <div className="flex flex-wrap gap-1 items-center">
                    {getCategoryItemsList(newCategory)
                      .filter(item => !supermarketItems.some(si => si.title === item && si.category === newCategory))
                      .map(item => (
                        <Badge
                          key={item}
                          variant="outline"
                          className="cursor-pointer text-[10px] hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={async () => {
                            if (!user) return;
                            await supabase.from("shopping_items").insert({
                              user_id: user.id,
                              title: item,
                              category: newCategory,
                              sheet_name: "סופר",
                              is_dream: false,
                            });
                            fetchItems();
                            toast.success(`${item} נוסף`);
                          }}
                        >
                          + {item}
                        </Badge>
                      ))}
                    {/* Inline add new permanent catalog item */}
                    {customItemInputs[`inline-${newCategory}`] !== undefined ? (
                      <div className="flex items-center gap-1">
                        <Input
                          placeholder="שם מוצר חדש..."
                          value={customItemInputs[`inline-${newCategory}`] || ""}
                          onChange={e => setCustomItemInputs(prev => ({ ...prev, [`inline-${newCategory}`]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              const title = customItemInputs[`inline-${newCategory}`]?.trim();
                              if (title) {
                                addCustomItemToCategory(newCategory, title);
                                setCustomItemInputs(prev => ({ ...prev, [`inline-${newCategory}`]: undefined as any }));
                              }
                            }
                            if (e.key === "Escape") {
                              setCustomItemInputs(prev => ({ ...prev, [`inline-${newCategory}`]: undefined as any }));
                            }
                          }}
                          className="w-28 h-6 text-[10px] px-2"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                          const title = customItemInputs[`inline-${newCategory}`]?.trim();
                          if (title) {
                            addCustomItemToCategory(newCategory, title);
                          }
                          setCustomItemInputs(prev => ({ ...prev, [`inline-${newCategory}`]: undefined as any }));
                        }}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="cursor-pointer text-[10px] border-dashed border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                        onClick={() => setCustomItemInputs(prev => ({ ...prev, [`inline-${newCategory}`]: "" }))}
                      >
                        + הוסף מוצר קבוע
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between flex-wrap gap-2">
            {superTotal > 0 && <div className="text-sm text-muted-foreground">סה"כ סופר: ₪{superTotal.toFixed(0)}</div>}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => archiveAllItems("סופר")}>
                <Archive className="h-3 w-3" />שלח הכל להיסטוריה
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { setShareSheetName("סופר"); setShareOpen(true); }}>
                <Users className="h-3 w-3" />שתף רשימת סופר
              </Button>
            </div>
          </div>

          {renderItemList(supermarketItems, "רשימת הסופר ריקה. הוסף מוצרים!", true)}
        </TabsContent>

        {/* Dreams */}
        <TabsContent value="dreams" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="חלום חדש (מוצר/חפץ)..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem(true)} className="flex-1 min-w-[150px]" />
                <AutocompleteInput fieldName="shopping-category" value={newCategory} onChange={setNewCategory} placeholder="קטגוריה" className="w-28" />
                <Input placeholder="מחיר" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-24" dir="ltr" />
                <Button onClick={() => addItem(true)} size="icon" variant="secondary"><Star className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>

          {dreamTotal > 0 && (
            <div className="text-sm text-muted-foreground">סה"כ חלומות: ₪{dreamTotal.toLocaleString()}</div>
          )}

          <div className="space-y-2">
            {dreamItems.map(item => (
              <Card key={item.id} className="border-amber-200 dark:border-amber-800">
                <CardContent className="py-3 px-4 flex items-center gap-3">
                  <Star className="h-5 w-5 text-amber-500 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.title}</p>
                    {item.category && <span className="text-xs text-muted-foreground">{item.category}</span>}
                  </div>
                  {item.price && <span className="font-bold text-sm">₪{item.price.toLocaleString()}</span>}
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
                </CardContent>
              </Card>
            ))}
            {dreamItems.length === 0 && <p className="text-center text-muted-foreground py-6">אין חלומות עדיין</p>}
          </div>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm">היסטוריית קניות ({archivedItems.length})</h3>
          </div>
          {archivedItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">אין היסטוריה עדיין</p>
          ) : (
            <div className="space-y-3">
              {archivedGroups.map(([dateLabel, groupItems]) => (
                <Card key={dateLabel}>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span>{dateLabel}</span>
                      <Badge variant="secondary" className="text-[10px]">{groupItems.length} פריטים</Badge>
                      <div className="flex-1" />
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => restoreArchivedGroup(groupItems)}>
                        <RotateCcw className="h-3 w-3" />שחזר את כל הקנייה
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {groupItems.map(item => (
                      <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                        <span className="flex-1 text-sm text-muted-foreground">{item.title}</span>
                        {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
                        {item.quantity && <Badge variant="outline" className="text-[10px]">{item.quantity}</Badge>}
                        <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => restoreItem(item.id)}>
                          <RotateCcw className="h-3 w-3" />שחזר
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Recycle Bin */}
        <TabsContent value="recycle" className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Recycle className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm">סל מחזור ({recycleBinItems.length})</h3>
            <span className="text-xs text-muted-foreground">פריטים נמחקים לצמיתות לאחר 7 ימים</span>
          </div>
          {recycleBinItems.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">סל המחזור ריק</p>
          ) : (
            <div className="space-y-2">
              {recycleBinItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                  <Trash2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm">{item.title}</span>
                  {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
                  <span className="text-[10px] text-muted-foreground">{new Date(item.updated_at).toLocaleDateString("he-IL")}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => restoreItem(item.id)}>
                    <RotateCcw className="h-3 w-3" />שחזר
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={async () => {
                    await supabase.from("shopping_items").delete().eq("id", item.id);
                    setArchivedItems(prev => prev.filter(i => i.id !== item.id));
                    toast.success("נמחק לצמיתות");
                  }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button variant="destructive" size="sm" className="gap-1" onClick={async () => {
                const ids = recycleBinItems.map(i => i.id);
                await supabase.from("shopping_items").delete().in("id", ids);
                setArchivedItems(prev => prev.filter(i => !ids.includes(i.id)));
                toast.success("סל המחזור רוקן");
              }}>
                <Trash2 className="h-3 w-3" />רוקן סל מחזור
              </Button>
            </div>
          )}
        </TabsContent>

        {/* AI */}
        <TabsContent value="ai" className="space-y-4">
          <AiChatPanel
            title="יועץ קניות AI"
            messages={aiChatHistory.messages}
            loaded={aiChatHistory.loaded}
            aiLoading={aiLoading}
            archive={aiChatHistory.archive}
            onSend={sendAiMessage}
            onClearAndArchive={aiChatHistory.clearAndArchive}
            onLoadConversation={aiChatHistory.loadConversation}
            placeholder="שאל שאלה..."
            emptyText="שאל על תקציב, חלופות זולות, איפה הכי משתלם..."
          />
        </TabsContent>
      </Tabs>

      <ShoppingShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        sheetName={shareSheetName}
        availableSheets={availableSheets}
      />
    </div>
  );
};

export default ShoppingDashboard;
