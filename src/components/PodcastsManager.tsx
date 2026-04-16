import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Search, Headphones, Download } from 'lucide-react';
import { exportToExcel } from '@/lib/exportToExcel';
import { toast } from 'sonner';
import { useRecycleBin } from '@/hooks/useRecycleBin';
import InlineNotesTextarea from '@/components/InlineNotesTextarea';
import DashboardDisplayToolbar from "@/components/DashboardDisplayToolbar";
import { useDashboardDisplay } from "@/hooks/useDashboardDisplay";
import ListView from '@/components/views/ListView';
import CardsView from '@/components/views/CardsView';
import KanbanView from '@/components/views/KanbanView';
import CompactView from '@/components/views/CompactView';
import { useLanguage } from '@/hooks/useLanguage';

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

const formatDateTime = (dateStr: string, locale: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

const PodcastsManager = () => {
  const { lang, dir } = useLanguage();
  const isHebrew = lang === "he";
  const locale = isHebrew ? "he-IL" : "en-US";
  const { viewMode, themeKey, setViewMode, setTheme } = useDashboardDisplay("podcasts");
  const { user } = useAuth();
  const { softDelete } = useRecycleBin();
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newPodcast, setNewPodcast] = useState({ title: '', host: '' });
  const copy = isHebrew ? {
    loadError: 'שגיאה בטעינת הפודקאסטים',
    titleRequired: 'נא להזין שם פודקאסט',
    addError: 'שגיאה בהוספת הפודקאסט',
    added: 'הפודקאסט נוסף בהצלחה',
    updateStatusError: 'שגיאה בעדכון הסטטוס',
    updateNotesError: 'שגיאה בעדכון ההערות',
    deleted: 'הפודקאסט הועבר לסל המחזור',
    loading: 'טוען פודקאסטים...',
    listened: 'נשמעו',
    listening: 'בהאזנה',
    toListen: 'להאזין',
    myPodcasts: 'הפודקאסטים שלי',
    podcastsCount: 'פודקאסטים',
    export: 'ייצוא',
    podcastName: 'שם הפודקאסט',
    host: 'מגיש/ה',
    addPodcast: 'הוסף פודקאסט',
    search: 'חפש פודקאסט או מגיש...',
    noResults: 'לא נמצאו תוצאות',
    noPodcasts: 'אין פודקאסטים עדיין',
    status: 'סטטוס',
    notes: 'הערות',
    statusChanged: 'שינוי סטטוס',
    created: 'נוצר',
    updated: 'עודכן',
    addNotes: 'הוסף הערות...',
  } : {
    loadError: 'Error loading podcasts',
    titleRequired: 'Please enter a podcast name',
    addError: 'Error adding podcast',
    added: 'Podcast added successfully',
    updateStatusError: 'Error updating status',
    updateNotesError: 'Error updating notes',
    deleted: 'Podcast moved to recycle bin',
    loading: 'Loading podcasts...',
    listened: 'Listened',
    listening: 'Listening',
    toListen: 'To listen',
    myPodcasts: 'My podcasts',
    podcastsCount: 'podcasts',
    export: 'Export',
    podcastName: 'Podcast name',
    host: 'Host',
    addPodcast: 'Add podcast',
    search: 'Search podcast or host...',
    noResults: 'No results found',
    noPodcasts: 'No podcasts yet',
    status: 'Status',
    notes: 'Notes',
    statusChanged: 'Status changed',
    created: 'Created',
    updated: 'Updated',
    addNotes: 'Add notes...',
  };

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
      toast.error(copy.loadError);
      console.error(error);
    } else {
      setPodcasts(data || []);
    }
    setLoading(false);
  };

  const addPodcast = async () => {
    if (!newPodcast.title.trim()) {
      toast.error(copy.titleRequired);
      return;
    }

    const { error } = await supabase.from('podcasts').insert({
      user_id: user?.id,
      title: newPodcast.title,
      host: newPodcast.host || null,
      status: 'להאזין',
    });

    if (error) {
      toast.error(copy.addError);
      console.error(error);
    } else {
      toast.success(copy.added);
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
      toast.error(copy.updateStatusError);
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
      toast.error(copy.updateNotesError);
      return;
    }

    setPodcasts((prev) => prev.map((p) => (p.id === id ? { ...p, notes } : p)));
  };

  const deletePodcast = async (id: string) => {
    const podcast = podcasts.find(p => p.id === id);
    if (!podcast) return;
    const success = await softDelete('podcasts', id, podcast);
    if (success) {
      toast.success(copy.deleted);
      setPodcasts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const filteredPodcasts = podcasts.filter(
    (podcast) =>
      podcast.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (podcast.host && podcast.host.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">{copy.loading}</div>;
  }

  const listenedCount = podcasts.filter(p => p.status === 'נשמע').length;
  const listeningCount = podcasts.filter(p => p.status === 'בהאזנה').length;
  const toListenCount = podcasts.filter(p => p.status === 'להאזין').length;

  return (
    <div className="h-full flex flex-col p-4" dir={dir}>
      {/* Stats Dashboard */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{listenedCount}</div>
          <div className="text-sm text-muted-foreground">{copy.listened}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{listeningCount}</div>
          <div className="text-sm text-muted-foreground">{copy.listening}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{toListenCount}</div>
          <div className="text-sm text-muted-foreground">{copy.toListen}</div>
        </div>
      </div>

      {/* Header with count */}
      <div className="flex items-center gap-2 mb-4">
        <Headphones className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">{copy.myPodcasts}</h2>
        <span className="text-sm text-muted-foreground">({podcasts.length} {copy.podcastsCount})</span>
        <div className="flex-1" />
        <DashboardDisplayToolbar viewMode={viewMode} themeKey={themeKey} onViewModeChange={setViewMode} onThemeChange={setTheme} />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportToExcel(
          podcasts.map(p => ({ title: p.title, host: p.host || '', status: p.status || '', notes: p.notes || '' })),
          [{ key: 'title', label: copy.podcastName }, { key: 'host', label: copy.host }, { key: 'status', label: copy.status }, { key: 'notes', label: copy.notes }],
          copy.myPodcasts
        )}>
          <Download className="h-3.5 w-3.5" />{copy.export}
        </Button>
      </div>

      {/* Add new podcast */}
      <div className="flex gap-2 flex-wrap mb-4">
        <Input
          placeholder={copy.podcastName}
          value={newPodcast.title}
          onChange={(e) => setNewPodcast({ ...newPodcast, title: e.target.value })}
          className="flex-1 min-w-[200px]"
          dir={dir}
        />
        <Input
          placeholder={copy.host}
          value={newPodcast.host}
          onChange={(e) => setNewPodcast({ ...newPodcast, host: e.target.value })}
          className="flex-1 min-w-[150px]"
          dir={dir}
        />
        <Button onClick={addPodcast}>
          <Plus className="h-4 w-4 ml-1" />
          {copy.addPodcast}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={copy.search}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
          dir={dir}
        />
      </div>

      {/* Content area - renders based on viewMode */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          {viewMode === 'list' ? (
            <ListView
              items={filteredPodcasts.map(p => ({
                id: p.id,
                title: p.title,
                subtitle: p.host,
                status: p.status || 'להאזין',
                statusOptions: [{ value: 'להאזין', label: 'להאזין' }, { value: 'בהאזנה', label: 'בהאזנה' }, { value: 'נשמע', label: 'נשמע' }],
                notes: p.notes,
                    meta: formatDateTime(p.updated_at, locale),
              }))}
              emptyText={searchTerm ? copy.noResults : copy.noPodcasts}
              onStatusChange={updatePodcastStatus}
              onDelete={deletePodcast}
            />
          ) : viewMode === 'cards' ? (
            <CardsView
              items={filteredPodcasts.map(p => ({
                id: p.id,
                title: p.title,
                subtitle: p.host,
                status: p.status || 'להאזין',
                statusOptions: [{ value: 'להאזין', label: 'להאזין' }, { value: 'בהאזנה', label: 'בהאזנה' }, { value: 'נשמע', label: 'נשמע' }],
                notes: p.notes,
                    meta: formatDateTime(p.updated_at, locale),
              }))}
              emptyText={searchTerm ? copy.noResults : copy.noPodcasts}
              onStatusChange={updatePodcastStatus}
              onDelete={deletePodcast}
            />
          ) : viewMode === 'kanban' ? (
            <KanbanView
              items={filteredPodcasts.map(p => ({
                id: p.id,
                title: p.title,
                subtitle: p.host,
                status: p.status || 'להאזין',
                notes: p.notes,
              }))}
              columns={[
                { value: 'להאזין', label: copy.toListen, color: 'bg-orange-500/15' },
                { value: 'בהאזנה', label: copy.listening, color: 'bg-blue-500/15' },
                { value: 'נשמע', label: copy.listened, color: 'bg-green-500/15' },
              ]}
              emptyText={searchTerm ? copy.noResults : copy.noPodcasts}
              onStatusChange={updatePodcastStatus}
              onDelete={deletePodcast}
            />
          ) : viewMode === 'compact' ? (
            <CompactView
              items={filteredPodcasts.map(p => ({
                id: p.id,
                title: p.title,
                status: p.status || 'להאזין',
                subtitle: p.host,
              }))}
              emptyText={searchTerm ? copy.noResults : copy.noPodcasts}
              onDelete={deletePodcast}
            />
          ) : (
            /* Default: Table view */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">{copy.podcastName}</TableHead>
                  <TableHead className="text-right">{copy.host}</TableHead>
                  <TableHead className="text-right">{copy.status}</TableHead>
                  <TableHead className="text-right">{copy.notes}</TableHead>
                  <TableHead className="text-right">{copy.statusChanged}</TableHead>
                  <TableHead className="text-right">{copy.created}</TableHead>
                  <TableHead className="text-right">{copy.updated}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPodcasts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      {searchTerm ? copy.noResults : copy.noPodcasts}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPodcasts.map((podcast) => (
                    <TableRow key={podcast.id}>
                      <TableCell className="font-medium">
                        <Input
                          defaultValue={podcast.title}
                          className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-1"
                          dir={dir}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== podcast.title) {
                              supabase.from('podcasts').update({ title: val }).eq('id', podcast.id).then(() => {
                                setPodcasts(prev => prev.map(p => p.id === podcast.id ? { ...p, title: val } : p));
                              });
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          defaultValue={podcast.host || ''}
                          placeholder="-"
                          className="border-0 bg-transparent p-0 h-auto focus-visible:ring-1"
                          dir={dir}
                          onBlur={(e) => {
                            const val = e.target.value.trim() || null;
                            if (val !== (podcast.host || null)) {
                              supabase.from('podcasts').update({ host: val }).eq('id', podcast.id).then(() => {
                                setPodcasts(prev => prev.map(p => p.id === podcast.id ? { ...p, host: val } : p));
                              });
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={podcast.status || 'להאזין'} onValueChange={(value) => updatePodcastStatus(podcast.id, value)}>
                          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="להאזין">{copy.toListen}</SelectItem>
                            <SelectItem value="בהאזנה">{copy.listening}</SelectItem>
                            <SelectItem value="נשמע">{copy.listened}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <InlineNotesTextarea
                          placeholder={copy.addNotes}
                          initialValue={podcast.notes}
                          onCommit={(val) => updatePodcastNotes(podcast.id, val)}
                          className="min-w-[150px] text-right min-h-[60px] w-full resize-y"
                          dir={dir}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {podcast.status_changed_at ? formatDateTime(podcast.status_changed_at, locale) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(podcast.created_at, locale)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(podcast.updated_at, locale)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deletePodcast(podcast.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PodcastsManager;
