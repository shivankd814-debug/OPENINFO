const UA = "OPENINFO/2.0 (public discovery reader; respect source terms)";
const limit = Math.min(30, Math.max(5, Number(process.env.MAX_ITEMS_PER_SOURCE || 18)));
const since = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);

async function request(url, accept = "application/json") {
  const res = await fetch(url, { headers: { "user-agent": UA, accept }, signal: AbortSignal.timeout(14000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
}
function clean(s = "") { return String(s).replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim().slice(0, 1000); }
function record(x) {
  try {
    const u = new URL(x.url);
    if (!["https:", "http:"].includes(u.protocol)) return null;
    return {
      title: clean(x.title || u.hostname).slice(0, 180),
      description: clean(x.description || "Open the original source for details."),
      url: u.href, canonicalUrl: u.href, source: x.source,
      category: x.category || "developer", publishedAt: x.publishedAt || new Date().toISOString(),
      image: x.image || null, pricing: x.pricing || "Not verified",
      status: x.status || "Source update", tags: x.tags || [],
      verification: "Source-linked", score: Number(x.score || 0)
    };
  } catch { return null; }
}
async function json(url) { return (await request(url)).json(); }

async function github() {
  const d = await json(`https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=${limit}`);
  return (d.items || []).map(x => record({
    title: x.full_name, description: x.description || "Recently created public GitHub repository.",
    url: x.html_url, source: "GitHub", category: "developer", publishedAt: x.created_at,
    image: x.owner?.avatar_url, pricing: "Open source — check repository licence",
    status: "New repository", tags: ["github", ...(x.topics || []).slice(0, 5)],
    score: x.stargazers_count || 0
  })).filter(Boolean);
}
async function huggingFace() {
  const d = await json(`https://huggingface.co/api/models?sort=lastModified&direction=-1&limit=${limit}`);
  return (d || []).map(x => record({
    title: x.id, description: `Public model · Downloads: ${x.downloads ?? "not listed"} · Likes: ${x.likes ?? "not listed"}`,
    url: `https://huggingface.co/${x.id}`, source: "Hugging Face", category: "ai",
    publishedAt: x.lastModified, pricing: "Model licence and hosted inference costs vary",
    status: "Model update", tags: ["ai", "model", ...(x.tags || []).slice(0, 4)], score: x.likes || 0
  })).filter(Boolean);
}
async function hackerNews() {
  const ids = await json("https://hacker-news.firebaseio.com/v0/newstories.json");
  const rows = await Promise.all((ids || []).slice(0, limit).map(async id => {
    try { return await json(`https://hacker-news.firebaseio.com/v0/item/${id}.json`); } catch { return null; }
  }));
  return rows.filter(x => x?.title && x?.url).map(x => record({
    title: x.title, description: `Hacker News discussion · ${x.score || 0} points · ${x.descendants || 0} comments`,
    url: x.url, source: "Hacker News", category: "startups", publishedAt: new Date(x.time * 1000),
    pricing: "Not checked", status: "Community discussion", tags: ["community", "discussion"], score: x.score || 0
  })).filter(Boolean);
}
async function openAlex() {
  const d = await json(`https://api.openalex.org/works?filter=from_publication_date:${since}&sort=publication_date:desc&per-page=${limit}`);
  return (d.results || []).map(x => record({
    title: x.title, description: `Research publication · ${x.publication_year || ""} · OpenAlex metadata`,
    url: x.doi || x.primary_location?.landing_page_url || `https://openalex.org/${x.id.split("/").pop()}`,
    source: "OpenAlex", category: "research", publishedAt: x.publication_date,
    pricing: "Publisher access varies; metadata is public", status: "Research publication",
    tags: ["research", "paper"]
  })).filter(Boolean);
}
function xmlText(s = "") { return clean(s.replace(/<!\[CDATA\[|\]\]>/g, "")); }
function parseFeed(xml, source, category) {
  const entries = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map(m => m[0]).slice(0, limit);
  return entries.map(b => {
    const get = tag => xmlText((b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")) || [,""])[1]);
    const href = (b.match(/<link[^>]+href=["']([^"']+)/i) || [,""])[1];
    return record({ title: get("title"), description: get("description") || get("summary") || get("content"),
      url: get("link") || href, source, category, publishedAt: get("pubDate") || get("published") || get("updated"),
      pricing: "Not verified", status: "Public feed update", tags: ["rss"] });
  }).filter(Boolean);
}
async function feed(url, name, category) {
  const res = await request(url, "application/rss+xml, application/atom+xml, application/xml, text/xml");
  return parseFeed(await res.text(), name, category);
}
async function reddit() {
  const subs = (process.env.REDDIT_SUBREDDITS || "LocalLLaMA,opensource,SideProject,InternetIsBeautiful,learnprogramming,webdev,ArtificialIntelligence")
    .split(",").map(s => s.trim()).filter(Boolean).slice(0, 12);
  const all = [];
  const results = await Promise.all(subs.map(async sub => {
    try { return await feed(`https://www.reddit.com/r/${encodeURIComponent(sub)}/new.rss?limit=${limit}`, `Reddit · r/${sub}`, "internet"); }
    catch (e) { throw new Error(`r/${sub}: ${e.message}`); }
  }));
  for (const group of results) all.push(...group);
  return all;
}
async function extraFeeds() {
  const defaults = [
    ["Hugging Face Blog", "https://huggingface.co/blog/feed.xml", "ai"],
    ["freeCodeCamp", "https://www.freecodecamp.org/news/rss/", "student"]
  ];
  const extra = (process.env.EXTRA_RSS_URLS || "").split(",").map(s => s.trim()).filter(Boolean)
    .map((url, i) => [`Configured RSS ${i + 1}`, url, "startups"]);
  const results = await Promise.all([...defaults, ...extra].map(([n, u, c]) => feed(u, n, c)));
  return results.flat();
}
export async function collectAll() {
  const jobs = [
    ["Reddit", reddit], ["GitHub", github], ["Hugging Face", huggingFace],
    ["Hacker News", hackerNews], ["OpenAlex", openAlex], ["Public RSS", extraFeeds]
  ];
  const results = await Promise.all(jobs.map(async ([name, fn]) => {
    try { return { name, items: await fn(), error: null }; }
    catch (e) { return { name, items: [], error: e.message }; }
  }));
  return {
    items: results.flatMap(x => x.items),
    sources: results.map(x => ({ name: x.name, status: x.error ? "error" : "ok", count: x.items.length, error: x.error, lastScanAt: new Date().toISOString() }))
  };
}
