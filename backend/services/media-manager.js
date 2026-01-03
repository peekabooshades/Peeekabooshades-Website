/**
 * PEEKABOO SHADES - ENTERPRISE MEDIA MANAGEMENT SYSTEM
 * =====================================================
 *
 * Central asset library with:
 * - Versioning and history
 * - Categories and tagging
 * - Search and filtering
 * - Usage tracking (which products use which images)
 * - Automatic optimization
 * - CDN-ready URLs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Media categories
const MEDIA_CATEGORIES = {
  products: {
    path: 'images/products',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  fabrics: {
    path: 'images/fabrics',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024
  },
  hardware: {
    path: 'images/hardware',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 5 * 1024 * 1024
  },
  banners: {
    path: 'images/banners',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 15 * 1024 * 1024
  },
  icons: {
    path: 'images/icons',
    allowedTypes: ['image/png', 'image/svg+xml', 'image/webp'],
    maxSize: 1 * 1024 * 1024
  },
  documents: {
    path: 'documents',
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: 20 * 1024 * 1024
  },
  uploads: {
    path: 'images/uploads',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxSize: 10 * 1024 * 1024
  }
};

class MediaManager {
  constructor() {
    this.dbPath = path.join(__dirname, '../database.json');
    this.publicPath = path.join(__dirname, '../../frontend/public');
    this.mediaIndex = null;
    this.lastIndexUpdate = 0;
    this.indexCacheTTL = 60000; // 1 minute cache
  }

  /**
   * Get database
   */
  getDB() {
    return JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
  }

  /**
   * Save database
   */
  saveDB(db) {
    fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
  }

  /**
   * Initialize media index in database
   */
  initializeMediaIndex() {
    const db = this.getDB();

    if (!db.mediaLibrary) {
      db.mediaLibrary = {
        assets: [],
        tags: [],
        collections: [],
        usageMap: {} // Maps asset IDs to where they're used
      };
      this.saveDB(db);
    }

    return db.mediaLibrary;
  }

  /**
   * Generate unique asset ID
   */
  generateAssetId() {
    return `asset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Generate file hash for deduplication
   */
  generateFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  }

  /**
   * Get all media assets with filtering
   */
  getAssets(options = {}) {
    const db = this.getDB();
    const library = db.mediaLibrary || { assets: [] };
    let assets = [...library.assets];

    // Filter by category
    if (options.category) {
      assets = assets.filter(a => a.category === options.category);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      assets = assets.filter(a =>
        options.tags.some(tag => a.tags && a.tags.includes(tag))
      );
    }

    // Filter by type
    if (options.type) {
      assets = assets.filter(a => a.mimeType && a.mimeType.startsWith(options.type));
    }

    // Search by name/description
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      assets = assets.filter(a =>
        (a.name && a.name.toLowerCase().includes(searchLower)) ||
        (a.description && a.description.toLowerCase().includes(searchLower)) ||
        (a.altText && a.altText.toLowerCase().includes(searchLower))
      );
    }

    // Sort
    const sortField = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    assets.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      return sortOrder === 'desc'
        ? (bVal > aVal ? 1 : -1)
        : (aVal > bVal ? 1 : -1);
    });

    // Pagination
    const page = options.page || 1;
    const limit = options.limit || 50;
    const offset = (page - 1) * limit;
    const total = assets.length;
    assets = assets.slice(offset, offset + limit);

    return {
      assets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single asset by ID
   */
  getAsset(assetId) {
    const db = this.getDB();
    const library = db.mediaLibrary || { assets: [] };
    return library.assets.find(a => a.id === assetId);
  }

  /**
   * Get asset by URL
   */
  getAssetByUrl(url) {
    const db = this.getDB();
    const library = db.mediaLibrary || { assets: [] };
    return library.assets.find(a => a.url === url);
  }

  /**
   * Register new asset in library
   */
  registerAsset(fileInfo, metadata = {}) {
    const db = this.getDB();
    if (!db.mediaLibrary) {
      db.mediaLibrary = { assets: [], tags: [], collections: [], usageMap: {} };
    }

    // Generate file hash for deduplication
    const filePath = path.join(this.publicPath, fileInfo.url);
    let fileHash = null;
    if (fs.existsSync(filePath)) {
      fileHash = this.generateFileHash(filePath);

      // Check for duplicate
      const existing = db.mediaLibrary.assets.find(a => a.hash === fileHash);
      if (existing && !metadata.allowDuplicate) {
        return {
          success: false,
          error: 'Duplicate file detected',
          existingAsset: existing
        };
      }
    }

    const asset = {
      id: this.generateAssetId(),
      name: metadata.name || path.basename(fileInfo.url),
      description: metadata.description || '',
      altText: metadata.altText || '',
      url: fileInfo.url,
      category: fileInfo.category || 'uploads',
      mimeType: fileInfo.mimeType || 'image/jpeg',
      size: fileInfo.size || 0,
      dimensions: fileInfo.dimensions || null,
      hash: fileHash,
      tags: metadata.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: metadata.createdBy || 'system',
      versions: [{
        version: 1,
        url: fileInfo.url,
        createdAt: new Date().toISOString(),
        createdBy: metadata.createdBy || 'system'
      }],
      currentVersion: 1,
      usageCount: 0,
      isActive: true
    };

    db.mediaLibrary.assets.push(asset);
    this.saveDB(db);

    return {
      success: true,
      asset
    };
  }

  /**
   * Update asset metadata
   */
  updateAsset(assetId, updates, userId = 'system') {
    const db = this.getDB();
    if (!db.mediaLibrary) return { success: false, error: 'Media library not found' };

    const index = db.mediaLibrary.assets.findIndex(a => a.id === assetId);
    if (index === -1) {
      return { success: false, error: 'Asset not found' };
    }

    const asset = db.mediaLibrary.assets[index];

    // Track what changed for audit
    const changes = {};
    const allowedUpdates = ['name', 'description', 'altText', 'tags', 'category', 'isActive'];

    for (const field of allowedUpdates) {
      if (updates[field] !== undefined && updates[field] !== asset[field]) {
        changes[field] = { from: asset[field], to: updates[field] };
        asset[field] = updates[field];
      }
    }

    asset.updatedAt = new Date().toISOString();
    asset.updatedBy = userId;

    db.mediaLibrary.assets[index] = asset;
    this.saveDB(db);

    return {
      success: true,
      asset,
      changes
    };
  }

  /**
   * Add new version of asset (for image updates)
   */
  addVersion(assetId, newFileInfo, userId = 'system') {
    const db = this.getDB();
    if (!db.mediaLibrary) return { success: false, error: 'Media library not found' };

    const index = db.mediaLibrary.assets.findIndex(a => a.id === assetId);
    if (index === -1) {
      return { success: false, error: 'Asset not found' };
    }

    const asset = db.mediaLibrary.assets[index];
    const newVersion = asset.currentVersion + 1;

    asset.versions.push({
      version: newVersion,
      url: newFileInfo.url,
      size: newFileInfo.size,
      createdAt: new Date().toISOString(),
      createdBy: userId
    });

    asset.url = newFileInfo.url;
    asset.size = newFileInfo.size;
    asset.currentVersion = newVersion;
    asset.updatedAt = new Date().toISOString();
    asset.updatedBy = userId;

    if (newFileInfo.dimensions) {
      asset.dimensions = newFileInfo.dimensions;
    }

    // Update hash
    const filePath = path.join(this.publicPath, newFileInfo.url);
    if (fs.existsSync(filePath)) {
      asset.hash = this.generateFileHash(filePath);
    }

    db.mediaLibrary.assets[index] = asset;
    this.saveDB(db);

    return {
      success: true,
      asset,
      version: newVersion
    };
  }

  /**
   * Revert to previous version
   */
  revertToVersion(assetId, versionNumber, userId = 'system') {
    const db = this.getDB();
    if (!db.mediaLibrary) return { success: false, error: 'Media library not found' };

    const index = db.mediaLibrary.assets.findIndex(a => a.id === assetId);
    if (index === -1) {
      return { success: false, error: 'Asset not found' };
    }

    const asset = db.mediaLibrary.assets[index];
    const targetVersion = asset.versions.find(v => v.version === versionNumber);

    if (!targetVersion) {
      return { success: false, error: 'Version not found' };
    }

    asset.url = targetVersion.url;
    asset.currentVersion = versionNumber;
    asset.updatedAt = new Date().toISOString();
    asset.updatedBy = userId;

    db.mediaLibrary.assets[index] = asset;
    this.saveDB(db);

    return {
      success: true,
      asset
    };
  }

  /**
   * Delete asset (soft delete by default)
   */
  deleteAsset(assetId, hardDelete = false, userId = 'system') {
    const db = this.getDB();
    if (!db.mediaLibrary) return { success: false, error: 'Media library not found' };

    const index = db.mediaLibrary.assets.findIndex(a => a.id === assetId);
    if (index === -1) {
      return { success: false, error: 'Asset not found' };
    }

    const asset = db.mediaLibrary.assets[index];

    // Check if asset is in use
    if (asset.usageCount > 0 && !hardDelete) {
      return {
        success: false,
        error: 'Asset is in use',
        usageCount: asset.usageCount,
        usedBy: db.mediaLibrary.usageMap[assetId] || []
      };
    }

    if (hardDelete) {
      // Delete physical file
      const filePath = path.join(this.publicPath, asset.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Remove from database
      db.mediaLibrary.assets.splice(index, 1);
      delete db.mediaLibrary.usageMap[assetId];
    } else {
      // Soft delete
      asset.isActive = false;
      asset.deletedAt = new Date().toISOString();
      asset.deletedBy = userId;
      db.mediaLibrary.assets[index] = asset;
    }

    this.saveDB(db);

    return {
      success: true,
      hardDelete
    };
  }

  /**
   * Track asset usage (call when asset is used in product, page, etc.)
   */
  trackUsage(assetId, entityType, entityId) {
    const db = this.getDB();
    if (!db.mediaLibrary) return;

    const index = db.mediaLibrary.assets.findIndex(a => a.id === assetId);
    if (index === -1) return;

    if (!db.mediaLibrary.usageMap[assetId]) {
      db.mediaLibrary.usageMap[assetId] = [];
    }

    const usageKey = `${entityType}:${entityId}`;
    if (!db.mediaLibrary.usageMap[assetId].includes(usageKey)) {
      db.mediaLibrary.usageMap[assetId].push(usageKey);
      db.mediaLibrary.assets[index].usageCount = db.mediaLibrary.usageMap[assetId].length;
      this.saveDB(db);
    }
  }

  /**
   * Remove usage tracking
   */
  removeUsage(assetId, entityType, entityId) {
    const db = this.getDB();
    if (!db.mediaLibrary) return;

    const index = db.mediaLibrary.assets.findIndex(a => a.id === assetId);
    if (index === -1) return;

    if (db.mediaLibrary.usageMap[assetId]) {
      const usageKey = `${entityType}:${entityId}`;
      const usageIndex = db.mediaLibrary.usageMap[assetId].indexOf(usageKey);
      if (usageIndex > -1) {
        db.mediaLibrary.usageMap[assetId].splice(usageIndex, 1);
        db.mediaLibrary.assets[index].usageCount = db.mediaLibrary.usageMap[assetId].length;
        this.saveDB(db);
      }
    }
  }

  /**
   * Get all tags
   */
  getTags() {
    const db = this.getDB();
    const library = db.mediaLibrary || { tags: [] };
    return library.tags;
  }

  /**
   * Add tag
   */
  addTag(tagName, tagColor = '#6366f1') {
    const db = this.getDB();
    if (!db.mediaLibrary) {
      db.mediaLibrary = { assets: [], tags: [], collections: [], usageMap: {} };
    }

    const existing = db.mediaLibrary.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (existing) {
      return { success: false, error: 'Tag already exists', tag: existing };
    }

    const tag = {
      id: `tag_${Date.now()}`,
      name: tagName,
      color: tagColor,
      createdAt: new Date().toISOString()
    };

    db.mediaLibrary.tags.push(tag);
    this.saveDB(db);

    return { success: true, tag };
  }

  /**
   * Create collection
   */
  createCollection(name, description = '') {
    const db = this.getDB();
    if (!db.mediaLibrary) {
      db.mediaLibrary = { assets: [], tags: [], collections: [], usageMap: {} };
    }

    const collection = {
      id: `col_${Date.now()}`,
      name,
      description,
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.mediaLibrary.collections.push(collection);
    this.saveDB(db);

    return { success: true, collection };
  }

  /**
   * Add asset to collection
   */
  addToCollection(collectionId, assetId) {
    const db = this.getDB();
    if (!db.mediaLibrary) return { success: false, error: 'Media library not found' };

    const collection = db.mediaLibrary.collections.find(c => c.id === collectionId);
    if (!collection) {
      return { success: false, error: 'Collection not found' };
    }

    if (!collection.assets.includes(assetId)) {
      collection.assets.push(assetId);
      collection.updatedAt = new Date().toISOString();
      this.saveDB(db);
    }

    return { success: true, collection };
  }

  /**
   * Scan filesystem and sync with database
   */
  syncFilesystem() {
    const db = this.getDB();
    if (!db.mediaLibrary) {
      db.mediaLibrary = { assets: [], tags: [], collections: [], usageMap: {} };
    }

    const scannedFiles = [];
    const newAssets = [];
    const orphanedAssets = [];

    // Scan each category path
    for (const [category, config] of Object.entries(MEDIA_CATEGORIES)) {
      const categoryPath = path.join(this.publicPath, config.path);

      if (!fs.existsSync(categoryPath)) {
        continue;
      }

      this._scanDirectory(categoryPath, category, scannedFiles);
    }

    // Find files not in database
    for (const file of scannedFiles) {
      const existing = db.mediaLibrary.assets.find(a => a.url === file.url);
      if (!existing) {
        // Register new asset
        const result = this.registerAsset({
          url: file.url,
          category: file.category,
          mimeType: file.mimeType,
          size: file.size
        }, {
          name: file.name,
          allowDuplicate: true
        });

        if (result.success) {
          newAssets.push(result.asset);
        }
      }
    }

    // Find database entries with missing files
    for (const asset of db.mediaLibrary.assets) {
      const filePath = path.join(this.publicPath, asset.url);
      if (!fs.existsSync(filePath)) {
        orphanedAssets.push(asset);
      }
    }

    return {
      success: true,
      scanned: scannedFiles.length,
      newAssets: newAssets.length,
      orphanedAssets: orphanedAssets.length,
      details: {
        new: newAssets,
        orphaned: orphanedAssets
      }
    };
  }

  /**
   * Recursively scan directory
   */
  _scanDirectory(dirPath, category, results) {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      if (item.startsWith('.')) continue;

      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this._scanDirectory(fullPath, category, results);
      } else {
        const ext = path.extname(item).toLowerCase();
        const mimeTypes = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.pdf': 'application/pdf'
        };

        if (mimeTypes[ext]) {
          const relativePath = fullPath.replace(this.publicPath, '').replace(/\\/g, '/');
          results.push({
            name: item,
            url: relativePath,
            category,
            mimeType: mimeTypes[ext],
            size: stat.size
          });
        }
      }
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats() {
    const db = this.getDB();
    const library = db.mediaLibrary || { assets: [] };

    const stats = {
      totalAssets: library.assets.length,
      activeAssets: library.assets.filter(a => a.isActive !== false).length,
      totalSize: 0,
      byCategory: {},
      byType: {},
      recentUploads: []
    };

    for (const asset of library.assets) {
      stats.totalSize += asset.size || 0;

      // By category
      if (!stats.byCategory[asset.category]) {
        stats.byCategory[asset.category] = { count: 0, size: 0 };
      }
      stats.byCategory[asset.category].count++;
      stats.byCategory[asset.category].size += asset.size || 0;

      // By type
      const type = asset.mimeType ? asset.mimeType.split('/')[0] : 'unknown';
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, size: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].size += asset.size || 0;
    }

    // Recent uploads (last 10)
    stats.recentUploads = library.assets
      .filter(a => a.isActive !== false)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    // Format sizes
    stats.totalSizeFormatted = this._formatBytes(stats.totalSize);
    for (const cat of Object.keys(stats.byCategory)) {
      stats.byCategory[cat].sizeFormatted = this._formatBytes(stats.byCategory[cat].size);
    }
    for (const type of Object.keys(stats.byType)) {
      stats.byType[type].sizeFormatted = this._formatBytes(stats.byType[type].size);
    }

    return stats;
  }

  /**
   * Format bytes to human readable
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
const mediaManager = new MediaManager();

module.exports = {
  mediaManager,
  MEDIA_CATEGORIES
};
