import path from 'path';
import fs from 'fs';
import { Router } from 'express';

const router = Router();

// API endpoint to serve the scraped data
router.get('/indicators', (req, res) => {
    const filePath = path.resolve(__dirname, 'scraped', 'finance', 'indicators_data.json'); // Adjust path if necessary

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).json({ error: 'Error reading data' });
        }

        try {
            const jsonData = JSON.parse(data);
            res.json(jsonData);
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            res.status(500).json({ error: 'Error parsing data' });
        }
    });
});

export default router;
