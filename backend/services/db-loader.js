/**
 * PEEKABOO SHADES - SHARED DATABASE LOADER
 * =========================================
 * Provides cached database reads for all services.
 * Avoids repeated 1.3MB file reads on every API call.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const CACHE_TTL = 30000; // 30 seconds

let cache = null;
let cacheTime = 0;

/**
 * Load database with in-memory caching
 */
function loadDB() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) {
    return cache;
  }
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    cache = JSON.parse(data);
    cacheTime = now;
    return cache;
  } catch (err) {
    if (cache) return cache; // Return stale cache on error
    return {};
  }
}

/**
 * Save database and update cache
 */
function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  cache = data;
  cacheTime = Date.now();
}

/**
 * Invalidate cache (force next read from disk)
 */
function invalidateCache() {
  cache = null;
  cacheTime = 0;
}

module.exports = { loadDB, saveDB, invalidateCache, DB_PATH };
