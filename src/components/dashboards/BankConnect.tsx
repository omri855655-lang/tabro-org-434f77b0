import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Landmark, Clock } from "lucide-react";

const BankConnect = () => {
  const { lang } = useLanguage();
  const isHe = lang === "he" || lang === "ar";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          {isHe ? "חיבור חשבון בנק" : "Bank Account Connection"}
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
              ? "חיבור ישיר לחשבון הבנק יהיה זמין בקרוב. בינתיים ניתן לייבא עסקאות מקובץ CSV"
              : "Direct bank connection will be available soon. Meanwhile you can import transactions from CSV files"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BankConnect;
