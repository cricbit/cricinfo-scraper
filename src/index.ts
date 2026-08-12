import express from "express";
import { getScorecard } from "./scorecard.js";
import { getAvailableSeasons } from "./seasons.js";
import { getMatchesForSeries, getSeriesForSeason } from "./series.js";
const app = express();

app.get("/seasons", async (_, res) => {
  try {
    const seasons = await getAvailableSeasons();
    res.json(seasons);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve seasons" });
  }
});

app.get("/series", async (req, res) => {
  const season = req.query.season;

  if (typeof season !== "string" || !season.trim()) {
    return res.status(400).json({ error: "season is required" });
  }

  try {
    const series = await getSeriesForSeason(season);
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: `Failed to retrieve series for ${season}` });
  }
});

app.get("/series/:seriesId/matches", async (req, res) => {
  const seriesId = req.params.seriesId;

  if (!/^\d+$/.test(seriesId)) {
    return res.status(400).json({ error: "seriesId must be a number" });
  }

  try {
    const matches = await getMatchesForSeries(seriesId);
    res.json(matches);
  } catch (err) {
    res
      .status(500)
      .json({ error: `Failed to retrieve matches for ${seriesId}` });
  }
});

app.get("/scorecard", async (req, res) => {
  const url = req.query.url;

  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "url is required" });
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: "url must be a valid URL" });
  }

  if (!/(^|\.)(cricinfo|espncricinfo)\.com$/.test(parsedUrl.hostname)) {
    return res
      .status(400)
      .json({ error: "url must be a cricinfo.com or espncricinfo.com URL" });
  }

  try {
    const scorecard = await getScorecard(parsedUrl.href);
    res.json(scorecard);
  } catch (err) {
    res.status(500).json({ error: `Failed to retrieve scorecard for ${url}` });
  }
});

app.get("/health", async (_req, res) => {
  return res.status(200).json({ message: "API healthy" });
});

app.listen(8080, () => {
  console.log(`server started at http://localhost:8080`);
});
