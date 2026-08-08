import * as cheerio from "cheerio";

export async function getHtml(url: string) {
  const response = await fetch(url);
  const html = await response.text();

  return cheerio.load(html);
}

export const BASE_URL = "https://www.cricinfo.com";
