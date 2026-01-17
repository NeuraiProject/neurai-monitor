const path = require('path');

const CONFIG = {
    PORT: process.env.PORT || 3000,
    DB: {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'domain_monitor',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
    },
    DOMAINS_FILE: path.join(__dirname, '../domains'),
    RETENTION_HOURS: 168,
    CHECK_INTERVAL_MINUTES: 15,
    TIMEOUT_MS: 10000,
};

module.exports = CONFIG;
