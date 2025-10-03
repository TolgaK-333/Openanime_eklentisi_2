const { addonBuilder } = require("stremio-addon-sdk");
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://openani.me";

const manifest = {
  id: "org.openani.eklenti",
  version: "1.0.2",
  name: "OpenAni.me Eklentisi",
  description: "OpenAni.me sitesinden anime içerikleri",
  resources: ["catalog", "stream"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "openani-anime",
      name: "OpenAni - Son Eklenenler"
    }
  ]
};

const builder = new addonBuilder(manifest);

// Anime katalog handler
builder.defineCatalogHandler(async ({ id }) => {
  if (id === "openani-anime") {
    try {
      const response = await axios.get(BASE_URL);
      const $ = cheerio.load(response.data);
      let metas = [];
      $(".film-poster").each((i, el) => {
        const link = $(el).attr("href");
        const title = $(el).attr("title");
        const poster = $(el).find("img").attr("data-src");
        if (link && title) {
          metas.push({
            id: link,
            type: "series",
            name: title,
            poster: poster || ""
          });
        }
      });
      return { metas };
    } catch (err) {
      console.error("Catalog hata:", err.message);
      return { metas: [] };
    }
  }
  return { metas: [] };
});

// Stream handler
builder.defineStreamHandler(async ({ id }) => {
  try {
    const animeUrl = BASE_URL + id;
    const response = await axios.get(animeUrl);
    const $ = cheerio.load(response.data);
    let streams = [];
    $(".episodes li a").each((i, el) => {
      const epLink = $(el).attr("href");
      const epTitle = $(el).text().trim();
      if (epLink) {
        streams.push({
          url: BASE_URL + epLink,
          title: epTitle || `Bölüm ${i + 1}`
        });
      }
    });
    if (streams.length === 0) {
      streams.push({
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        title: "Test Video"
      });
    }
    return { streams };
  } catch (err) {
    console.error("Stream hata:", err.message);
    return { streams: [] };
  }
});

// Express server
const app = express();
const PORT = process.env.PORT || 3000;

// Ana endpoint (Stremio addon)
app.use("/", (req, res) => {
  const addonInterface = builder.getInterface();
  addonInterface(req)
    .then((data) => res.json(data))
    .catch((err) => {
      console.error("Server hata:", err.message);
      res.status(500).send({ error: err.message });
    });
});

// ✅ manifest.json endpoint
app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

app.listen(PORT, () => {
  console.log(`Stremio addon server running on port ${PORT}`);
});
