import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Search, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import InlineNotesTextarea from '@/components/InlineNotesTextarea';

interface Podcast {
  id: string;
  title: string;
  host: string | null;
  status: string | null;
  notes: string | null;
  updated_at: string;
  created_at: string;
  status_changed_at: string | null;
}

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const PodcastsManager = () => {
  const { user } = useAuth();
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newPodcast, setNewPodcast] = useState({ title: '', host: '' });

  useEffect(() => {
    if (user) {
      fetchPodcasts();
    }
  }, [user]);

  const fetchPodcasts = async () => {
    const { data, error } = await supabase
      .from('podcasts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('שגיאה בטעינת הפודקאסטים');
      console.error(error);
    } else {
      setPodcasts(data || []);
    }
    setLoading(false);
  };

  const addPodcast = async () => {
    if (!newPodcast.title.trim()) {
      toast.error('נא להזין שם פודקאסט');
      return;
    }

    const { error } = await supabase.from('podcasts').insert({
      user_id: user?.id,
      title: newPodcast.title,
      host: newPodcast.host || null,
      status: 'להאזין',
    });

    if (error) {
      toast.error('שגיאה בהוספת הפודקאסט');
      console.error(error);
    } else {
      toast.success('הפודקאסט נוסף בהצלחה');
      setNewPodcast({ title: '', host: '' });
      fetchPodcasts();
    }
  };

  const updatePodcastStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('podcasts')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('שגיאה בעדכון הסטטוס');
      return;
    }

    setPodcasts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const updatePodcastNotes = async (id: string, notes: string) => {
    const { error } = await supabase
      .from('podcasts')
      .update({ notes })
      .eq('id', id);

    if (error) {
      toast.error('שגיאה בעדכון ההערות');
      return;
    }

    setPodcasts((prev) => prev.map((p) => (p.id === id ? { ...p, notes } : p)));
  };

  const deletePodcast = async (id: string) => {
    const { error } = await supabase.from('podcasts').delete().eq('id', id);

    if (error) {
      toast.error('שגיאה במחיקת הפודקאסט');
      return;
    }

    toast.success('הפודקאסט נמחק');
    setPodcasts((prev) => prev.filter((p) => p.id !== id));
  };

  const filteredPodcasts = podcasts.filter(
    (podcast) =>
      podcast.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (podcast.host && podcast.host.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">טוען פודקאסטים...</div>;
  }

  const listenedCount = podcasts.filter(p => p.status === 'נשמע').length;
  const listeningCount = podcasts.filter(p => p.status === 'בהאזנה').length;
  const toListenCount = podcasts.filter(p => p.status === 'להאזין').length;

  return (
    <div className="h-full flex flex-col p-4" dir="rtl">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{listenedCount}</div>
          <div className="text-sm text-muted-foreground">נשמעו</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{listeningCount}</div>
          <div className="text-sm text-muted-foreground">בהאזנה</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{toListenCount}</div>
          <div className="text-sm text-muted-foreground">להאזין</div>
        </div>
      </div>

      {/* Header with count */}
      <div className="flex items-center gap-2 mb-4">
        <Headphones className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">הפודקאסטים שלי</h2>
        <span className="text-sm text-muted-foreground">({podcasts.length} פודקאסטים)</span>
      </div>

      {/* Add new podcast */}
      <div className="flex gap-2 flex-wrap mb-4">
        <Input
          placeholder="שם הפודקאסט"
          value={newPodcast.title}
          onChange={(e) => setNewPodcast({ ...newPodcast, title: e.target.value })}
          className="flex-1 min-w-[200px]"
          dir="rtl"
        />
        <Input
          placeholder="מגיש/ה"
          value={newPodcast.host}
          onChange={(e) => setNewPodcast({ ...newPodcast, host: e.target.value })}
          className="flex-1 min-w-[150px]"
          dir="rtl"
        />
        <Button onClick={addPodcast}>
          <Plus className="h-4 w-4 ml-1" />
          הוסף פודקאסט
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חפש פודקאסט או מגיש..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
          dir="rtl"
        />
      </div>

      {/* Podcasts table with scroll */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם הפודקאסט</TableHead>
              <TableHead className="text-right">מגיש/ה</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="text-right">שינוי סטטוס</TableHead>
              <TableHead className="text-right">נוצר</TableHead>
              <TableHead className="text-right">עודכן</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPodcasts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {searchTerm ? 'לא נמצאו תוצאות' : 'אין פודקאסטים עדיין'}
                </TableCell>
              </TableRow>
            ) : (
              filteredPodcasts.map((podcast) => (
                <TableRow key={podcast.id}>
                  <TableCell className="font-medium">{podcast.title}</TableCell>
                  <TableCell>{podcast.host || '-'}</TableCell>
                  <TableCell>
                    <Select
                      value={podcast.status || 'להאזין'}
                      onValueChange={(value) => updatePodcastStatus(podcast.id, value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="להאזין">להאזין</SelectItem>
                        <SelectItem value="בהאזנה">בהאזנה</SelectItem>
                        <SelectItem value="נשמע">נשמע</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <InlineNotesTextarea
                      placeholder="הוסף הערות..."
                      initialValue={podcast.notes}
                      onCommit={(val) => updatePodcastNotes(podcast.id, val)}
                      className="min-w-[150px] text-right min-h-[60px] w-full resize-y"
                      dir="rtl"
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDateTime(podcast.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDateTime(podcast.updated_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePodcast(podcast.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default PodcastsManager;
