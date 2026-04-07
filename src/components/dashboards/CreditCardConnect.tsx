import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = [
  { value: "max", label: "Max" },
  { value: "cal", label: "Cal" },
  { value: "isracard", label: "Isracard" },
  { value: "visacal", label: "Visa Cal" },
  { value: "leumi-card", label: "Leumi Card" },
  { value: "amex", label: "Amex Israel" },
];

interface CreditCardConnection {
  id: string;
  provider: string;
  card_last_digits: string | null;
  display_name: string | null;
  last_sync: string | null;
  sync_status: string;
  sync_error: string | null;
  created_at: string;
}

const CreditCardConnect = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [connections, setConnections] = useState<CreditCardConnection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [lastDigits, setLastDigits] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("credit_card_connections")
      .select("id, provider, card_last_digits, display_name, last_sync, sync_status, sync_error, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setConnections((data as any[]) || []);
  }, [user]);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const addConnection = async () => {
    if (!user || !provider) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("credit_card_connections").insert({
        user_id: user.id,
        provider,
        display_name: displayName || PROVIDERS.find(p => p.value === provider)?.label || provider,
        card_last_digits: lastDigits || null,
      } as any);
      if (error) throw error;
      toast.success(t('syncSuccess'));
      setShowForm(false);
      setProvider("");
      setDisplayName("");
      setLastDigits("");
      await fetchConnections();
    } catch (e: any) {
      toast.error(t('syncError'));
    } finally {
      setLoading(false);
    }
  };

  const removeConnection = async (id: string) => {
    if (!confirm(t('confirmDisconnectCard'))) return;
    await supabase.from("credit_card_connections").delete().eq("id", id);
    toast.success(t('disconnectCard'));
    await fetchConnections();
  };

  const syncConnection = async (id: string) => {
    toast.info(t('syncing'));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.functions.invoke("credit-card-sync", {
        body: { connectionId: id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success(t('syncSuccess'));
      await fetchConnections();
    } catch {
      toast.error(t('syncError'));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t('creditCard')}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3 w-3 mr-1" />{t('connectCreditCard')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue placeholder={t('creditCardProvider')} /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={t('cardDisplayName')}
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
            <Input
              placeholder={t('lastFourDigits')}
              value={lastDigits}
              onChange={e => setLastDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
              maxLength={4}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={addConnection} disabled={!provider || loading}>
                {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {t('connect')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
            </div>
          </div>
        )}

        {connections.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground text-center py-4">{t('noTransactions')}</p>
        )}

        {connections.map(conn => (
          <div key={conn.id} className="flex items-center justify-between border rounded-lg p-3">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">
                  {conn.display_name || PROVIDERS.find(p => p.value === conn.provider)?.label}
                  {conn.card_last_digits && <span className="text-muted-foreground ml-1">****{conn.card_last_digits}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {conn.last_sync ? `${t('lastSync')}: ${new Date(conn.last_sync).toLocaleDateString()}` : t('neverSynced')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={conn.sync_status === 'success' ? 'default' : conn.sync_status === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                {conn.sync_status}
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => syncConnection(conn.id)}>
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeConnection(conn.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default CreditCardConnect;
