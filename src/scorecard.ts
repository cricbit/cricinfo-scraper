import { getHtml } from "./utils.js";

type TeamScore = {
  team: string;
  teamId: number | undefined;
  innings: string[];
  target?: number;
  trailing: boolean;
};

type Award = {
  type: "player-of-the-match" | "player-of-the-series";
  player: string;
  playerId: number | undefined;
  team?: string;
  stat: string;
};

type BattingEntry = {
  name: string;
  playerId: number | undefined;
  dismissal: string;
  runs: number;
  balls: number;
  minutes?: number;
  fours: number;
  sixes: number;
  strikeRate: number;
};

type BowlingEntry = {
  name: string;
  playerId: number | undefined;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
};

type FallOfWicket = {
  wicket: number;
  score: number;
  player: string;
  over: string;
};

type Innings = {
  team: string;
  label: string;
  batting: BattingEntry[];
  extras?: string;
  extrasRuns: number | undefined;
  total?: string;
  totalRuns: number | undefined;
  fallOfWickets: FallOfWicket[];
  bowling: BowlingEntry[];
};

type Scorecard = {
  status: string;
  descriptor: string;
  teams: TeamScore[];
  result: string;
  awards: Award[];
  innings: Innings[];
};

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const idFromHref = (href?: string) => {
  const id = href?.match(/-(\d+)$/)?.[1];
  return id ? Number(id) : undefined;
};

