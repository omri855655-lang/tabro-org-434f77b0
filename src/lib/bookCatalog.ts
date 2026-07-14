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
  source: "Open Library" | "Google Books" | "Tabro";
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
  const params = new URLSearchParams({ q: query, maxResults: String(Math.min(40, limit)), printType: "books" });
  if (language && language !== "all") params.set("langRestrict", language);
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

export function mergeCatalogBooks(...groups: CatalogBook[][]): CatalogBook[] {
  const merged = new Map<string, CatalogBook>();
  groups.flat().forEach((book) => {
    const identity = `${book.title.trim().toLocaleLowerCase()}::${book.author.trim().toLocaleLowerCase()}`;
    const previous = merged.get(identity);
    if (!previous) merged.set(identity, book);
    else merged.set(identity, {
      ...previous,
      pages: previous.pages || book.pages,
      year: previous.year || book.year,
      language: previous.language || book.language,
      coverId: previous.coverId || book.coverId,
      coverUrl: previous.coverUrl || book.coverUrl,
      isbn: previous.isbn || book.isbn,
    });
  });
  return [...merged.values()];
}
