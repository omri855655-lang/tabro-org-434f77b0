import { useEmailIntegration } from "@/hooks/useEmailIntegration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, CreditCard, ListTodo, ShoppingCart, FileText, User } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  payment: CreditCard,
  task: ListTodo,
  shopping: ShoppingCart,
  bill: FileText,
  personal: User,
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  payment: { he: "תשלומים", en: "Payments", es: "Pagos", zh: "支付", ar: "مدفوعات", ru: "Платежи" },
  task: { he: "משימות", en: "Tasks", es: "Tareas", zh: "任务", ar: "مهام", ru: "Задачи" },
  shopping: { he: "קניות", en: "Shopping", es: "Compras", zh: "购物", ar: "تسوق", ru: "Покупки" },
  bill: { he: "חשבונות", en: "Bills", es: "Facturas", zh: "账单", ar: "فواتير", ru: "Счета" },
  personal: { he: "אישי", en: "Personal", es: "Personal", zh: "个人", ar: "شخصي", ru: "Личное" },
};

const EmailInsightsWidget = () => {
  const { lang, t } = useLanguage();
  const { analyses, connections, categorySummary } = useEmailIntegration();

  if (connections.length === 0) return null;

  const total = analyses.length;
  if (total === 0) return null;

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Mail className="h-4 w-4" />
          {t("emailInsights" as any) || "תובנות מייל"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(categorySummary).map(([cat, count]) => {
            const Icon = CATEGORY_ICONS[cat] || Mail;
            const label = CATEGORY_LABELS[cat]?.[lang] || cat;
            return (
              <Badge key={cat} variant="outline" className="gap-1 text-[10px]">
                <Icon className="h-3 w-3" />
                {label}: {count}
              </Badge>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {total} {t("emailsAnalyzed" as any) || "מיילים נותחו"}
        </p>
      </CardContent>
    </Card>
  );
};

export default EmailInsightsWidget;
