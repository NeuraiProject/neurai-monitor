const express = require('express');
const cors = require('cors');
const db = require('./src/db');
const scheduler = require('./src/scheduler');
const { getDomains, getDomainEntries } = require('./monitor');
const CONFIG = require('./src/config');

const app = express();

app.use(cors());
app.use(express.json());

// API Endpoints

// Get latest status for all unique domains
app.get('/api/domains', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT DISTINCT ON (domain) *
            FROM domain_checks
            ORDER BY domain, checked_at DESC
        `);

        // Get the configured order from the file
        const configuredDomains = getDomains();
        const configuredEntries = getDomainEntries();
        const categoryMap = new Map(
            configuredEntries.map(entry => [entry.domain, entry.category || null])
        );

        // Sort the DB results to match the file order
        const data = result.rows.filter(row => !row.domain.trim().startsWith('##'));
        data.sort((a, b) => {
            const indexA = configuredDomains.indexOf(a.domain);
            const indexB = configuredDomains.indexOf(b.domain);

            // If both found, sort by index
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;

            // If one not found (e.g. old data), put at the end
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;

            return 0;
        });

        const allowedSet = new Set(configuredDomains);
        const filteredData = data.filter(row => allowedSet.has(row.domain));

        const withCategory = filteredData.map(row => ({
            ...row,
            category: categoryMap.get(row.domain) || null
        }));

        res.json(withCategory);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Get history for a specific domain
app.get('/api/history', async (req, res) => {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: "Domain required" });

    try {
        const result = await db.query(`
            SELECT * FROM domain_checks 
            WHERE domain = $1 
            ORDER BY checked_at DESC 
            LIMIT 3000
        `, [domain]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(CONFIG.PORT, async () => {
    console.log(`Backend running on port ${CONFIG.PORT}`);

    // Wait for DB to be ready
    setTimeout(async () => {
        await db.initDB();
        await scheduler.backfillGaps();
        scheduler.startMonitoring();
    }, 5000);
});

