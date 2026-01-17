const { Pool } = require('pg');
const CONFIG = require('./config');

const pool = new Pool(CONFIG.DB);

const initDB = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS domain_checks (
                id SERIAL PRIMARY KEY,
                domain VARCHAR(255) NOT NULL,
                available BOOLEAN, 
                ssl_valid BOOLEAN,
                ssl_days_remaining INTEGER,
                ssl_valid_to TIMESTAMP,
                checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Migration: Ensure columns are nullable (safe for existing data)
        await client.query(`ALTER TABLE domain_checks ALTER COLUMN available DROP NOT NULL;`);
        await client.query(`ALTER TABLE domain_checks ALTER COLUMN ssl_valid DROP NOT NULL;`);

        console.log("Database initialized successfully.");
    } catch (err) {
        console.error("Error initializing database:", err);
    } finally {
        client.release();
    }
};

const query = (text, params) => pool.query(text, params);

const getClient = () => pool.connect();

module.exports = {
    pool,
    initDB,
    query,
    getClient
};