export async function getScorecard(url: string): Promise<Scorecard> {
  const $ = await getHtml(url);

  const header = $("div.ds-mb-5")
    .filter((_, el) => $(el).find("span.ds-text-overline-1").length > 0)
    .first();

  const status = normalizeText(
    header.find("span.ds-text-overline-1").first().text(),
  );

  const descriptorDiv = header.find("div.ds-text-body-3").first();
  const descriptor = normalizeText(
    descriptorDiv.clone().children("a").remove().end().text(),
  ).replace(/,\s*$/, "");

  const teams: TeamScore[] = header
    .find("div.ci-team-score")
    .map((_, el) => {
      const row = $(el);
      const teamAnchor = row.find('a[href^="/team/"]').first();
      const code =
        row.find("div[title]").first().attr("title") ??
        normalizeText(teamAnchor.text());
      const scoreText = normalizeText(row.children("div").eq(1).text());
      const targetMatch = scoreText.match(/^\(T:(\d+)\)\s*/);

      const team: TeamScore = {
        team: code,
        teamId: idFromHref(teamAnchor.attr("href")),
        innings: scoreText
          .replace(/^\(T:\d+\)\s*/, "")
          .split("&")
          .map((s) => s.trim())
          .filter(Boolean),
        trailing: row.hasClass("ds-opacity-60"),
      };

      if (targetMatch) team.target = Number(targetMatch[1]);

      return team;
    })
    .get();

  const result = normalizeText(
    header.find("p.ds-text-color-primary").first().text(),
  );

  const awards: Award[] = header
    .find('div[class*="ds-px-2.5"][class*="ds-py-3"]')
    .map((_, el) => {
      const block = $(el);
      const label = normalizeText(
        block.find("div.ds-text-overline-2").first().text(),
      );
      const playerLink = block
        .find('div.ds-flex.ds-items-baseline a[href^="/cricketers/"]')
        .first();
      const team = normalizeText(
        block.find("span.ds-text-color-text-tertiary").last().text(),
      ).replace(/^,\s*/, "");

      const award: Award = {
        type: label.toLowerCase().includes("series")
          ? "player-of-the-series"
          : "player-of-the-match",
        player: playerLink.attr("title") || normalizeText(playerLink.text()),
        playerId: idFromHref(playerLink.attr("href")),
        stat: normalizeText(block.find("div.ds-ml-auto").first().text()),
      };

      if (team) award.team = team;

      return award;
    })
    .get()
    .filter((award) => award.player);

  const innings: Innings[] = $("div.ds-mb-4.ds-border-t")
    .filter((_, el) => $(el).find("div.ds-bg-color-primary-bg").length > 0)
    .map((_, block) => {
      const inningsBlock = $(block);
      const headerSpans = inningsBlock.children("div").first().find("span");
      const team = normalizeText(headerSpans.eq(0).text());
      const label = normalizeText(headerSpans.eq(1).text());

      const tables = inningsBlock.find("table");
      const battingTable = tables.eq(0);
      const bowlingTable = tables.eq(1);

      const batting: BattingEntry[] = [];
      const fallOfWickets: FallOfWicket[] = [];
      let extras: string | undefined;
      let extrasRuns: number | undefined;
      let total: string | undefined;
      let totalRuns: number | undefined;

      battingTable.find("tbody > tr").each((_, tr) => {
        const row = $(tr);
        if (row.hasClass("ds-hidden")) return;

        const tds = row.find("> td");
        if (tds.length === 0) return;

        const firstCell = normalizeText(tds.eq(0).text());

        if (firstCell === "Extras") {
          extras = normalizeText(tds.eq(1).text());
          extrasRuns = Number(normalizeText(tds.eq(2).text()));
          return;
        }

        if (firstCell === "Total") {
          total = normalizeText(tds.eq(1).text());
          totalRuns = Number(normalizeText(tds.eq(2).text()));
          return;
        }

        if (tds.length === 1) {
          tds
            .eq(0)
            .find("div.ds-text-body-3 > span")
            .each((_, span) => {
              const entry = $(span);
              const score = entry
                .find("span.ds-text-color-text")
                .first()
                .text()
                .trim();
              const rest = normalizeText(
                entry.clone().find("span").remove().end().text(),
              );
              const match = rest.match(/\(([^,]+),\s*([\d.]+)\s*ov\)/);
              const [wicket, runs] = score.split("-");

              if (wicket && runs && match?.[1] && match[2]) {
                fallOfWickets.push({
                  wicket: Number(wicket),
                  score: Number(runs),
                  player: match[1].trim(),
                  over: match[2],
                });
              }
            });
          return;
        }

        const playerLink = tds.eq(0).find('a[href^="/cricketers/"]').first();

        batting.push({
          name: playerLink.attr("title") || normalizeText(playerLink.text()),
          playerId: idFromHref(playerLink.attr("href")),
          dismissal: normalizeText(tds.eq(1).text()),
          runs: Number(normalizeText(tds.eq(2).text())),
          balls: Number(normalizeText(tds.eq(3).text())),
          ...(normalizeText(tds.eq(4).text())
            ? { minutes: Number(normalizeText(tds.eq(4).text())) }
            : {}),
          fours: Number(normalizeText(tds.eq(5).text())),
          sixes: Number(normalizeText(tds.eq(6).text())),
          strikeRate: Number(normalizeText(tds.eq(7).text())),
        });
      });

      const bowling: BowlingEntry[] = [];

      bowlingTable.find("tbody > tr").each((_, tr) => {
        const row = $(tr);
        if (row.hasClass("ds-hidden")) return;

        const tds = row.find("> td");
        if (tds.length < 9) return;

        const playerLink = tds.eq(0).find('a[href^="/cricketers/"]').first();

        bowling.push({
          name: normalizeText(playerLink.text()),
          playerId: idFromHref(playerLink.attr("href")),
          overs: normalizeText(tds.eq(1).text()),
          maidens: Number(normalizeText(tds.eq(2).text())),
          runs: Number(normalizeText(tds.eq(3).text())),
          wickets: Number(normalizeText(tds.eq(4).text())),
          economy: Number(normalizeText(tds.eq(5).text())),
          wides: Number(normalizeText(tds.eq(7).text())),
          noBalls: Number(normalizeText(tds.eq(8).text())),
        });
      });

      const inningsResult: Innings = {
        team,
        label,
        batting,
        extrasRuns,
        totalRuns,
        fallOfWickets,
        bowling,
      };

      if (extras) inningsResult.extras = extras;
      if (total) inningsResult.total = total;

      return inningsResult;
    })
    .get();

  return {
    status,
    descriptor,
    teams,
    result,
    awards,
    innings,
  };
}
