import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Search, BookOpen, Download } from 'lucide-react';
import FileImport from '@/components/FileImport';
import { useRecycleBin } from '@/hooks/useRecycleBin';
import { exportToExcel } from '@/lib/exportToExcel';
import { toast } from 'sonner';
import InlineNotesTextarea from '@/components/InlineNotesTextarea';
import DashboardDisplayToolbar from "@/components/DashboardDisplayToolbar";
import { useDashboardDisplay } from "@/hooks/useDashboardDisplay";
import ListView from '@/components/views/ListView';
import CardsView from '@/components/views/CardsView';
import KanbanView from '@/components/views/KanbanView';
import CompactView from '@/components/views/CompactView';
import { useLanguage } from '@/hooks/useLanguage';

interface Book {
  id: string;
  title: string;
  author: string | null;
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

const BooksManager = () => {
  const { viewMode, themeKey, setViewMode, setTheme } = useDashboardDisplay("books");
  const { lang, dir } = useLanguage();
  const { user } = useAuth();
  const { softDelete } = useRecycleBin();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newBook, setNewBook] = useState({ title: '', author: '' });
  const isHebrew = lang === 'he';
  const locale = ({ he: 'he-IL', en: 'en-US', es: 'es-ES', zh: 'zh-CN', ar: 'ar-SA', ru: 'ru-RU' } as const)[lang];
  const copy = isHebrew ? {
    loadError: 'שגיאה בטעינת הספרים',
    enterTitle: 'נא להזין שם ספר',
    addError: 'שגיאה בהוספת הספר',
    addSuccess: 'הספר נוסף בהצלחה',
    updateStatusError: 'שגיאה בעדכון הסטטוס',
    updateNotesError: 'שגיאה בעדכון ההערות',
    movedToRecycle: 'הספר הועבר לסל המחזור',
    importError: 'שגיאה בייבוא הספרים',
    loading: 'טוען ספרים...',
    read: 'נקראו',
    reading: 'בקריאה',
    toRead: 'לקרוא',
    title: 'הספרים שלי',
    booksCount: 'ספרים',
    export: 'ייצוא',
    import: 'ייבוא ספרים',
    titlePlaceholder: 'שם הספר',
    authorPlaceholder: 'מחבר',
    addBook: 'הוסף ספר',
    search: 'חפש ספר או מחבר...',
    noResults: 'לא נמצאו תוצאות',
    empty: 'אין ספרים עדיין',
    titleCol: 'שם הספר',
    authorCol: 'מחבר',
    statusCol: 'סטטוס',
    notesCol: 'הערות',
    statusChangedCol: 'שינוי סטטוס',
    createdCol: 'נוצר',
    updatedCol: 'עודכן',
    addNotes: 'הוסף הערות...',
    sheetName: 'ספרים',
  } : {
    loadError: 'Error loading books',
    enterTitle: 'Please enter a book title',
    addError: 'Error adding book',
    addSuccess: 'Book added successfully',
    updateStatusError: 'Error updating status',
    updateNotesError: 'Error updating notes',
    movedToRecycle: 'Book moved to recycle bin',
    importError: 'Error importing books',
    loading: 'Loading books...',
    read: 'Read',
    reading: 'Reading',
    toRead: 'To read',
    title: 'My Books',
    booksCount: 'books',
    export: 'Export',
    import: 'Import books',
    titlePlaceholder: 'Book title',
    authorPlaceholder: 'Author',
    addBook: 'Add book',
    search: 'Search books or authors...',
    noResults: 'No results found',
    empty: 'No books yet',
    titleCol: 'Title',
    authorCol: 'Author',
    statusCol: 'Status',
    notesCol: 'Notes',
    statusChangedCol: 'Status changed',
    createdCol: 'Created',
    updatedCol: 'Updated',
    addNotes: 'Add notes...',
    sheetName: 'Books',
  };
  const statusOptions = [
    { value: 'לקרוא', label: copy.toRead },
    { value: 'בקריאה', label: copy.reading },
    { value: 'נקרא', label: copy.read },
  ];

  useEffect(() => {
    if (user) {
      fetchBooks();
    }
  }, [user]);

