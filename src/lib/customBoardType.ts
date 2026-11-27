import type { AppLanguage } from "./appLanguage";

export type CustomBoardType = "list" | "tasks";
export const CUSTOM_TASK_SHEET_PREFIX = "tabro-board-";
export const customTaskSheetName = (boardId: string) => `${CUSTOM_TASK_SHEET_PREFIX}${boardId}`;

type BoardCopy = { label: string; list: string; tasks: string; hint: string; error: string };
export const customBoardTypeCopy: Record<AppLanguage, BoardCopy> = {
  he: { label: "סוג הדשבורד", list: "דשבורד רשימות", tasks: "דשבורד משימות מלא", hint: "במעבר הראשון למשימות, פריטי הרשימה יועתקו ללוח המשימות. שני הלוחות נשמרים בנפרד, ואפשר לחזור לכל אחד מהם.", error: "לא ניתן לשנות את סוג הדשבורד" },
  en: { label: "Dashboard type", list: "List dashboard", tasks: "Full task dashboard", hint: "The first switch to tasks copies your list items to the task board. Each board keeps its own items, and you can switch back at any time.", error: "Could not change the dashboard type" },
  es: { label: "Tipo de panel", list: "Panel de listas", tasks: "Panel completo de tareas", hint: "Al cambiar a tareas por primera vez, los elementos de la lista se copian al panel de tareas. Cada panel conserva sus propios elementos y puedes volver cuando quieras.", error: "No se pudo cambiar el tipo de panel" },
  ar: { label: "نوع لوحة المعلومات", list: "لوحة القوائم", tasks: "لوحة المهام الكاملة", hint: "عند التبديل إلى المهام للمرة الأولى، تُنسخ عناصر القائمة إلى لوحة المهام. تحتفظ كل لوحة بعناصرها ويمكنك التبديل بينهما في أي وقت.", error: "تعذّر تغيير نوع لوحة المعلومات" },
  zh: { label: "仪表板类型", list: "列表仪表板", tasks: "完整任务仪表板", hint: "首次切换到任务时，列表项目会被复制到任务板。两种面板分别保存各自的项目，你可以随时切换。", error: "无法更改仪表板类型" },
  ru: { label: "Тип панели", list: "Панель списков", tasks: "Полная панель задач", hint: "При первом переходе к задачам элементы списка копируются на панель задач. Каждая панель хранит свои элементы, и вы можете переключаться между ними.", error: "Не удалось изменить тип панели" },
};
