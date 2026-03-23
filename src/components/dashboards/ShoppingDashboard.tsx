import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ShoppingCart, Star, Check, Archive, Sparkles, MessageCircle, Users, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { useDashboardChatHistory } from "@/hooks/useDashboardChatHistory";
import AutocompleteInput from "@/components/AutocompleteInput";
import ShoppingShareDialog from "@/components/dashboards/ShoppingShareDialog";

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
}

const SUPERMARKET_CATEGORIES = ["ירקות ופירות", "מוצרי חלב", "בשר ודגים", "לחם ומאפים", "שימורים", "חטיפים ומתוקים", "משקאות", "ניקיון", "היגיינה", "קפואים", "תבלינים", "אחר"];

const ShoppingDashboard = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [activeTab, setActiveTab] = useState("shopping");
  const [aiChat, setAiChat] = useState("");
  const { messages: aiMessages, setMessages: setAiMessages, clearHistory: clearAiHistory } = useDashboardChatHistory("shopping");
  const [aiLoading, setAiLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSheetName, setShareSheetName] = useState("ראשי");

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("shopping_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });
    setItems((data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (isDream: boolean, sheetName = "ראשי") => {
    if (!user || !newTitle.trim()) return;
    const { error } = await supabase.from("shopping_items").insert({
      user_id: user.id,
      title: newTitle.trim(),
      category: newCategory.trim() || null,
      quantity: newQuantity.trim() || null,
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
    await supabase.from("shopping_items").update({ status: next }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: next } : i));
  };

  const deleteItem = async (id: string) => {
    await supabase.from("shopping_items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const archiveItem = async (id: string) => {
    await supabase.from("shopping_items").update({ archived: true }).eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    toast.success("הועבר לארכיון");
  };

  const sendAiMessage = async () => {
    if (!aiChat.trim()) return;
    const userMsg = { role: "user", content: aiChat };
    const newMessages = [...aiMessages, userMsg];
    setAiMessages(newMessages);
    setAiChat("");
    setAiLoading(true);

    try {
      const dreamItems = items.filter(i => i.is_dream);
      const shoppingItems = items.filter(i => !i.is_dream && i.sheet_name !== "סופר");
      const superItems = items.filter(i => i.sheet_name === "סופר");
      const context = `רשימת קניות: ${shoppingItems.map(i => `${i.title} (${i.status})`).join(", ")}. רשימת סופר: ${superItems.map(i => `${i.title} (${i.status}${i.category ? ", " + i.category : ""})`).join(", ")}. רשימת חלומות: ${dreamItems.map(i => `${i.title} (מחיר: ${i.price || "לא ידוע"})`).join(", ")}.`;

      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: aiChat,
          taskCategory: "shopping",
          customPrompt: `אתה יועץ קניות חכם. עזור למשתמש עם רשימת הקניות, הסופר והחלומות שלו. תן טיפים לחיסכון, חלופות זולות, ומניעת קניות אימפולסיביות. ${context}\n\nהמשתמש שואל: ${aiChat}`,
        },
      });
      if (error) throw error;
      setAiMessages(prev => [...prev, { role: "assistant", content: data?.suggestion || "אין תשובה" }]);
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "שגיאה בתקשורת עם AI" }]);
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

  const renderItemList = (itemList: ShoppingItem[], emptyMsg: string) => {
    if (itemList.length === 0) return <p className="text-center text-muted-foreground py-6">{emptyMsg}</p>;

    const cats = [...new Set(itemList.map(i => i.category || "כללי"))];
    return cats.map(cat => {
      const catItems = itemList.filter(i => (i.category || "כללי") === cat);
      return (
        <Card key={cat}>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {cat}
              <Badge variant="secondary" className="text-[10px]">{catItems.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 px-2 space-y-1">
            {catItems.map(item => (
              <div key={item.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${item.status === "נקנה" ? "bg-green-50 dark:bg-green-950/20 opacity-60" : "bg-card"}`}>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => toggleStatus(item.id, item.status)}>
                  {item.status === "נקנה" ? <Check className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 border-2 rounded" />}
                </Button>
                <span className={`flex-1 text-sm ${item.status === "נקנה" ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                {item.quantity && <Badge variant="outline" className="text-[10px]">{item.quantity}</Badge>}
                {item.price && <span className="text-xs text-muted-foreground">₪{item.price}</span>}
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => archiveItem(item.id)}><Archive className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    });
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <ShoppingCart className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold flex-1">קניות וחלומות</h2>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { setShareSheetName("ראשי"); setShareOpen(true); }}>
          <Users className="h-4 w-4" />שיתוף
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="shopping" className="flex-1 gap-1"><ShoppingCart className="h-3.5 w-3.5" />קניות ({shoppingItems.length})</TabsTrigger>
          <TabsTrigger value="supermarket" className="flex-1 gap-1"><ShoppingBasket className="h-3.5 w-3.5" />סופר ({supermarketItems.length})</TabsTrigger>
          <TabsTrigger value="dreams" className="flex-1 gap-1"><Star className="h-3.5 w-3.5" />חלומות ({dreamItems.length})</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 gap-1"><Sparkles className="h-3.5 w-3.5" />יועץ AI</TabsTrigger>
        </TabsList>

        {/* General shopping */}
        <TabsContent value="shopping" className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex gap-2 flex-wrap">
                <Input placeholder="מוצר חדש..." value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem(false)} className="flex-1 min-w-[150px]" />
                <AutocompleteInput fieldName="shopping-category" value={newCategory} onChange={setNewCategory} placeholder="קטגוריה" className="w-28" />
                <Input placeholder="כמות" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} className="w-20" />
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
                <Input placeholder="כמות" value={newQuantity} onChange={e => setNewQuantity(e.target.value)} className="w-20" />
                <Input placeholder="מחיר" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-24" dir="ltr" />
                <Button onClick={() => addItem(false, "סופר")} size="icon"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {SUPERMARKET_CATEGORIES.map(cat => (
                  <Badge key={cat} variant={newCategory === cat ? "default" : "outline"} className="cursor-pointer text-[10px]" onClick={() => setNewCategory(cat)}>{cat}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            {superTotal > 0 && <div className="text-sm text-muted-foreground">סה"כ סופר: ₪{superTotal.toFixed(0)}</div>}
            <Button variant="outline" size="sm" className="gap-1" onClick={() => { setShareSheetName("סופר"); setShareOpen(true); }}>
              <Users className="h-3 w-3" />שתף רשימת סופר
            </Button>
          </div>

          {renderItemList(supermarketItems, "רשימת הסופר ריקה. הוסף מוצרים!")}
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

        {/* AI */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2 justify-between"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />יועץ קניות AI</div>{aiMessages.length > 0 && <Button variant="ghost" size="sm" className="text-xs h-6" onClick={clearAiHistory}><Trash2 className="h-3 w-3 mr-1" />נקה</Button>}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">שאל אותי על תקציב, חלופות זולות, איפה הכי משתלם, או איך לחסוך. גם טיפים להימנעות מקניות אימפולסיביות!</p>
              <div className="border rounded-lg p-3 min-h-[200px] max-h-[400px] overflow-y-auto space-y-3">
                {aiMessages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">התחל שיחה...</p>}
                {aiMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {aiLoading && <div className="text-sm text-muted-foreground animate-pulse">חושב...</div>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="שאל שאלה..." value={aiChat} onChange={e => setAiChat(e.target.value)} onKeyDown={e => e.key === "Enter" && sendAiMessage()} />
                <Button onClick={sendAiMessage} disabled={aiLoading}><MessageCircle className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
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
