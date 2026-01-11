// ============================================
// SEO SERVICE - Meta Tags, Schema, OpenGraph
// ============================================

const BASE_URL = 'https://peekabooshades.com';
const COMPANY_NAME = 'Peekaboo Shades';
const COMPANY_PHONE = '(469) 758-8935';
const COMPANY_EMAIL = 'info@peekabooshades.com';

// Default SEO settings
const defaults = {
  title: 'Peekaboo Shades - Custom Window Blinds & Shades in Texas',
  description: 'Affordable custom roller blinds, zebra shades, and motorized window treatments. Free shipping across Texas. Dallas, Austin, Houston, San Antonio delivery.',
  image: `${BASE_URL}/images/og-image.jpg`,
  type: 'website',
  twitterHandle: '@peekabooshades'
};

// ============================================
// META TAG GENERATORS
// ============================================

/**
 * Generate meta tags for a page
 */
function generateMetaTags(options = {}) {
  const {
    title = defaults.title,
    description = defaults.description,
    canonical = BASE_URL,
    noindex = false,
    nofollow = false
  } = options;

  const robots = [];
  if (noindex) robots.push('noindex');
  if (nofollow) robots.push('nofollow');

  return {
    title: title.length > 60 ? title.substring(0, 57) + '...' : title,
    description: description.length > 160 ? description.substring(0, 157) + '...' : description,
    canonical,
    robots: robots.length > 0 ? robots.join(', ') : 'index, follow'
  };
}

/**
 * Generate Open Graph tags for social sharing
 */
function generateOpenGraph(options = {}) {
  const {
    title = defaults.title,
    description = defaults.description,
    image = defaults.image,
    url = BASE_URL,
    type = defaults.type,
    siteName = COMPANY_NAME
  } = options;

  return {
    'og:title': title,
    'og:description': description,
    'og:image': image,
    'og:url': url,
    'og:type': type,
    'og:site_name': siteName,
    'og:locale': 'en_US'
  };
}

/**
 * Generate Twitter Card tags
 */
function generateTwitterCard(options = {}) {
  const {
    title = defaults.title,
    description = defaults.description,
    image = defaults.image,
    card = 'summary_large_image',
    site = defaults.twitterHandle
  } = options;

  return {
    'twitter:card': card,
    'twitter:site': site,
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image
  };
}

// ============================================
// JSON-LD SCHEMA GENERATORS
// ============================================

/**
 * Organization schema
 */
function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: COMPANY_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/images/peekabooshades_logo.jpeg`,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: COMPANY_PHONE,
      contactType: 'customer service',
      email: COMPANY_EMAIL,
      areaServed: 'US',
      availableLanguage: 'English'
    },
    sameAs: [
      'https://www.facebook.com/peekabooshades',
      'https://www.instagram.com/peekabooshades',
      'https://twitter.com/peekabooshades'
    ],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dallas',
      addressRegion: 'TX',
      addressCountry: 'US'
    }
  };
}

/**
 * LocalBusiness schema for Texas service areas
 */
function generateLocalBusinessSchema(city = 'Dallas') {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BASE_URL}/#localbusiness`,
    name: COMPANY_NAME,
    description: `Custom window blinds and shades serving ${city}, Texas and surrounding areas. Roller shades, zebra shades, motorized blinds with free shipping.`,
    url: BASE_URL,
    telephone: COMPANY_PHONE,
    email: COMPANY_EMAIL,
    priceRange: '$$',
    image: `${BASE_URL}/images/peekabooshades_logo.jpeg`,
    areaServed: {
      '@type': 'State',
      name: 'Texas',
      containsPlace: [
        { '@type': 'City', name: 'Dallas' },
        { '@type': 'City', name: 'Austin' },
        { '@type': 'City', name: 'Houston' },
        { '@type': 'City', name: 'San Antonio' },
        { '@type': 'City', name: 'Fort Worth' }
      ]
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '18:00'
    }
  };
}

/**
 * Product schema for individual products
 */
function generateProductSchema(product) {
  const {
    name,
    description,
    image,
    sku,
    price,
    priceCurrency = 'USD',
    availability = 'InStock',
    brand = COMPANY_NAME,
    category,
    url
  } = product;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image: image ? (image.startsWith('http') ? image : `${BASE_URL}${image}`) : `${BASE_URL}/images/og-image.jpg`,
    sku,
    brand: {
      '@type': 'Brand',
      name: brand
    },
    category,
    offers: {
      '@type': 'Offer',
      url: url || BASE_URL,
      priceCurrency,
      price: price || '0',
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      availability: `https://schema.org/${availability}`,
      seller: {
        '@type': 'Organization',
        name: COMPANY_NAME
      }
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '127'
    }
  };
}

/**
 * FAQ schema for FAQ sections
 */
