import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Search, GraduationCap, ChevronDown, ChevronLeft, Sparkles, CheckCircle2, Circle, Loader2, Calendar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import InlineNotesTextarea from '@/components/InlineNotesTextarea';
import { extractLessonsFromSyllabus } from '@/components/courses/syllabusLessonParser';

interface Course {
  id: string;
  title: string;
  status: string | null;
  notes: string | null;
  syllabus: string | null;
  ai_recommendations: string | null;
  created_at: string;
  updated_at: string;
}

interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  completed: boolean;
  scheduled_date: string | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('he-IL') + ' ' + date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
};

const CoursesManager = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseLessons, setCourseLessons] = useState<Record<string, CourseLesson[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newCourse, setNewCourse] = useState({ title: '' });
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [syllabusDialogOpen, setSyllabusDialogOpen] = useState<string | null>(null);
  const [syllabusInput, setSyllabusInput] = useState('');
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [recommendationsDialogOpen, setRecommendationsDialogOpen] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCourses();
    }
  }, [user]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('שגיאה בטעינת הקורסים');
      console.error(error);
    } else {
      setCourses(data || []);
      // Fetch lessons for all courses
      const courseIds = (data || []).map(c => c.id);
      if (courseIds.length > 0) {
        const { data: lessonsData } = await supabase
          .from('course_lessons')
          .select('*')
          .in('course_id', courseIds)
          .order('sort_order', { ascending: true });
        
        const lessonsByCourse: Record<string, CourseLesson[]> = {};
        (lessonsData || []).forEach(lesson => {
          if (!lessonsByCourse[lesson.course_id]) {
            lessonsByCourse[lesson.course_id] = [];
          }
          lessonsByCourse[lesson.course_id].push(lesson);
        });
        setCourseLessons(lessonsByCourse);
      }
    }
    setLoading(false);
  };

  const addCourse = async () => {
    if (!newCourse.title.trim()) {
      toast.error('נא להזין שם קורס');
      return;
    }

    const { error } = await supabase.from('courses').insert({
      user_id: user?.id,
      title: newCourse.title,
      status: 'בתכנון',
    });

    if (error) {
      toast.error('שגיאה בהוספת הקורס');
      console.error(error);
    } else {
      toast.success('הקורס נוסף בהצלחה');
      setNewCourse({ title: '' });
      fetchCourses();
    }
  };

  const updateCourseStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('courses')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('שגיאה בעדכון הסטטוס');
      return;
    }

    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const updateCourseNotes = async (id: string, notes: string) => {
    const { error } = await supabase
      .from('courses')
      .update({ notes })
      .eq('id', id);

    if (error) {
      toast.error('שגיאה בעדכון ההערות');
      return;
    }

    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, notes } : c)));
  };

  const deleteCourse = async (id: string) => {
    const { error } = await supabase.from('courses').delete().eq('id', id);

    if (error) {
      toast.error('שגיאה במחיקת הקורס');
      return;
    }

    toast.success('הקורס נמחק');
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const saveSyllabus = async (courseId: string) => {
    const nextSyllabus = syllabusInput.trim();

    const { error } = await supabase
      .from('courses')
      .update({ syllabus: nextSyllabus })
      .eq('id', courseId);

    if (error) {
      toast.error('שגיאה בשמירת הסילבוס');
      return;
    }

    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, syllabus: nextSyllabus } : c));
    await generateLessonsFromSyllabus(courseId, nextSyllabus, true);
  };

  const parseLessonsFromAiResponse = (payload: any) => {
    const rawLessons = (() => {
      const directLessons = Array.isArray(payload?.lessons) ? payload.lessons : [];
      if (directLessons.length > 0) return directLessons;

      if (typeof payload?.suggestion !== 'string') return [];

      try {
        const directParsed = JSON.parse(payload.suggestion);
        if (Array.isArray(directParsed)) return directParsed;
        if (Array.isArray(directParsed?.lessons)) return directParsed.lessons;
      } catch {
        const jsonMatch = payload.suggestion.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch {
            // continue to line-based fallback
          }
        }
      }

      const lines = payload.suggestion
        .split('\n')
        .map((l: string) => l.replace(/^\s*[-*•\d\.\)\-]+\s*/, '').trim())
        .filter((l: string) => l.length >= 2 && !l.startsWith('{') && !l.startsWith('['));

      return lines.slice(0, 40).map((line: string) => ({
        title: line,
        duration_minutes: 30,
      }));
    })();

    return rawLessons
      .map((lesson: any) => ({
        title: typeof lesson?.title === 'string' ? lesson.title.trim() : '',
        duration_minutes: Math.min(300, Math.max(5, Number(lesson?.duration_minutes) || 30)),
      }))
      .filter((lesson: { title: string }) => lesson.title.length > 0)
      .slice(0, 60);
  };

  const replaceLessonsForCourse = async (courseId: string, lessons: { title: string; duration_minutes?: number }[]) => {
    if (!user?.id) {
      throw new Error('משתמש לא מחובר');
    }

    const { error: deleteError } = await supabase.from('course_lessons').delete().eq('course_id', courseId);
    if (deleteError) throw deleteError;

    const lessonsToInsert = lessons.map((lesson, index) => ({
      course_id: courseId,
      user_id: user.id,
      title: lesson.title,
      sort_order: index,
      duration_minutes: Math.min(300, Math.max(5, lesson.duration_minutes || 30)),
    }));

    const { data: insertedLessons, error: insertError } = await supabase
      .from('course_lessons')
      .insert(lessonsToInsert)
      .select();

    if (insertError) throw insertError;

    setCourseLessons(prev => ({
      ...prev,
      [courseId]: insertedLessons || []
    }));

    return insertedLessons || [];
  };

  const generateLessonsFromSyllabus = async (courseId: string, syllabusOverride?: string, autoMode = false) => {
    const course = courses.find(c => c.id === courseId);
    const syllabusText = (syllabusOverride ?? course?.syllabus ?? '').trim();

    if (!syllabusText) {
      toast.error('נא להזין סילבוס קודם');
      return;
    }

    setAiLoading(courseId);

    try {
      let lessons = extractLessonsFromSyllabus(syllabusText);

      if (lessons.length < 2) {
        try {
          const { data, error } = await supabase.functions.invoke('task-ai-helper', {
            body: {
              taskDescription: `פרק את הסילבוס הבא לשיעורים בודדים. עבור כל שיעור, תן כותרת קצרה ומשך זמן משוער בדקות.\n\nסילבוס:\n${syllabusText}`,
              taskCategory: 'course_breakdown'
            }
          });

          if (error) throw error;
          const aiLessons = parseLessonsFromAiResponse(data);
          if (aiLessons.length > 0) {
            lessons = aiLessons;
          }
        } catch (aiError) {
          console.error('AI lesson generation failed, using local parsing fallback:', aiError);
        }
      }

      if (lessons.length === 0) {
        toast.error('לא הצלחתי לפרק את הסילבוס');
        return;
      }

      const insertedLessons = await replaceLessonsForCourse(courseId, lessons);

      toast.success(
        autoMode
          ? `הסילבוס נשמר ונוצרו ${insertedLessons.length} שיעורים אוטומטית`
          : `נוצרו ${insertedLessons.length} שיעורים`
      );
      setSyllabusDialogOpen(null);
    } catch (error) {
      console.error(error);
      toast.error(autoMode ? 'הסילבוס נשמר אבל יצירת השיעורים האוטומטית נכשלה' : 'שגיאה ביצירת השיעורים');
    } finally {
      setAiLoading(null);
    }
  };

  const getAiRecommendations = async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    const lessons = courseLessons[courseId] || [];
    
    setAiLoading(courseId);

    try {
      const { data, error } = await supabase.functions.invoke('task-ai-helper', {
        body: {
          taskDescription: `בהתבסס על הקורס "${course?.title}" עם ${lessons.length} שיעורים, תן המלצות:
1. איך ללמוד את החומר בצורה יעילה
2. מה הסדר הנכון
3. מתי כדאי ללמוד (שעות ביום, ימים בשבוע)
4. טיפים לשימור החומר
5. משאבים נוספים מומלצים

${course?.syllabus ? `סילבוס: ${course.syllabus}` : ''}
${lessons.length > 0 ? `שיעורים: ${lessons.map(l => l.title).join(', ')}` : ''}`,
          taskCategory: 'learning_recommendations'
        }
      });

      if (error) throw error;

      // Save recommendations
      await supabase
        .from('courses')
        .update({ ai_recommendations: data.suggestion })
        .eq('id', courseId);

      setCourses(prev => prev.map(c => c.id === courseId ? { ...c, ai_recommendations: data.suggestion } : c));
      setRecommendationsDialogOpen(courseId);
    } catch (error) {
      console.error(error);
      toast.error('שגיאה בקבלת המלצות');
    } finally {
      setAiLoading(null);
    }
  };

  const toggleLessonCompletion = async (lesson: CourseLesson) => {
    const { error } = await supabase
      .from('course_lessons')
      .update({ completed: !lesson.completed })
      .eq('id', lesson.id);

    if (error) {
      toast.error('שגיאה בעדכון שיעור');
      return;
    }

    setCourseLessons(prev => ({
      ...prev,
      [lesson.course_id]: prev[lesson.course_id].map(l =>
        l.id === lesson.id ? { ...l, completed: !l.completed } : l
      )
    }));
  };

  const updateLessonDate = async (lesson: CourseLesson, date: string) => {
    const { error } = await supabase
      .from('course_lessons')
      .update({ scheduled_date: date || null })
      .eq('id', lesson.id);

    if (error) {
      toast.error('שגיאה בעדכון תאריך');
      return;
    }

    setCourseLessons(prev => ({
      ...prev,
      [lesson.course_id]: prev[lesson.course_id].map(l =>
        l.id === lesson.id ? { ...l, scheduled_date: date } : l
      )
    }));
  };

  const toggleExpanded = (courseId: string) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const filteredCourses = courses.filter(
    (course) => course.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">טוען קורסים...</div>;
  }

  const planningCount = courses.filter(c => c.status === 'בתכנון').length;
  const inProgressCount = courses.filter(c => c.status === 'בלמידה').length;
  const completedCount = courses.filter(c => c.status === 'הושלם').length;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden" dir="rtl">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-3 gap-4 mb-4 flex-shrink-0">
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{planningCount}</div>
          <div className="text-sm text-muted-foreground">בתכנון</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
          <div className="text-sm text-muted-foreground">בלמידה</div>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          <div className="text-sm text-muted-foreground">הושלמו</div>
        </div>
      </div>

      {/* Header with count */}
      <div className="flex items-center gap-2 mb-4 flex-shrink-0">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-bold">הקורסים שלי</h2>
        <span className="text-sm text-muted-foreground">({courses.length} קורסים)</span>
      </div>

      {/* Add new course */}
      <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
        <Input
          placeholder="שם הקורס"
          value={newCourse.title}
          onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
          className="flex-1 min-w-[200px] text-right"
          dir="rtl"
        />
        <Button onClick={addCourse}>
          <Plus className="h-4 w-4 ml-1" />
          הוסף קורס
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 flex-shrink-0">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="חפש קורס..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10 text-right"
          dir="rtl"
        />
      </div>

      {/* Courses list with scroll */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          {filteredCourses.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm ? 'לא נמצאו תוצאות' : 'אין קורסים עדיין'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredCourses.map((course) => {
                const lessons = courseLessons[course.id] || [];
                const completedLessons = lessons.filter(l => l.completed).length;
                const isExpanded = expandedCourses.has(course.id);

                return (
                  <Collapsible key={course.id} open={isExpanded} onOpenChange={() => toggleExpanded(course.id)}>
                    <div className="p-4 bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{course.title}</h3>
                            {lessons.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({completedLessons}/{lessons.length} שיעורים)
                              </span>
                            )}
                          </div>
                        </div>
                        <Select
                          value={course.status || 'בתכנון'}
                          onValueChange={(value) => updateCourseStatus(course.id, value)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="בתכנון">בתכנון</SelectItem>
                            <SelectItem value="בלמידה">בלמידה</SelectItem>
                            <SelectItem value="הושלם">הושלם</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Syllabus Dialog */}
                        <Dialog open={syllabusDialogOpen === course.id} onOpenChange={(open) => {
                          setSyllabusDialogOpen(open ? course.id : null);
                          if (open) setSyllabusInput(course.syllabus || '');
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              סילבוס
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl" dir="rtl">
                            <DialogHeader>
                              <DialogTitle>סילבוס - {course.title}</DialogTitle>
                            </DialogHeader>
                            <Textarea
                              placeholder="הדבק את הסילבוס כאן..."
                              value={syllabusInput}
                              onChange={(e) => setSyllabusInput(e.target.value)}
                              className="min-h-[300px] text-right"
                              dir="rtl"
                            />
                            <DialogFooter className="gap-2">
                              <Button variant="outline" onClick={() => saveSyllabus(course.id)} disabled={aiLoading === course.id}>
                                שמור סילבוס
                              </Button>
                              <Button
                                onClick={() => generateLessonsFromSyllabus(course.id, syllabusInput || course.syllabus || undefined)}
                                disabled={aiLoading === course.id}
                              >
                                {aiLoading === course.id ? (
                                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4 ml-1" />
                                )}
                                צור שיעורים מהסילבוס
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* AI Recommendations */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => getAiRecommendations(course.id)}
                          disabled={aiLoading === course.id}
                        >
                          {aiLoading === course.id ? (
                            <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 ml-1" />
                          )}
                          המלצות AI
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCourse(course.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Notes */}
                      <div className="mt-2 mr-11">
                        <InlineNotesTextarea
                          placeholder="הערות לקורס..."
                          initialValue={course.notes}
                          onCommit={(val) => updateCourseNotes(course.id, val)}
                          className="w-full text-right min-h-[40px]"
                          dir="rtl"
                        />
                      </div>

                      {/* Progress Bar */}
                      {lessons.length > 0 && (
                        <div className="mt-3 mr-11 space-y-1">
                          <Progress value={lessons.length > 0 ? (completedLessons / lessons.length) * 100 : 0} className="h-2" />
                          <p className="text-[10px] text-muted-foreground">
                            {Math.round((completedLessons / lessons.length) * 100)}% הושלם — {lessons.length - completedLessons} שיעורים נותרו
                          </p>
                        </div>
                      )}

                      <div className="flex gap-4 mt-2 mr-11 text-xs text-muted-foreground">
                        <span>נוצר: {formatDateTime(course.created_at)}</span>
                        <span>עודכן: {formatDateTime(course.updated_at)}</span>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="bg-muted/30 p-4 mr-11 border-t border-border">
                        {/* Lessons list */}
                        {lessons.length === 0 ? (
                          <p className="text-sm text-muted-foreground">אין שיעורים עדיין - הוסף סילבוס וצור שיעורים</p>
                        ) : (
                          <div className="space-y-2">
                            {lessons.map((lesson, index) => (
                              <div
                                key={lesson.id}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded bg-background",
                                  lesson.completed && "opacity-60"
                                )}
                              >
                                <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                                <button onClick={() => toggleLessonCompletion(lesson)}>
                                  {lesson.completed ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </button>
                                <span className={cn("flex-1", lesson.completed && "line-through")}>
                                  {lesson.title}
                                </span>
                                {lesson.duration_minutes && (
                                  <span className="text-xs text-muted-foreground">
                                    {lesson.duration_minutes} דק'
                                  </span>
                                )}
                                <Input
                                  type="date"
                                  value={lesson.scheduled_date || ''}
                                  onChange={(e) => updateLessonDate(lesson, e.target.value)}
                                  className="w-[140px] h-8"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>

                    {/* Recommendations Dialog */}
                    <Dialog open={recommendationsDialogOpen === course.id} onOpenChange={(open) => setRecommendationsDialogOpen(open ? course.id : null)}>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto" dir="rtl">
                        <DialogHeader>
                          <DialogTitle>המלצות למידה - {course.title}</DialogTitle>
                        </DialogHeader>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {course.ai_recommendations || 'אין המלצות עדיין'}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoursesManager;
