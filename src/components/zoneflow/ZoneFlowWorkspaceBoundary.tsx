import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  name: string;
  onBack: () => void;
}

interface State { failed: boolean }

export class ZoneFlowWorkspaceBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`ZoneFlow workspace crashed: ${this.props.name}`, error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="mx-auto my-10 max-w-xl rounded-3xl border border-amber-300 bg-amber-50 p-7 text-slate-900 shadow-sm" dir="rtl">
        <AlertTriangle className="mb-4 h-8 w-8 text-amber-600" />
        <h2 className="text-xl font-bold">המרחב {this.props.name} נתקל בתקלה</h2>
        <p className="mt-2 text-sm text-slate-600">שאר ZoneFlow עדיין זמין. אפשר לנסות לפתוח את המרחב מחדש או לחזור למסך הראשי בלי לקבל דף לבן.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => this.setState({ failed: false })}><RefreshCcw className="h-4 w-4" />נסה שוב</Button>
          <Button variant="outline" onClick={this.props.onBack}><ArrowRight className="h-4 w-4" />חזרה ל-ZoneFlow הראשי</Button>
        </div>
      </div>
    );
  }
}
