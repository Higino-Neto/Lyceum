/**
 * Lightweight language identification from function-word frequencies and
 * script. Used to catch books whose metadata declares no language or the
 * wrong one (e.g. an import default), so knowledge is filed under the right
 * language. Deliberately conservative: returns `null` when unsure.
 */

const STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "of", "to", "a", "in", "is", "that", "it", "was", "he", "for", "with", "as", "his", "on", "be", "at", "by", "i", "you", "had", "not", "but", "she", "they", "have", "this", "from", "which"],
  de: ["der", "die", "und", "in", "den", "von", "zu", "das", "mit", "sich", "des", "auf", "für", "ist", "im", "dem", "nicht", "ein", "eine", "als", "auch", "es", "an", "er", "hat", "aus", "bei", "sie", "nach", "wird", "ich", "war", "aber", "noch"],
  fr: ["le", "la", "de", "et", "les", "des", "en", "un", "une", "du", "est", "que", "qui", "dans", "pour", "pas", "au", "sur", "ne", "il", "elle", "je", "se", "plus", "par", "avec", "ce", "mais", "nous", "vous", "son", "sa", "aux", "lui", "été"],
  es: ["de", "la", "que", "el", "en", "y", "los", "se", "del", "las", "un", "por", "con", "no", "una", "su", "para", "es", "al", "lo", "como", "más", "pero", "sus", "le", "ya", "o", "fue", "este", "ha", "muy", "sin", "sobre", "también", "me"],
  pt: ["de", "a", "o", "que", "e", "do", "da", "em", "um", "para", "é", "com", "não", "uma", "os", "no", "se", "na", "por", "mais", "as", "dos", "como", "mas", "foi", "ao", "ele", "das", "tem", "à", "seu", "sua", "ou", "ser", "quando", "muito", "nos", "já", "eu", "também", "isso", "ela", "você", "estava"],
  it: ["di", "e", "il", "la", "che", "a", "in", "per", "un", "è", "non", "una", "del", "con", "i", "si", "da", "le", "della", "lo", "gli", "ma", "come", "al", "anche", "più", "sono", "nel", "ha", "era", "mi", "questo", "io", "lui", "lei"],
  nl: ["de", "en", "van", "het", "een", "in", "is", "dat", "op", "te", "zijn", "met", "voor", "niet", "die", "aan", "er", "maar", "om", "ook", "als", "bij", "dan", "nog", "ik", "je", "hij", "ze", "wat", "was", "naar", "uit"],
  sv: ["och", "i", "att", "det", "som", "en", "på", "är", "av", "för", "med", "till", "den", "har", "de", "inte", "om", "ett", "han", "men", "var", "jag", "sig", "från", "vi", "så", "kan", "hon", "när"],
  pl: ["i", "w", "się", "na", "nie", "z", "do", "to", "że", "jest", "o", "jak", "a", "po", "ale", "co", "tak", "za", "od", "go", "już", "jego", "jej", "by", "czy", "mnie", "tym", "był", "była"],
  ru: ["и", "в", "не", "на", "я", "что", "он", "с", "как", "а", "то", "все", "она", "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее", "мне", "было", "вот"],
};

const LISTS = Object.fromEntries(Object.entries(STOPWORDS).map(([code, words]) => [code, new Set(words)]));

export interface LanguageGuess {
  language: string;
  confidence: number;
}

function scriptGuess(text: string): string | null {
  let kana = 0;
  let han = 0;
  let hangul = 0;
  let greek = 0;
  let arabic = 0;
  let letters = 0;
  for (const char of text.slice(0, 20_000)) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x41) continue;
    letters += 1;
    if (code >= 0x3040 && code <= 0x30ff) kana += 1;
    else if (code >= 0x4e00 && code <= 0x9fff) han += 1;
    else if (code >= 0xac00 && code <= 0xd7af) hangul += 1;
    else if (code >= 0x0370 && code <= 0x03ff) greek += 1;
    else if (code >= 0x0600 && code <= 0x06ff) arabic += 1;
  }
  if (letters === 0) return null;
  if (kana / letters > 0.05) return "ja";
  if (han / letters > 0.3) return "zh";
  if (hangul / letters > 0.3) return "ko";
  if (greek / letters > 0.3) return "el";
  if (arabic / letters > 0.3) return "ar";
  return null;
}

/** Guesses the language of a text sample; `null` when there is no clear winner. */
export function detectLanguage(sample: string): LanguageGuess | null {
  const script = scriptGuess(sample);
  if (script) return { language: script, confidence: 0.9 };
  const words = sample.toLowerCase().match(/\p{L}+/gu)?.slice(0, 20_000) ?? [];
  if (words.length < 30) return null;
  const scores = Object.entries(LISTS).map(([language, list]) => {
    let hits = 0;
    for (const word of words) if (list.has(word)) hits += 1;
    return { language, score: hits / words.length };
  }).sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (!best || best.score < 0.12) return null;
  const margin = second ? best.score / Math.max(second.score, 0.001) : 10;
  if (margin < 1.3) return null;
  return { language: best.language, confidence: Math.min(1, best.score * 2) * Math.min(1, margin / 2) };
}
