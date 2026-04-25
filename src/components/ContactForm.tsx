import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  ADMIN_MAIL_SUPABASE_PUBLISHABLE_KEY,
  ADMIN_MAIL_SUPABASE_URL,
} from "@/integrations/supabase/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

const ContactForm = () => {
  const { user } = useAuth();
  const { lang, t } = useLanguage();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("bug");
  const [sending, setSending] = useState(false);
  const isHe = lang === "he" || lang === "ar";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error(isHe ? "יש לכתוב הודעה" : "Please enter a message");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${ADMIN_MAIL_SUPABASE_URL}/functions/v1/send-contact-form`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ADMIN_MAIL_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          subject: subject.trim() || (isHe ? "פנייה ללא נושא" : "Support request without subject"),
          message: message.trim(),
          category,
          userEmail: user?.email || (isHe ? "אנונימי" : "Anonymous"),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || (isHe ? "שגיאה בשליחת הפנייה" : "Failed to send contact request"));
      }
      if (data?.error) throw new Error(data.error);
      toast.success(isHe ? "הפנייה נשלחה בהצלחה ל-info@tabro.org" : "Your message was sent successfully to info@tabro.org");
      setSubject("");
      setMessage("");
      setCategory("bug");
    } catch (err: any) {
      const msg = err?.message || (isHe ? "שגיאה בשליחה, נסה שוב" : "Send failed, please try again");
      toast.error(msg);
    }
    setSending(false);
  };

  return (
    <Card className="max-w-lg mx-auto card-surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          {t("contactForm" as any)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{isHe ? "סוג פנייה" : "Request type"}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">🐛 {isHe ? "דיווח על באג" : "Bug report"}</SelectItem>
                <SelectItem value="feature">💡 {isHe ? "בקשת פיצ'ר" : "Feature request"}</SelectItem>
                <SelectItem value="advice">📝 {isHe ? "עצה / הצעה" : "Advice / suggestion"}</SelectItem>
                <SelectItem value="other">📩 {isHe ? "אחר" : "Other"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{isHe ? "נושא" : "Subject"}</Label>
            <Input placeholder={isHe ? "נושא הפנייה..." : "Message subject..."} value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{isHe ? "הודעה" : "Message"}</Label>
            <Textarea placeholder={isHe ? "תאר את הבעיה או ההצעה שלך..." : "Describe the issue or suggestion..."} value={message} onChange={e => setMessage(e.target.value)} rows={5} />
          </div>
          <p className="text-xs text-muted-foreground">{isHe ? "נשלח מ:" : "Sent from:"} {user?.email || (isHe ? "לא מחובר" : "Not signed in")}</p>
          <Button type="submit" className="w-full gap-2" disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? (isHe ? "שולח..." : "Sending...") : (isHe ? "שלח פנייה" : "Send message")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ContactForm;
