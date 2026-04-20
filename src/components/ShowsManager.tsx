import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Search, Tv, Film, ArrowUpDown, Tag, X, CalendarPlus, Download } from 'lucide-react';
import FileImport from '@/components/FileImport';
import { exportToExcel } from '@/lib/exportToExcel';
import { useRecycleBin } from '@/hooks/useRecycleBin';
import { toast } from 'sonner';
import InlineNotesTextarea from '@/components/InlineNotesTextarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DashboardDisplayToolbar from "@/components/DashboardDisplayToolbar";
import { useDashboardDisplay } from "@/hooks/useDashboardDisplay";
import ListView from '@/components/views/ListView';
import CardsView from '@/components/views/CardsView';
import KanbanView from '@/components/views/KanbanView';
import CompactView from '@/components/views/CompactView';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Show {
  id: string;
  title: string;
  type: string | null;
  status: string | null;
  current_season: number | null;
  current_episode: number | null;
  notes: string | null;
  category: string | null;
  air_date: string | null;
  updated_at: string;
  created_at: string;
  status_changed_at: string | null;
}

interface ShowEpisodeNote {
  season: number;
  episode: number;
  title: string;
  summary: string;
}

interface ParsedShowNotes {
  plainNotes: string;
  episodeNotes: ShowEpisodeNote[];
}

const parseShowNotes = (notes: string | null): ParsedShowNotes => {
  if (!notes) return { plainNotes: "", episodeNotes: [] };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.episodeNotes)) {
      return {
        plainNotes: typeof parsed.plainNotes === "string" ? parsed.plainNotes : "",
        episodeNotes: parsed.episodeNotes.filter(Boolean),
      };
    }
  } catch {}
  return { plainNotes: notes, episodeNotes: [] };
};

