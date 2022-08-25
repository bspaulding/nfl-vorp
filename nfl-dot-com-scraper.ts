import puppeteer from "https://deno.land/x/puppeteer@14.1.1/mod.ts";

function makeUrl({ year, category }: { year: number, category: string }) {
	return `https://www.nfl.com/stats/player-stats/category/${category}/${year}/pre/all/passingyards/DESC`
}

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(makeUrl({ year: 2021, category: "passing" });
