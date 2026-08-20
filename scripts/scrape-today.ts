import { chromium } from 'playwright';
import {
    loadData,
    refreshMeta,
    rowToPriceRecord,
    saveData,
    upsertRecords,
    type RowRecord
} from './data.ts';

const URL = 'https://www.sharesansar.com/today-share-price';

function dateArg(): string {
    const arg = process.argv.find((a) => a.startsWith('--date='));
    return arg ? arg.slice('--date='.length) : '';
}

function parseDate(input: string): string {
    if (input) return input; // expect MM/DD/YYYY
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${now.getFullYear()}`;
}

async function scrape() {
    const dateInputValue = parseDate(dateArg());
    const [month, day, year] = dateInputValue.split('/');
    const iso = `${year}-${month}-${day}`;

    console.log(`Scraping sharesansar.com for ${dateInputValue}...`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        const fromDate = page.locator('#fromdate');
        await fromDate.waitFor({ state: 'visible', timeout: 30000 });
        await fromDate.fill(dateInputValue);

        const submit = page.locator('#btn_todayshareprice_submit');
        if (await submit.count()) {
            await submit.first().click();
        } else {
            await fromDate.press('Enter');
        }

        await page.waitForSelector('table.dataTable', { timeout: 30000 });
        await page.waitForTimeout(1500);

        const rows: string[][] = [];
        const seen = new Set<string>();
        let guard = 0;

        while (guard++ < 100) {
            const allRows = await page.$$eval(
                'table.dataTable tr',
                (trs) =>
                    trs.map((tr) =>
                        Array.from(tr.querySelectorAll('th, td')).map((cell) =>
                            (cell.textContent ?? '').trim()
                        )
                    )
            );

            for (const row of allRows) {
                if (row.length < 5) continue;
                const key = row.join('|');
                if (seen.has(key)) continue;
                seen.add(key);
                rows.push(row);
            }

            const next = page.locator('li.paginate_button.next:not(.disabled) a, a.paginate_button.next:not(.disabled)');
            if (await next.count()) {
                await next.first().click();
                await page.waitForTimeout(1200);
            } else {
                break;
            }
        }

        await browser.close();

        if (rows.length < 2) {
            throw new Error('No data found on sharesansar for the given date.');
        }

        const header = rows[0];
        const records = rows
            .slice(1)
            .map((cells) => rowToPriceRecord(header, cells, iso))
            .filter((r): r is RowRecord => r !== null);

        const data = await loadData();
        const inserted = upsertRecords(data, records);
        refreshMeta(data);
        await saveData(data);

        console.log(`Saved ${records.length} records for ${iso} (${inserted} new). Data now through ${data.last_updated}.`);
    } finally {
        await browser.close().catch(() => {});
    }
}

scrape().catch((error) => {
    console.error(error);
    process.exit(1);
});