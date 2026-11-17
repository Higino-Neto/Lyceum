/** Lyceum-hosted dictionaries (zip with StarDict files), shared by desktop and the WebView builds. */
export interface CuratedDictionary {
  id: string;
  name: string;
  sourceLang: string;
  targetLang: string;
  size: number;
  url: string;
  version: string;
  hash: string;
}

export const DICTIONARY_BUCKET_URL = "https://szjunmocyxycmuirvzta.supabase.co/storage/v1/object/public/dictionaries";

export const CURATED_DICTIONARIES: CuratedDictionary[] = [
  {
    id: "eng-spa",
    name: "English → Spanish",
    sourceLang: "en",
    targetLang: "es",
    size: 1024 * 1024 * 5,
    url: `${DICTIONARY_BUCKET_URL}/eng-spa.zip`,
    version: "2025.11.23",
    hash: "",
  },
  {
    id: "eng-por",
    name: "English → Portuguese",
    sourceLang: "en",
    targetLang: "pt",
    size: 1024 * 1024 * 1,
    url: `${DICTIONARY_BUCKET_URL}/eng-por.zip`,
    version: "0.3",
    hash: "",
  },
  {
    id: "eng-fra",
    name: "English → French",
    sourceLang: "en",
    targetLang: "fr",
    size: 1024 * 1024 * 1,
    url: `${DICTIONARY_BUCKET_URL}/eng-fra.zip`,
    version: "0.1.6",
    hash: "",
  },
  {
    id: "eng-deu",
    name: "English → German",
    sourceLang: "en",
    targetLang: "de",
    size: 1024 * 1024 * 26,
    url: `${DICTIONARY_BUCKET_URL}/eng-deu.zip`,
    version: "1.9-fd1",
    hash: "",
  },
  {
    id: "eng-ita",
    name: "English → Italian",
    sourceLang: "en",
    targetLang: "it",
    size: 1024 * 1024 * 4,
    url: `${DICTIONARY_BUCKET_URL}/eng-ita.zip`,
    version: "2025.11.23",
    hash: "",
  },
  {
    id: "eng-zho",
    name: "English → Chinese",
    sourceLang: "en",
    targetLang: "zh",
    size: 1024 * 1024 * 2,
    url: `${DICTIONARY_BUCKET_URL}/eng-zho.zip`,
    version: "2025.11.23",
    hash: "",
  },
  {
    id: "eng-jpn",
    name: "English → Japanese",
    sourceLang: "en",
    targetLang: "ja",
    size: 1024 * 1024 * 3,
    url: `${DICTIONARY_BUCKET_URL}/eng-jpn.zip`,
    version: "2025.11.23",
    hash: "",
  },
  {
    id: "eng-rus",
    name: "English → Russian",
    sourceLang: "en",
    targetLang: "ru",
    size: 1024 * 1024 * 6,
    url: `${DICTIONARY_BUCKET_URL}/eng-rus.zip`,
    version: "2025.11.23",
    hash: "",
  },
];
