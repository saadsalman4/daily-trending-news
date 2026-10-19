export type CategorySlug =
  | "breaking"
  | "world"
  | "middle-east"
  | "politics"
  | "business"
  | "aviation"
  | "technology"
  | "ai"
  | "science"
  | "health";

export type Category = {
  slug: CategorySlug;
  name: string;
  short: string;
  description: string;
  /** Added to an article's breaking-news score (hard-news sections rank higher). */
  weight: number;
};

export type Feed = { url: string; source: string; category: Exclude<CategorySlug, "breaking"> };

// "breaking" has no feeds of its own: it shows articles from every section that the
// scorer flags as major (attacks, crashes, disasters, stories many outlets are covering).
export const CATEGORIES: Category[] = [
  { slug: "breaking", name: "Breaking & Major Incidents", short: "Breaking", description: "Attacks, crashes, disasters and the stories everyone is covering.", weight: 0 },
  { slug: "world", name: "World", short: "World", description: "Conflicts, diplomacy and major global events.", weight: 1 },
  { slug: "middle-east", name: "Middle East & Gulf", short: "Middle East", description: "Saudi Arabia, UAE, Israel, Iran and the wider region.", weight: 2 },
  { slug: "politics", name: "Politics", short: "Politics", description: "Elections, governments and policy.", weight: 0 },
  { slug: "business", name: "Business & Economy", short: "Business", description: "Markets, companies, inflation and oil.", weight: 0 },
  { slug: "aviation", name: "Aviation & Travel", short: "Aviation", description: "Airline incidents, airspace closures and travel advisories.", weight: 2 },
  { slug: "technology", name: "Technology", short: "Tech", description: "Big tech, gadgets and launches.", weight: -2 },
  { slug: "ai", name: "AI", short: "AI", description: "Models, labs, policy and the AI industry.", weight: -2 },
  { slug: "science", name: "Science & Space", short: "Science", description: "Research, discoveries and space.", weight: -1 },
  { slug: "health", name: "Health", short: "Health", description: "Outbreaks, medical breakthroughs and public health.", weight: 0 },
];

export const FEED_CATEGORIES = CATEGORIES.filter((c) => c.slug !== "breaking");

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

// Order matters: when the same URL shows up in several feeds, the first one wins,
// so the more specific sections (Middle East, Aviation, AI) are listed first.
export const FEEDS: Feed[] = [
  // Middle East & Gulf
  { category: "middle-east", source: "The National", url: "https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml" },
  { category: "middle-east", source: "Gulf News", url: "https://gulfnews.com/feed" },
  { category: "middle-east", source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml" },
  { category: "middle-east", source: "The Guardian", url: "https://www.theguardian.com/world/middleeast/rss" },

  // Aviation & Travel
  { category: "aviation", source: "Simple Flying", url: "https://simpleflying.com/feed/" },
  { category: "aviation", source: "FlightGlobal", url: "https://www.flightglobal.com/rss" },
  { category: "aviation", source: "AeroTime", url: "https://www.aerotime.aero/feed" },
  { category: "aviation", source: "The Guardian", url: "https://www.theguardian.com/world/air-transport/rss" },

  // AI
  { category: "ai", source: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
  { category: "ai", source: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { category: "ai", source: "The Guardian", url: "https://www.theguardian.com/technology/artificialintelligenceai/rss" },
  { category: "ai", source: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },

  // World
  { category: "world", source: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { category: "world", source: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { category: "world", source: "The Guardian", url: "https://www.theguardian.com/world/rss" },
  { category: "world", source: "NPR", url: "https://feeds.npr.org/1004/rss.xml" },
  { category: "world", source: "DW", url: "https://rss.dw.com/rdf/rss-en-world" },

  // Politics
  { category: "politics", source: "Politico", url: "https://rss.politico.com/politics-news.xml" },
  { category: "politics", source: "NPR", url: "https://feeds.npr.org/1014/rss.xml" },
  { category: "politics", source: "The Guardian", url: "https://www.theguardian.com/us-news/us-politics/rss" },
  { category: "politics", source: "BBC News", url: "https://feeds.bbci.co.uk/news/politics/rss.xml" },

  // Business & Economy
  { category: "business", source: "BBC News", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { category: "business", source: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { category: "business", source: "The Guardian", url: "https://www.theguardian.com/business/rss" },

  // Technology
  { category: "technology", source: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { category: "technology", source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
  { category: "technology", source: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { category: "technology", source: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },

  // Science & Space
  { category: "science", source: "BBC News", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
  { category: "science", source: "Space.com", url: "https://www.space.com/feeds/all" },
  { category: "science", source: "The Guardian", url: "https://www.theguardian.com/science/rss" },
  { category: "science", source: "ScienceDaily", url: "https://www.sciencedaily.com/rss/top/science.xml" },
  { category: "science", source: "NASA", url: "https://www.nasa.gov/news-release/feed/" },

  // Health
  { category: "health", source: "BBC News", url: "https://feeds.bbci.co.uk/news/health/rss.xml" },
  { category: "health", source: "STAT", url: "https://www.statnews.com/feed/" },
  { category: "health", source: "The Guardian", url: "https://www.theguardian.com/society/health/rss" },
];
