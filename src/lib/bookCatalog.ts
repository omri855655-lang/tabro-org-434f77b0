export type CatalogSource = "Open Library" | "Google Books" | "Internet Archive" | "Project Gutenberg" | "Tabro";

export interface CatalogBook {
  key: string;
  title: string;
  author: string;
  year?: number;
  pages?: number;
  language?: string;
  coverId?: number;
  coverUrl?: string;
  isbn?: string;
  source: CatalogSource;
  sources?: CatalogSource[];
  externalUrl?: string;
}

const cleanImageUrl = (value: unknown) => typeof value === "string" ? value.replace(/^http:/, "https:") : undefined;

export async function searchOpenLibraryBooks(query: string, language: string, limit = 10): Promise<CatalogBook[]> {
  const params = new URLSearchParams({
    q: language === "he" ? `${query} language:heb` : query,
    limit: String(limit),
    fields: "key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,language",
  });
  const response = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
  if (!response.ok) throw new Error(`Open Library ${response.status}`);
  const data = await response.json() as { docs?: Array<Record<string, unknown>> };
  return (data.docs || []).map((doc, index) => ({
    key: `ol:${String(doc.key || `${index}-${doc.title}`)}`,
    title: String(doc.title || ""),
    author: Array.isArray(doc.author_name) ? String(doc.author_name[0] || "") : "",
    year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : undefined,
    pages: typeof doc.number_of_pages_median === "number" ? doc.number_of_pages_median : undefined,
    language: Array.isArray(doc.language) ? String(doc.language[0] || "") : undefined,
    coverId: typeof doc.cover_i === "number" ? doc.cover_i : undefined,
    isbn: Array.isArray(doc.isbn) ? String(doc.isbn[0] || "") : undefined,
    source: "Open Library" as const,
  })).filter((book) => book.title);
}

export async function searchGoogleBooks(query: string, language: string, limit = 10): Promise<CatalogBook[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({ q: query, maxResults: String(Math.min(40, limit)), printType: "books" });
  if (language && language !== "all") params.set("langRestrict", language);
  params.set("key", apiKey);
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);
  if (!response.ok) throw new Error(`Google Books ${response.status}`);
  const data = await response.json() as { items?: Array<{ id?: string; volumeInfo?: Record<string, unknown> }> };
  return (data.items || []).map((item, index) => {
    const info = item.volumeInfo || {};
    const identifiers = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers as Array<{ identifier?: string }> : [];
    const images = info.imageLinks && typeof info.imageLinks === "object" ? info.imageLinks as Record<string, unknown> : {};
    const publishedDate = typeof info.publishedDate === "string" ? info.publishedDate : "";
    return {
      key: `gb:${item.id || index}`,
      title: String(info.title || ""),
      author: Array.isArray(info.authors) ? String(info.authors[0] || "") : "",
      year: /^\d{4}/.test(publishedDate) ? Number(publishedDate.slice(0, 4)) : undefined,
      pages: typeof info.pageCount === "number" ? info.pageCount : undefined,
      language: typeof info.language === "string" ? info.language : undefined,
      coverUrl: cleanImageUrl(images.thumbnail || images.smallThumbnail),
      isbn: identifiers[0]?.identifier,
      source: "Google Books" as const,
    };
  }).filter((book) => book.title);
}

export async function searchInternetArchiveBooks(query: string, language: string, limit = 10): Promise<CatalogBook[]> {
  const params = new URLSearchParams({
    q: `${query} AND mediatype:texts`,
    rows: String(limit),
    page: "1",
    output: "json",
  });
  ["identifier", "title", "creator", "date", "language"].forEach((field) => params.append("fl[]", field));
  const response = await fetch(`https://archive.org/advancedsearch.php?${params.toString()}`);
  if (!response.ok) throw new Error(`Internet Archive ${response.status}`);
  const data = await response.json() as { response?: { docs?: Array<Record<string, unknown>> } };
  const books = (data.response?.docs || []).map((doc, index) => {
    const identifier = String(doc.identifier || `${index}-${doc.title}`);
    const rawTitle = Array.isArray(doc.title) ? doc.title[0] : doc.title;
    const rawCreator = Array.isArray(doc.creator) ? doc.creator[0] : doc.creator;
    const rawLanguage = Array.isArray(doc.language) ? doc.language[0] : doc.language;
    const rawDate = String(doc.date || "");
    return {
      key: `ia:${identifier}`,
      title: String(rawTitle || ""),
      author: String(rawCreator || ""),
      year: /^\d{4}/.test(rawDate) ? Number(rawDate.slice(0, 4)) : undefined,
      language: typeof rawLanguage === "string" ? rawLanguage : undefined,
      coverUrl: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
      externalUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
      source: "Internet Archive" as const,
    };
  }).filter((book) => book.title);
  if (language !== "he") return books;
  return books.sort((a, b) => Number(/^(heb|he)$/i.test(b.language || "")) - Number(/^(heb|he)$/i.test(a.language || "")));
}

export async function searchProjectGutenbergBooks(query: string, language: string, limit = 10): Promise<CatalogBook[]> {
  const params = new URLSearchParams({ search: query });
  if (language === "he") params.set("languages", "he");
  const response = await fetch(`https://gutendex.com/books/?${params.toString()}`);
  if (!response.ok) throw new Error(`Project Gutenberg ${response.status}`);
  const data = await response.json() as { results?: Array<Record<string, unknown>> };
  return (data.results || []).slice(0, limit).map((book, index) => {
    const authors = Array.isArray(book.authors) ? book.authors as Array<{ name?: string }> : [];
    const languages = Array.isArray(book.languages) ? book.languages : [];
    const formats = book.formats && typeof book.formats === "object" ? book.formats as Record<string, unknown> : {};
    const id = typeof book.id === "number" ? book.id : index;
    return {
      key: `pg:${id}`,
      title: String(book.title || ""),
      author: String(authors[0]?.name || ""),
      language: String(languages[0] || ""),
      coverUrl: cleanImageUrl(formats["image/jpeg"]),
      externalUrl: `https://www.gutenberg.org/ebooks/${id}`,
      source: "Project Gutenberg" as const,
    };
  }).filter((book) => book.title);
}

export function mergeCatalogBooks(...groups: CatalogBook[][]): CatalogBook[] {
  const merged = new Map<string, CatalogBook>();
  groups.flat().forEach((book) => {
    const identity = `${book.title.trim().toLocaleLowerCase()}::${book.author.trim().toLocaleLowerCase()}`;
    const previous = merged.get(identity);
    if (!previous) merged.set(identity, { ...book, sources: book.sources || [book.source] });
    else merged.set(identity, {
      ...previous,
      pages: previous.pages || book.pages,
      year: previous.year || book.year,
      language: previous.language || book.language,
      coverId: previous.coverId || book.coverId,
      coverUrl: previous.coverUrl || book.coverUrl,
      isbn: previous.isbn || book.isbn,
      externalUrl: previous.externalUrl || book.externalUrl,
      sources: [...new Set([...(previous.sources || [previous.source]), ...(book.sources || [book.source])])],
    });
  });
  return [...merged.values()];
}
