import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Search, BookOpen, Download, Eye } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BookCompetitionPanel } from '@/components/BookCompetitionPanel';
import { useLanguage } from '@/hooks/useLanguage';

interface Book {
  id: string;
  title: string;
  author: string | null;
  long_summary: string | null;
  status: string | null;
  notes: string | null;
  updated_at: string;
  created_at: string;
  status_changed_at: string | null;
}

interface ParsedBookNotes {
  plainNotes: string;
  longSummary: string;
  chapterSummaries: Array<{ title: string; summary: string }>;
}

const serializeBookNotes = (detail: ParsedBookNotes) =>
  JSON.stringify({
    plainNotes: detail.plainNotes.trim(),
    longSummary: detail.longSummary.trim(),
    chapterSummaries: detail.chapterSummaries
      .map((chapter) => ({
        title: chapter.title.trim(),
        summary: chapter.summary.trim(),
      }))
      .filter((chapter) => chapter.title || chapter.summary),
  });

const parseBookNotes = (notes: string | null): ParsedBookNotes => {
  if (!notes) return { plainNotes: "", longSummary: "", chapterSummaries: [] };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object") {
      return {
        plainNotes: typeof parsed.plainNotes === "string" ? parsed.plainNotes : "",
        longSummary: typeof parsed.longSummary === "string" ? parsed.longSummary : "",
        chapterSummaries: Array.isArray(parsed.chapterSummaries) ? parsed.chapterSummaries.filter(Boolean) : [],
      };
    }
  } catch {}
  return { plainNotes: notes, longSummary: "", chapterSummaries: [] };
};

const BOOKS_UI = {
  he: { loading: 'טוען ספרים...', myBooks: 'הספרים שלי', booksCount: 'ספרים', detailsHint: 'פתח ספר בלחיצה כפולה או בכפתור "פרטים"', import: 'ייבוא ספרים', export: 'ייצוא', bookTitle: 'שם הספר', search: 'חפש ספר או מחבר...', empty: 'אין ספרים עדיין', noResults: 'לא נמצאו תוצאות', statusChanged: 'שינוי סטטוס', created: 'נוצר', updated: 'עודכן', details: 'פרטים', addNotes: 'הוסף הערות...', close: 'סגור', save: 'שמור שינויים', chapterTitle: 'שם פרק / חלק', chapterSummary: 'סיכום הפרק', deleteChapter: 'מחק פרק' },
  en: { loading: 'Loading books...', myBooks: 'My books', booksCount: 'books', detailsHint: 'Open a book by double-clicking a row or selecting Details', import: 'Import books', export: 'Export', bookTitle: 'Book title', search: 'Search a book or author...', empty: 'No books yet', noResults: 'No results found', statusChanged: 'Status changed', created: 'Created', updated: 'Updated', details: 'Details', addNotes: 'Add notes...', close: 'Close', save: 'Save changes', chapterTitle: 'Chapter / section title', chapterSummary: 'Chapter summary', deleteChapter: 'Delete chapter' },
  es: { loading: 'Cargando libros...', myBooks: 'Mis libros', booksCount: 'libros', detailsHint: 'Abre un libro con doble clic o con Detalles', import: 'Importar libros', export: 'Exportar', bookTitle: 'Titulo del libro', search: 'Buscar libro o autor...', empty: 'Aun no hay libros', noResults: 'No se encontraron resultados', statusChanged: 'Estado actualizado', created: 'Creado', updated: 'Actualizado', details: 'Detalles', addNotes: 'Agregar notas...', close: 'Cerrar', save: 'Guardar cambios', chapterTitle: 'Titulo del capitulo / seccion', chapterSummary: 'Resumen del capitulo', deleteChapter: 'Eliminar capitulo' },
  zh: { loading: '正在加载书籍...', myBooks: '我的书籍', booksCount: '本书', detailsHint: '双击一行或点击详情打开书籍', import: '导入书籍', export: '导出', bookTitle: '书名', search: '搜索书名或作者...', empty: '还没有书籍', noResults: '未找到结果', statusChanged: '状态更新', created: '创建时间', updated: '更新时间', details: '详情', addNotes: '添加笔记...', close: '关闭', save: '保存更改', chapterTitle: '章节标题', chapterSummary: '章节摘要', deleteChapter: '删除章节' },
  ar: { loading: 'جار تحميل الكتب...', myBooks: 'كتبي', booksCount: 'كتب', detailsHint: 'افتح كتابا بالنقر المزدوج أو من زر التفاصيل', import: 'استيراد الكتب', export: 'تصدير', bookTitle: 'عنوان الكتاب', search: 'ابحث عن كتاب أو مؤلف...', empty: 'لا توجد كتب بعد', noResults: 'لم يتم العثور على نتائج', statusChanged: 'تغيير الحالة', created: 'تم الإنشاء', updated: 'تم التحديث', details: 'التفاصيل', addNotes: 'أضف ملاحظات...', close: 'إغلاق', save: 'حفظ التغييرات', chapterTitle: 'عنوان الفصل / القسم', chapterSummary: 'ملخص الفصل', deleteChapter: 'حذف الفصل' },
  ru: { loading: 'Загрузка книг...', myBooks: 'Мои книги', booksCount: 'книг', detailsHint: 'Откройте книгу двойным щелчком или кнопкой «Подробнее»', import: 'Импорт книг', export: 'Экспорт', bookTitle: 'Название книги', search: 'Поиск книги или автора...', empty: 'Книг пока нет', noResults: 'Ничего не найдено', statusChanged: 'Изменение статуса', created: 'Создано', updated: 'Обновлено', details: 'Подробнее', addNotes: 'Добавить заметки...', close: 'Закрыть', save: 'Сохранить изменения', chapterTitle: 'Название главы / раздела', chapterSummary: 'Краткое содержание главы', deleteChapter: 'Удалить главу' },
} as const;

