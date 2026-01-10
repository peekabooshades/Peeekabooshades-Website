/**
 * PEEKABOO SHADES - CONTENT MANAGEMENT SYSTEM
 * ============================================
 *
 * Centralized content management for all frontend pages.
 * ALL content is stored in the database and editable from admin.
 * NO hardcoded content in frontend pages.
 *
 * Content Types:
 * - Page content (hero, sections, CTAs)
 * - Navigation menus
 * - Global settings (header, footer)
 * - Product page templates
 * - Marketing banners
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ContentManager {
  constructor() {
    this.dbPath = path.join(__dirname, '../database.json');
    this.contentCache = null;
    this.lastCacheUpdate = 0;
    this.cacheTTL = 30000; // 30 seconds
  }

  getDB() {
    return JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
  }

  saveDB(db) {
    fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
    this.contentCache = null; // Invalidate cache
  }

  /**
   * Initialize CMS content structure
   */
  initializeContent() {
    const db = this.getDB();

    if (!db.cmsContent) {
      db.cmsContent = {
        pages: {},
        navigation: {},
        globalSettings: {},
        templates: {},
        banners: [],
        translations: {}
      };

      // Initialize default global settings
      db.cmsContent.globalSettings = this.getDefaultGlobalSettings();

      // Initialize default navigation
      db.cmsContent.navigation = this.getDefaultNavigation();

      // Initialize default home page content
      db.cmsContent.pages['home'] = this.getDefaultHomePage();

      // Initialize default product page template
      db.cmsContent.templates['product'] = this.getDefaultProductTemplate();

      this.saveDB(db);
    }

    return db.cmsContent;
  }

  /**
   * Default global settings
   */
  getDefaultGlobalSettings() {
    return {
      siteName: 'Peekaboo Shades',
      tagline: 'Custom Window Treatments',
      logo: '/images/logo.png',
      favicon: '/images/favicon.png',
      contactEmail: 'info@peekabooshades.com',
      contactPhone: '(800) 555-0199',
      address: {
        street: '123 Window Way',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90210',
        country: 'USA'
      },
      socialMedia: {
        facebook: 'https://facebook.com/peekabooshades',
        instagram: 'https://instagram.com/peekabooshades',
        pinterest: 'https://pinterest.com/peekabooshades',
        twitter: ''
      },
      header: {
        showTopBar: true,
        topBarText: 'Free Shipping on Orders Over $499!',
        topBarLink: '/products',
        showSearch: true,
        showCart: true,
        showAccount: true
      },
      footer: {
        showNewsletter: true,
        newsletterTitle: 'Subscribe to Our Newsletter',
        newsletterText: 'Get exclusive deals and design tips delivered to your inbox.',
        copyrightText: '2024 Peekaboo Shades. All rights reserved.',
        columns: [
          {
            title: 'Shop',
            links: [
              { text: 'Roller Shades', url: '/category/roller-shades' },
              { text: 'Roman Shades', url: '/category/roman-shades' },
              { text: 'Honeycomb Shades', url: '/category/honeycomb-shades' },
              { text: 'Natural Woven', url: '/category/natural-woven-shades' }
            ]
          },
          {
            title: 'Support',
            links: [
              { text: 'Measuring Guide', url: '/measuring-guide' },
              { text: 'Installation', url: '/installation' },
              { text: 'FAQs', url: '/faqs' },
              { text: 'Contact Us', url: '/contact' }
            ]
          },
          {
            title: 'Company',
            links: [
              { text: 'About Us', url: '/about' },
              { text: 'Blog', url: '/blog' },
              { text: 'Reviews', url: '/reviews' },
              { text: 'Warranty', url: '/warranty' }
            ]
          }
        ]
      },
      seo: {
        defaultTitle: 'Peekaboo Shades | Custom Window Treatments',
        defaultDescription: 'Shop custom window blinds and shades. Free shipping on orders over $499. Professional quality at affordable prices.',
        defaultKeywords: 'blinds, shades, window treatments, roller blinds, roman shades',
        ogImage: '/images/og-image.jpg'
      },
      analytics: {
        googleAnalyticsId: '',
        facebookPixelId: '',
        hotjarId: ''
      }
    };
  }

  /**
   * Default navigation
   */
  getDefaultNavigation() {
    return {
      main: [
        {
          id: 'nav-1',
          text: 'Shop',
          url: '/products',
          children: [
            { text: 'Roller Shades', url: '/category/roller-shades', description: 'Modern and affordable' },
            { text: 'Roman Shades', url: '/category/roman-shades', description: 'Classic elegance' },
            { text: 'Honeycomb Shades', url: '/category/honeycomb-shades', description: 'Energy efficient' },
            { text: 'Natural Woven', url: '/category/natural-woven-shades', description: 'Natural beauty' }
          ]
        },
        { id: 'nav-2', text: 'Samples', url: '/samples' },
        { id: 'nav-3', text: 'How It Works', url: '/how-it-works' },
        { id: 'nav-4', text: 'Gallery', url: '/gallery' },
        { id: 'nav-5', text: 'Contact', url: '/contact' }
      ],
      mobile: [
        { id: 'mob-1', text: 'Shop All', url: '/products' },
        { id: 'mob-2', text: 'Roller Shades', url: '/category/roller-shades' },
        { id: 'mob-3', text: 'Roman Shades', url: '/category/roman-shades' },
        { id: 'mob-4', text: 'Samples', url: '/samples' },
        { id: 'mob-5', text: 'Contact', url: '/contact' }
      ]
    };
  }

  /**
   * Default home page content
   */
  getDefaultHomePage() {
    return {
      id: 'home',
      slug: 'home',
      title: 'Home',
      seo: {
        title: 'Peekaboo Shades | Custom Window Treatments',
        description: 'Shop custom window blinds and shades at factory-direct prices.',
        keywords: 'blinds, shades, window treatments'
      },
      sections: [
        {
          id: 'hero',
          type: 'hero',
          enabled: true,
          content: {
            headline: 'Custom Window Treatments',
            subheadline: 'Made Just For You',
            description: 'Factory-direct prices on premium quality blinds and shades. Free shipping on orders over $499.',
            primaryButton: { text: 'Shop Now', url: '/products' },
            secondaryButton: { text: 'Get Samples', url: '/samples' },
            backgroundImage: '/images/hero-bg.jpg',
            overlayOpacity: 0.4
          }
        },
        {
          id: 'categories',
          type: 'categoryGrid',
          enabled: true,
          content: {
            title: 'Shop By Category',
            subtitle: 'Find the perfect style for your home',
            categories: [] // Will be populated from actual categories
          }
        },
        {
          id: 'features',
          type: 'featureList',
          enabled: true,
          content: {
            title: 'Why Choose Peekaboo Shades?',
            features: [
              {
                icon: 'truck',
                title: 'Free Shipping',
                description: 'On orders over $499'
              },
              {
                icon: 'ruler',
                title: 'Perfect Fit Guarantee',
                description: "We'll remake if measurements are off"
              },
              {
                icon: 'shield',
                title: '5 Year Warranty',
                description: 'Quality you can trust'
              },
              {
                icon: 'headset',
                title: 'Expert Support',
                description: 'Call us for free design help'
              }
            ]
          }
        },
        {
          id: 'cta',
          type: 'cta',
          enabled: true,
          content: {
            title: 'Ready to Transform Your Windows?',
            description: 'Get started with free samples or speak with our design experts.',
            primaryButton: { text: 'Order Free Samples', url: '/samples' },
            secondaryButton: { text: 'Call Us: (800) 555-0199', url: 'tel:8005550199' },
            backgroundColor: '#8E6545'
          }
        }
      ],
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Default product page template
   */
  getDefaultProductTemplate() {
    return {
      id: 'product',
      name: 'Product Page Template',
      layout: {
        showBreadcrumbs: true,
        showProductGallery: true,
        showConfigurator: true,
        showDescription: true,
        showFeatures: true,
        showSpecs: true,
        showFAQs: true,
        showRelatedProducts: true,
        showReviews: true
      },
      content: {
        configurator: {
          title: 'Customize Your Shade',
          steps: ['Select Fabric', 'Choose Dimensions', 'Pick Options', 'Review'],
          addToCartText: 'Add to Cart',
          priceLabel: 'Your Price:'
        },
        features: {
          sectionTitle: 'Features & Benefits',
          defaultFeatures: [
            { icon: 'sun', title: 'Light Filtering', description: 'Control natural light beautifully' },
            { icon: 'eye-slash', title: 'Privacy', description: 'Maintain your privacy day and night' },
            { icon: 'leaf', title: 'Energy Efficient', description: 'Reduce heating and cooling costs' },
            { icon: 'child', title: 'Child Safe', description: 'Cordless options available' }
          ]
        },
        faqs: {
          sectionTitle: 'Frequently Asked Questions'
        },
        relatedProducts: {
          sectionTitle: 'You May Also Like'
        }
      },
      styles: {
        primaryColor: '#8E6545',
        accentColor: '#6366f1',
        borderRadius: '8px',
        buttonStyle: 'rounded'
      }
    };
  }

  /**
   * Get page content
   */
  getPageContent(pageSlug) {
    const db = this.getDB();
    if (!db.cmsContent || !db.cmsContent.pages) {
      return null;
    }
    return db.cmsContent.pages[pageSlug] || null;
  }

  /**
   * Save page content
   */
  savePageContent(pageSlug, content, userId = 'system') {
    const db = this.getDB();
    if (!db.cmsContent) {
      this.initializeContent();
    }

    const previousContent = db.cmsContent.pages[pageSlug];

    db.cmsContent.pages[pageSlug] = {
      ...content,
      slug: pageSlug,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    this.saveDB(db);

    return {
      success: true,
      page: db.cmsContent.pages[pageSlug],
      previousContent
    };
  }

  /**
   * Get global settings
   */
  getGlobalSettings() {
    const db = this.getDB();
    if (!db.cmsContent || !db.cmsContent.globalSettings) {
      this.initializeContent();
      return this.getDB().cmsContent.globalSettings;
    }
    return db.cmsContent.globalSettings;
  }

  /**
   * Update global settings
   */
  updateGlobalSettings(updates, userId = 'system') {
    const db = this.getDB();
    if (!db.cmsContent) {
      this.initializeContent();
    }

    const previous = { ...db.cmsContent.globalSettings };

    db.cmsContent.globalSettings = {
      ...db.cmsContent.globalSettings,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    this.saveDB(db);

    return {
      success: true,
      settings: db.cmsContent.globalSettings,
      previous
    };
  }

  /**
   * Get navigation
   */
  getNavigation(type = 'main') {
    const db = this.getDB();
    if (!db.cmsContent || !db.cmsContent.navigation) {
      this.initializeContent();
      return this.getDB().cmsContent.navigation[type];
    }
    return db.cmsContent.navigation[type] || [];
  }

  /**
   * Update navigation
   */
  updateNavigation(type, items, userId = 'system') {
    const db = this.getDB();
    if (!db.cmsContent) {
      this.initializeContent();
    }

    const previous = db.cmsContent.navigation[type];
    db.cmsContent.navigation[type] = items;

    this.saveDB(db);

    return {
      success: true,
      navigation: items,
      previous
    };
  }

  /**
   * Get product page content (combines template + product-specific content)
   */
  getProductPageContent(productSlug) {
    const db = this.getDB();

    // Get base template
    const template = db.cmsContent?.templates?.product || this.getDefaultProductTemplate();

    // Get product-specific overrides
    const productContent = db.productPageContent?.[productSlug] || {};

    // Get theme settings
    const theme = db.themeSettings || {};

    // Merge template with product-specific content
    return {
      template,
      content: productContent,
      theme,
      productSlug
    };
  }

  /**
   * Save product page content
   */
  saveProductPageContent(productSlug, content, userId = 'system') {
    const db = this.getDB();

    if (!db.productPageContent) {
      db.productPageContent = {};
    }

    const previous = db.productPageContent[productSlug];

    db.productPageContent[productSlug] = {
      ...content,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    this.saveDB(db);

    return {
      success: true,
      content: db.productPageContent[productSlug],
      previous
    };
  }

  /**
   * Get all banners
   */
  getBanners(location = null) {
    const db = this.getDB();
    if (!db.cmsContent || !db.cmsContent.banners) {
      return [];
    }

    let banners = db.cmsContent.banners.filter(b => b.isActive);

    if (location) {
      banners = banners.filter(b => b.location === location);
    }

    // Check date validity
    const now = new Date();
    banners = banners.filter(b => {
      if (b.startDate && new Date(b.startDate) > now) return false;
      if (b.endDate && new Date(b.endDate) < now) return false;
      return true;
    });

    return banners.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Create banner
   */
  createBanner(bannerData, userId = 'system') {
    const db = this.getDB();
    if (!db.cmsContent) {
      this.initializeContent();
    }

    const banner = {
      id: `banner_${uuidv4().slice(0, 8)}`,
      ...bannerData,
      isActive: bannerData.isActive !== false,
      createdAt: new Date().toISOString(),
      createdBy: userId
    };

    db.cmsContent.banners.push(banner);
    this.saveDB(db);

    return { success: true, banner };
  }

  /**
   * Update banner
   */
  updateBanner(bannerId, updates, userId = 'system') {
    const db = this.getDB();
    if (!db.cmsContent) return { success: false, error: 'CMS not initialized' };

    const index = db.cmsContent.banners.findIndex(b => b.id === bannerId);
    if (index === -1) {
      return { success: false, error: 'Banner not found' };
    }

    db.cmsContent.banners[index] = {
      ...db.cmsContent.banners[index],
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    this.saveDB(db);

    return { success: true, banner: db.cmsContent.banners[index] };
  }

  /**
   * Delete banner
   */
  deleteBanner(bannerId) {
    const db = this.getDB();
    if (!db.cmsContent) return { success: false, error: 'CMS not initialized' };

    const index = db.cmsContent.banners.findIndex(b => b.id === bannerId);
    if (index === -1) {
      return { success: false, error: 'Banner not found' };
    }

    db.cmsContent.banners.splice(index, 1);
    this.saveDB(db);

    return { success: true };
  }

  /**
   * Get all content for frontend (combined payload)
   * Merges both cmsContent and siteContent for backward compatibility
   */
  getFrontendBundle() {
    const db = this.getDB();
    this.initializeContent();

    // Merge siteContent (legacy) with cmsContent (new)
    const siteContent = db.siteContent || {};
    const cmsContent = db.cmsContent || {};

    // Build global settings - prefer siteContent (admin theme settings)
    const global = {
      ...cmsContent.globalSettings,
      siteName: siteContent.header?.siteName || cmsContent.globalSettings?.siteName || 'Peekaboo Shades',
      contactPhone: siteContent.topBar?.phone || cmsContent.globalSettings?.contactPhone,
      contactEmail: siteContent.topBar?.email || cmsContent.globalSettings?.contactEmail,
      header: {
        ...cmsContent.globalSettings?.header,
        showTopBar: siteContent.topBar?.enabled !== false,
        topBarText: siteContent.topBar?.text || cmsContent.globalSettings?.header?.topBarText,
        topBarLink: siteContent.topBar?.link || cmsContent.globalSettings?.header?.topBarLink,
        logoUrl: siteContent.header?.logo || siteContent.theme?.logoUrl || cmsContent.globalSettings?.logo
      },
      socialMedia: siteContent.footer?.socialMedia || cmsContent.globalSettings?.socialMedia
    };

    // Build navigation - prefer siteContent
    const navigation = {
      mainMenu: siteContent.navigation?.mainMenu || cmsContent.navigation?.mainMenu || [],
      footerLinks: siteContent.navigation?.footerLinks || siteContent.footer?.links || cmsContent.navigation?.footerLinks || [],
      socialLinks: siteContent.navigation?.socialLinks || cmsContent.navigation?.socialLinks || []
    };

    // Build theme - from siteContent.theme (admin theme settings)
    const theme = siteContent.theme || db.themeSettings || {};

    // Build banners from heroSlides
    const banners = (siteContent.heroSlides || []).filter(s => s.active !== false).map(slide => ({
      id: slide.id,
      title: slide.title,
      subtitle: slide.subtitle,
      image: slide.image,
      buttonText: slide.buttonText,
      buttonLink: slide.buttonLink,
      active: slide.active !== false
    }));

    return {
      global,
      navigation,
      banners: banners.length > 0 ? banners : this.getBanners(),
      theme,
      // Also include raw siteContent for legacy support
      siteContent: {
        topBar: siteContent.topBar,
        header: siteContent.header,
        footer: siteContent.footer,
        homepage: siteContent.homepage
      }
    };
  }
}

// Singleton instance
const contentManager = new ContentManager();

module.exports = {
  contentManager
};
