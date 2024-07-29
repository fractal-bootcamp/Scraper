#!/usr/bin/env bun
import { scrapeAllSections, Indicator, MarketStatus } from './script';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface Argv {
    _: (string | number)[];
    $0: string;
}

const argv = yargs(hideBin(process.argv))
    .demandCommand(1, 'You need to provide a URL to scrape')
    .argv as unknown as Argv;

const { _: [url] } = argv;

const fullUrl = (url as string).startsWith('http') ? url : `https://${url}`;
const outputDir = 'scraped';
const outputFile = path.join(outputDir, 'scrapedData.json');
const logFile = 'scraper.log';

console.log(`Scraping URL: ${fullUrl}`);

let previousData: Record<string, Indicator[]> = {};

function log(message: string) {
    const logMessage = `[${new Date().toISOString()}] ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(logMessage.trim());
}

function updateHeartbeat() {
    fs.writeFileSync('scraper_heartbeat.txt', new Date().toISOString());
}

function alertError(error: Error) {
    log(`ALERT: Scraper error: ${error.message}`);
    // Implement additional alerting logic here (e.g., send email)
}

function smoothTransition(oldValue: number, newValue: number, steps: number, currentStep: number): number {
    return oldValue + (newValue - oldValue) * (currentStep / steps);
}

async function fetchMarketStatus(): Promise<MarketStatus[]> {
    try {
        const response = await axios.get('https://www.alphavantage.co/query', {
            params: {
                function: 'MARKET_STATUS',
                apikey: process.env.API_KEY // Make sure to set your API key in the environment variables
            }
        });
        // Adjust this based on the actual response structure
        return response.data.marketStatus as MarketStatus[];
    } catch (error) {
        console.error('Error fetching market status:', error);
        throw error;
    }
}

async function runScraper() {
    log('Starting scrape cycle');
    try {
        const result = await scrapeAllSections(fullUrl as string);
        const marketStatus = await fetchMarketStatus(); // Fetch market status

        log(`Scrape completed. Found ${Object.keys(result).length} sections.`);

        if (Object.keys(previousData).length === 0) {
            previousData = result;
            fs.writeFileSync(outputFile, JSON.stringify({
                timestamp: new Date().toISOString(),
                sections: result,
                marketStatus // Save market status
            }, null, 2));
        } else {
            const transitionSteps = 24; // 2 minutes divided into 5-second intervals
            for (let step = 1; step <= transitionSteps; step++) {
                const smoothedData: Record<string, Indicator[]> = {};

                for (const [section, indicators] of Object.entries(result)) {
                    smoothedData[section] = indicators.map((newItem, index) => {
                        const oldItem = previousData[section]?.[index] || newItem;
                        return {
                            ...newItem,
                            price: smoothTransition(oldItem.price, newItem.price, transitionSteps, step),
                            change: smoothTransition(oldItem.change, newItem.change, transitionSteps, step),
                            changePercent: smoothTransition(oldItem.changePercent, newItem.changePercent, transitionSteps, step),
                            marketStatus: newItem.marketStatus // Ensure market status is included
                        };
                    });
                }

                fs.writeFileSync(outputFile, JSON.stringify({
                    timestamp: new Date().toISOString(),
                    sections: smoothedData,
                    marketStatus // Include market status in the updated data
                }, null, 2));
                log(`Updated data (step ${step}/${transitionSteps})`);

                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between updates
            }

            previousData = result;
        }

        updateHeartbeat();
    } catch (error) {
        alertError(error as Error);
    }
}

// Run the scraper initially and then every 2 minutes
runScraper();
setInterval(runScraper, 120000); // 120000 milliseconds = 2 minutes