const formatDateTime = (dateStr: string, locale: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale) + ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

const BooksManager = () => {
  const { lang, dir, t } = useLanguage();
  const booksUi = BOOKS_UI[lang] ?? BOOKS_UI.en;
  const locale = ({ he: 'he-IL', en: 'en-US', es: 'es-ES', zh: 'zh-CN', ar: 'ar', ru: 'ru-RU' } as Record<string, string>)[lang] ?? 'en-US';
  const textAlign = dir === 'rtl' ? 'text-right' : 'text-left';
  const statusOptions = [{ value: 'לקרוא', label: t('toRead') }, { value: 'בקריאה', label: t('reading') }, { value: 'נקרא', label: t('read') }];
  const { viewMode, themeKey, setViewMode, setTheme } = useDashboardDisplay("books");
  const { user } = useAuth();
  const { softDelete } = useRecycleBin();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newBook, setNewBook] = useState({ title: '', author: '' });
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookDetail, setBookDetail] = useState<ParsedBookNotes>({ plainNotes: "", longSummary: "", chapterSummaries: [] });

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
    if (!user?.id) {
      toast.error('צריך להתחבר מחדש כדי להוסיף ספר');
      return;
    }

    if (!newBook.title.trim()) {
      toast.error('נא להזין שם ספר');
      return;
    }

    const { error } = await supabase.from('books').insert({
      user_id: user.id,
      title: newBook.title.trim(),
      author: newBook.author.trim() || null,
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

  const openBookDetail = (book: Book) => {
    const parsed = parseBookNotes(book.notes);
    setSelectedBook(book);
    setBookDetail({
      plainNotes: parsed.plainNotes,
      longSummary: book.long_summary || parsed.longSummary,
      chapterSummaries: parsed.chapterSummaries,
    });
  };

  const saveBookDetail = async () => {
    if (!selectedBook || !user) return;

    const plainNotes = bookDetail.plainNotes.trim();
    const longSummary = bookDetail.longSummary.trim();
    const serializedNotes = serializeBookNotes(bookDetail);
    const chapterRows = bookDetail.chapterSummaries
      .map((chapter, index) => ({
        user_id: user.id,
        book_id: selectedBook.id,
        chapter_title: chapter.title.trim() || null,
        summary: chapter.summary.trim() || null,
        sort_order: index,
      }))
      .filter((chapter) => chapter.chapter_title || chapter.summary);

    let { error: bookError } = await supabase
      .from('books')
      .update({
        title: selectedBook.title,
        author: selectedBook.author || null,
        notes: serializedNotes,
        long_summary: longSummary || null,
      })
      .eq('id', selectedBook.id);

    if (bookError && /long_summary/i.test(bookError.message)) {
      const fallback = await supabase
        .from('books')
        .update({
          title: selectedBook.title,
          author: selectedBook.author || null,
          notes: serializedNotes,
        })
        .eq('id', selectedBook.id);
      bookError = fallback.error;
    }

    if (bookError) {
      toast.error('שגיאה בשמירת פרטי הספר');
      return;
    }

    const { error: deleteError } = await supabase
      .from('book_chapter_summaries')
      .delete()
      .eq('book_id', selectedBook.id);

    const chapterTableMissing = !!deleteError && /book_chapter_summaries|relation .* does not exist/i.test(deleteError.message);

    if (deleteError && !chapterTableMissing) {
      toast.error('שגיאה בעדכון פרקי הספר');
      return;
    }

    if (chapterRows.length > 0 && !chapterTableMissing) {
      const { error: chapterError } = await supabase
        .from('book_chapter_summaries')
        .insert(chapterRows);

      if (chapterError) {
        toast.error('שגיאה בשמירת פרקי הספר');
        return;
      }
    }

    setBooks(prev => prev.map((book) => (
      book.id === selectedBook.id
        ? {
            ...book,
            title: selectedBook.title,
            author: selectedBook.author || null,
            notes: serializedNotes,
            long_summary: longSummary || null,
          }
        : book
    )));
    setSelectedBook(null);
    toast.success('פרטי הספר נשמרו');
  };

  useEffect(() => {
    if (!selectedBook) return;

    let cancelled = false;

    const loadChapterSummaries = async () => {
      const { data, error } = await supabase
        .from('book_chapter_summaries')
        .select('chapter_title, summary, sort_order')
        .eq('book_id', selectedBook.id)
        .order('sort_order', { ascending: true });

      if (cancelled || error || !data || data.length === 0) return;

      setBookDetail((prev) => ({
        ...prev,
        chapterSummaries: data.map((chapter) => ({
          title: chapter.chapter_title || '',
          summary: chapter.summary || '',
        })),
      }));
    };

    void loadChapterSummaries();

    return () => {
      cancelled = true;
    };
  }, [selectedBook]);

  const deleteBook = async (id: string) => {
    const book = books.find(b => b.id === id);
    if (!book) return;
    const success = await softDelete('books', id, book);
    if (success) {
      toast.success('הספר הועבר לסל המחזור');
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
    return <div className="p-8 text-center text-muted-foreground" dir={dir}>{booksUi.loading}</div>;
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
          <div className="text-sm text-muted-foreground">{t('read')}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{readingCount}</div>
          <div className="text-sm text-muted-foreground">{t('reading')}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{toReadCount}</div>
          <div className="text-sm text-muted-foreground">{t('toRead')}</div>
        </div>
      </div>
      <BookCompetitionPanel readCount={readCount} />

      {/* Header with count */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">{booksUi.myBooks}</h2>
        <span className="text-sm text-muted-foreground">({books.length} {booksUi.booksCount})</span>
        <span className="text-xs text-muted-foreground">{booksUi.detailsHint}</span>
        <div className="flex-1" />
        <DashboardDisplayToolbar viewMode={viewMode} themeKey={themeKey} onViewModeChange={setViewMode} onThemeChange={setTheme} />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportToExcel(
          books.map(b => ({ title: b.title, author: b.author || '', status: b.status || '', notes: parseBookNotes(b.notes).plainNotes || '' })),
          [{ key: 'title', label: booksUi.bookTitle }, { key: 'author', label: t('author') }, { key: 'status', label: t('status') }, { key: 'notes', label: t('notes') }],
          t('books')
        )}>
          <Download className="h-3.5 w-3.5" />{booksUi.export}
        </Button>
        <FileImport onImport={handleImportBooks} label={booksUi.import} />
      </div>

      {/* Add new book */}
      <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
        <Input
          placeholder={booksUi.bookTitle}
          value={newBook.title}
          onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
          className={`flex-1 min-w-[200px] ${textAlign}`}
          dir={dir}
        />
        <Input
          placeholder={t('author')}
          value={newBook.author}
          onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
          className={`flex-1 min-w-[150px] ${textAlign}`}
          dir={dir}
        />
        <Button onClick={addBook}>
          <Plus className="h-4 w-4" />
          {t('addBook')}
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 flex-shrink-0">
        <Search className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
        <Input
          placeholder={booksUi.search}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`${dir === 'rtl' ? 'pr-10' : 'pl-10'} ${textAlign}`}
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
                notes: parseBookNotes(b.notes).plainNotes,
                meta: formatDateTime(b.updated_at, locale),
              }))}
              emptyText={searchTerm ? booksUi.noResults : booksUi.empty}
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
                notes: parseBookNotes(b.notes).plainNotes,
                meta: formatDateTime(b.updated_at, locale),
              }))}
              emptyText={searchTerm ? booksUi.noResults : booksUi.empty}
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
                notes: parseBookNotes(b.notes).plainNotes,
              }))}
              columns={[
                { value: 'לקרוא', label: t('toRead'), color: 'bg-orange-500/15' },
                { value: 'בקריאה', label: t('reading'), color: 'bg-blue-500/15' },
                { value: 'נקרא', label: t('read'), color: 'bg-green-500/15' },
              ]}
              emptyText={searchTerm ? booksUi.noResults : booksUi.empty}
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
              emptyText={searchTerm ? booksUi.noResults : booksUi.empty}
              onDelete={deleteBook}
            />
          ) : (
            /* Default: Table view */
            <Table className="min-w-[700px] sm:min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead className={`${textAlign} min-w-[220px] sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} bg-card z-10`}>{booksUi.bookTitle}</TableHead>
                  <TableHead className={textAlign}>{t('author')}</TableHead>
                  <TableHead className={textAlign}>{t('status')}</TableHead>
                  <TableHead className={textAlign}>{t('notes')}</TableHead>
                  <TableHead className={textAlign}>{booksUi.statusChanged}</TableHead>
                  <TableHead className={textAlign}>{booksUi.created}</TableHead>
                  <TableHead className={textAlign}>{booksUi.updated}</TableHead>
                  <TableHead className={textAlign}>{booksUi.details}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      {searchTerm ? booksUi.noResults : booksUi.empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBooks.map((book) => (
                    <TableRow key={book.id} onDoubleClick={() => openBookDetail(book)}>
                      <TableCell className={`font-medium ${textAlign} min-w-[140px] sm:min-w-[220px] sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} bg-card z-10 max-w-[200px] sm:max-w-none`}>
                        <Input
                          defaultValue={book.title}
                          className={`border-0 bg-transparent p-0 h-auto ${textAlign} font-medium focus-visible:ring-1 min-w-[120px] sm:min-w-[200px] text-sm sm:text-base`}
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
                      <TableCell className={textAlign}>
                        <Input
                          defaultValue={book.author || ''}
                          placeholder="-"
                          className={`border-0 bg-transparent p-0 h-auto ${textAlign} focus-visible:ring-1`}
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
                            <SelectItem value="לקרוא">{t('toRead')}</SelectItem>
                            <SelectItem value="בקריאה">{t('reading')}</SelectItem>
                            <SelectItem value="נקרא">{t('read')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <InlineNotesTextarea
                          placeholder={booksUi.addNotes}
                          initialValue={parseBookNotes(book.notes).plainNotes}
                          onCommit={(val) => updateBookNotes(book.id, val)}
                          className={`min-w-[150px] ${textAlign} min-h-[60px] w-full resize-y`}
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
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => openBookDetail(book)}>
                          <Eye className="h-3.5 w-3.5" />
                          {booksUi.details}
                        </Button>
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

      <Dialog open={!!selectedBook} onOpenChange={(open) => { if (!open) setSelectedBook(null); }}>
        <DialogContent className="max-w-4xl" dir={dir}>
          <DialogHeader>
            <DialogTitle>פרטי ספר מורחבים</DialogTitle>
          </DialogHeader>
          {selectedBook && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>שם הספר</Label>
                  <Input value={selectedBook.title} onChange={(e) => setSelectedBook({ ...selectedBook, title: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>מחבר</Label>
                  <Input value={selectedBook.author || ""} onChange={(e) => setSelectedBook({ ...selectedBook, author: e.target.value || null })} />
                </div>
              </div>

              <div className="space-y-1">
                <Label>סיכום גדול / מסקנות</Label>
                <Textarea
                  value={bookDetail.longSummary}
                  onChange={(e) => setBookDetail((prev) => ({ ...prev, longSummary: e.target.value }))}
                  className="min-h-[150px]"
                  placeholder="כאן אפשר לכתוב סיכום רחב, רעיונות מרכזיים, ציטוטים ומסקנות."
                />
              </div>

              <div className="space-y-1">
                <Label>הערות קצרות</Label>
                <Textarea
                  value={bookDetail.plainNotes}
                  onChange={(e) => setBookDetail((prev) => ({ ...prev, plainNotes: e.target.value }))}
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">פרקים / חלקים וסיכומים</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBookDetail((prev) => ({
                      ...prev,
                      chapterSummaries: [...prev.chapterSummaries, { title: "", summary: "" }],
                    }))}
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    הוסף פרק
                  </Button>
                </div>
                <div className="space-y-3 max-h-[280px] overflow-auto">
                  {bookDetail.chapterSummaries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">אין עדיין פרקים או חלקים שמורים.</div>
                  ) : bookDetail.chapterSummaries.map((chapter, index) => (
                    <div key={index} className="rounded-lg border border-border p-3 space-y-2">
                      <Input
                        value={chapter.title}
                        onChange={(e) => setBookDetail((prev) => ({
                          ...prev,
                          chapterSummaries: prev.chapterSummaries.map((entry, i) => i === index ? { ...entry, title: e.target.value } : entry),
                        }))}
                        placeholder={booksUi.chapterTitle}
                      />
                      <Textarea
                        value={chapter.summary}
                        onChange={(e) => setBookDetail((prev) => ({
                          ...prev,
                          chapterSummaries: prev.chapterSummaries.map((entry, i) => i === index ? { ...entry, summary: e.target.value } : entry),
                        }))}
                        placeholder={booksUi.chapterSummary}
                        className="min-h-[90px]"
                      />
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setBookDetail((prev) => ({
                            ...prev,
                            chapterSummaries: prev.chapterSummaries.filter((_, i) => i !== index),
                          }))}
                        >
                          {booksUi.deleteChapter}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>{booksUi.statusChanged}: {selectedBook.status_changed_at ? formatDateTime(selectedBook.status_changed_at, locale) : '-'}</div>
                <div>{booksUi.created}: {formatDateTime(selectedBook.created_at, locale)}</div>
                <div>{booksUi.updated}: {formatDateTime(selectedBook.updated_at, locale)}</div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedBook(null)}>{booksUi.close}</Button>
                <Button onClick={saveBookDetail}>
                  {booksUi.save}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BooksManager;
