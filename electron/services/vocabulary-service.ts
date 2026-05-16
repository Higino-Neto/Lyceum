import AdmZip from "adm-zip";
import fs from "node:fs";

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "shall", "can", "need", "dare", "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "under",
  "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "also", "now", "i", "me", "my", "myself", "we", "our", "ours",
  "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself",
  "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs",
  "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "about",
  "because", "while", "although", "if", "unless", "until", "whether", "however", "therefore",
  "otherwise", "either", "neither", "both", "neither", "yet", "still", "already", "always",
  "never", "ever", "yet", "since", "before", "until", "after", "during", "over", "without",
  "within", "along", "around", "behind", "beyond", "near", "onto", "off", "out", "up", "down",
  "away", "back", "even", "much", "many", "any", "every", "another", "such", "him", "her",
]);

export function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeWord(word: string): string | null {
  const normalized = word.toLowerCase().replace(/[^a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ\s-]/g, "");
  if (normalized.length < 1) return null;
  return normalized;
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase());
}

export function extractVocabularyFromEpub(filePath: string): { word: string; count: number }[] {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();

  const textParts: string[] = [];
  const htmlEntries = entries.filter((entry: any) => {
    const name = entry.entryName.toLowerCase();
    return name.endsWith(".html") || name.endsWith(".xhtml") || name.endsWith(".htm");
  });

  for (const entry of htmlEntries) {
    try {
      const html = entry.getData().toString("utf8");
      const text = stripHtml(html);
      if (text.length > 0) {
        textParts.push(text);
      }
    } catch (e) {
      console.error("[Vocabulary] Error reading entry:", entry.entryName, e);
    }
  }

  const fullText = textParts.join(" ");
  const wordCounts = new Map<string, number>();

  for (const word of fullText.split(/\s+/)) {
    const normalized = normalizeWord(word);
    if (normalized) {
      wordCounts.set(normalized, (wordCounts.get(normalized) || 0) + 1);
    }
  }

  return Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}
