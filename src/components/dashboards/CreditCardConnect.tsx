import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Clock } from "lucide-react";

const CreditCardConnect = () => {
  const { lang } = useLanguage();
  const isHe = lang === "he" || lang === "ar";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          {isHe ? "חיבור כרטיס אשראי" : "Credit Card Connection"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">
            {isHe ? "בקרוב..." : "Coming soon..."}
          </p>
          <p className="text-xs text-muted-foreground max-w-[250px]">
            {isHe
              ? "חיבור ישיר לכרטיס האשראי יהיה זמין בקרוב. בינתיים ניתן לייבא עסקאות מקובץ CSV"
              : "Direct credit card connection will be available soon. Meanwhile you can import transactions from CSV files"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditCardConnect;
