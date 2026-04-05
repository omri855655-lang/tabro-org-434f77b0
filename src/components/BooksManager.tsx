import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Search, BookOpen, Download } from 'lucide-react';
import FileImport from '@/components/FileImport';
import { exportToExcel } from '@/lib/exportToExcel';
import { toast } from 'sonner';
import InlineNotesTextarea from '@/components/InlineNotesTextarea';

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

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const BooksManager = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newBook, setNewBook] = useState({ title: '', author: '' });

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
      toast.error('שגיאה בטעינת הספרים');
      console.error(error);
    } else {
      setBooks(data || []);
    }
    setLoading(false);
  };

  const addBook = async () => {
    if (!newBook.title.trim()) {
      toast.error('נא להזין שם ספר');
      return;
    }

    const { error } = await supabase.from('books').insert({
      user_id: user?.id,
      title: newBook.title,
      author: newBook.author || null,
      status: 'לקרוא',
    });

    if (error) {
      toast.error('שגיאה בהוספת הספר');
      console.error(error);
    } else {
      toast.success('הספר נוסף בהצלחה');
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
      toast.error('שגיאה בעדכון הסטטוס');
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
      toast.error('שגיאה בעדכון ההערות');
      return;
    }

    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, notes } : b)));
  };

  const deleteBook = async (id: string) => {
    const { error } = await supabase.from('books').delete().eq('id', id);

    if (error) {
      toast.error('שגיאה במחיקת הספר');
      return;
    }

    toast.success('הספר נמחק');
    setBooks((prev) => prev.filter((b) => b.id !== id));
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
      toast.error('שגיאה בייבוא הספרים');
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
    return <div className="p-8 text-center text-muted-foreground">טוען ספרים...</div>;
  }

  const readCount = books.filter(b => b.status === 'נקרא').length;
  const readingCount = books.filter(b => b.status === 'בקריאה').length;
  const toReadCount = books.filter(b => b.status === 'לקרוא').length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden" dir="rtl">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-3 gap-4 mb-4 flex-shrink-0">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{readCount}</div>
          <div className="text-sm text-muted-foreground">נקראו</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{readingCount}</div>
          <div className="text-sm text-muted-foreground">בקריאה</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{toReadCount}</div>
          <div className="text-sm text-muted-foreground">לקרוא</div>
        </div>
      </div>

      {/* Header with count */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">הספרים שלי</h2>
        <span className="text-sm text-muted-foreground">({books.length} ספרים)</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportToExcel(
          books.map(b => ({ title: b.title, author: b.author || '', status: b.status || '', notes: b.notes || '' })),
          [{ key: 'title', label: 'שם הספר' }, { key: 'author', label: 'מחבר' }, { key: 'status', label: 'סטטוס' }, { key: 'notes', label: 'הערות' }],
          'ספרים'
        )}>
          <Download className="h-3.5 w-3.5" />ייצוא
        </Button>
        <FileImport onImport={handleImportBooks} label="ייבוא ספרים" />
      </div>

      {/* Add new book */}
      <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
        <Input
          placeholder="שם הספר"
          value={newBook.title}
          onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
          className="flex-1 min-w-[200px] text-right"
          dir="rtl"
        />
        <Input
          placeholder="מחבר"
          value={newBook.author}
          onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
          className="flex-1 min-w-[150px] text-right"
          dir="rtl"
        />
        <Button onClick={addBook}>
          <Plus className="h-4 w-4 ml-1" />
          הוסף ספר
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 flex-shrink-0">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חפש ספר או מחבר..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10 text-right"
          dir="rtl"
        />
      </div>

      {/* Books table with scroll */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          <Table className="min-w-[700px] sm:min-w-[980px]">
          <TableHeader>
           <TableRow>
               <TableHead className="text-right min-w-[220px] sticky right-0 bg-card z-10">שם הספר</TableHead>
              <TableHead className="text-right">מחבר</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="text-right">שינוי סטטוס</TableHead>
              <TableHead className="text-right">נוצר</TableHead>
              <TableHead className="text-right">עודכן</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {searchTerm ? 'לא נמצאו תוצאות' : 'אין ספרים עדיין'}
                </TableCell>
              </TableRow>
            ) : (
              filteredBooks.map((book) => (
                <TableRow key={book.id}>
                   <TableCell className="font-medium text-right min-w-[140px] sm:min-w-[220px] sticky right-0 bg-card z-10 max-w-[200px] sm:max-w-none">
                    <Input
                       defaultValue={book.title}
                        className="border-0 bg-transparent p-0 h-auto text-right font-medium focus-visible:ring-1 min-w-[120px] sm:min-w-[200px] text-sm sm:text-base"
                      dir="rtl"
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
                      dir="rtl"
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
                    <Select
                      value={book.status || 'לקרוא'}
                      onValueChange={(value) => updateBookStatus(book.id, value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="לקרוא">לקרוא</SelectItem>
                        <SelectItem value="בקריאה">בקריאה</SelectItem>
                        <SelectItem value="נקרא">נקרא</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <InlineNotesTextarea
                      placeholder="הוסף הערות..."
                      initialValue={book.notes}
                      onCommit={(val) => updateBookNotes(book.id, val)}
                      className="min-w-[150px] text-right min-h-[60px] w-full resize-y"
                      dir="rtl"
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {book.status_changed_at ? formatDateTime(book.status_changed_at) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDateTime(book.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDateTime(book.updated_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteBook(book.id)}
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

export default BooksManager;
