export interface ExternalBook {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
  isbn?: string[];
  oclc?: string[];
}

export interface ExternalBookResult {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
  total_pages: number | null;
  published_date: string | null;
  external_source: 'openlibrary';
}

async function searchOpenLibrary(query: string, limit: number = 10): Promise<ExternalBookResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `https://openlibrary.org/search.json?q=${encodedQuery}&limit=${limit}&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median,isbn,oclc`
  );

  if (!response.ok) {
    throw new Error('Failed to search Open Library');
  }

  const data = await response.json();
  
  return (data.docs || []).map((book: ExternalBook): ExternalBookResult => ({
    id: `openlibrary-${book.key}`,
    title: book.title,
    author: book.author_name?.[0] || null,
    thumbnail_url: book.cover_i 
      ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
      : null,
    total_pages: book.number_of_pages_median || null,
    published_date: book.first_publish_year?.toString() || null,
    external_source: 'openlibrary',
  }));
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - (distance / maxLength);
}

function normalizeForComparison(str: string): string {
  return str.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export async function searchAllBooks(
  query: string,
  localBooks: { id: string; title: string; author: string | null; thumbnail_url: string | null; total_pages: number | null }[]
): Promise<{ source: 'local' | 'external'; data: typeof localBooks[0] | ExternalBookResult; similarity: number }[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const normalizedQuery = normalizeForComparison(query);
  const results: { source: 'local' | 'external'; data: typeof localBooks[0] | ExternalBookResult; similarity: number }[] = [];

  const localResults = localBooks.map(book => {
    const normalizedTitle = normalizeForComparison(book.title);
    const normalizedAuthor = book.author ? normalizeForComparison(book.author) : '';
    
    const titleSimilarity = calculateSimilarity(normalizedTitle, normalizedQuery);
    const authorSimilarity = normalizedAuthor ? calculateSimilarity(normalizedAuthor, normalizedQuery) * 0.7 : 0;
    const combinedSimilarity = Math.max(titleSimilarity, authorSimilarity);

    return {
      source: 'local' as const,
      data: book,
      similarity: combinedSimilarity,
    };
  }).filter(r => r.similarity > 0.2);

  results.push(...localResults);

  try {
    const externalResults = await searchOpenLibrary(query, 15);
    
    const mappedExternal = externalResults.map(book => {
      const normalizedTitle = normalizeForComparison(book.title);
      const normalizedAuthor = book.author ? normalizeForComparison(book.author) : '';
      
      const titleSimilarity = calculateSimilarity(normalizedTitle, normalizedQuery);
      const authorSimilarity = normalizedAuthor ? calculateSimilarity(normalizedAuthor, normalizedQuery) * 0.7 : 0;
      const combinedSimilarity = Math.max(titleSimilarity, authorSimilarity);

      return {
        source: 'external' as const,
        data: book,
        similarity: combinedSimilarity,
      };
    });

    results.push(...mappedExternal);
  } catch (error) {
    console.error('Error searching external books:', error);
  }

  results.sort((a, b) => b.similarity - a.similarity);

  const uniqueResults = results.filter((item, index, self) => {
    const titleA = normalizeForComparison('title' in item.data ? item.data.title : '');
    return index === self.findIndex((t) => {
      const titleB = normalizeForComparison('title' in t.data ? t.data.title : '');
      return titleA === titleB;
    });
  });

  return uniqueResults.slice(0, 20);
}
