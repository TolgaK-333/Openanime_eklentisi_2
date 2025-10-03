const { addonBuilder } = require("stremio-addon-sdk");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const manifest = require("./manifest.json");

const builder = new addonBuilder(manifest);
const SITE_BASE = "https://openani.me";

// --- helper fetchHtml ---
async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (StremioAddon/1.0)" }
  });
  return await res.text();
}

// --- catalog handler ---
builder.defineCatalogHandler(async ({ extra }) => {
  const q = (extra && extra.search) ? extra.search.trim() : "";
  if (!q) return { metas: [] };

  const html = await fetchHtml(`${SITE_BASE}/?s=${encodeURIComponent(q)}`);
  const $ = cheerio.load(html);

  const metas = [];
  const seen = new Set();

  $("a[href*='/anime/']").each((i, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (!href || !text) return;

    const parts = href.replace(SITE_BASE,"").split("/").filter(Boolean);
    if (parts.length >= 2 && !href.includes("/anime/") ) return;
    const slug = parts[1];
    const metaId = `openani:${slug}`;
    if (!seen.has(metaId)) {
      seen.add(metaId);
      metas.push({ id: metaId, type: "series", name: text });
    }
  });

  return { metas };
});

// --- meta handler ---
builder.defineMetaHandler(async ({ id }) => {
  const slug = id.split(":")[1];
  const html = await fetchHtml(`${SITE_BASE}/anime/${slug}`);
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim() || slug;
  const poster = $("meta[property='og:image']").attr("content") || null;

  const episodes = [];
  $("a[href*='/anime/']").each((i, el) => {
    const href = $(el).attr("href");
    const match = href.match(/\/anime\/([^\/]+)\/(\d+)\/(\d+)/);
    if (match) {
      const [ , epSlug, season, episode ] = match;
      episodes.push({
        id: `openani:${epSlug}|${season}|${episode}`,
        name: `${title} - S${season}E${episode}`,
        season: parseInt(season,10),
        episode: parseInt(episode,10)
      });
    }
  });

  return {
    meta: {
      id,
      type: "series",
      name: title,
      poster,
      videos: episodes
    }
  };
});

// --- stream handler ---
builder.defineStreamHandler(async ({ id }) => {
  const [ slug, season, episode ] = id.split(":")[1].split("|");
  const html = await fetchHtml(`${SITE_BASE}/anime/${slug}/${season}/${episode}`);
  const $ = cheerio.load(html);

  const streams = [];
  $("video source[src], video[src], iframe[src]").each((i, el) => {
    const src = $(el).attr("src");
    if (src && src.startsWith("http")) {
      streams.push({ title: `Source ${i+1}`, url: src });
    }
  });

  return { streams: streams.length ? streams : [{ title: "Episode page", url: `${SITE_BASE}/anime/${slug}/${season}/${episode}` }] };
});

const server = require("http").createServer(builder.getInterface());
const port = process.env.PORT || 3000;
server.listen(port, () => console.log("OpenAni addon running on port " + port));