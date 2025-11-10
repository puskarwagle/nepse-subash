// State
let emaPeriod = 90;
let selectedDate = '2024-12-31';
let selectedStocks = [];
let allData = [];
let availableSymbols = [];

// DOM Elements
const emaValue = document.getElementById('emaValue');
const emaUp = document.getElementById('emaUp');
const emaDown = document.getElementById('emaDown');
const dateInput = document.getElementById('dateInput');
const stockSelect = document.getElementById('stockSelect');
const stockList = document.getElementById('stockList');
const lastUpdate = document.getElementById('lastUpdate');

// Get all CSV files from data folder
async function getAllCSVFiles() {
    const files = [];

    // Generate all possible date filenames from 2022-01-01 to 2025-12-31
    for (let year = 2022; year <= 2025; year++) {
        for (let month = 1; month <= 12; month++) {
            const daysInMonth = new Date(year, month, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const filename = `data/${String(month).padStart(2, '0')}_${String(day).padStart(2, '0')}_${year}.csv`;
                files.push({
                    filename,
                    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                });
            }
        }
    }

    return files;
}

// Load CSV data from all files in data folder
async function loadData() {
    const files = await getAllCSVFiles();
    let filesLoaded = 0;
    let filesFailed = 0;

    console.log(`Attempting to load ${files.length} CSV files...`);

    for (const {filename, date} of files) {
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                filesFailed++;
                continue;
            }

            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                complete: function(results) {
                    results.data.forEach(row => {
                        if (row.Symbol && row.Close) {
                            allData.push({
                                symbol: row.Symbol,
                                date: date,
                                close: parseFloat(row.Close.replace(/,/g, ''))
                            });
                        }
                    });
                }
            });

            filesLoaded++;
        } catch (error) {
            filesFailed++;
        }
    }

    console.log(`Loaded ${filesLoaded} files, ${filesFailed} failed`);
    console.log(`Total ${allData.length} records`);

    // Get unique symbols
    const symbolSet = new Set(allData.map(row => row.symbol));
    availableSymbols = Array.from(symbolSet).sort();

    // Populate dropdown
    populateDropdown();

    // Set last update date
    if (allData.length > 0) {
        const dates = allData.map(row => row.date).sort();
        lastUpdate.textContent = dates[dates.length - 1];
    }

    console.log(`Ready with ${availableSymbols.length} symbols`);
}

// Populate stock dropdown
function populateDropdown() {
    stockSelect.innerHTML = '<option value="">Select a stock...</option>';
    availableSymbols.forEach(symbol => {
        if (!selectedStocks.includes(symbol)) {
            const option = document.createElement('option');
            option.value = symbol;
            option.textContent = symbol;
            stockSelect.appendChild(option);
        }
    });
}

// Calculate EMA
function calculateEMA(data, period) {
    if (data.length < period) return null;

    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

    for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * multiplier + ema;
    }

    return ema;
}

// Analyze a single stock
function analyzeStock(symbol) {
    // Get data for this symbol up to selected date
    const stockData = allData
        .filter(row => row.symbol === symbol && row.date <= selectedDate)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (stockData.length === 0) {
        return null;
    }

    const prices = stockData.map(row => parseFloat(row.close));
    const currentPrice = prices[prices.length - 1];

    // Calculate EMA for different periods to get range
    const emaShort = calculateEMA(prices, Math.max(1, emaPeriod - 10));
    const emaLong = calculateEMA(prices, emaPeriod + 10);

    if (emaShort === null || emaLong === null) {
        return null;
    }

    const emaLow = Math.min(emaShort, emaLong);
    const emaHigh = Math.max(emaShort, emaLong);

    let status;
    if (currentPrice > emaHigh) {
        status = 'above';
    } else if (currentPrice < emaLow) {
        status = 'below';
    } else {
        status = 'within';
    }

    return {
        symbol,
        current_price: currentPrice.toFixed(2),
        ema_low: emaLow.toFixed(2),
        ema_high: emaHigh.toFixed(2),
        status
    };
}

// Render stock list
function renderStocks() {
    if (selectedStocks.length === 0) {
        stockList.innerHTML = `
            <div class="empty-state">
                <p>No stocks selected</p>
                <p style="font-size: 14px;">Add stocks from the dropdown below</p>
            </div>
        `;
        return;
    }

    stockList.innerHTML = '';

    selectedStocks.forEach(symbol => {
        const analysis = analyzeStock(symbol);

        if (!analysis) {
            return;
        }

        const statusIcon = analysis.status === 'above' ? '↑' :
                          analysis.status === 'below' ? '↓' : '→';
        const statusText = analysis.status === 'above' ? 'Above' :
                          analysis.status === 'below' ? 'Below' : 'Within';

        const item = document.createElement('div');
        item.className = `stock-item ${analysis.status}`;
        item.innerHTML = `
            <input type="checkbox" class="checkbox" checked data-symbol="${symbol}">
            <div class="stock-symbol">${analysis.symbol}</div>
            <div class="stock-status">
                <span class="status-icon">${statusIcon}</span>
                <span>${statusText}</span>
                <span class="stock-price">${analysis.current_price}</span>
            </div>
            <div class="stock-range">EMA: ${analysis.ema_low} - ${analysis.ema_high}</div>
        `;

        stockList.appendChild(item);
    });

    // Add event listeners to checkboxes
    document.querySelectorAll('.checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (!e.target.checked) {
                removeStock(e.target.dataset.symbol);
            }
        });
    });
}

// Add stock
function addStock(symbol) {
    if (symbol && !selectedStocks.includes(symbol)) {
        selectedStocks.push(symbol);
        populateDropdown();
        renderStocks();
    }
}

// Remove stock
function removeStock(symbol) {
    selectedStocks = selectedStocks.filter(s => s !== symbol);
    populateDropdown();
    renderStocks();
}

// Update EMA
function updateEMA(delta) {
    emaPeriod = Math.max(1, Math.min(200, emaPeriod + delta));
    emaValue.textContent = emaPeriod;
    renderStocks();
}

// Event Listeners
emaUp.addEventListener('click', () => updateEMA(1));
emaDown.addEventListener('click', () => updateEMA(-1));

dateInput.addEventListener('change', (e) => {
    selectedDate = e.target.value;
    renderStocks();
});

stockSelect.addEventListener('change', (e) => {
    addStock(e.target.value);
    e.target.value = '';
});

// Initialize
loadData();
