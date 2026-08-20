import {
    loadData,
    parseCsv,
    refreshMeta,
    rowToPriceRecord,
    saveData,
    upsertRecords,
    type RowRecord
} from './data.ts';

const REPO = 'sbmagar13/sharesansar_datascrape';
const TREE_URL = `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`;
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/main/data/`;
const LOOKBACK_DAYS = 120;

/** List all dates available in the remote repo, as ISO strings (YYYY-MM-DD). */
async function listRemoteDates(): Promise<string[]> {
    const res = await fetch(TREE_URL);
    if (!res.ok) throw new Error(`Failed to list repo files (HTTP ${res.status})`);
    const payload = (await res.json()) as { tree?: { path?: string }[] };
    const dates: string[] = [];
    for (const entry of payload.tree ?? []) {
        const match = /^data\/(\d{2})_(\d{2})_(\d{4})\.csv$/.exec(entry.path ?? '');
        if (match) dates.push(`${match[3]}-${match[1]}-${match[2]}`);
    }
    return dates;
}

/** Download and parse a single day's CSV from the remote repo. */
async function fetchDay(iso: string): Promise<RowRecord[]> {
    const [year, month, day] = iso.split('-');
    const res = await fetch(`${RAW_URL}${month}_${day}_${year}.csv`);
    if (!res.ok) return [];

    const rows = parseCsv(await res.text());
    if (rows.length < 2) return [];

    const header = rows[0];
    const records: RowRecord[] = [];
    for (const cells of rows.slice(1)) {
        const record = rowToPriceRecord(header, cells, iso);
        if (record) records.push(record);
    }
    return records;
}

async function main() {
    const data = await loadData();

    const existingDates = new Set<string>();
    for (const arr of Object.values(data.prices)) {
        for (const r of arr) existingDates.add(r.date);
    }
    console.log(
        `Existing data: ${Object.keys(data.prices).length} symbols, ${existingDates.size} dates, through ${data.last_updated}`
    );

    console.log('Listing remote data files...');
    const remoteDates = (await listRemoteDates()).sort();
    const recent = remoteDates.slice(-LOOKBACK_DAYS);
    console.log(`Remote repo has ${remoteDates.length} dates; ensuring the latest ${recent.length} are present.`);

    const missing = recent.filter((iso) => !existingDates.has(iso));
    console.log(`${missing.length} new date(s) to fetch.`);

    let total = 0;
    for (const iso of missing) {
        const records = await fetchDay(iso);
        if (records.length === 0) {
            console.log(`  - ${iso}: no data available`);
            continue;
        }
        const inserted = upsertRecords(data, records);
        total += inserted;
        console.log(`  + ${iso}: ${inserted} records`);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    refreshMeta(data);
    await saveData(data);
    console.log(`Done. ${total} records added. Data now through ${data.last_updated}.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});