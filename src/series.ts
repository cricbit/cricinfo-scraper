import { ALLOWED_SERIES_TYPES, BASE_URL, getHtml } from "./utils.js";

const SEASON_URL = BASE_URL + "/ci/engine/series/index.html?season=";
const SERIES_URL = BASE_URL + "/ci/engine/match/index/series.html?series=";

type Series = {
  id: number;
  name: string;
  type: string;
  dates: string;
  location?: string;
  result: string;
  url: string;
};

type Match = {
  id: number;
  matchNum?: number;
  dates: string;
  venue?: string;
  status?: string;
  team1?: string;
  team1Score?: string;
  team2?: string;
  team2Score?: string;
  result?: string;
  scorecardUrl?: string;
  reportUrl?: string;
};

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

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
  const $ = await getHtml(SEASON_URL + season);
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

export async function getMatchesForSeries(seriesId: string) {
  const $ = await getHtml(SERIES_URL + seriesId);
  const matchBlocks = $("section.default-match-block");
  const matches: Match[] = [];

  for (const block of matchBlocks) {
    const matchBlock = $(block);
    const descriptorLink = matchBlock.find(".match-info .match-no a").first();
    const descriptor = normalizeText(descriptorLink.text());
    const descriptorParts = descriptor.match(/^(.+?)\s+at\s+(.+)$/i);
    const name = descriptorParts?.[1]?.trim() || descriptor;
    const venue = descriptorParts?.[2]?.trim();
    const matchNumber = name.match(/^(\d+)(?:st|nd|rd|th)\b/i)?.[1];

    const scorecardHref =
      matchBlock
        .find('.match-articles a[href*="/scorecard/"]')
        .first()
        .attr("href") ?? descriptorLink.attr("href");
    const reportHref = matchBlock
      .find('.match-articles a[href*="/report/"]')
      .first()
      .attr("href");
    const matchId = (scorecardHref ?? reportHref)?.match(
      /\/(?:scorecard|report)\/(\d+)(?:\/|$)/,
    )?.[1];

    if (!matchId || !name) {
      continue;
    }

    const parseInnings = (selector: string) => {
      const innings = matchBlock.find(selector).first();
      const teamOnly = innings.clone();
      teamOnly.find(".bold").remove();

      return {
        team: normalizeText(teamOnly.text()),
      };
    };

    const firstInnings = parseInnings(".innings-info-1");
    const secondInnings = parseInnings(".innings-info-2");
    const dates = normalizeText(
      matchBlock.find(".match-info > span.bold").first().text(),
    );
    const status = matchBlock.attr("data-matchstatus")?.trim();
    const result = normalizeText(matchBlock.find(".match-status").text());

    matches.push({
      id: Number(matchId),
      dates,
      ...(matchNumber ? { matchNum: Number(matchNumber) } : {}),
      ...(venue ? { venue } : {}),
      ...(status ? { status } : {}),
      ...(firstInnings.team ? { team1: firstInnings.team } : {}),
      ...(secondInnings.team ? { team2: secondInnings.team } : {}),
      ...(result ? { result } : {}),
      ...(scorecardHref
        ? { scorecardUrl: new URL(scorecardHref, BASE_URL).href }
        : {}),
    });
  }

  return matches;
}
