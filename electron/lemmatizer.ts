const irregularVerbs: Record<string, string> = {
  are: "be", was: "be", were: "be", been: "be", being: "be", am: "be", is: "be",
  have: "have", had: "have", has: "have",
  do: "do", did: "do", does: "do", doing: "do",
  go: "go", went: "go", gone: "go", going: "go", goes: "go",
  get: "get", got: "get", getting: "get",
  make: "make", made: "make", making: "make",
  take: "take", took: "take", taken: "take", taking: "take",
  see: "see", saw: "see", seen: "see", seeing: "see",
  come: "come", came: "come", coming: "come",
  know: "know", knew: "know", known: "know", knowing: "know",
  think: "think", thought: "think", thinking: "think",
  say: "say", said: "say", saying: "say",
  want: "want", wanted: "want", wanting: "want",
  use: "use", used: "use", using: "use",
  find: "find", found: "find", finding: "find",
  give: "give", gave: "give", given: "give", giving: "give",
  tell: "tell", told: "tell", telling: "tell",
  could: "can", would: "will", should: "shall", might: "may", must: "must", can: "can", will: "will", shall: "shall", may: "may",
  need: "need", needed: "need", needing: "need",
  leave: "leave", left: "leave", leaving: "leave",
  put: "put", putting: "put", let: "let", letting: "let",
  run: "run", ran: "run", running: "run",
  move: "move", moved: "move", moving: "move",
  live: "live", lived: "live", living: "live",
  hold: "hold", held: "hold", holding: "hold",
  bring: "bring", brought: "bring", bringing: "bring",
  write: "write", wrote: "write", written: "write", writing: "write",
  read: "read", reading: "read",
  learn: "learn", learned: "learn", learning: "learn",
  change: "change", changed: "change", changing: "change",
  lead: "lead", led: "lead", leading: "lead",
  stand: "stand", stood: "stand", standing: "stand",
  meet: "meet", met: "meet", meeting: "meet",
  pay: "pay", paid: "pay", paying: "pay",
  buy: "buy", bought: "buy", buying: "buy",
  wait: "wait", waited: "wait", waiting: "wait",
  serve: "serve", served: "serve", serving: "serve",
  die: "die", died: "die", dying: "die",
  send: "send", sent: "send", sending: "send",
  expect: "expect", expected: "expect", expecting: "expect",
  build: "build", built: "build", building: "build",
  stay: "stay", stayed: "stay", staying: "stay",
  fall: "fall", fell: "fall", fallen: "fall", falling: "fall",
  cut: "cut", cutting: "cut",
  reach: "reach", reached: "reach", reaching: "reach",
  kill: "kill", killed: "kill", killing: "kill",
  remain: "remain", remained: "remain", remaining: "remain",
  suggest: "suggest", suggested: "suggest", suggesting: "suggest",
  raise: "raise", raised: "raise", raising: "raise",
  pass: "pass", passed: "pass", passing: "pass",
  sell: "sell", sold: "sell", selling: "sell",
  require: "require", required: "require", requiring: "require",
  report: "report", reported: "report", reporting: "report",
  decide: "decide", decided: "decide", deciding: "decide",
  pull: "pull", pulled: "pull", pulling: "pull",
};

const irregularPlurals: Record<string, string> = {
  men: "man", women: "woman", children: "child",
  feet: "foot", teeth: "tooth", geese: "goose",
  mice: "mouse", lice: "louse", oxen: "ox",
  knives: "knife", wives: "wife", lives: "life",
  leaves: "leaf", halves: "half", sheaves: "sheaf",
  loaves: "loaf", thieves: "thief", calves: "calf",
  hooves: "hoof", elves: "elf", selves: "self",
  shelves: "shelf", potatoes: "potato", tomatoes: "tomato",
  heroes: "hero", echoes: "echo", vetoes: "veto",
  negroes: "negro", mosquitoes: "mosquito", mottoes: "motto",
  cargoes: "cargo", photographs: "photograph",
  phonographs: "phonograph", monographs: "monograph",
  paragraphs: "paragraph",
};

const irregularAdjectives: Record<string, string> = {
  better: "good", best: "good", worse: "bad", worst: "bad",
  more: "many", most: "many", less: "little", least: "little",
  elder: "old", eldest: "old", older: "old", oldest: "old",
  farther: "far", farthest: "far", further: "far", furthest: "far",
  later: "late", latest: "late", latter: "late",
  redder: "red", reddest: "red",
  simpler: "simple", simplest: "simple",
  commoner: "common", commonest: "common",
};

export function lemmatize(word: string): string {
  const lower = word.toLowerCase();
  if (irregularVerbs[lower]) return irregularVerbs[lower];
  if (irregularPlurals[lower]) return irregularPlurals[lower];
  if (irregularAdjectives[lower]) return irregularAdjectives[lower];
  if (lower.length < 4) return lower;

  if (lower.endsWith("ied")) return lower.slice(0, -3) + "y";
  if (lower.endsWith("ies")) return lower.slice(0, -3) + "y";
  if (lower.endsWith("ing")) {
    const base = lower.slice(0, -3);
    if (base.length >= 2) {
      if (base.endsWith("tt") || base.endsWith("ss") || base.endsWith("gg") || base.endsWith("nn") || base.endsWith("mm") || base.endsWith("pp") || base.endsWith("rr") || base.endsWith("e")) {
        return base;
      }
      return base;
    }
    return base;
  }

  if (lower.endsWith("ed")) {
    const base = lower.slice(0, -2);
    if (base.endsWith("e")) return base;
    if (base.length >= 3) {
      const last = base.slice(-1);
      const secondLast = base.slice(-2, -1);
      if (!"aeiou".includes(secondLast) && last === secondLast) {
        return base.slice(0, -1);
      }
    }
    return base;
  }

  if (lower.endsWith("es")) {
    const base = lower.slice(0, -2);
    if (base.endsWith("ss") || base.endsWith("sh") || base.endsWith("ch") || base.endsWith("x") || base.endsWith("z") || base.endsWith("o")) {
      return base;
    }
    return base;
  }

  if (lower.endsWith("s") && !lower.endsWith("ss")) {
    return lower.slice(0, -1);
  }
  if (lower.endsWith("er")) return lower.slice(0, -2) || lower;
  if (lower.endsWith("est")) return lower.slice(0, -3) || lower;
  if (lower.endsWith("ly") && lower.length > 4) return lower.slice(0, -2);
  if (lower.endsWith("ful")) return lower.slice(0, -3);
  if (lower.endsWith("less")) return lower.slice(0, -4);
  if (lower.endsWith("ness")) return lower.slice(0, -4);
  if (lower.endsWith("ment")) return lower.slice(0, -4);
  if (lower.endsWith("tion") || lower.endsWith("sion")) return lower.slice(0, -4);
  if (lower.endsWith("able") || lower.endsWith("ible")) return lower.slice(0, -4);
  if (lower.endsWith("al")) return lower.slice(0, -2);
  if (lower.endsWith("ive")) return lower.slice(0, -3);
  if (lower.endsWith("ous")) return lower.slice(0, -3);

  return lower;
}

export function normalizeWord(word: string): string {
  return word.normalize("NFKC").replace(/['\u2018\u2019`]/g, "").replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "").toLowerCase();
}