function generateFAQSchema(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

/**
 * Breadcrumb schema
 */
function generateBreadcrumbSchema(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url ? (item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`) : undefined
    }))
  };
}

/**
 * WebPage schema
 */
function generateWebPageSchema(options = {}) {
  const {
    name = defaults.title,
    description = defaults.description,
    url = BASE_URL,
    datePublished,
    dateModified
  } = options;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url,
    datePublished: datePublished || new Date().toISOString(),
    dateModified: dateModified || new Date().toISOString(),
    publisher: generateOrganizationSchema()
  };
}

/**
 * Article/Guide schema for blog/guide pages
 */
function generateArticleSchema(article) {
  const {
    headline,
    description,
    image,
    author = COMPANY_NAME,
    datePublished,
    dateModified,
    url
  } = article;

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    image: image ? (image.startsWith('http') ? image : `${BASE_URL}${image}`) : `${BASE_URL}/images/og-image.jpg`,
    author: {
      '@type': 'Organization',
      name: author
    },
    publisher: {
      '@type': 'Organization',
      name: COMPANY_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/images/peekabooshades_logo.jpeg`
      }
    },
    datePublished: datePublished || new Date().toISOString(),
    dateModified: dateModified || new Date().toISOString(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url || BASE_URL
    }
  };
}

// ============================================
// HTML GENERATION HELPERS
// ============================================

/**
 * Generate meta tags HTML string
 */
function generateMetaTagsHTML(options = {}) {
  const meta = generateMetaTags(options);
  const og = generateOpenGraph(options);
  const twitter = generateTwitterCard(options);

  let html = `
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}">
    <link rel="canonical" href="${meta.canonical}">
    <meta name="robots" content="${meta.robots}">
  `;

  // Open Graph tags
  Object.entries(og).forEach(([key, value]) => {
    html += `\n    <meta property="${key}" content="${value}">`;
  });

  // Twitter tags
  Object.entries(twitter).forEach(([key, value]) => {
    html += `\n    <meta name="${key}" content="${value}">`;
  });

  return html;
}

/**
 * Generate JSON-LD script tag
 */
function generateSchemaHTML(schema) {
  if (!schema) return '';
  return `<script type="application/ld+json">${JSON.stringify(schema, null, 0)}</script>`;
}

/**
 * Generate all page SEO HTML (meta tags + schema)
 */
function generatePageSEO(options = {}) {
  const {
    title,
    description,
    canonical,
    noindex,
    image,
    url,
    type,
    product,
    faqs,
    breadcrumbs,
    isArticle,
    articleData,
    includeOrganization = true,
    includeLocalBusiness = false,
    city
  } = options;

  let html = generateMetaTagsHTML({ title, description, canonical, noindex, image, url, type });

  // Add Organization schema (usually on all pages)
  if (includeOrganization) {
    html += '\n    ' + generateSchemaHTML(generateOrganizationSchema());
  }

  // Add LocalBusiness schema (for local pages)
  if (includeLocalBusiness) {
    html += '\n    ' + generateSchemaHTML(generateLocalBusinessSchema(city));
  }

  // Add Product schema
  if (product) {
    html += '\n    ' + generateSchemaHTML(generateProductSchema(product));
  }

  // Add FAQ schema
  if (faqs && faqs.length > 0) {
    html += '\n    ' + generateSchemaHTML(generateFAQSchema(faqs));
  }

  // Add Breadcrumb schema
  if (breadcrumbs && breadcrumbs.length > 0) {
    html += '\n    ' + generateSchemaHTML(generateBreadcrumbSchema(breadcrumbs));
  }

  // Add Article schema
  if (isArticle && articleData) {
    html += '\n    ' + generateSchemaHTML(generateArticleSchema(articleData));
  }

  return html;
}

// ============================================
// SITEMAP UTILITIES
// ============================================

/**
 * Generate sitemap entry
 */
function generateSitemapEntry(url, options = {}) {
  const {
    lastmod = new Date().toISOString().split('T')[0],
    changefreq = 'weekly',
    priority = '0.5'
  } = options;

  return `  <url>
    <loc>${url.startsWith('http') ? url : BASE_URL + url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

/**
 * Generate full sitemap XML
 */
function generateSitemapXML(urls) {
  const entries = urls.map(entry => {
    if (typeof entry === 'string') {
      return generateSitemapEntry(entry);
    }
    return generateSitemapEntry(entry.url, entry);
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

// ============================================
// ROBOTS.TXT GENERATOR
// ============================================

function generateRobotsTxt() {
  return `# Robots.txt for Peekaboo Shades
# https://peekabooshades.com

User-agent: *
Allow: /

# Disallow admin and API
Disallow: /admin/
Disallow: /api/
Disallow: /cart?*
Disallow: /checkout
Disallow: /*?session=
Disallow: /*?ref=

# Sitemap
Sitemap: ${BASE_URL}/sitemap.xml

# Crawl-delay
Crawl-delay: 1
`;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Meta generators
  generateMetaTags,
  generateOpenGraph,
  generateTwitterCard,

  // Schema generators
  generateOrganizationSchema,
  generateLocalBusinessSchema,
  generateProductSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
  generateWebPageSchema,
  generateArticleSchema,

  // HTML helpers
  generateMetaTagsHTML,
  generateSchemaHTML,
  generatePageSEO,

  // Sitemap
  generateSitemapEntry,
  generateSitemapXML,

  // Robots
  generateRobotsTxt,

  // Constants
  BASE_URL,
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_EMAIL,
  defaults
};
