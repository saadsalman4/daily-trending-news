import { getCategory } from "../categories";

// Heuristic "is this a big deal?" scoring. Two signals:
//   1. Severity keywords in the headline (attacks, crashes, disasters…).
//   2. Coverage: how many distinct outlets are running a similar headline right now.
// A story crosses into "breaking" at BREAKING_THRESHOLD.

export const BREAKING_THRESHOLD = 7;

const SEVERE: [RegExp, number][] = [
  [/\b(killed|kills|dead|deadly|deaths?|death toll|fatalities|casualties|massacre)\b/i, 4],
  [/\b(bomb(s|ing|ings|ed)?|blasts?|explosions?|explodes?|detonat\w*)\b/i, 5],
  [/\b(missiles?|air ?strikes?|drone (strike|attack)s?|rockets? (fire|attack)|shelling)\b/i, 4],
  [/\b(terror\w*|hostages?|gunman|gunmen|mass shooting|shooting|stabbing|assassinat\w*)\b/i, 4],
  [/\b(plane|jet|aircraft|airliner|flight|helicopter)\b.*\b(crash\w*|down|missing|hijack\w*|emergency|fire|evacuat\w*)\b/i, 5],
  [/\b(crash\w*|hijack\w*|emergency landing|mayday|diverted|turbulence injur\w*)\b/i, 3],
  [/\b(earthquake|tsunami|hurricane|typhoon|cyclone|volcano|eruption|landslide|tornado)\b/i, 4],
  [/\b(coup|invasion|invades?|declares? war|martial law|state of emergency|curfew)\b/i, 5],
  [/\b(airspace (closed|closure)|flights? (cancelled|suspended|grounded)|grounds? flights)\b/i, 4],
  [/\b(outbreak|pandemic|epidemic)\b/i, 3],
  [/\b(nuclear|chemical weapons?)\b/i, 2],
  [/\b(attacks?|attacked|strikes|strikes? on|retaliat\w*|escalat\w*|ceasefire|war)\b/i, 2],
  [/\b(evacuat\w*|wildfires?|floods?|flooding|blackout|outage)\b/i, 2],
  [/\b(breaking|live:|live updates|latest:)\b/i, 2],
];

const STOPWORDS = new Set(
  "the a an and or but of to in on at for from by with as is are was were be been has have had it its this that these those after over into amid says said say new live latest updates what why how who will could would should can may more than about".split(
    " ",
  ),
);

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[’']s\b/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

export function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}

/** Headlines sharing this fraction of their keywords are treated as the same story. */
export const SAME_STORY = 0.5;

export function severityScore(title: string, summary: string | null) {
  let score = 0;
  for (const [re, pts] of SEVERE) if (re.test(title)) score += pts;
  // Summary matches count for less: they're often background, not the news itself.
  if (summary) for (const [re, pts] of SEVERE) if (!re.test(title) && re.test(summary)) score += Math.floor(pts / 3);
  return Math.min(score, 12);
}

type Scorable = { title: string; summary: string | null; source: string; category: string };

/**
 * Scores `items` against a pool of recent headlines (new items plus recent DB rows)
 * so cross-outlet coverage counts even when the other outlets were ingested earlier.
 */
export function scoreArticles<T extends Scorable>(items: T[], pool: { title: string; source: string }[]) {
  const poolTokens = pool.map((p) => ({ source: p.source, tokens: titleTokens(p.title) }));
  return items.map((item) => {
    const tokens = titleTokens(item.title);
    const outlets = new Set<string>([item.source]);
    for (const p of poolTokens) {
      if (!outlets.has(p.source) && similarity(tokens, p.tokens) >= SAME_STORY) outlets.add(p.source);
    }
    const severity = severityScore(item.title, item.summary);
    const coverage = Math.min((outlets.size - 1) * 2, 8);
    const weight = getCategory(item.category)?.weight ?? 0;
    // Soft news only becomes "breaking" if it's both severe and widely covered.
    const score = Math.max(0, severity + coverage + (severity > 0 ? weight : Math.min(weight, 0)));
    return { item, score, is_breaking: score >= BREAKING_THRESHOLD && severity >= 3 };
  });
}
