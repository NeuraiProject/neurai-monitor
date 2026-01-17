const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sslChecker = require('ssl-checker');
const tls = require('tls');
const url = require('url');
const CONFIG = require('./src/config'); // Import config

// Use configured path
// Note: monitor.js is in /backend, config is in /backend/src
// But config.js defines path relative to itself. 
// Actually, monitor.js is currently at /backend/monitor.js
// CONFIG.DOMAINS_FILE was defined as path.join(__dirname, '../domains') from src/config.js
// which means /backend/domains. Correct.

const DOMAINS_FILE = CONFIG.DOMAINS_FILE;

const parseDomainsFile = () => {
    try {
        const data = fs.readFileSync(DOMAINS_FILE, 'utf8');
        const lines = data.split('\n');
        const entries = [];
        let currentCategory = null;

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            if (line.startsWith('##')) {
                const heading = line.replace(/^##\s*/, '').trim();
                currentCategory = heading || null;
                continue;
            }

            entries.push({
                domain: line,
                category: currentCategory
            });
        }

        return entries;
    } catch (err) {
        console.error("Error reading domains file:", err);
        return [];
    }
};

const getDomainEntries = () => {
    return parseDomainsFile();
};

const getDomains = () => {
    return getDomainEntries().map(entry => entry.domain);
};

const checkAvailability = async (parsedUrl) => {
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        try {
            const response = await axios.get(parsedUrl.href, { timeout: 10000 });
            return response.status >= 200 && response.status < 300;
        } catch (err) {
            return false;
        }
    } else if (parsedUrl.protocol === 'wss:' || parsedUrl.protocol === 'ssl:') {
        // For WSS/SSL, we check if we can establish a TLS connection
        return new Promise((resolve) => {
            const port = parsedUrl.port || 443;
            const socket = tls.connect({
                host: parsedUrl.hostname,
                port,
                servername: parsedUrl.hostname,
                rejectUnauthorized: false,
                timeout: 10000
            }, () => {
                socket.end();
                resolve(true);
            });
            socket.on('error', () => resolve(false));
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
        });
    }
    return false;
};

const checkTlsCertificate = (hostname, port) => {
    return new Promise((resolve) => {
        const socket = tls.connect({
            host: hostname,
            port,
            servername: hostname,
            rejectUnauthorized: false,
            timeout: 10000
        }, () => {
            const cert = socket.getPeerCertificate();
            socket.end();

            if (!cert || !cert.valid_to) {
                return resolve({ valid: false, daysRemaining: 0, validTo: null });
            }

            const matchesHostname = (host, pattern) => {
                const normalizedHost = host.toLowerCase();
                const normalizedPattern = pattern.toLowerCase().trim();
                if (!normalizedPattern) return false;
                if (normalizedPattern.startsWith('*.')) {
                    const suffix = normalizedPattern.slice(1); // keep leading dot
                    return normalizedHost.endsWith(suffix) && normalizedHost.split('.').length === normalizedPattern.split('.').length;
                }
                return normalizedHost === normalizedPattern;
            };

            const getAltNames = (altNameString) => {
                if (!altNameString) return [];
                return altNameString
                    .split(',')
                    .map(entry => entry.trim())
                    .filter(entry => entry.toUpperCase().startsWith('DNS:'))
                    .map(entry => entry.slice(4).trim())
                    .filter(Boolean);
            };

            const altNames = getAltNames(cert.subjectaltname);
            const commonName = cert.subject && cert.subject.CN ? cert.subject.CN : '';
            const nameMatches = (
                altNames.length > 0
                    ? altNames.some(name => matchesHostname(hostname, name))
                    : matchesHostname(hostname, commonName)
            );

            const now = new Date();
            const validTo = new Date(cert.valid_to);
            const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
            const isValidNow = (!validFrom || now >= validFrom) && now <= validTo && nameMatches;
            const daysRemaining = Math.floor((validTo - now) / (24 * 60 * 60 * 1000));

            resolve({
                valid: isValidNow,
                daysRemaining,
                validTo
            });
        });

        socket.on('error', () => resolve({ valid: false, daysRemaining: 0, validTo: null }));
        socket.on('timeout', () => {
            socket.destroy();
            resolve({ valid: false, daysRemaining: 0, validTo: null });
        });
    });
};

const checkDomain = async (inputDomain) => {
    let httpStatus = false;
    let sslInfo = { valid: false, daysRemaining: 0, validTo: null };

    // Parse the input. If no protocol, assume https://
    let parsedUrl;
    try {
        if (!inputDomain.includes('://')) {
            parsedUrl = new url.URL(`https://${inputDomain}`);
        } else {
            parsedUrl = new url.URL(inputDomain);
        }
    } catch (err) {
        console.error(`Invalid domain format: ${inputDomain}`);
        return {
            domain: inputDomain,
            available: false,
            ssl: sslInfo,
            checkedAt: new Date()
        };
    }

    // 1. Check Availability
    httpStatus = await checkAvailability(parsedUrl);

    // 2. Check SSL Certificate (only for secure protocols)
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:' || parsedUrl.protocol === 'ssl:') {
        try {
            const port = parsedUrl.port || 443;
            if (parsedUrl.protocol === 'wss:' || parsedUrl.protocol === 'ssl:') {
                sslInfo = await checkTlsCertificate(parsedUrl.hostname, parseInt(port));
            } else {
                const sslData = await sslChecker(parsedUrl.hostname, { method: "GET", port: parseInt(port) });
                const validTo = sslData.validTo ? new Date(sslData.validTo) : null;
                const daysRemaining = validTo
                    ? Math.floor((validTo - new Date()) / (24 * 60 * 60 * 1000))
                    : sslData.daysRemaining;
                sslInfo = {
                    valid: sslData.valid,
                    daysRemaining,
                    validTo: sslData.validTo
                };
            }
        } catch (err) {
            // console.error(`SSL Check failed for ${inputDomain}:`, err.message);
            sslInfo = { valid: false, daysRemaining: 0, validTo: null };
        }
    }

    return {
        domain: inputDomain,
        available: httpStatus,
        ssl: sslInfo,
        checkedAt: new Date()
    };
};

const runChecks = async () => {
    const domains = getDomains();
    // Run checks in parallel
    const results = await Promise.all(domains.map(domain => checkDomain(domain)));
    return results;
};

module.exports = { runChecks, getDomains, getDomainEntries };
