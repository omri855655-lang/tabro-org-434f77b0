import { useState } from "react";
import { createRoot } from "react-dom/client";
import AppRecoveryBoundary from "../../src/components/AppRecoveryBoundary";
import "../../src/index.css";

function TestFailure({ failed }: { failed: boolean }) {
  if (failed) throw new Error("Intentional fictional-data recovery test");
  return <p className="text-sm">לא נעשה שימוש בחשבון או בפרטי אשראי בבדיקה.</p>;
}
export default function Preview() {
  const [failed, setFailed] = useState(false);
  return <AppRecoveryBoundary><main dir="rtl" className="space-y-4 p-8"><h1 className="text-xl font-bold">בדיקת הגנה ממסך לבן</h1><button className="rounded-xl border p-3" onClick={() => setFailed(true)}>הדמה תקלה בתצוגה</button><TestFailure failed={failed} /></main></AppRecoveryBoundary>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
