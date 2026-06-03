import { useState, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "site_pin_verified";

export function usePinGate() {
  const { user } = useAuth();
  const [verified, setVerified] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === "true";
  });
  const [pinEnabled, setPinEnabled] = useState<boolean | null>(null);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setPinEnabled(null);
      setHasPin(null);
      return;
    }

    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("pin_enabled")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setPinEnabled(data.pin_enabled);
        // PIN value is never sent to the client; existence is implied by pin_enabled
        setHasPin(data.pin_enabled);
        if (!data.pin_enabled) {
          setVerified(true);
        }
      } else {
        setPinEnabled(false);
        setHasPin(false);
        setVerified(true);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const verify = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setVerified(true);
  };

  const reset = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setVerified(false);
  };

  return { verified, verify, reset, pinEnabled, hasPin, loading, setHasPin };
}

// PIN Setup component for new users
export function PinSetup({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [pin, setPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [step, setStep] = useState<"set" | "confirm">("set");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [step]);

  const handleChange = (index: number, value: string, isConfirm: boolean) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const setter = isConfirm ? setConfirmPin : setPin;
    const current = isConfirm ? confirmPin : pin;
    const newPin = [...current];
    newPin[index] = digit;
    setter(newPin);

    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && index === 3) {
      const fullPin = newPin.join("");
      if (fullPin.length === 4) {
        if (!isConfirm) {
          // Move to confirm step
          setTimeout(() => {
            setStep("confirm");
            setConfirmPin(["", "", "", ""]);
          }, 200);
        } else {
          // Verify match
          const originalPin = pin.join("");
          if (fullPin === originalPin) {
            savePin(fullPin);
          } else {
            toast.error("הקודים לא תואמים, נסה שוב");
            setStep("set");
            setPin(["", "", "", ""]);
            setConfirmPin(["", "", "", ""]);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
          }
        }
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    const current = step === "confirm" ? confirmPin : pin;
    if (e.key === "Backspace" && !current[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const savePin = async (pinCode: string) => {
    if (!user) return;
    const { error } = await (supabase.rpc as any)("set_pin", { input_pin: pinCode });

    if (error) {
      toast.error("שגיאה בשמירת הקוד");
      return;
    }

    toast.success("קוד הגישה נשמר בהצלחה!");
    onSuccess();
  };

  const currentPin = step === "confirm" ? confirmPin : pin;
  const isConfirm = step === "confirm";

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4"
      dir="rtl"
    >
      <Card className="w-full max-w-sm shadow-2xl border-0 bg-card/95 backdrop-blur">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold">
            {isConfirm ? "אשר את הקוד" : "הגדר קוד גישה"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isConfirm
              ? "הזן את הקוד שוב לאישור"
              : "בחר קוד בן 4 ספרות לכניסה מהירה"}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex justify-center gap-3" dir="ltr">
              {currentPin.map((digit, i) => (
                <Input
                  key={`${step}-${i}`}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value, isConfirm)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-14 h-14 text-center text-2xl font-bold"
                  autoComplete="off"
                />
              ))}
            </div>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={async () => {
                if (!user) return;
                await supabase
                  .from("profiles")
                  .update({ pin_enabled: false })
                  .eq("user_id", user.id);
                toast.success("קוד גישה לא הוגדר — אפשר להפעיל בהגדרות");
                onSuccess();
              }}
            >
              דלג — לא רוצה קוד גישה
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// PIN verification component
export default function PinGate({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [pin, setPin] = useState(["", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const digit = value.slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);

    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && index === 3) {
      const fullPin = newPin.join("");
      if (fullPin.length === 4) {
        verifyPin(fullPin);
      }
    }
  };

  const verifyPin = async (fullPin: string) => {
    if (!user) return;

    const { data, error } = await (supabase.rpc as any)("verify_pin", { input_pin: fullPin });

    if (!error && data === true) {
      toast.success("קוד נכון!");
      onSuccess();
    } else {
      toast.error("קוד שגוי");
      setPin(["", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullPin = pin.join("");
    if (fullPin.length < 4) {
      toast.error("נא להזין 4 ספרות");
      return;
    }
    verifyPin(fullPin);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4"
      dir="rtl"
    >
      <Card className="w-full max-w-sm shadow-2xl border-0 bg-card/95 backdrop-blur">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold">הזן קוד כניסה</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-3" dir="ltr">
              {pin.map((digit, i) => (
                <Input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-14 h-14 text-center text-2xl font-bold"
                  autoComplete="off"
                />
              ))}
            </div>
            <Button type="submit" className="w-full">
              כניסה
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
