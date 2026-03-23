import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, CreditCard, TrendingUp, TrendingDown, DollarSign, Check, Calendar, Sparkles, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useDashboardChatHistory } from "@/hooks/useDashboardChatHistory";

interface Payment {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string | null;
  payment_type: string;
  payment_method: string | null;
  due_date: string | null;
  paid: boolean;
  recurring: boolean;
  recurring_frequency: string | null;
  notes: string | null;
  sheet_name: string;
  archived: boolean;
  created_at: string;
}

const PaymentDashboard = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newType, setNewType] = useState("expense");
  const [newMethod, setNewMethod] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newRecurring, setNewRecurring] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [aiChat, setAiChat] = useState("");
  const { messages: aiMessages, setMessages: setAiMessages, clearHistory: clearAiHistory } = useDashboardChatHistory("payments");
  const [aiLoading, setAiLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("payment_tracking")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("created_at", { ascending: false });
    setPayments((data as any[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const addPayment = async () => {
    if (!user || !newTitle.trim() || !newAmount) return;
    const { error } = await supabase.from("payment_tracking").insert({
      user_id: user.id,
      title: newTitle.trim(),
      amount: parseFloat(newAmount),
      category: newCategory.trim() || null,
      payment_type: newType,
      payment_method: newMethod.trim() || null,
      due_date: newDueDate || null,
      recurring: newRecurring,
    });
    if (error) { toast.error("שגיאה"); return; }
    setNewTitle(""); setNewAmount(""); setNewCategory(""); setNewMethod(""); setNewDueDate("");
    toast.success("נוסף");
    fetchPayments();
  };

  const togglePaid = async (id: string, paid: boolean) => {
    await supabase.from("payment_tracking").update({ paid: !paid }).eq("id", id);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, paid: !paid } : p));
  };

  const deletePayment = async (id: string) => {
    await supabase.from("payment_tracking").delete().eq("id", id);
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const totalExpenses = useMemo(() => payments.filter(p => p.payment_type === "expense").reduce((s, p) => s + p.amount, 0), [payments]);
  const totalIncome = useMemo(() => payments.filter(p => p.payment_type === "income").reduce((s, p) => s + p.amount, 0), [payments]);
  const unpaidExpenses = useMemo(() => payments.filter(p => p.payment_type === "expense" && !p.paid).reduce((s, p) => s + p.amount, 0), [payments]);
  const overdue = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return payments.filter(p => !p.paid && p.due_date && p.due_date < today);
  }, [payments]);

  const sendAiMessage = async () => {
    if (!aiChat.trim()) return;
    const userMsg = { role: "user", content: aiChat };
    setAiMessages(prev => [...prev, userMsg]);
    setAiChat("");
    setAiLoading(true);

    try {
      const context = `הוצאות: ₪${totalExpenses.toFixed(0)}, הכנסות: ₪${totalIncome.toFixed(0)}, לא שולמו: ₪${unpaidExpenses.toFixed(0)}, באיחור: ${overdue.length}. קטגוריות: ${[...new Set(payments.map(p => p.category).filter(Boolean))].join(", ")}`;
      const { data, error } = await supabase.functions.invoke("task-ai-helper", {
        body: {
          taskDescription: aiChat,
          taskCategory: "finance",
          customPrompt: `אתה יועץ פיננסי חכם. ${context}\nהמשתמש שואל: ${aiChat}`,
        },
      });
      if (error) throw error;
      setAiMessages(prev => [...prev, { role: "assistant", content: data?.suggestion || "אין תשובה" }]);
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "שגיאה" }]);
    }
    setAiLoading(false);
  };

  if (loading) return <div className="p-6 text-center text-muted-foreground">טוען...</div>;

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <CreditCard className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">מעקב תשלומים</h2>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <CardContent className="p-3 text-center">
            <TrendingDown className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">הוצאות</p>
            <p className="font-bold text-red-600">₪{totalExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">הכנסות</p>
            <p className="font-bold text-green-600">₪{totalIncome.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-3 text-center">
            <DollarSign className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">לא שולם</p>
            <p className="font-bold text-amber-600">₪{unpaidExpenses.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className={`${overdue.length > 0 ? "bg-red-100 dark:bg-red-950/30 border-red-300" : "bg-muted/30"}`}>
          <CardContent className="p-3 text-center">
            <Calendar className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">באיחור</p>
            <p className="font-bold">{overdue.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">כל התשלומים</TabsTrigger>
          <TabsTrigger value="add" className="flex-1 gap-1"><Plus className="h-3 w-3" />הוסף</TabsTrigger>
          <TabsTrigger value="ai" className="flex-1 gap-1"><Sparkles className="h-3 w-3" />יועץ AI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-2">
          {payments.map(p => (
            <Card key={p.id} className={p.payment_type === "income" ? "border-green-200 dark:border-green-800" : ""}>
              <CardContent className="py-2 px-3 flex items-center gap-3">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => togglePaid(p.id, p.paid)}>
                  {p.paid ? <Check className="h-4 w-4 text-green-600" /> : <div className="h-4 w-4 border-2 rounded" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${p.paid ? "line-through text-muted-foreground" : ""}`}>{p.title}</p>
                  <div className="flex gap-2 items-center">
                    {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                    {p.due_date && <span className="text-[10px] text-muted-foreground">{format(new Date(p.due_date), "dd/MM/yy")}</span>}
                    {p.recurring && <Badge variant="secondary" className="text-[10px]">חוזר</Badge>}
                  </div>
                </div>
                <span className={`font-bold text-sm ${p.payment_type === "income" ? "text-green-600" : "text-red-600"}`}>
                  {p.payment_type === "income" ? "+" : "-"}₪{p.amount.toLocaleString()}
                </span>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deletePayment(p.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {payments.length === 0 && <p className="text-center text-muted-foreground py-8">אין תשלומים עדיין</p>}
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Input placeholder="שם התשלום" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="סכום" type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} dir="ltr" className="flex-1" />
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">הוצאה</SelectItem>
                    <SelectItem value="income">הכנסה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Input placeholder="קטגוריה" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="flex-1" />
                <Input placeholder="אמצעי תשלום" value={newMethod} onChange={e => setNewMethod(e.target.value)} className="flex-1" />
              </div>
              <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} dir="ltr" />
              <Button onClick={addPayment} className="w-full gap-2"><Plus className="h-4 w-4" />הוסף תשלום</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5" />יועץ פיננסי AI</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">שאל על תקציב, חיסכון, ניתוח הוצאות ועוד</p>
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
    </div>
  );
};

export default PaymentDashboard;
