import puppeteer from "puppeteer";

function extractDate(html) {
  if (!html) return null;

  // remove HTML tags
  const text = html.replace(/<[^>]*>/g, "").trim();

  // ensure MM/DD/YYYY
  const match = text.match(/\d{2}\/\d{2}\/\d{4}/);
  return match ? match[0] : null;
}

async function scrapeFDA483All() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  const allRecords = [];
  const seen = new Set();

  // 🔥 Intercept DataTables XHR responses
  page.on("response", async response => {
    const url = response.url();
    if (!url.includes("datatable")) return;

    const contentType = response.headers()["content-type"] || "";
    if (!contentType.includes("application/json")) return;

    try {
      const json = await response.json();
      if (!json?.data) return;

      for (const row of json.data) {
        const date = extractDate(row[0]);
        if (!date || !date.endsWith("2025")) continue;

        const fei = row[2];
        const key = `${date}-${fei}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const linkMatch = row[3]?.match(/href="([^"]+)"/);

        allRecords.push({
          date,
          name: row[1],
          fei_number: Number(fei),
          firebaseUrl: linkMatch ? `https://www.fda.gov${linkMatch[1]}` : null
        });
      }
    } catch (err) {
      // ignore parse issues
    }
  });

  await page.goto(
    "https://www.fda.gov/about-fda/office-inspections-and-investigations/oii-foia-electronic-reading-room?foia_record_type_name=483",
    { waitUntil: "networkidle2", timeout: 0 }
  );

  // 🔁 Click Next until disabled
  while (true) {
    const hasNext = await page.evaluate(() => {
      const nextLi = document.querySelector("li#datatable_next");
      if (!nextLi || nextLi.classList.contains("disabled")) return false;

      const anchor = nextLi.querySelector("a");
      if (!anchor) return false;

      anchor.click();
      return true;
    });

    if (!hasNext) break;
    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  await browser.close();
  return allRecords;
}

(async () => {
  const data = await scrapeFDA483All();
  console.log("TOTAL 2025 RECORDS:", data.length);
  console.log(JSON.stringify(data));
})();
