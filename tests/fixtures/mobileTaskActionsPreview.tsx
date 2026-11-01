import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ListView from '@/components/views/ListView';
import CardsView from '@/components/views/CardsView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import '@/index.css';

function Fixture() {
  const [statuses, setStatuses] = useState({ list: 'בטיפול', card: 'בטיפול' });
  const [opened, setOpened] = useState<string | null>(null);
  const item = (id: 'list' | 'card') => ({ id, title: id === 'list' ? 'משימת רשימה' : 'משימת כרטיס', status: statuses[id], statusOptions: ['טרם החל', 'בטיפול', 'בוצע'].map(value => ({value, label: value})) });
  return <main dir="rtl" className="mx-auto max-w-[390px] space-y-6 p-4">
    <h1 className="text-xl font-bold">בדיקת פעולות משימה בנייד</h1><p>נתוני דוגמה מקומיים בלבד</p>
    <ListView items={[item('list')]} onClick={setOpened} onStatusChange={(id, status) => setStatuses(prev => ({...prev, [id]: status}))} />
    <CardsView items={[item('card')]} onClick={setOpened} onStatusChange={(id, status) => setStatuses(prev => ({...prev, [id]: status}))} />
    <output>רשימה: {statuses.list} / כרטיס: {statuses.card}</output>
    <Dialog open={!!opened} onOpenChange={() => setOpened(null)}><DialogContent><DialogHeader><DialogTitle>פרטי משימה</DialogTitle><DialogDescription>אמור להיפתח רק בלחיצה על גוף המשימה</DialogDescription></DialogHeader>{opened}</DialogContent></Dialog>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
