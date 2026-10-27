export function pickLearningTopic(paths: Record<string, string[]>, random = Math.random) {
  const categories = Object.keys(paths).filter(key => paths[key].length > 0);
  if (!categories.length) throw new Error('No learning topics');
  const pick = <T,>(items: T[]) => items[Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)))];
  const category = pick(categories);
  return { category, subtopic: pick(paths[category]) };
}

export const learningDrawCopy = {
  he: ['מגרילים את הנושא הבא...', 'הנושא שנבחר עבורך'],
  en: ['Drawing your next topic...', 'Your selected topic'],
  es: ['Sorteando el siguiente tema...', 'Tu tema seleccionado'],
  zh: ['正在抽取下一个主题...', '为你选中的主题'],
  ar: ['جارٍ سحب الموضوع التالي...', 'الموضوع المختار لك'],
  ru: ['Выбираем следующую тему...', 'Выбранная для вас тема'],
};
