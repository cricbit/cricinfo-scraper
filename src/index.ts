import express from "express";
import { getAvailableSeasons } from "./seasons.js";
const app = express();

app.get("/seasons", async (_req, res) => {
  try {
    const seasons = await getAvailableSeasons();
    res.json(seasons);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve seasons" });
  }
});

app.listen(8080, () => {
  console.log(`server started at http://localhost:8080`);
});
