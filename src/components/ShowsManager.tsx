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
import { toast } from 'sonner';
import InlineNotesTextarea from '@/components/InlineNotesTextarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('he-IL');
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
  const { user } = useAuth();
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
      toast.error('שגיאה בטעינת הסדרות');
      console.error(error);
    } else {
      setShows((data || []) as Show[]);
    }
    setLoading(false);
  };

  const addShow = async () => {
    if (!newShow.title.trim()) {
      toast.error('נא להזין שם סדרה/סרט');
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
      toast.error('שגיאה בהוספה');
      console.error(error);
    } else {
      toast.success('נוסף בהצלחה');
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
      toast.error('שגיאה בעדכון');
    } else {
      setShows((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    }
  };

  const deleteShow = async (id: string) => {
    const { error } = await supabase.from('shows').delete().eq('id', id);
    if (error) {
      toast.error('שגיאה במחיקה');
    } else {
      toast.success('נמחק בהצלחה');
      setShows((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const addCustomCategory = () => {
    const cat = newCategoryInput.trim();
    if (!cat) return;
    if (allCategories.includes(cat)) {
      toast.error('קטגוריה כבר קיימת');
      return;
    }
    setCustomCategories(prev => [...prev, cat]);
    setNewCategoryInput('');
    toast.success(`קטגוריה "${cat}" נוספה`);
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
      else if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal, 'he');
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

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">טוען סדרות וסרטים...</div>;
  }

  const seriesCount = shows.filter(s => s.type === 'סדרה').length;
  const moviesCount = shows.filter(s => s.type === 'סרט').length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <Tv className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">הסדרות והסרטים שלי</h2>
        <span className="text-sm text-muted-foreground">({shows.length} פריטים)</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportToExcel(
          shows.map(s => ({ title: s.title, type: s.type || '', status: s.status || '', category: s.category || '', season: s.current_season, episode: s.current_episode, notes: s.notes || '' })),
          [{ key: 'title', label: 'שם' }, { key: 'type', label: 'סוג' }, { key: 'status', label: 'סטטוס' }, { key: 'category', label: 'קטגוריה' }, { key: 'season', label: 'עונה' }, { key: 'episode', label: 'פרק' }, { key: 'notes', label: 'הערות' }],
          'סדרות_וסרטים'
        )}>
          <Download className="h-3.5 w-3.5" />ייצוא
        </Button>
      </div>

      {/* Tabs: All / Series / Movies */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-shrink-0 mb-3">
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            הכל ({shows.length})
          </TabsTrigger>
          <TabsTrigger value="series" className="gap-1.5">
            <Tv className="h-3.5 w-3.5" />
            סדרות ({seriesCount})
          </TabsTrigger>
          <TabsTrigger value="movies" className="gap-1.5">
            <Film className="h-3.5 w-3.5" />
            סרטים ({moviesCount})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Add new show */}
      <div className="flex gap-2 flex-wrap mb-3 flex-shrink-0">
        <Input
          placeholder="שם הסדרה/סרט"
          value={newShow.title}
          onChange={(e) => setNewShow({ ...newShow, title: e.target.value })}
          className="flex-1 min-w-[180px]"
          dir="rtl"
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
            <SelectItem value="סדרה">סדרה</SelectItem>
            <SelectItem value="סרט">סרט</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={newShow.category || '_none'}
          onValueChange={(value) => setNewShow({ ...newShow, category: value === '_none' ? '' : value })}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="קטגוריה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">ללא קטגוריה</SelectItem>
            {allCategories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={addShow}>
          <Plus className="h-4 w-4 ml-1" />
          הוסף
        </Button>
      </div>

      {/* Search + Category filter + Manage categories */}
      <div className="flex gap-2 mb-3 flex-shrink-0 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חפש סדרה או סרט..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
            dir="rtl"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="סנן קטגוריה" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הקטגוריות</SelectItem>
            {allCategories.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Tag className="h-3.5 w-3.5" />
              ניהול קטגוריות
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" dir="rtl">
            <h4 className="font-bold text-sm mb-2">קטגוריות מותאמות</h4>
            <div className="flex gap-1.5 mb-2">
              <Input
                placeholder="קטגוריה חדשה..."
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

      {/* Shows table */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader field="title" label="שם" />
                <TableHead className="text-right">סוג</TableHead>
                <SortHeader field="category" label="קטגוריה" />
                <SortHeader field="status" label="סטטוס" />
                <SortHeader field="air_date" label="תאריך עלייה" />
                <TableHead className="text-right">עונה</TableHead>
                <TableHead className="text-right">פרק</TableHead>
                <TableHead className="text-right">הערות</TableHead>
                <SortHeader field="created_at" label="נוצר" />
                <TableHead className="text-right">שינוי סטטוס</TableHead>
                <SortHeader field="updated_at" label="עודכן" />
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground">
                    {searchTerm ? 'לא נמצאו תוצאות' : 'אין סדרות או סרטים עדיין'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSorted.map((show) => (
                  <TableRow key={show.id}>
                    <TableCell className="font-medium">
                      <Input
                        defaultValue={show.title}
                        className="border-0 bg-transparent p-0 h-auto font-medium focus-visible:ring-1"
                        dir="rtl"
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
                        {show.type || 'סדרה'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={show.category || '_none'}
                        onValueChange={(v) => updateShow(show.id, { category: v === '_none' ? null : v })}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue placeholder="קטגוריה" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">ללא</SelectItem>
                          {allCategories.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={show.status || 'לצפות'}
                        onValueChange={(value) => updateShow(show.id, { status: value })}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="לצפות">לצפות</SelectItem>
                          <SelectItem value="בצפייה">בצפייה</SelectItem>
                          <SelectItem value="נצפה">נצפה</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        defaultValue={show.air_date || ''}
                        onBlur={(e) => {
                          const val = e.target.value || null;
                          if (val !== show.air_date) updateShow(show.id, { air_date: val } as any);
                        }}
                        className="w-[130px] h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      {show.type === 'סדרה' && (
                        <Input
                          type="number"
                          min="1"
                          defaultValue={show.current_season ?? ''}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                          onBlur={(e) => {
                            const next = parseNullableNumber(e.target.value);
                            if (next !== (show.current_season ?? null)) updateShow(show.id, { current_season: next });
                          }}
                          className="w-16 h-8"
                          placeholder="-"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {show.type === 'סדרה' && (
                        <Input
                          type="number"
                          min="1"
                          defaultValue={show.current_episode ?? ''}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                          onBlur={(e) => {
                            const next = parseNullableNumber(e.target.value);
                            if (next !== (show.current_episode ?? null)) updateShow(show.id, { current_episode: next });
                          }}
                          className="w-16 h-8"
                          placeholder="-"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <InlineNotesTextarea
                        placeholder="הוסף הערות..."
                        initialValue={show.notes}
                        onCommit={(val) => updateShow(show.id, { notes: val })}
                        className="min-w-[150px] text-right min-h-[50px] w-full resize-y text-xs"
                        dir="rtl"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateTime(show.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {show.status_changed_at ? formatDateTime(show.status_changed_at) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateTime(show.updated_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteShow(show.id)}
                        className="text-destructive hover:text-destructive h-8 w-8"
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

export default ShowsManager;
