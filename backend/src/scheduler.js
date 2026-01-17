const db = require('./db');
const { runChecks } = require('../monitor');
const CONFIG = require('./config');

const backfillGaps = async () => {
    console.log("Checking for data gaps...");
    const client = await db.pool.connect();
    try {
        const domainsRes = await client.query('SELECT DISTINCT domain FROM domain_checks');
        const domains = domainsRes.rows.map(r => r.domain);

        const now = new Date();
        const currentQuarter = Math.floor(now.getMinutes() / 15) * 15;
        const nowAligned = new Date(now);
        nowAligned.setMinutes(currentQuarter, 0, 0);

        for (const domain of domains) {
            // Get last check
            const lastRes = await client.query('SELECT checked_at FROM domain_checks WHERE domain = $1 ORDER BY checked_at DESC LIMIT 1', [domain]);
            if (lastRes.rows.length === 0) continue;

            const lastCheck = new Date(lastRes.rows[0].checked_at);

            // Iterate forward from lastCheck + 15m
            let pointer = new Date(lastCheck);
            // Snap pointer to next 15m mark
            const pMin = pointer.getMinutes();
            const remainder = pMin % 15;
            pointer.setMinutes(pMin + (15 - remainder), 0, 0);

            // We fill up to 'nowAligned'
            while (pointer < nowAligned) {
                console.log(`Backfilling missing check for ${domain} at ${pointer.toISOString()}`);

                await client.query(`
                    INSERT INTO domain_checks (domain, available, ssl_valid, ssl_days_remaining, ssl_valid_to, checked_at)
                    VALUES ($1, NULL, NULL, NULL, NULL, $2)
                `, [domain, pointer]);

                // Move forward 15m
                pointer = new Date(pointer.getTime() + 15 * 60000);
            }
        }
        console.log("Gap backfill complete.");
    } catch (err) {
        console.error("Error backfilling gaps:", err);
    } finally {
        client.release();
    }
};

const performChecks = async () => {
    console.log(`Running scheduled checks at ${new Date().toISOString()}...`);
    const results = await runChecks();
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        for (const res of results) {
            const query = `
                INSERT INTO domain_checks 
                (domain, available, ssl_valid, ssl_days_remaining, ssl_valid_to, checked_at) 
                VALUES ($1, $2, $3, $4, $5, $6)
            `;
            await client.query(query, [
                res.domain,
                res.available,
                res.ssl.valid,
                res.ssl.daysRemaining,
                res.ssl.validTo ? new Date(res.ssl.validTo) : null,
                res.checkedAt
            ]);
        }

        // Cleanup: Delete records older than retention period
        await client.query(`DELETE FROM domain_checks WHERE checked_at < NOW() - INTERVAL '${CONFIG.RETENTION_HOURS} hours'`);

        await client.query('COMMIT');
        console.log("Checks saved and old data cleaned.");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error saving checks to database:", err);
    } finally {
        client.release();
    }
};

const startMonitoring = async () => {
    console.log("Starting monitoring service...");

    // Run first check immediately
    await performChecks();

    const scheduleNext = () => {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const ms = now.getMilliseconds();

        // Calculate minutes to next quarter
        const nextQuarterMinute = Math.ceil((minutes + 1) / 15) * 15;
        const diffMinutes = nextQuarterMinute - minutes;

        let delayMs = (diffMinutes * 60 * 1000) - (seconds * 1000) - ms;

        // Safety buffer
        if (delayMs <= 0) delayMs += 15 * 60 * 1000;

        console.log(`Next check scheduled in ${Math.round(delayMs / 1000)} seconds.`);

        setTimeout(async () => {
            await performChecks();
            scheduleNext(); // Recursive schedule
        }, delayMs);
    };

    scheduleNext();
};

module.exports = {
    startMonitoring,
    backfillGaps
};
