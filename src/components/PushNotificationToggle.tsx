import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useLanguage } from '@/hooks/useLanguage';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PushNotificationToggle = () => {
  const { isSubscribed, isSupported, loading, subscribe, unsubscribe } = usePushNotifications();
  const { lang } = useLanguage();
  const labels = { he: ['הפעל התראות push', 'כבה התראות push'], en: ['Enable push notifications', 'Disable push notifications'], es: ['Activar notificaciones push', 'Desactivar notificaciones push'], ar: ['تفعيل الإشعارات الفورية', 'إيقاف الإشعارات الفورية'], ru: ['Включить push-уведомления', 'Отключить push-уведомления'], zh: ['开启推送通知', '关闭推送通知'] }[lang];
  const label = labels[isSubscribed ? 1 : 0];

  if (!isSupported) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={loading}
          aria-label={label}
          className={isSubscribed ? "text-primary" : "text-muted-foreground"}
        >
          {isSubscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
      </TooltipContent>
    </Tooltip>
  );
};

export default PushNotificationToggle;
