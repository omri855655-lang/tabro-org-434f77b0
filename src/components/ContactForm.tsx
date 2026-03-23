import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

const ContactForm = () => {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("bug");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("יש לכתוב הודעה");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-form", {
        body: {
          subject: subject.trim() || "פנייה ללא נושא",
          message: message.trim(),
          category,
          userEmail: user?.email || "אנונימי",
        },
      });
      if (error) throw error;
      toast.success("הפנייה נשלחה בהצלחה! נחזור אליך בהקדם");
      setSubject("");
      setMessage("");
      setCategory("bug");
    } catch {
      toast.error("שגיאה בשליחה, נסה שוב");
    }
    setSending(false);
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          פנייה / דיווח על בעיה
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>סוג פנייה</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">🐛 דיווח על באג</SelectItem>
                <SelectItem value="feature">💡 בקשת פיצ'ר</SelectItem>
                <SelectItem value="advice">📝 עצה / הצעה</SelectItem>
                <SelectItem value="other">📩 אחר</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>נושא</Label>
            <Input placeholder="נושא הפנייה..." value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>הודעה</Label>
            <Textarea placeholder="תאר את הבעיה או ההצעה שלך..." value={message} onChange={e => setMessage(e.target.value)} rows={5} />
          </div>
          <p className="text-xs text-muted-foreground">נשלח מ: {user?.email || "לא מחובר"}</p>
          <Button type="submit" className="w-full gap-2" disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? "שולח..." : "שלח פנייה"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ContactForm;
