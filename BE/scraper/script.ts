import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const API_KEY = 'FN9OX942RAOTYCTD'; // Your API key
const BASE_URL = 'https://www.alphavantage.co/query';

const MAX_RETRIES = 3;
const TIMEOUT = 120000; // 120 seconds
const SCRAPE_INTERVAL = 120000; // 2 minutes in milliseconds

export interface MarketStatus {
    symbol: string;
    marketStatus: string; // e.g., "OPEN", "CLOSED"
    marketOpenTime: string; // e.g., "2024-07-29T09:30:00Z"
    marketCloseTime: string; // e.g., "2024-07-29T16:00:00Z"
}

export interface Indicator {
    name: string;
    price: number;
    change: number;
    changePercent: number;
    marketStatus: MarketStatus; // Adding market status to the indicator
}

// Function to fetch market status from Alpha Vantage API
export const fetchMarketStatus = async (): Promise<any> => {
    try {
        const response = await axios.get(BASE_URL, {
            params: {
                function: 'MARKET_STATUS',
                apikey: API_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching market status:', error);
        throw error;
    }
};

export const getIndicators = (html: string, section: string): Indicator[] => {
    const $ = cheerio.load(html);
    const indicators: Indicator[] = [];

    $(`div[data-testid="${section}"]`).find('div.row.box.yf-a8qyos.sparkV2').each((_, row) => {
        const name = $(row).find('span.symbol.yf-a8quos.valid').text().trim();
        const priceStr = $(row).find('span.yf-a8quos').text().trim();
        const changeStr = $(row).find('fin-streamer[data-field="regularMarketChange"]').attr('data-value') || '0';
        const changePercentStr = $(row).find('fin-streamer[data-field="regularMarketChangePercent"]').attr('data-value') || '0';

        const price = parseFloat(priceStr.replace(/[^\d.-]/g, ''));
        const change = parseFloat(changeStr);
        const changePercent = parseFloat(changePercentStr) * 100;

        // Assuming marketStatus is part of the `MarketStatus` interface
        const marketStatus: MarketStatus = {
            symbol: name, // Assuming name is the symbol
            marketStatus: 'UNKNOWN', // Placeholder value; will need real data
            marketOpenTime: '', // Placeholder value; will need real data
            marketCloseTime: '' // Placeholder value; will need real data
        };

        indicators.push({
            name,
            price,
            change,
            changePercent,
            marketStatus // Include market status in the indicator
        });
    });

    return indicators;
};

export const getSections = (html: string): string[] => {
    const $ = cheerio.load(html);
    const sections: string[] = [];

    $('div[data-testid="tabs-container"] button[role="tab"]').each((_, element) => {
        const sectionId = $(element).attr('id');
        if (sectionId) {
            sections.push(sectionId.replace('tab-', ''));
        }
    });

    return sections;
};

export const scrapeAllSections = async (url: string): Promise<Record<string, Indicator[]>> => {
    const html = await fetchHTMLWithPuppeteer(url);
    const sections = getSections(html);
    const result: Record<string, Indicator[]> = {};

    for (const section of sections) {
        result[section] = getIndicators(html, section);
    }

    return result;
};

export const saveScrapedData = (data: Record<string, Indicator[]>, marketStatus: any) => {
    const dirPath = path.join(__dirname, '..', 'scraped', 'finance');
    const filePath = path.join(dirPath, 'indicators_data.json');

    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    const scrapedData = {
        timestamp: new Date().toISOString(),
        sections: data,
        marketStatus // Include market status in the saved data
    };

    fs.writeFileSync(filePath, JSON.stringify(scrapedData, null, 2), 'utf-8');
    console.log(`Scraped data saved to ${filePath}`);
};

const sendErrorNotification = async (error: Error) => {
    // ... [keep this function as it is] ...
};

const scrapeAndSave = async () => {
    try {
        const url = 'https://finance.yahoo.com';
        const scrapedData = await scrapeAllSections(url);
        const marketStatus = await fetchMarketStatus(); // Fetch market status
        saveScrapedData(scrapedData, marketStatus); // Save both scraped data and market status
        console.log('Scraping completed successfully');
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error during scraping:', error.message);
            await sendErrorNotification(error);
        } else {
            console.error('Unexpected error during scraping:', error);
        }
    }
};

scrapeAndSave();
setInterval(scrapeAndSave, SCRAPE_INTERVAL);

async function fetchHTMLWithPuppeteer(url: string): Promise<string> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    const html = await page.content();
    await browser.close();
    return html;
}
