import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props { children: ReactNode }
interface State { failed: boolean; retryKey: number }

export default class PlannerErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Personal planner render failed", error, info);
  }

  private retry = () => {
    this.setState((current) => ({ failed: false, retryKey: current.retryKey + 1 }));
  };

  render() {
    if (this.state.failed) {
      return (
        <div className="mx-auto my-12 max-w-xl rounded-3xl border border-amber-300 bg-amber-50 p-7 text-right text-slate-900 shadow-sm" dir="rtl">
          <AlertTriangle className="mb-4 h-8 w-8 text-amber-600" />
          <h2 className="text-xl font-bold">מתכנן הלו״ז נשאר זמין</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">אירוע לא תקין נעצר לפני שהפיל את כל האתר. לחץ על ניסיון חוזר כדי לטעון מחדש רק את המתכנן.</p>
          <Button className="mt-5" onClick={this.retry}><RefreshCcw className="h-4 w-4" />נסה שוב</Button>
        </div>
      );
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