  const fetchBooks = async () => {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(copy.loadError);
      console.error(error);
    } else {
      setBooks(data || []);
    }
    setLoading(false);
  };

  const addBook = async () => {
    if (!newBook.title.trim()) {
      toast.error(copy.enterTitle);
      return;
    }

    const { error } = await supabase.from('books').insert({
      user_id: user?.id,
      title: newBook.title,
      author: newBook.author || null,
      status: 'לקרוא',
    });

    if (error) {
      toast.error(copy.addError);
      console.error(error);
    } else {
      toast.success(copy.addSuccess);
      setNewBook({ title: '', author: '' });
      fetchBooks();
    }
  };

  const updateBookStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('books')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error(copy.updateStatusError);
      return;
    }

    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  };

  const updateBookNotes = async (id: string, notes: string) => {
    const { error } = await supabase
      .from('books')
      .update({ notes })
      .eq('id', id);

    if (error) {
      toast.error(copy.updateNotesError);
      return;
    }

    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, notes } : b)));
  };

  const deleteBook = async (id: string) => {
    const book = books.find(b => b.id === id);
    if (!book) return;
    const success = await softDelete('books', id, book);
    if (success) {
      toast.success(copy.movedToRecycle);
      setBooks((prev) => prev.filter((b) => b.id !== id));
    }
  };

  const handleImportBooks = async (rows: Record<string, string>[]) => {
    if (!user) return;
    const inserts = rows.map(row => ({
      user_id: user.id,
      title: row['שם הספר'] || row['title'] || row['שם'] || Object.values(row)[0] || '',
      author: row['מחבר'] || row['author'] || null,
      status: row['סטטוס'] || row['status'] || 'לקרוא',
      notes: row['הערות'] || row['notes'] || null,
    })).filter(r => r.title.trim());

    const { error } = await supabase.from('books').insert(inserts);
    if (error) {
      toast.error(copy.importError);
      console.error(error);
    } else {
      fetchBooks();
    }
  };

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (book.author && book.author.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">{copy.loading}</div>;
  }

  const readCount = books.filter(b => b.status === 'נקרא').length;
  const readingCount = books.filter(b => b.status === 'בקריאה').length;
  const toReadCount = books.filter(b => b.status === 'לקרוא').length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden" dir={dir}>
      {/* Stats Dashboard */}
      <div className="grid grid-cols-3 gap-4 mb-4 flex-shrink-0">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{readCount}</div>
          <div className="text-sm text-muted-foreground">{copy.read}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{readingCount}</div>
          <div className="text-sm text-muted-foreground">{copy.reading}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{toReadCount}</div>
          <div className="text-sm text-muted-foreground">{copy.toRead}</div>
        </div>
      </div>

      {/* Header with count */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">{copy.title}</h2>
        <span className="text-sm text-muted-foreground">({books.length} {copy.booksCount})</span>
        <div className="flex-1" />
        <DashboardDisplayToolbar viewMode={viewMode} themeKey={themeKey} onViewModeChange={setViewMode} onThemeChange={setTheme} />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportToExcel(
          books.map(b => ({ title: b.title, author: b.author || '', status: b.status || '', notes: b.notes || '' })),
          [{ key: 'title', label: copy.titleCol }, { key: 'author', label: copy.authorCol }, { key: 'status', label: copy.statusCol }, { key: 'notes', label: copy.notesCol }],
          copy.sheetName
        )}>
          <Download className="h-3.5 w-3.5" />{copy.export}
        </Button>
        <FileImport onImport={handleImportBooks} label={copy.import} />
      </div>

      {/* Add new book */}
      <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
        <Input
          placeholder={copy.titlePlaceholder}
          value={newBook.title}
          onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
          className={`flex-1 min-w-[200px] ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
          dir={dir}
        />
        <Input
          placeholder={copy.authorPlaceholder}
          value={newBook.author}
          onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
          className={`flex-1 min-w-[150px] ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
          dir={dir}
        />
        <Button onClick={addBook}>
          <Plus className="h-4 w-4 ml-1" />
          {copy.addBook}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 flex-shrink-0">
        <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${dir === 'rtl' ? 'right-3' : 'left-3'}`} />
        <Input
          placeholder={copy.search}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={dir === 'rtl' ? 'pr-10 text-right' : 'pl-10 text-left'}
          dir={dir}
        />
      </div>

      {/* Content area - renders based on viewMode */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          {viewMode === 'list' ? (
            <ListView
              items={filteredBooks.map(b => ({
                id: b.id,
                title: b.title,
                subtitle: b.author,
                status: b.status || 'לקרוא',
                statusOptions,
                notes: b.notes,
                meta: formatDateTime(b.updated_at, locale),
              }))}
              emptyText={searchTerm ? copy.noResults : copy.empty}
              onStatusChange={updateBookStatus}
              onDelete={deleteBook}
            />
          ) : viewMode === 'cards' ? (
            <CardsView
              items={filteredBooks.map(b => ({
                id: b.id,
                title: b.title,
                subtitle: b.author,
                status: b.status || 'לקרוא',
                statusOptions,
                notes: b.notes,
                meta: formatDateTime(b.updated_at, locale),
              }))}
              emptyText={searchTerm ? copy.noResults : copy.empty}
              onStatusChange={updateBookStatus}
              onDelete={deleteBook}
            />
          ) : viewMode === 'kanban' ? (
            <KanbanView
              items={filteredBooks.map(b => ({
                id: b.id,
                title: b.title,
                subtitle: b.author,
                status: b.status || 'לקרוא',
                notes: b.notes,
              }))}
              columns={[
                { value: 'לקרוא', label: copy.toRead, color: 'bg-orange-500/15' },
                { value: 'בקריאה', label: copy.reading, color: 'bg-blue-500/15' },
                { value: 'נקרא', label: copy.read, color: 'bg-green-500/15' },
              ]}
              emptyText={searchTerm ? copy.noResults : copy.empty}
              onStatusChange={updateBookStatus}
              onDelete={deleteBook}
            />
          ) : viewMode === 'compact' ? (
            <CompactView
              items={filteredBooks.map(b => ({
                id: b.id,
                title: b.title,
                status: b.status || 'לקרוא',
                subtitle: b.author,
              }))}
              emptyText={searchTerm ? copy.noResults : copy.empty}
              onDelete={deleteBook}
            />
          ) : (
            /* Default: Table view */
            <Table className="min-w-[700px] sm:min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right min-w-[220px] sticky right-0 bg-card z-10">{copy.titleCol}</TableHead>
                  <TableHead className="text-right">{copy.authorCol}</TableHead>
                  <TableHead className="text-right">{copy.statusCol}</TableHead>
                  <TableHead className="text-right">{copy.notesCol}</TableHead>
                  <TableHead className="text-right">{copy.statusChangedCol}</TableHead>
                  <TableHead className="text-right">{copy.createdCol}</TableHead>
                  <TableHead className="text-right">{copy.updatedCol}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      {searchTerm ? copy.noResults : copy.empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBooks.map((book) => (
                    <TableRow key={book.id}>
                      <TableCell className="font-medium text-right min-w-[140px] sm:min-w-[220px] sticky right-0 bg-card z-10 max-w-[200px] sm:max-w-none">
                        <Input
                          defaultValue={book.title}
                          className="border-0 bg-transparent p-0 h-auto text-right font-medium focus-visible:ring-1 min-w-[120px] sm:min-w-[200px] text-sm sm:text-base"
                          dir={dir}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== book.title) {
                              supabase.from('books').update({ title: val }).eq('id', book.id).then(() => {
                                setBooks(prev => prev.map(b => b.id === book.id ? { ...b, title: val } : b));
                              });
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          defaultValue={book.author || ''}
                          placeholder="-"
                          className="border-0 bg-transparent p-0 h-auto text-right focus-visible:ring-1"
                          dir={dir}
                          onBlur={(e) => {
                            const val = e.target.value.trim() || null;
                            if (val !== (book.author || null)) {
                              supabase.from('books').update({ author: val }).eq('id', book.id).then(() => {
                                setBooks(prev => prev.map(b => b.id === book.id ? { ...b, author: val } : b));
                              });
                            }
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={book.status || 'לקרוא'} onValueChange={(value) => updateBookStatus(book.id, value)}>
                          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <InlineNotesTextarea
                          placeholder={copy.addNotes}
                          initialValue={book.notes}
                          onCommit={(val) => updateBookNotes(book.id, val)}
                          className={`min-w-[150px] min-h-[60px] w-full resize-y ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                          dir={dir}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {book.status_changed_at ? formatDateTime(book.status_changed_at, locale) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(book.created_at, locale)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(book.updated_at, locale)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteBook(book.id)} className="text-destructive hover:text-destructive">
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

export default BooksManager;