const formatDateTime = (dateStr: string, locale: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

const parseNullableNumber = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

type SortField = 'title' | 'status' | 'air_date' | 'created_at' | 'updated_at' | 'category';
type SortDir = 'asc' | 'desc';

const DEFAULT_CATEGORIES = ['דרמה', 'קומדיה', 'אקשן', 'מתח', 'דוקומנטרי', 'מדע בדיוני', 'אנימציה', 'רומנטי', 'פשע', 'אימה'];

const ShowsManager = () => {
  const { viewMode, themeKey, setViewMode, setTheme } = useDashboardDisplay("shows");
  const { lang, dir } = useLanguage();
  const { user } = useAuth();
  const { softDelete } = useRecycleBin();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newShow, setNewShow] = useState({ title: '', type: 'סדרה', category: '' });
  const [activeTab, setActiveTab] = useState<'all' | 'series' | 'movies'>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [showDetail, setShowDetail] = useState<ParsedShowNotes>({ plainNotes: "", episodeNotes: [] });
  const isHebrew = lang === 'he';
  const locale = ({ he: 'he-IL', en: 'en-US', es: 'es-ES', zh: 'zh-CN', ar: 'ar-SA', ru: 'ru-RU' } as const)[lang];
  const copy = isHebrew ? {
    loadError: 'שגיאה בטעינת הסדרות',
    enterTitle: 'נא להזין שם סדרה/סרט',
    addError: 'שגיאה בהוספה',
    addSuccess: 'נוסף בהצלחה',
    updateError: 'שגיאה בעדכון',
    recycleSuccess: 'הועבר לסל המחזור',
    importError: 'שגיאה בייבוא',
    categoryExists: 'קטגוריה כבר קיימת',
    categoryAdded: 'נוספה קטגוריה',
    loading: 'טוען סדרות וסרטים...',
    title: 'הסדרות והסרטים שלי',
    items: 'פריטים',
    export: 'ייצוא',
    import: 'ייבוא סדרות',
    all: 'הכל',
    series: 'סדרות',
    movies: 'סרטים',
    titlePlaceholder: 'שם הסדרה/סרט',
    categoryPlaceholder: 'קטגוריה',
    noCategory: 'ללא קטגוריה',
    add: 'הוסף',
    search: 'חפש סדרה או סרט...',
    filterCategory: 'סנן קטגוריה',
    allCategories: 'כל הקטגוריות',
    manageCategories: 'ניהול קטגוריות',
    customCategories: 'קטגוריות מותאמות',
    newCategory: 'קטגוריה חדשה...',
    noResults: 'לא נמצאו תוצאות',
    empty: 'אין סדרות או סרטים עדיין',
    nameCol: 'שם',
    typeCol: 'סוג',
    categoryCol: 'קטגוריה',
    statusCol: 'סטטוס',
    airDateCol: 'תאריך עלייה',
    seasonCol: 'עונה',
    episodeCol: 'פרק',
    notesCol: 'הערות',
    createdCol: 'נוצר',
    statusChangedCol: 'שינוי סטטוס',
    updatedCol: 'עודכן',
    addNotes: 'הוסף הערות...',
    noneShort: 'ללא',
    sheetName: 'סדרות_וסרטים',
    showTypeSeries: 'סדרה',
    showTypeMovie: 'סרט',
    toWatch: 'לצפות',
    watching: 'בצפייה',
    watched: 'נצפה',
  } : {
    loadError: 'Error loading shows',
    enterTitle: 'Please enter a show or movie title',
    addError: 'Error adding item',
    addSuccess: 'Added successfully',
    updateError: 'Error updating item',
    recycleSuccess: 'Moved to recycle bin',
    importError: 'Error importing items',
    categoryExists: 'Category already exists',
    categoryAdded: 'Category added',
    loading: 'Loading shows and movies...',
    title: 'My Shows & Movies',
    items: 'items',
    export: 'Export',
    import: 'Import shows',
    all: 'All',
    series: 'Series',
    movies: 'Movies',
    titlePlaceholder: 'Show or movie title',
    categoryPlaceholder: 'Category',
    noCategory: 'No category',
    add: 'Add',
    search: 'Search shows or movies...',
    filterCategory: 'Filter category',
    allCategories: 'All categories',
    manageCategories: 'Manage categories',
    customCategories: 'Custom categories',
    newCategory: 'New category...',
    noResults: 'No results found',
    empty: 'No shows or movies yet',
    nameCol: 'Name',
    typeCol: 'Type',
    categoryCol: 'Category',
    statusCol: 'Status',
    airDateCol: 'Air date',
    seasonCol: 'Season',
    episodeCol: 'Episode',
    notesCol: 'Notes',
    createdCol: 'Created',
    statusChangedCol: 'Status changed',
    updatedCol: 'Updated',
    addNotes: 'Add notes...',
    noneShort: 'None',
    sheetName: 'Shows_Movies',
    showTypeSeries: 'Series',
    showTypeMovie: 'Movie',
    toWatch: 'To watch',
    watching: 'Watching',
    watched: 'Watched',
  };
  const statusOptions = [
    { value: 'לצפות', label: copy.toWatch },
    { value: 'בצפייה', label: copy.watching },
    { value: 'נצפה', label: copy.watched },
  ];
  const getTypeLabel = (type: string | null) => type === 'סרט' ? copy.showTypeMovie : copy.showTypeSeries;

  useEffect(() => {
    if (user) fetchShows();
  }, [user]);

  // Extract unique categories from shows
  const allCategories = useMemo(() => {
    const fromShows = shows.map(s => s.category).filter(Boolean) as string[];
    const merged = [...new Set([...DEFAULT_CATEGORIES, ...customCategories, ...fromShows])];
    return merged.sort();
  }, [shows, customCategories]);

  const fetchShows = async () => {
    const { data, error } = await supabase
      .from('shows')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(copy.loadError);
      console.error(error);
    } else {
      setShows((data || []) as Show[]);
    }
    setLoading(false);
  };

  const addShow = async () => {
    if (!newShow.title.trim()) {
      toast.error(copy.enterTitle);
      return;
    }

    const { error } = await supabase.from('shows').insert({
      user_id: user?.id,
      title: newShow.title,
      type: newShow.type,
      status: 'לצפות',
      category: newShow.category || null,
    } as any);

    if (error) {
      toast.error(copy.addError);
      console.error(error);
    } else {
      toast.success(copy.addSuccess);
      setNewShow({ title: '', type: 'סדרה', category: '' });
      fetchShows();
    }
  };

  const updateShow = async (id: string, updates: Partial<Show>) => {
    const { error } = await supabase
      .from('shows')
      .update(updates as any)
      .eq('id', id);

    if (error) {
      toast.error(copy.updateError);
    } else {
      setShows((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    }
  };

  const openShowDetail = (show: Show) => {
    const parsed = parseShowNotes(show.notes);
    setSelectedShow(show);
    setShowDetail({
      plainNotes: parsed.plainNotes,
      episodeNotes: parsed.episodeNotes,
    });
  };

  const saveShowDetail = async () => {
    if (!selectedShow || !user) return;

    const plainNotes = showDetail.plainNotes.trim();
    const episodeRows = showDetail.episodeNotes
      .map((note, index) => ({
        user_id: user.id,
        show_id: selectedShow.id,
        season_number: note.season || 1,
        episode_number: note.episode || 1,
        episode_title: note.title.trim() || null,
        summary: note.summary.trim() || null,
        sort_order: index,
      }))
      .filter((note) => note.episode_title || note.summary);

    const { error: showError } = await supabase
      .from('shows')
      .update({
        notes: plainNotes || null,
        current_season: selectedShow.current_season,
        current_episode: selectedShow.current_episode,
        title: selectedShow.title,
        category: selectedShow.category,
        status: selectedShow.status,
      })
      .eq('id', selectedShow.id);

    if (showError) {
      toast.error(isHebrew ? 'שגיאה בשמירת פרטי הסדרה/הסרט' : 'Error saving show details');
      return;
    }

    const { error: deleteError } = await supabase
      .from('show_episode_notes')
      .delete()
      .eq('show_id', selectedShow.id);

    if (deleteError) {
      toast.error(isHebrew ? 'שגיאה בעדכון פרקי הסדרה' : 'Error updating episode notes');
      return;
    }

    if (episodeRows.length > 0) {
      const { error: episodeError } = await supabase
        .from('show_episode_notes')
        .insert(episodeRows);

      if (episodeError) {
        toast.error(isHebrew ? 'שגיאה בשמירת פרקי הסדרה' : 'Error saving episode notes');
        return;
      }
    }

    setShows((prev) => prev.map((show) => (
      show.id === selectedShow.id
        ? {
            ...show,
            title: selectedShow.title,
            category: selectedShow.category,
            status: selectedShow.status,
            notes: plainNotes || null,
            current_season: selectedShow.current_season,
            current_episode: selectedShow.current_episode,
          }
        : show
    )));
    setSelectedShow(null);
    toast.success(isHebrew ? 'פרטי הסדרה/הסרט נשמרו' : 'Show details saved');
  };

  useEffect(() => {
    if (!selectedShow || selectedShow.type !== 'סדרה') return;

    let cancelled = false;

    const loadEpisodeNotes = async () => {
      const { data, error } = await supabase
        .from('show_episode_notes')
        .select('season_number, episode_number, episode_title, summary, sort_order')
        .eq('show_id', selectedShow.id)
        .order('sort_order', { ascending: true });

      if (cancelled || error || !data || data.length === 0) return;

      setShowDetail((prev) => ({
        ...prev,
        episodeNotes: data.map((note) => ({
          season: note.season_number || 1,
          episode: note.episode_number || 1,
          title: note.episode_title || '',
          summary: note.summary || '',
        })),
      }));
    };

    void loadEpisodeNotes();

    return () => {
      cancelled = true;
    };
  }, [selectedShow]);

  const addEpisodeNote = () => {
    const season = selectedShow?.current_season || 1;
    const episode = (selectedShow?.current_episode || 0) + 1;
    setShowDetail((prev) => ({
      ...prev,
      episodeNotes: [...prev.episodeNotes, { season, episode, title: "", summary: "" }],
    }));
  };

  const deleteShow = async (id: string) => {
    const show = shows.find(s => s.id === id);
    if (!show) return;
    const success = await softDelete('shows', id, show);
    if (success) {
      toast.success(copy.recycleSuccess);
      setShows((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleImportShows = async (rows: Record<string, string>[]) => {
    if (!user) return;
    const inserts = rows.map(row => ({
      user_id: user.id,
      title: row['שם'] || row['title'] || Object.values(row)[0] || '',
      type: row['סוג'] || row['type'] || 'סדרה',
      status: row['סטטוס'] || row['status'] || 'לצפות',
      category: row['קטגוריה'] || row['category'] || null,
      notes: row['הערות'] || row['notes'] || null,
    })).filter(r => r.title.trim());

    const { error } = await supabase.from('shows').insert(inserts as any);
    if (error) {
      toast.error(copy.importError);
      console.error(error);
    } else {
      fetchShows();
    }
  };

  const addCustomCategory = () => {
    const cat = newCategoryInput.trim();
    if (!cat) return;
    if (allCategories.includes(cat)) {
      toast.error(copy.categoryExists);
      return;
    }
    setCustomCategories(prev => [...prev, cat]);
    setNewCategoryInput('');
    toast.success(`${copy.categoryAdded}: "${cat}"`);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = shows.filter((show) =>
      show.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter by tab
    if (activeTab === 'series') list = list.filter(s => s.type === 'סדרה');
    if (activeTab === 'movies') list = list.filter(s => s.type === 'סרט');

    // Filter by category
    if (filterCategory !== 'all') list = list.filter(s => s.category === filterCategory);

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) cmp = 0;
      else if (aVal == null) cmp = 1;
      else if (bVal == null) cmp = -1;
      else if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal, isHebrew ? 'he' : 'en');
      else cmp = 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [shows, searchTerm, activeTab, filterCategory, sortField, sortDir]);

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead
      className="text-right cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground/50'}`} />
      </div>
    </TableHead>
  );

  if (loading) return <div className="p-8 text-center text-muted-foreground">{copy.loading}</div>;

  const seriesCount = shows.filter(s => s.type === 'סדרה').length;
  const moviesCount = shows.filter(s => s.type === 'סרט').length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden" dir={dir}>
      <div className="flex items-center gap-2 mb-4">
        <Tv className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">{copy.title}</h2>
        <span className="text-sm text-muted-foreground">({shows.length} {copy.items})</span>
        <div className="flex-1" />
        <DashboardDisplayToolbar viewMode={viewMode} themeKey={themeKey} onViewModeChange={setViewMode} onThemeChange={setTheme} />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportToExcel(
          shows.map(s => ({ title: s.title, type: s.type || '', status: s.status || '', category: s.category || '', season: s.current_season, episode: s.current_episode, notes: parseShowNotes(s.notes).plainNotes || '' })),
          [{ key: 'title', label: copy.nameCol }, { key: 'type', label: copy.typeCol }, { key: 'status', label: copy.statusCol }, { key: 'category', label: copy.categoryCol }, { key: 'season', label: copy.seasonCol }, { key: 'episode', label: copy.episodeCol }, { key: 'notes', label: copy.notesCol }],
          copy.sheetName
        )}>
          <Download className="h-3.5 w-3.5" />{copy.export}
        </Button>
        <FileImport onImport={handleImportShows} label={copy.import} />
      </div>

      {/* Tabs: All / Series / Movies */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-shrink-0 mb-3">
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            {copy.all} ({shows.length})
          </TabsTrigger>
          <TabsTrigger value="series" className="gap-1.5">
            <Tv className="h-3.5 w-3.5" />
            {copy.series} ({seriesCount})
          </TabsTrigger>
          <TabsTrigger value="movies" className="gap-1.5">
            <Film className="h-3.5 w-3.5" />
            {copy.movies} ({moviesCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Add new show */}
      <div className="flex gap-2 flex-wrap mb-3 flex-shrink-0">
        <Input
          placeholder={copy.titlePlaceholder}
          value={newShow.title}
          onChange={(e) => setNewShow({ ...newShow, title: e.target.value })}
          className="flex-1 min-w-[180px]"
          dir={dir}
          onKeyDown={(e) => e.key === 'Enter' && addShow()}
        />
        <Select
          value={newShow.type}
          onValueChange={(value) => setNewShow({ ...newShow, type: value })}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="סדרה">{copy.showTypeSeries}</SelectItem>
            <SelectItem value="סרט">{copy.showTypeMovie}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={newShow.category || '_none'}
          onValueChange={(value) => setNewShow({ ...newShow, category: value === '_none' ? '' : value })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={copy.categoryPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{copy.noCategory}</SelectItem>
            {allCategories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={addShow}>
          <Plus className="h-4 w-4 ml-1" />
          {copy.add}
        </Button>
      </div>

      {/* Search + Category filter + Manage categories */}
      <div className="flex gap-2 mb-3 flex-shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
          <Input
            placeholder={copy.search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={dir === 'rtl' ? 'pr-10' : 'pl-10'}
            dir={dir}
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={copy.filterCategory} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{copy.allCategories}</SelectItem>
            {allCategories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Tag className="h-3.5 w-3.5" />
              {copy.manageCategories}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" dir={dir}>
            <h4 className="font-bold text-sm mb-2">{copy.customCategories}</h4>
            <div className="flex gap-1.5 mb-2">
              <Input
                placeholder={copy.newCategory}
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                className="text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addCustomCategory()}
              />
              <Button size="sm" onClick={addCustomCategory}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-auto">
              {allCategories.map(cat => (
                <Badge key={cat} variant="secondary" className="gap-1 text-xs">
                  {cat}
                  {customCategories.includes(cat) && (
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => setCustomCategories(prev => prev.filter(c => c !== cat))}
                    />
                  )}
                </Badge>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Content area - renders based on viewMode */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          {viewMode === 'list' ? (
            <ListView
              items={filteredAndSorted.map(s => ({
                id: s.id,
                title: s.title,
                subtitle: `${getTypeLabel(s.type)}${s.category ? ` • ${s.category}` : ''}`,
                status: s.status || 'לצפות',
                statusOptions,
                notes: parseShowNotes(s.notes).plainNotes,
                meta: s.current_season ? `${copy.seasonCol} ${s.current_season} • ${copy.episodeCol} ${s.current_episode || '?'}` : undefined,
              }))}
              emptyText={searchTerm ? copy.noResults : copy.empty}
              onStatusChange={(id, status) => updateShow(id, { status })}
              onDelete={deleteShow}
            />
          ) : viewMode === 'cards' ? (
            <CardsView
              items={filteredAndSorted.map(s => ({
                id: s.id,
                title: s.title,
                subtitle: `${getTypeLabel(s.type)}${s.category ? ` • ${s.category}` : ''}`,
                status: s.status || 'לצפות',
                statusOptions,
                notes: parseShowNotes(s.notes).plainNotes,
                meta: s.current_season ? `${copy.seasonCol} ${s.current_season} • ${copy.episodeCol} ${s.current_episode || '?'}` : undefined,
              }))}
              emptyText={searchTerm ? copy.noResults : copy.empty}
              onStatusChange={(id, status) => updateShow(id, { status })}
              onDelete={deleteShow}
            />
          ) : viewMode === 'kanban' ? (
            <KanbanView
              items={filteredAndSorted.map(s => ({
                id: s.id,
                title: s.title,
                subtitle: `${getTypeLabel(s.type)}${s.category ? ` • ${s.category}` : ''}`,
                status: s.status || 'לצפות',
                notes: parseShowNotes(s.notes).plainNotes,
              }))}
              columns={[
                { value: 'לצפות', label: copy.toWatch, color: 'bg-orange-500/15' },
                { value: 'בצפייה', label: copy.watching, color: 'bg-blue-500/15' },
                { value: 'נצפה', label: copy.watched, color: 'bg-green-500/15' },
              ]}
              emptyText={searchTerm ? copy.noResults : copy.empty}
              onStatusChange={(id, status) => updateShow(id, { status })}
              onDelete={deleteShow}
            />
          ) : viewMode === 'compact' ? (
            <CompactView
              items={filteredAndSorted.map(s => ({
                id: s.id,
                title: s.title,
                status: s.status || 'לצפות',
                subtitle: getTypeLabel(s.type),
              }))}
              emptyText={searchTerm ? copy.noResults : copy.empty}
              onDelete={deleteShow}
            />
          ) : (
            /* Default: Table view */
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader field="title" label={copy.nameCol} />
                  <TableHead className="text-right">{copy.typeCol}</TableHead>
                  <SortHeader field="category" label={copy.categoryCol} />
                  <SortHeader field="status" label={copy.statusCol} />
                  <SortHeader field="air_date" label={copy.airDateCol} />
                  <TableHead className="text-right">{copy.seasonCol}</TableHead>
                  <TableHead className="text-right">{copy.episodeCol}</TableHead>
                  <TableHead className="text-right">{copy.notesCol}</TableHead>
                  <SortHeader field="created_at" label={copy.createdCol} />
                  <TableHead className="text-right">{copy.statusChangedCol}</TableHead>
                  <SortHeader field="updated_at" label={copy.updatedCol} />
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground">
                      {searchTerm ? copy.noResults : copy.empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSorted.map((show) => (
                    <TableRow key={show.id} onDoubleClick={() => openShowDetail(show)}>
                      <TableCell className="font-medium">
                        <Input
                          defaultValue={show.title}
                          className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-1"
                          dir={dir}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== show.title) updateShow(show.id, { title: val });
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={show.type === 'סרט' ? 'default' : 'secondary'} className="text-xs">
                          {show.type === 'סרט' ? <Film className="h-3 w-3 ml-1" /> : <Tv className="h-3 w-3 ml-1" />}
                          {getTypeLabel(show.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select value={show.category || '_none'} onValueChange={(v) => updateShow(show.id, { category: v === '_none' ? null : v })}>
                          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder={copy.categoryPlaceholder} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">{copy.noneShort}</SelectItem>
                            {allCategories.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={show.status || 'לצפות'} onValueChange={(value) => updateShow(show.id, { status: value })}>
                          <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="date" defaultValue={show.air_date || ''} onBlur={(e) => { const val = e.target.value || null; if (val !== show.air_date) updateShow(show.id, { air_date: val } as any); }} className="w-[130px] h-8 text-xs" />
                      </TableCell>
                      <TableCell>
                        {show.type === 'סדרה' && (
                          <Input type="number" min="1" defaultValue={show.current_season ?? ''} onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }} onBlur={(e) => { const next = parseNullableNumber(e.target.value); if (next !== (show.current_season ?? null)) updateShow(show.id, { current_season: next }); }} className="w-16 h-8" placeholder="-" />
                        )}
                      </TableCell>
                      <TableCell>
                        {show.type === 'סדרה' && (
                          <Input type="number" min="1" defaultValue={show.current_episode ?? ''} onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }} onBlur={(e) => { const next = parseNullableNumber(e.target.value); if (next !== (show.current_episode ?? null)) updateShow(show.id, { current_episode: next }); }} className="w-16 h-8" placeholder="-" />
                        )}
                      </TableCell>
                      <TableCell>
                        <InlineNotesTextarea placeholder={copy.addNotes} initialValue={parseShowNotes(show.notes).plainNotes} onCommit={(val) => updateShow(show.id, { notes: val })} className={`min-w-[150px] min-h-[50px] w-full resize-y text-xs ${dir === 'rtl' ? 'text-right' : 'text-left'}`} dir={dir} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{formatDateTime(show.created_at, locale)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{show.status_changed_at ? formatDateTime(show.status_changed_at, locale) : '-'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{formatDateTime(show.updated_at, locale)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteShow(show.id)} className="text-destructive hover:text-destructive h-8 w-8">
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

      <Dialog open={!!selectedShow} onOpenChange={(open) => { if (!open) setSelectedShow(null); }}>
        <DialogContent className="max-w-4xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>{isHebrew ? 'פרטי סדרה / סרט' : 'Show / Movie Details'}</DialogTitle>
          </DialogHeader>
          {selectedShow && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{copy.nameCol}</Label>
                  <Input value={selectedShow.title} onChange={(e) => setSelectedShow({ ...selectedShow, title: e.target.value })} dir={dir} />
                </div>
                <div className="space-y-1">
                  <Label>{copy.categoryCol}</Label>
                  <Input value={selectedShow.category || ""} onChange={(e) => setSelectedShow({ ...selectedShow, category: e.target.value || null })} dir={dir} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label>{copy.typeCol}</Label>
                  <Input value={getTypeLabel(selectedShow.type)} disabled dir={dir} />
                </div>
                <div className="space-y-1">
                  <Label>{copy.statusCol}</Label>
                  <Select value={selectedShow.status || "לצפות"} onValueChange={(value) => setSelectedShow({ ...selectedShow, status: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{copy.seasonCol}</Label>
                  <Input type="number" min="1" value={selectedShow.current_season ?? ""} onChange={(e) => setSelectedShow({ ...selectedShow, current_season: parseNullableNumber(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>{copy.episodeCol}</Label>
                  <Input type="number" min="1" value={selectedShow.current_episode ?? ""} onChange={(e) => setSelectedShow({ ...selectedShow, current_episode: parseNullableNumber(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>{isHebrew ? 'סיכום כללי / הערות' : 'General summary / notes'}</Label>
                <Textarea
                  value={showDetail.plainNotes}
                  onChange={(e) => setShowDetail((prev) => ({ ...prev, plainNotes: e.target.value }))}
                  className="min-h-[100px]"
                  dir={dir}
                />
              </div>

              {selectedShow.type === 'סדרה' && (
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{isHebrew ? 'פרקים וסיכומים' : 'Episodes & Summaries'}</div>
                    <Button size="sm" variant="outline" onClick={addEpisodeNote}>
                      <Plus className="h-4 w-4 ml-1" />
                      {isHebrew ? 'הוסף פרק' : 'Add episode'}
                    </Button>
                  </div>
                  <div className="space-y-3 max-h-[320px] overflow-auto">
                    {showDetail.episodeNotes.length === 0 ? (
                      <div className="text-sm text-muted-foreground">{isHebrew ? 'אין עדיין פרקים שמורים.' : 'No saved episode notes yet.'}</div>
                    ) : showDetail.episodeNotes.map((episode, index) => (
                      <div key={index} className="rounded-lg border border-border p-3 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={episode.season}
                            onChange={(e) => setShowDetail((prev) => ({
                              ...prev,
                              episodeNotes: prev.episodeNotes.map((entry, i) => i === index ? { ...entry, season: Number(e.target.value) || 1 } : entry),
                            }))}
                            placeholder={copy.seasonCol}
                          />
                          <Input
                            type="number"
                            min="1"
                            value={episode.episode}
                            onChange={(e) => setShowDetail((prev) => ({
                              ...prev,
                              episodeNotes: prev.episodeNotes.map((entry, i) => i === index ? { ...entry, episode: Number(e.target.value) || 1 } : entry),
                            }))}
                            placeholder={copy.episodeCol}
                          />
                          <Input
                            value={episode.title}
                            onChange={(e) => setShowDetail((prev) => ({
                              ...prev,
                              episodeNotes: prev.episodeNotes.map((entry, i) => i === index ? { ...entry, title: e.target.value } : entry),
                            }))}
                            placeholder={isHebrew ? 'שם הפרק' : 'Episode title'}
                            dir={dir}
                          />
                        </div>
                        <Textarea
                          value={episode.summary}
                          onChange={(e) => setShowDetail((prev) => ({
                            ...prev,
                            episodeNotes: prev.episodeNotes.map((entry, i) => i === index ? { ...entry, summary: e.target.value } : entry),
                          }))}
                          placeholder={isHebrew ? 'סיכום הפרק' : 'Episode summary'}
                          className="min-h-[90px]"
                          dir={dir}
                        />
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setShowDetail((prev) => ({
                              ...prev,
                              episodeNotes: prev.episodeNotes.filter((_, i) => i !== index),
                            }))}
                          >
                            {isHebrew ? 'מחק פרק' : 'Remove episode'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>{copy.airDateCol}: {selectedShow.air_date ? new Date(selectedShow.air_date).toLocaleDateString(locale) : '-'}</div>
                <div>{copy.createdCol}: {formatDateTime(selectedShow.created_at, locale)}</div>
                <div>{copy.updatedCol}: {formatDateTime(selectedShow.updated_at, locale)}</div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedShow(null)}>{isHebrew ? 'סגור' : 'Close'}</Button>
                <Button onClick={saveShowDetail}>{isHebrew ? 'שמור שינויים' : 'Save changes'}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShowsManager;
