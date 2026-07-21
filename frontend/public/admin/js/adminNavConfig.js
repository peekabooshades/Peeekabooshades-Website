/**
 * Admin Navigation Configuration
 * Professional Window Treatment Admin Panel - Consolidated 8-Department Structure
 *
 * Each department has 3-4 most-used items + "View All" link to hub page
 */

const AdminNavConfig = {
  // ============================================
  // ALL SEARCHABLE PAGES (includes hub pages)
  // ============================================
  allPages: [
    // Dashboard
    { label: 'Dashboard', href: '/admin/', keywords: ['home', 'main', 'overview'] },

    // Catalog
    { label: 'Products', href: '/admin/products.html', keywords: ['items', 'blinds', 'shades', 'catalog'] },
    { label: 'Fabrics', href: '/admin/fabrics.html', keywords: ['materials', 'fabric library', 'swatches'] },
    { label: 'Pricing', href: '/admin/product-pricing.html', keywords: ['prices', 'costs', 'margins', 'pricing engine'] },
    { label: 'Categories', href: '/admin/categories.html', keywords: ['product categories', 'organize'] },
    { label: 'Hardware Options', href: '/admin/hardware-options.html', keywords: ['valance', 'bottom rail', 'cassette'] },
    { label: 'Accessories', href: '/admin/accessories.html', keywords: ['motors', 'remotes', 'smart hub'] },
    { label: 'Zebra Hardware', href: '/admin/zebra-hardware.html', keywords: ['zebra blinds', 'zebra options'] },
    { label: 'Zebra Pricing', href: '/admin/zebra-pricing.html', keywords: ['zebra costs', 'zebra prices'] },
    { label: 'Bulk Import', href: '/admin/bulk-import.html', keywords: ['csv', 'excel', 'import products'] },

    // Orders
    { label: 'All Orders', href: '/admin/orders.html', keywords: ['purchases', 'sales', 'order list'] },
    { label: 'Quotes', href: '/admin/quotes.html', keywords: ['estimates', 'proposals', 'quote requests'] },
    { label: 'Production Queue', href: '/admin/production-queue.html', keywords: ['manufacturing', 'queue', 'production'] },
    // BUG-A002: 'Create Order' removed — create-order.html is a "coming soon" stub,
    // so the command palette must not advertise it as a working feature. Manual
    // order creation is natively covered by Shopify draft orders; re-add here only
    // when a real page (or a Shopify draft-order redirect) is wired up.
    { label: 'Draft Orders', href: '/admin/draft-orders.html', keywords: ['pending', 'incomplete orders'] },
    { label: 'Invoices', href: '/admin/invoices.html', keywords: ['billing', 'invoice list'] },
    { label: 'Refunds', href: '/admin/refunds.html', keywords: ['returns', 'money back'] },
    { label: 'Returns', href: '/admin/returns.html', keywords: ['rma', 'return requests'] },
    { label: 'Abandoned Checkouts', href: '/admin/abandoned-checkouts.html', keywords: ['cart abandonment', 'incomplete'] },
    { label: 'Shipping Labels', href: '/admin/shipping-labels.html', keywords: ['labels', 'shipping'] },
    { label: 'Order Status', href: '/admin/order-status.html', keywords: ['status management', 'workflow'] },

    // Customers
    { label: 'All Customers', href: '/admin/customers.html', keywords: ['clients', 'users', 'customer list'] },
    { label: 'Customer Groups', href: '/admin/customer-groups.html', keywords: ['segments', 'groups'] },
    { label: 'Reviews', href: '/admin/reviews.html', keywords: ['feedback', 'ratings', 'testimonials'] },
    { label: 'Trade Program', href: '/admin/trade/', keywords: ['dealers', 'wholesale', 'b2b'] },
    { label: 'Technicians', href: '/admin/trade/technicians.html', keywords: ['installers', 'service'] },
    { label: 'Dealer Pricing', href: '/admin/dealer-pricing.html', keywords: ['wholesale prices', 'trade prices'] },
    { label: 'Commissions', href: '/admin/commissions.html', keywords: ['affiliate', 'referral'] },

    // Marketing
    { label: 'Promotions', href: '/admin/marketing/promotions.html', keywords: ['discounts', 'sales', 'offers'] },
    { label: 'Campaigns', href: '/admin/marketing/campaigns.html', keywords: ['email campaigns', 'marketing'] },
    { label: 'Blog Posts', href: '/admin/blog/posts.html', keywords: ['articles', 'content', 'news'] },
    { label: 'Coupons', href: '/admin/marketing/coupons.html', keywords: ['discount codes', 'promo codes'] },
    { label: 'Email Subscribers', href: '/admin/marketing/subscribers.html', keywords: ['newsletter', 'mailing list'] },
    { label: 'Social Media', href: '/admin/marketing/social.html', keywords: ['facebook', 'instagram', 'social'] },
    { label: 'Automations', href: '/admin/marketing/automations.html', keywords: ['automated emails', 'workflows'] },
    { label: 'Flash Sales', href: '/admin/marketing/flash-sales.html', keywords: ['limited time', 'flash deals'] },

    // Analytics & Reports
    { label: 'Analytics Dashboard', href: '/admin/analytics.html', keywords: ['stats', 'metrics', 'overview'] },
    { label: 'Sales Reports', href: '/admin/reports/sales.html', keywords: ['revenue', 'sales analytics'] },
    { label: 'Customer Reports', href: '/admin/reports/customers.html', keywords: ['customer analytics'] },
    { label: 'Product Reports', href: '/admin/reports/products.html', keywords: ['product analytics', 'bestsellers'] },
    { label: 'Tax Reports', href: '/admin/tax-reports.html', keywords: ['tax', 'taxes', 'tax analytics'] },

    // Content
    { label: 'Pages', href: '/admin/pages.html', keywords: ['website pages', 'content pages'] },
    { label: 'Media Library', href: '/admin/media-library.html', keywords: ['images', 'files', 'uploads'] },
    { label: 'FAQs', href: '/admin/faqs.html', keywords: ['questions', 'help', 'faq'] },
    { label: 'Navigation', href: '/admin/online-store/navigation.html', keywords: ['menu', 'nav', 'links'] },
    { label: 'Banners', href: '/admin/online-store/banners.html', keywords: ['hero', 'slider', 'homepage banners'] },
    { label: 'Page Builder', href: '/admin/page-builder.html', keywords: ['visual editor', 'builder'] },
    { label: 'Landing Pages', href: '/admin/landing-pages.html', keywords: ['marketing pages', 'landing'] },

    // Settings
    { label: 'General Settings', href: '/admin/settings.html', keywords: ['store settings', 'configuration'] },
    { label: 'Payments', href: '/admin/settings/payments.html', keywords: ['stripe', 'paypal', 'payment methods'] },
    { label: 'Shipping Settings', href: '/admin/settings/shipping.html', keywords: ['delivery', 'shipping rates'] },
    { label: 'Tax Settings', href: '/admin/settings/taxes.html', keywords: ['tax rates', 'tax configuration'] },
    { label: 'Theme Settings', href: '/admin/theme-settings.html', keywords: ['design', 'appearance', 'theme'] },
    { label: 'Shop Settings', href: '/admin/online-store/shop-settings.html', keywords: ['store config'] },
    { label: 'System Config', href: '/admin/system-config.html', keywords: ['system', 'advanced settings'] },
    { label: 'Manufacturers', href: '/admin/settings/manufacturers.html', keywords: ['manufacturer', 'factory', 'supplier', 'pricing upload'] },

    // Security
    { label: 'Security', href: '/admin/security/', keywords: ['security settings', 'protection'] },
    { label: 'Users', href: '/admin/security/users.html', keywords: ['admin users', 'staff', 'accounts'] },
    { label: 'Permissions', href: '/admin/security/permissions.html', keywords: ['roles', 'access control'] },
    { label: 'Audit Logs', href: '/admin/security/audit-logs.html', keywords: ['activity log', 'history'] },
    { label: 'Two-Factor Auth', href: '/admin/security/two-factor.html', keywords: ['2fa', 'authentication'] },
    { label: 'API Security', href: '/admin/security/api-security.html', keywords: ['api keys', 'tokens'] },

    // Tools
    { label: 'API Tester', href: '/admin/api-tester.html', keywords: ['test api', 'debug'] },
    { label: 'Webhooks', href: '/admin/webhooks.html', keywords: ['integrations', 'hooks'] },
    { label: 'Image Manager', href: '/admin/image-manager.html', keywords: ['images', 'upload'] },

    // Manufacturer Portal
    { label: 'Manufacturer Portal', href: '/manufacturer/', keywords: ['manufacturer', 'factory', 'production'] },
    { label: 'Pending Orders', href: '/manufacturer/', keywords: ['manufacturer pending', 'factory orders pending'] },
    { label: 'Production Orders', href: '/manufacturer/', keywords: ['manufacturer production', 'in production', 'manufacturing'] },
    { label: 'Shipped Orders', href: '/manufacturer/', keywords: ['manufacturer shipped', 'shipped orders'] }
  ],

  sections: [
    // ============================================
    // 1. DASHBOARD (Single link)
    // ============================================
    {
      id: 'dashboard',
      title: null,
      items: [
        { id: 'dashboard', label: 'Dashboard', href: '/admin/', icon: 'home', status: 'active' }
      ]
    },

    // ============================================
    // 2. CATALOG
    // ============================================
    {
      id: 'catalog',
      title: 'Catalog',
      items: [
        { id: 'all-products', label: 'Products', href: '/admin/products.html', icon: 'cube', status: 'active' },
        { id: 'fabric-library', label: 'Fabrics', href: '/admin/fabrics.html', icon: 'color-swatch', status: 'active' },
        { id: 'pricing-engine', label: 'Pricing', href: '/admin/product-pricing.html', icon: 'calculator', status: 'active' },
        { id: 'catalog-hub', label: 'View All Catalog', href: '/admin/catalog/', icon: 'arrow-right', status: 'active', isViewAll: true }
      ]
    },

    // ============================================
    // 3. ORDERS
    // ============================================
    {
      id: 'orders',
      title: 'Orders',
      items: [
        { id: 'all-orders', label: 'All Orders', href: '/admin/orders.html', icon: 'shopping-bag', status: 'active', badge: 'orders-badge' },
        { id: 'quotes', label: 'Quotes', href: '/admin/quotes.html', icon: 'document-text', status: 'active', badge: 'quotes-badge' },
        { id: 'production-queue', label: 'Production', href: '/admin/production-queue.html', icon: 'clipboard-list', status: 'active' },
        { id: 'manufacturer-portal', label: 'Manufacturer Portal', href: '/manufacturer/', icon: 'factory', status: 'active', external: true },
        { id: 'orders-hub', label: 'View All Orders', href: '/admin/orders-hub/', icon: 'arrow-right', status: 'active', isViewAll: true }
      ]
    },

    // ============================================
    // 4. CUSTOMERS
    // ============================================
    {
      id: 'customers',
      title: 'Customers',
      items: [
        { id: 'all-customers', label: 'All Customers', href: '/admin/customers.html', icon: 'users', status: 'active' },
        { id: 'trade-program', label: 'Trade Program', href: '/dealer/', icon: 'office-building', status: 'active', external: true },
        { id: 'technicians', label: 'Technicians', href: '/admin/trade/technicians.html', icon: 'identification', status: 'active' },
        { id: 'customers-hub', label: 'View All Customers', href: '/admin/customers-hub/', icon: 'arrow-right', status: 'active', isViewAll: true }
      ]
    },

    // ============================================
    // 5. MARKETING
    // ============================================
    {
      id: 'marketing',
      title: 'Marketing',
      items: [
        { id: 'promotions', label: 'Promotions', href: '/admin/marketing/promotions.html', icon: 'speakerphone', status: 'active' },
        { id: 'email-campaigns', label: 'Campaigns', href: '/admin/marketing/campaigns.html', icon: 'mail', status: 'active' },
        { id: 'blog-posts', label: 'Blog', href: '/admin/blog/posts.html', icon: 'newspaper', status: 'active' },
        { id: 'marketing-hub', label: 'View All Marketing', href: '/admin/marketing-hub/', icon: 'arrow-right', status: 'active', isViewAll: true }
      ]
    },

    // ============================================
    // 6. ANALYTICS
    // ============================================
    {
      id: 'analytics',
      title: 'Analytics',
      items: [
        { id: 'analytics-dashboard', label: 'Dashboard', href: '/admin/analytics.html', icon: 'chart-bar', status: 'active' },
        { id: 'sales-reports', label: 'Sales Reports', href: '/admin/reports/sales.html', icon: 'chart-line', status: 'active' },
        { id: 'customer-reports', label: 'Customer Reports', href: '/admin/reports/customers.html', icon: 'user-group', status: 'active' },
        { id: 'reports-hub', label: 'View All Reports', href: '/admin/reports-hub/', icon: 'arrow-right', status: 'active', isViewAll: true }
      ]
    },

    // ============================================
    // 7. CONTENT
    // ============================================
    {
      id: 'content',
      title: 'Content',
      items: [
        { id: 'all-pages', label: 'Pages', href: '/admin/pages.html', icon: 'document-duplicate', status: 'active' },
        { id: 'media-library', label: 'Media', href: '/admin/media-library.html', icon: 'photograph', status: 'active' },
        { id: 'faqs', label: 'FAQs', href: '/admin/faqs.html', icon: 'question-mark-circle', status: 'active' },
        { id: 'content-hub', label: 'View All Content', href: '/admin/content-hub/', icon: 'arrow-right', status: 'active', isViewAll: true }
      ]
    },

    // ============================================
    // 8. SETTINGS
    // ============================================
    {
      id: 'settings',
      title: 'Settings',
      items: [
        { id: 'general-settings', label: 'General', href: '/admin/settings.html', icon: 'cog', status: 'active' },
        { id: 'manufacturers', label: 'Manufacturers', href: '/admin/settings/manufacturers.html', icon: 'factory', status: 'active' },
        { id: 'payments-shipping', label: 'Payments & Shipping', href: '/admin/settings/payments.html', icon: 'credit-card', status: 'active' },
        { id: 'security', label: 'Security', href: '/admin/security/', icon: 'shield-check', status: 'active' },
        { id: 'settings-hub', label: 'View All Settings', href: '/admin/settings-hub/', icon: 'arrow-right', status: 'active', isViewAll: true }
      ]
    }
  ],

  // ============================================
  // ICON SVG PATHS (Heroicons)
  // ============================================
  icons: {
    'home': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />',
    'cube': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />',
    'color-swatch': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />',
    'calculator': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />',
    'arrow-right': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />',
    'shopping-bag': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />',
    'document-text': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />',
    'clipboard-list': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />',
    'users': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />',
    'office-building': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />',
    'identification': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />',
    'speakerphone': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />',
    'mail': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />',
    'newspaper': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />',
    'chart-bar': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />',
    'chart-line': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16" />',
    'user-group': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />',
    'document-duplicate': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />',
    'photograph': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />',
    'question-mark-circle': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
    'cog': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />',
    'credit-card': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />',
    'shield-check': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />',
    'factory': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />',
    'currency-dollar': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
    'trending-up': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />'
  },

  /**
   * Render the sidebar navigation HTML with collapsible sections
   * @param {string} currentPage - Current page ID to mark as active
   * @returns {string} HTML string for sidebar nav
   */
  renderSidebar(currentPage) {
    let html = '<nav class="sidebar-nav">';

    for (const section of this.sections) {
      const hasTitle = section.title && section.title !== null;
      const sectionAttr = hasTitle ? ` data-section="${section.id}"` : '';

      html += `<div class="nav-section"${sectionAttr}>`;

      if (hasTitle) {
        html += `
          <div class="nav-section-title" onclick="AdminNavConfig.toggleSection(this)">
            <span>${section.title}</span>
            <svg class="toggle-icon" width="14" height="14" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div class="nav-section-items">`;
      }

      for (const item of section.items) {
        if (item.status === 'hidden') continue;

        const isActive = item.id === currentPage ? ' active' : '';
        const isDisabled = item.status === 'disabled' ? ' disabled' : '';
        const isViewAll = item.isViewAll ? ' view-all' : '';
        const externalAttr = item.external ? ' target="_blank"' : '';
        const disabledTitle = item.status === 'disabled' ? ' title="Coming Soon"' : '';

        if (item.status === 'disabled') {
          html += `<span class="nav-item${isDisabled}${isViewAll}"${disabledTitle}>`;
        } else {
          html += `<a href="${item.href}" class="nav-item${isActive}${isViewAll}"${externalAttr}>`;
        }

        html += `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">`;
        html += this.icons[item.icon] || this.icons['document-text'];
        html += `</svg>`;
        html += `<span>${item.label}</span>`;

        if (item.badge) {
          html += `<span class="nav-badge" id="${item.badge}" style="display: none;">0</span>`;
        }

        if (item.status === 'disabled') {
          html += `</span>`;
        } else {
          html += `</a>`;
        }
      }

      if (hasTitle) {
        html += '</div>'; // Close nav-section-items
      }

      html += '</div>'; // Close nav-section
    }

    html += '</nav>';
    return html;
  },

  /**
   * Toggle section collapse state
   */
  toggleSection(titleElement) {
    const section = titleElement.closest('.nav-section');
    if (section) {
      section.classList.toggle('collapsed');
      const sectionId = section.dataset.section;
      if (sectionId) {
        const collapsedSections = JSON.parse(localStorage.getItem('admin_collapsed_sections') || '[]');
        if (section.classList.contains('collapsed')) {
          if (!collapsedSections.includes(sectionId)) {
            collapsedSections.push(sectionId);
          }
        } else {
          const index = collapsedSections.indexOf(sectionId);
          if (index > -1) {
            collapsedSections.splice(index, 1);
          }
        }
        localStorage.setItem('admin_collapsed_sections', JSON.stringify(collapsedSections));
      }
    }
  },

  /**
   * Restore collapsed sections from localStorage
   */
  restoreCollapsedSections() {
    const collapsedSections = JSON.parse(localStorage.getItem('admin_collapsed_sections') || '[]');
    collapsedSections.forEach(sectionId => {
      const section = document.querySelector(`.nav-section[data-section="${sectionId}"]`);
      if (section) {
        section.classList.add('collapsed');
      }
    });
  },

  /**
   * Initialize the sidebar - call this on page load
   * @param {string} currentPage - Current page ID to mark as active
   */
  initSidebar(currentPage) {
    const sidebarContainer = document.querySelector('.admin-sidebar');
    if (!sidebarContainer) return;

    // Create sidebar header with search
    const headerHtml = `
      <div class="sidebar-header">
        <a href="/admin/" class="sidebar-logo">
          <img src="/images/peekabooshades_logo.jpeg" alt="Peekaboo Shades" style="height: 32px; width: auto; border-radius: 6px;">
          <span>Peekaboo Shades</span>
        </a>
      </div>
      <div class="sidebar-search">
        <div class="search-input-wrapper">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" id="sidebar-search-input" placeholder="Search pages..." autocomplete="off" />
          <kbd class="search-shortcut">/</kbd>
        </div>
        <div class="search-results" id="sidebar-search-results"></div>
      </div>
    `;

    // Set sidebar content
    sidebarContainer.innerHTML = headerHtml + this.renderSidebar(currentPage);

    // Restore collapsed sections
    this.restoreCollapsedSections();

    // Initialize search
    this.initSearch();
  },

  /**
   * Initialize sidebar search functionality
   */
  initSearch() {
    const searchInput = document.getElementById('sidebar-search-input');
    const searchResults = document.getElementById('sidebar-search-results');
    if (!searchInput || !searchResults) return;

    let selectedIndex = -1;

    // Focus search on "/" key
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        searchInput.focus();
      }
      // Escape to close
      if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.blur();
        searchInput.value = '';
        searchResults.innerHTML = '';
        searchResults.style.display = 'none';
        selectedIndex = -1;
      }
    });

    // Search input handler
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      selectedIndex = -1;

      if (query.length < 2) {
        searchResults.innerHTML = '';
        searchResults.style.display = 'none';
        return;
      }

      const results = this.searchPages(query);
      this.renderSearchResults(results, searchResults);
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      const items = searchResults.querySelectorAll('.search-result-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
        this.updateSelectedResult(items, selectedIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        this.updateSelectedResult(items, selectedIndex);
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        items[selectedIndex].click();
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.sidebar-search')) {
        searchResults.innerHTML = '';
        searchResults.style.display = 'none';
        selectedIndex = -1;
      }
    });

    // Focus styling
    searchInput.addEventListener('focus', () => {
      searchInput.parentElement.classList.add('focused');
    });
    searchInput.addEventListener('blur', () => {
      searchInput.parentElement.classList.remove('focused');
    });
  },

  /**
   * Search pages by query
   */
  searchPages(query) {
    const results = [];
    const queryWords = query.split(/\s+/);

    for (const page of this.allPages) {
      const labelLower = page.label.toLowerCase();
      const keywordsStr = (page.keywords || []).join(' ').toLowerCase();
      const searchText = labelLower + ' ' + keywordsStr;

      // Check if all query words match
      const matches = queryWords.every(word => searchText.includes(word));

      if (matches) {
        // Calculate relevance score
        let score = 0;
        if (labelLower.startsWith(query)) score += 10;
        if (labelLower.includes(query)) score += 5;
        queryWords.forEach(word => {
          if (labelLower.includes(word)) score += 3;
          if (keywordsStr.includes(word)) score += 1;
        });

        results.push({ ...page, score });
      }
    }

    // Sort by relevance
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, 8); // Limit to 8 results
  },

  /**
   * Render search results dropdown
   */
  renderSearchResults(results, container) {
    if (results.length === 0) {
      container.innerHTML = '<div class="search-no-results">No pages found</div>';
      container.style.display = 'block';
      return;
    }

    let html = '';
    for (const result of results) {
      html += `
        <a href="${result.href}" class="search-result-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="result-label">${result.label}</span>
          ${result.keywords && result.keywords.length > 0 ? `<span class="result-keywords">${result.keywords.slice(0, 2).join(', ')}</span>` : ''}
        </a>
      `;
    }

    container.innerHTML = html;
    container.style.display = 'block';
  },

  /**
   * Update selected result highlighting
   */
  updateSelectedResult(items, index) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  },

  /**
   * Get current page ID from URL
   */
  getCurrentPageId() {
    const path = window.location.pathname;
    const search = window.location.search;

    // Check for exact matches first
    for (const section of this.sections) {
      for (const item of section.items) {
        // Handle query params
        if (item.href.includes('?') && path + search === item.href) {
          return item.id;
        }
        // Handle exact path match
        if (item.href === path || item.href === path + 'index.html') {
          return item.id;
        }
        // Handle path without trailing slash
        const itemPath = item.href.split('?')[0];
        if (itemPath === path) {
          return item.id;
        }
      }
    }

    // Default to dashboard for /admin/ or /admin/index.html
    if (path === '/admin/' || path === '/admin/index.html') {
      return 'dashboard';
    }

    return null;
  },

  /**
   * Get nav item by ID
   */
  getItem(itemId) {
    for (const section of this.sections) {
      const item = section.items.find(i => i.id === itemId);
      if (item) return item;
    }
    return null;
  },

  /**
   * Update item status
   */
  setItemStatus(itemId, status) {
    const item = this.getItem(itemId);
    if (item) {
      item.status = status;
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdminNavConfig;
}
