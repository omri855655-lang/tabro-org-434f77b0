import { Component, type ReactNode } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';

const copy = {
  he: ['לא הצלחנו להציג את המסך הזה', 'אפשר לעבור למסך אחר או לטעון מחדש. מידע שכבר נשמר אינו נמחק.', 'נסה שוב', 'טען מחדש'],
  en: ['This screen could not be displayed', 'Switch to another screen or reload. Saved data is not deleted.', 'Try again', 'Reload'],
  es: ['No se pudo mostrar esta pantalla', 'Cambia de pantalla o recarga. Los datos guardados no se eliminan.', 'Reintentar', 'Recargar'],
  zh: ['无法显示此页面', '请切换页面或重新加载。已保存的数据不会被删除。', '重试', '重新加载'],
  ar: ['تعذر عرض هذه الشاشة', 'انتقل إلى شاشة أخرى أو أعد التحميل. لن تُحذف البيانات المحفوظة.', 'حاول مجدداً', 'إعادة التحميل'],
  ru: ['Не удалось показать этот экран', 'Перейдите на другой экран или обновите страницу. Сохранённые данные не удаляются.', 'Повторить', 'Обновить'],
};
class Boundary extends Component<{ children: ReactNode; resetKey: string; labels: string[] }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('Workspace panel failed:', error.name); }
  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const [title, description, retry, reload] = this.props.labels;
    return <section role="alert" className="m-4 rounded-2xl border bg-card p-6 text-card-foreground"><h2 className="text-xl font-semibold">{title}</h2><p className="my-3 text-sm text-muted-foreground">{description}</p><div className="flex flex-wrap gap-2"><Button onClick={() => this.setState({ failed: false })}>{retry}</Button><Button variant="outline" onClick={() => window.location.reload()}>{reload}</Button></div></section>;
  }
}
export default function WorkspacePanelBoundary({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  const { lang } = useLanguage();
  return <Boundary resetKey={resetKey} labels={copy[lang]}>{children}</Boundary>;
}
