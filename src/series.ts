import { ALLOWED_SERIES_TYPES, BASE_URL, getHtml } from "./utils.js";

const SERIES_URL = BASE_URL + "/ci/engine/series/index.html?season=";

type Series = {
  id: number;
  name: string;
  type: string;
  dates: string;
  location?: string;
  result: string;
  url: string;
};

function parseDateAndLocation(value: string) {
  const detailsStart = value.lastIndexOf(" (");

  if (detailsStart === -1 || !value.endsWith(")")) {
    return { dates: value };
  }

  const tourDetails = value.slice(detailsStart + 2, -1);
  const locationSeparator = tourDetails.toLowerCase().lastIndexOf(" in ");

  if (locationSeparator === -1) {
    return { dates: value };
  }

  const dates = value.slice(0, detailsStart).trim();
  const location = tourDetails.slice(locationSeparator + 4).trim();

  return dates && location ? { dates, location } : { dates: value };
}

export async function getSeriesForSeason(season: string) {
  const $ = await getHtml(SERIES_URL + season);
  const matchSections = $("div.match-section-head");
  const series: Series[] = [];

  for (const section of matchSections) {
    const seriesType = $(section).find("h2").text().trim();

    if (ALLOWED_SERIES_TYPES.includes(seriesType)) {
      const seriesListSection = $(section).next("section.series-summary-wrap");

      seriesListSection
        .children("section.series-summary-block")
        .each((_, seriesBlock) => {
          const cleanText = (selector: string) =>
            $(seriesBlock).find(selector).text().replace(/\s+/g, " ").trim();

          const seriesId = $(seriesBlock).attr("data-series-id");
          const seriesUrl = $(seriesBlock).attr("data-summary-url");
          const dateAndLocation = parseDateAndLocation(
            cleanText(".date-location").replace(/^,\s*/, ""),
          );

          series.push({
            id: Number(seriesId),
            name: cleanText(".teams a"),
            type: seriesType,
            ...dateAndLocation,
            result: cleanText(".result-info"),
            url: new URL(seriesUrl ?? "", BASE_URL).href,
          });
        });
    }
  }

  return series;
}
