import express from "express";
import { getAvailableSeasons } from "./seasons.js";
import { getSeriesForSeason } from "./series.js";
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

app.get("/series/:season", async (req, res) => {
  const season = req.params.season;
  console.log(season);
  try {
    const series = await getSeriesForSeason(season);
    res.json(series);
  } catch (err) {
    res.status(500).json({ error: `Failed to retrieve series for ${season}` });
  }
});

app.listen(8080, () => {
  console.log(`server started at http://localhost:8080`);
});
