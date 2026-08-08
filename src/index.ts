import { getHtml } from "./utils.js";

const BASE_URL = "https://www.cricinfo.com";
const SEASONS_URL = BASE_URL + "/ci/engine/series/index.html";

type Season = {
  season: string;
  seasonUrl: string;
};

async function getAvailableSeasons() {
  const $ = await getHtml(SEASONS_URL);
  const links = $("a[href*='season=']");

  const seasons: Season[] = [];

  for (const link of links) {
    const season = $(link).text();
    const href = $(link).attr("href");

    if (href)
      seasons.push({
        season,
        seasonUrl: new URL(href, BASE_URL).href,
      });
  }

  console.log(seasons);

  return seasons;
}

await getAvailableSeasons();
