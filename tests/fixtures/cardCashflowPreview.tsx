import { useState } from "react";
import { createRoot } from "react-dom/client";
import CardCashflowOverview from "../../src/components/dashboards/CardCashflowOverview";
import { buildCardCashflows } from "../../src/lib/cardCashflow";
import "../../src/index.css";

function Preview() {
  const [hidden, setHidden] = useState<string[]>([]);
  const [days, setDays] = useState<Record<string, number>>({});
  const cards = buildCardCashflows([
    {id:'a',external_account_id:'max:0001',provider_name:'MAX',display_name:'MAX לדוגמה',account_type:'CARD',masked_number:'****0001',currency:'ILS'},
    {id:'b',external_account_id:'csv-card:b',provider_name:'amex',display_name:'Amex לדוגמה',account_type:'CARD',masked_number:'****0002',currency:'ILS'},
  ],[
    {id:'1',source_type:'cloud_scraper',account_external_id:'max:0001',direction:'expense',amount:1240,currency:'ILS',transaction_date:'2026-10-19',posted_date:'2026-11-10',created_at:'2026-10-20'},
    {id:'2',source_type:'cloud_scraper',account_external_id:'max:0001',direction:'income',amount:100,currency:'ILS',transaction_date:'2026-10-19',posted_date:'2026-11-10',created_at:'2026-10-20'},
    {id:'3',source_type:'credit_card_import',source_connection_id:'b',direction:'expense',amount:625,currency:'ILS',transaction_date:'2026-10-18',created_at:'2026-10-20',raw_data:{billing_date:'2026-11-02'}},
  ],'2026-10-20','2027-01-18',days);
  return <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8"><p className="text-sm text-muted-foreground">תצוגת בדיקה · נתונים דמיוניים בלבד</p><CardCashflowOverview cards={cards} hiddenKeys={hidden} saving={false} isRtl onVisibility={(key,value)=>setHidden(value?[...hidden,key]:hidden.filter(item=>item!==key))} onBillingDay={(key,day)=>{const next={...days};if(day)next[key]=day;else delete next[key];setDays(next);}} /></main>;
}
createRoot(document.getElementById("root")!).render(<Preview/>);
