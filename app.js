// State
let emaPeriod = 90;
let selectedDate = '';
let selectedStocks = [];
let allData = [];
let availableSymbols = [];
let availableDates = [];

// DOM Elements
const emaValue = document.getElementById('emaValue');
const emaUp = document.getElementById('emaUp');
const emaDown = document.getElementById('emaDown');
const dateSelect = document.getElementById('dateSelect');
const stockSelect = document.getElementById('stockSelect');
const stockList = document.getElementById('stockList');
const lastUpdate = document.getElementById('lastUpdate');

// Load data from batches
async function loadData() {
    console.log('Loading data batches...');

    const batches = window.DATA_BATCHES || [];
    let loadedBatches = 0;

    for (const batchNum of batches) {
        try {
            // Dynamically load batch script
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `data-batch-${batchNum}.js`;
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });

            // Get data from loaded batch
            const batchData = window[`DATA_BATCH_${batchNum}`];
            if (batchData) {
                allData.push(...batchData);
                loadedBatches++;
            }
        } catch (error) {
            console.error(`Error loading batch ${batchNum}:`, error);
        }
    }

    console.log(`Loaded ${loadedBatches} batches with ${allData.length} total records`);

    // Get unique symbols and dates
    const symbolSet = new Set(allData.map(row => row.symbol));
    const dateSet = new Set(allData.map(row => row.date));

    availableSymbols = Array.from(symbolSet).sort();
    availableDates = Array.from(dateSet).sort().reverse(); // Most recent first

    // Set default date to most recent
    selectedDate = availableDates[0];

    // Populate dropdowns
    populateDateDropdown();
    populateStockDropdown();

    // Set last update
    lastUpdate.textContent = availableDates[0];

    console.log(`Ready with ${availableSymbols.length} symbols and ${availableDates.length} dates`);
}

// Populate date dropdown
function populateDateDropdown() {
    dateSelect.innerHTML = '';
    availableDates.forEach(date => {
        const option = document.createElement('option');
        option.value = date;
        option.textContent = date;
        if (date === selectedDate) {
            option.selected = true;
        }
        dateSelect.appendChild(option);
    });
}

// Populate stock dropdown
function populateStockDropdown() {
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

    const prices = stockData.map(row => row.close);
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
        populateStockDropdown();
        renderStocks();
    }
}

// Remove stock
function removeStock(symbol) {
    selectedStocks = selectedStocks.filter(s => s !== symbol);
    populateStockDropdown();
    renderStocks();
}

// Update EMA
function updateEMA(delta) {
    emaPeriod = Math.max(1, Math.min(200, emaPeriod + delta));
    emaValue.textContent = emaPeriod;
    renderStocks();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners
    emaUp.addEventListener('click', () => updateEMA(1));
    emaDown.addEventListener('click', () => updateEMA(-1));

    dateSelect.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        renderStocks();
    });

    stockSelect.addEventListener('change', (e) => {
        addStock(e.target.value);
        e.target.value = '';
    });

    // Load data
    loadData();
});
