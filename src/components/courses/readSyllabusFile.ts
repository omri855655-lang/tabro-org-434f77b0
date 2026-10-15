export async function readSyllabusFile(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('הקובץ גדול מדי. המקסימום הוא 10MB.');
  if (/\.(txt|md)$/i.test(file.name)) return (await file.text()).slice(0, 60000);
  if (!/\.pdf$/i.test(file.name)) throw new Error('אפשר להעלות PDF או קובץ טקסט.');
  const pdfjs = await import('pdfjs-dist');
  const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 60); pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const text = await page.getTextContent();
      pages.push(text.items.map(item => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '').join(''));
    }
    const text = pages.join('\n').trim();
    if (!text) throw new Error('לא נמצא טקסט בקובץ. בקובץ סרוק יש להדביק טקסט לאחר זיהוי תווים.');
    return text.slice(0, 60000);
  } finally { await pdf.destroy(); }
}
