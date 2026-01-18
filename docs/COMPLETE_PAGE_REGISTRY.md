# Peekaboo Shades - Complete Page Registry

**Total Pages: 245**
**Last Updated:** January 2026

This document lists EVERY HTML page in the Peekaboo Shades website.

---

## Table of Contents

1. [Customer-Facing Pages (20 pages)](#1-customer-facing-pages)
2. [Landing Pages (9 pages)](#2-landing-pages)
3. [Guides (5 pages)](#3-guides)
4. [Policies (7 pages)](#4-policies)
5. [Dealer Portal (6 pages)](#5-dealer-portal)
6. [Technician Portal (7 pages)](#6-technician-portal)
7. [Manufacturer Portal (2 pages)](#7-manufacturer-portal)
8. [Admin Panel (189 pages)](#8-admin-panel)

---

## 1. Customer-Facing Pages

**Location:** `/frontend/public/`

| # | Page | File | Purpose | API Endpoints |
|---|------|------|---------|---------------|
| 1 | Homepage | `index.html` | Marketing landing with hero slider | `GET /api/content/bundle`, `GET /api/products?featured=true` |
| 2 | Shop | `shop.html` | Product listing with filters | `GET /api/products`, `GET /api/categories` |
| 3 | Product Configurator | `product.html` | Roller/standard product configurator | `GET /api/products/:slug`, `POST /api/pricing/calculate` |
| 4 | Zebra Product | `zebra-product.html` | Zebra blinds configurator | `GET /api/products/:slug`, `POST /api/pricing/calculate` |
| 5 | Cart | `cart.html` | Shopping cart & checkout | `POST /api/checkout`, `POST /api/orders` |
| 6 | **Sign Up** | `signup.html` | Member registration | `POST /api/customer/register` |
| 7 | **Login** | `login.html` | Member authentication | `POST /api/customer/login` |
| 8 | **Account** | `account.html` | Customer dashboard | `GET /api/customer/profile`, `GET /api/customer/orders` |
| 9 | Order Lookup | `order-lookup.html` | Track order status | `GET /api/orders/:orderNumber/status` |
| 10 | Samples | `samples.html` | Free sample ordering (max 10) | `POST /api/samples/request` |
| 11 | Schedule Appointment | `schedule-appointment.html` | Book installation/measurement | `POST /api/appointments` |
| 12 | Trade Application | `trade.html` | Dealer/contractor signup | `POST /api/trade/apply` |
| 13 | FAQs | `faqs.html` | Frequently asked questions | `GET /api/faqs` |
| 14 | Blog | `blog.html` | Blog listing | `GET /api/blog/posts` |
| 15 | Contact | `contact.html` | Contact form | `POST /api/contact` |
| 16 | Dynamic Page | `page.html` | CMS-driven content pages | `GET /api/pages/:slug` |
| 17 | Warranty | `warranty.html` | Warranty information | Static |
| 18 | Returns | `returns.html` | Return policy | Static |
| 19 | Shipping | `shipping.html` | Shipping information | Static |
| 20 | Child Safety | `child-safety.html` | Child safety information | Static |

---

## 2. Landing Pages

**Location:** `/frontend/public/landing/`

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Roller Shades | `roller-shades.html` | SEO landing for roller shades |
| 2 | Zebra Shades | `zebra-shades.html` | SEO landing for zebra shades |
| 3 | Blackout Roller Shades | `blackout-roller-shades.html` | SEO landing for blackout roller |
| 4 | Blackout Zebra Shades | `blackout-zebra-shades.html` | SEO landing for blackout zebra |
| 5 | Light Filtering Roller | `light-filtering-roller-shades.html` | SEO landing for light filtering |
| 6 | Motorized Roller Shades | `motorized-roller-shades.html` | SEO landing for motorized |
| 7 | Cordless Shades | `cordless-shades.html` | SEO landing for cordless |
| 8 | Window Shades Living Room | `window-shades-living-room.html` | Room-specific landing |
| 9 | Window Shades Bedroom | `window-shades-bedroom.html` | Room-specific landing |

---

## 3. Guides

**Location:** `/frontend/public/guides/`

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Guides Index | `index.html` | Guide category listing |
| 2 | How to Measure | `how-to-measure-for-blinds.html` | Measurement instructions |
| 3 | Blackout Shades Guide | `blackout-shades-what-to-know.html` | Blackout shade buying guide |
| 4 | Cordless vs Motorized | `cordless-vs-motorized.html` | Control type comparison |
| 5 | Zebra vs Roller | `zebra-vs-roller-shades.html` | Product type comparison |

---

## 4. Policies

**Location:** `/frontend/public/policies/`

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Privacy Policy | `privacy-policy.html` | Privacy policy |
| 2 | Terms of Service | `terms-of-service.html` | Terms and conditions |
| 3 | Returns Policy | `returns.html` | Return/refund policy |
| 4 | Shipping Policy | `shipping.html` | Shipping policy |
| 5 | Warranty | `warranty.html` | Warranty terms |
| 6 | Child Safety | `child-safety.html` | Child safety compliance |
| 7 | Contact | `contact.html` | Contact information |

---

## 5. Dealer Portal

**Location:** `/frontend/public/dealer/`

| # | Page | File | Purpose | API Endpoints |
|---|------|------|---------|---------------|
| 1 | Login | `login.html` | Dealer authentication | `POST /api/dealer/login` |
| 2 | Dashboard | `index.html` | Dashboard with stats | `GET /api/dealer/stats` |
| 3 | Orders | `orders.html` | Order listing | `GET /api/dealer/orders` |
| 4 | New Order | `new-order.html` | Product configurator for B2B | `POST /api/dealer/orders` |
| 5 | Customers | `customers.html` | End-customer management | `GET /api/dealer/customers` |
| 6 | Commissions | `commissions.html` | Earnings & payouts | `GET /api/dealer/commissions` |

---

## 6. Technician Portal

**Location:** `/frontend/public/technician/`

| # | Page | File | Purpose | API Endpoints |
|---|------|------|---------|---------------|
| 1 | Signup | `signup.html` | Technician registration | `POST /api/technician/register` |
| 2 | Login | `login.html` | Technician authentication | `POST /api/technician/login` |
| 3 | Dashboard | `index.html` | Dashboard with jobs | `GET /api/technician/stats` |
| 4 | Appointments | `appointments.html` | Job assignments | `GET /api/technician/appointments` |
| 5 | Schedule | `schedule.html` | Availability calendar | `GET/PUT /api/technician/schedule` |
| 6 | Payments | `payments.html` | Earnings & payouts | `GET /api/technician/payments` |
| 7 | Profile | `profile.html` | Profile settings | `GET/PUT /api/technician/profile` |

---

## 7. Manufacturer Portal

**Location:** `/frontend/public/manufacturer/`

| # | Page | File | Purpose | API Endpoints |
|---|------|------|---------|---------------|
| 1 | Login | `login.html` | Manufacturer authentication | `POST /api/manufacturer/login` |
| 2 | Dashboard | `index.html` | Production queue & orders | `GET /api/manufacturer/orders`, `POST /api/manufacturer/orders/:id/status` |

---

## 8. Admin Panel

**Location:** `/frontend/public/admin/`
**Total Admin Pages: 189**

### 8.1 Core Admin Pages

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Login | `login.html` | Admin authentication |
| 2 | Dashboard | `index.html` | Analytics dashboard |
| 3 | Analytics | `analytics.html` | Detailed analytics |
| 4 | Settings | `settings.html` | General settings |
| 5 | Theme Settings | `theme-settings.html` | Theme customization |
| 6 | System Config | `system-config.html` | System configuration |
| 7 | API Tester | `api-tester.html` | API testing tool |
| 8 | Copilot | `copilot.html` | AI assistant |

### 8.2 Catalog Management (18 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Catalog Hub | `catalog/index.html` | Catalog navigation |
| 2 | Products | `products.html` | Product listing |
| 3 | Product Catalog | `product-catalog.html` | Catalog view |
| 4 | Product Edit | `product-edit.html` | Edit product |
| 5 | Product Editor | `product-editor.html` | Visual editor |
| 6 | Product Editor V2 | `product-editor-v2.html` | New visual editor |
| 7 | Product Page Editor | `product-page-editor.html` | Page builder |
| 8 | Product Content | `product-content.html` | Content management |
| 9 | Product Pricing | `product-pricing.html` | Pricing configuration |
| 10 | Product Launch | `product-launch.html` | Launch workflow |
| 11 | Product Attributes | `product-attributes.html` | Attributes management |
| 12 | Product Tags | `product-tags.html` | Tag management |
| 13 | Categories | `categories.html` | Category taxonomy |
| 14 | Fabrics | `fabrics.html` | Fabric management |
| 15 | Fabric Collections | `fabric-collections.html` | Fabric groupings |
| 16 | Fabric Attributes | `fabric-attributes.html` | Fabric properties |
| 17 | Hardware Options | `hardware-options.html` | Hardware config |
| 18 | Accessories | `accessories.html` | Accessories management |

### 8.3 Zebra-Specific (3 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Zebra Pricing | `zebra-pricing.html` | Zebra pricing |
| 2 | Zebra Hardware | `zebra-hardware.html` | Zebra hardware |
| 3 | Zebra Page Editor | `zebra-page-editor.html` | Zebra page builder |

### 8.4 Orders Management (12 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Orders Hub | `orders-hub/index.html` | Orders navigation |
| 2 | Orders | `orders.html` | All orders listing |
| 3 | Create Order | `create-order.html` | Manual order creation |
| 4 | Order Status | `order-status.html` | Status management |
| 5 | Draft Orders | `draft-orders.html` | Incomplete orders |
| 6 | Quotes | `quotes.html` | Quote requests |
| 7 | Invoices | `invoices.html` | Invoice management |
| 8 | Print Invoice | `print-invoice.html` | Invoice printing |
| 9 | Refunds | `refunds.html` | Refund processing |
| 10 | Returns | `returns.html` | Returns management |
| 11 | Remakes | `remakes.html` | Remake requests |
| 12 | Abandoned Checkouts | `abandoned-checkouts.html` | Cart recovery |

### 8.5 Production & Shipping (6 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Production Queue | `production-queue.html` | Manufacturing queue |
| 2 | Cut Sheets | `cut-sheets.html` | Production cut sheets |
| 3 | Tracking | `tracking.html` | Shipment tracking |
| 4 | Shipping Labels | `shipping-labels.html` | Label generation |
| 5 | Delivery Scheduling | `delivery-scheduling.html` | Delivery management |
| 6 | Warranty Claims | `warranty-claims.html` | Warranty processing |

### 8.6 Customers Management (6 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Customers Hub | `customers-hub/index.html` | Customer navigation |
| 2 | Customers | `customers.html` | Customer listing |
| 3 | Customer Detail | `customer.html` | Single customer view |
| 4 | Customer Groups | `customer-groups.html` | Group management |
| 5 | Sample Requests | `sample-requests.html` | Sample orders |
| 6 | Sample Inventory | `sample-inventory.html` | Sample stock |

### 8.7 Trade/Dealers (8 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Trade Applications | `trade/applications.html` | Applications review |
| 2 | Contractors | `trade/contractors.html` | Contractor management |
| 3 | Designers | `trade/designers.html` | Designer management |
| 4 | Trade Technicians | `trade/technicians.html` | Technician management |
| 5 | Technicians | `technicians.html` | Technician list |
| 6 | Trade Pricing | `trade-pricing.html` | Trade pricing |
| 7 | Dealer Pricing | `dealer-pricing.html` | Dealer tiers |
| 8 | Commissions | `commissions.html` | Commission tracking |

### 8.8 Installations (6 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Installers | `installers.html` | Installer management |
| 2 | Installer Payments | `installer-payments.html` | Installer payouts |
| 3 | Install Scheduling | `install-scheduling.html` | Installation calendar |
| 4 | Appointments | `appointments.html` | Appointment management |
| 5 | Measurement Requests | `measurement-requests.html` | Measurement bookings |
| 6 | Technician Availability | `technician-availability.html` | Availability management |
| 7 | Service Areas | `service-areas.html` | Service zones |

### 8.9 Marketing (18 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Marketing Hub | `marketing-hub/index.html` | Marketing navigation |
| 2 | Marketing Index | `marketing/index.html` | Marketing dashboard |
| 3 | Campaigns | `marketing/campaigns.html` | Campaign management |
| 4 | Promotions | `marketing/promotions.html` | Promotion codes |
| 5 | Coupons | `marketing/coupons.html` | Coupon codes |
| 6 | Auto Discounts | `marketing/auto-discounts.html` | Automatic discounts |
| 7 | Flash Sales | `marketing/flash-sales.html` | Time-limited sales |
| 8 | Bundles | `marketing/bundles.html` | Product bundles |
| 9 | Automations | `marketing/automations.html` | Email automations |
| 10 | Templates | `marketing/templates.html` | Email templates |
| 11 | Subscribers | `marketing/subscribers.html` | Email list |
| 12 | Social | `marketing/social.html` | Social media |
| 13 | Facebook | `marketing/facebook.html` | Facebook integration |
| 14 | Google Shopping | `marketing/google-shopping.html` | Google feed |
| 15 | UTM | `marketing/utm.html` | UTM tracking |
| 16 | Pricing Promotions | `pricing-promotions.html` | Pricing rules |
| 17 | Promotion Rules | `promotion-rules.html` | Promotion logic |
| 18 | Landing Pages | `landing-pages.html` | Landing page builder |

### 8.10 Pricing (4 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Dealer Pricing | `pricing/dealer-pricing.html` | Dealer tier pricing |
| 2 | Quantity Discounts | `pricing/quantity-discounts.html` | Volume discounts |
| 3 | Quantity Discounts (alt) | `quantity-discounts.html` | Volume discounts |
| 4 | Surcharges | `pricing/surcharges.html` | Additional fees |

### 8.11 Content Management (15 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Content Hub | `content-hub/index.html` | Content navigation |
| 2 | Pages | `pages.html` | CMS pages |
| 3 | Page Builder | `page-builder.html` | Visual page builder |
| 4 | Section Builder | `section-builder.html` | Section editor |
| 5 | Visual Builder | `visual-builder.html` | Drag-drop builder |
| 6 | FAQs | `faqs.html` | FAQ management |
| 7 | Blog Posts | `blog/posts.html` | Blog post management |
| 8 | Blog Categories | `blog/categories.html` | Blog categories |
| 9 | Reviews | `reviews.html` | Customer reviews |
| 10 | Media Library | `media-library.html` | File management |
| 11 | Image Manager | `image-manager.html` | Image management |
| 12 | Room Visualizer | `room-visualizer.html` | AR visualizer |
| 13 | Specs Library | `specs-library.html` | Product specifications |
| 14 | Measuring Guide | `content/measuring-guide.html` | Guide editor |
| 15 | Accounts | `accounts.html` | Financial accounts |

### 8.12 Guides Management (6 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Measuring Guide | `guides/measuring-guide.html` | Measurement guide |
| 2 | Installation Guide | `guides/installation.html` | Installation guide |
| 3 | Care Guide | `guides/care.html` | Care instructions |
| 4 | Buying Guide | `guides/buying.html` | Buying guide |
| 5 | Warranty Guide | `guides/warranty.html` | Warranty info |
| 6 | Videos | `guides/videos.html` | Video guides |

### 8.13 Policies Management (5 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Privacy Policy | `policies/privacy.html` | Privacy editor |
| 2 | Terms | `policies/terms.html` | Terms editor |
| 3 | Returns | `policies/returns.html` | Returns policy |
| 4 | Shipping | `policies/shipping.html` | Shipping policy |
| 5 | Warranty | `policies/warranty.html` | Warranty policy |

### 8.14 Navigation Management (2 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Footer | `navigation/footer.html` | Footer links |
| 2 | Mobile | `navigation/mobile.html` | Mobile menu |

### 8.15 Online Store (5 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Homepage | `online-store/homepage.html` | Homepage editor |
| 2 | Navigation | `online-store/navigation.html` | Nav editor |
| 3 | Banners | `online-store/banners.html` | Banner management |
| 4 | Themes | `online-store/themes.html` | Theme selection |
| 5 | Shop Settings | `online-store/shop-settings.html` | Shop configuration |

### 8.16 Theme Customization (6 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Header | `theme/header.html` | Header customization |
| 2 | Footer | `theme/footer.html` | Footer customization |
| 3 | Typography | `theme/typography.html` | Font settings |
| 4 | Favicon | `theme/favicon.html` | Favicon upload |
| 5 | Custom CSS | `theme/custom-css.html` | CSS editor |
| 6 | Custom Scripts | `theme/custom-scripts.html` | JS editor |

### 8.17 SEO Management (4 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Meta Tags | `seo/meta-tags.html` | Meta tag editor |
| 2 | Sitemap | `seo/sitemap.html` | Sitemap generator |
| 3 | Redirects | `seo/redirects.html` | URL redirects |
| 4 | Schema | `seo/schema.html` | Structured data |

### 8.18 Settings (14 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Settings Hub | `settings-hub/index.html` | Settings navigation |
| 2 | Shipping Zones | `settings/shipping-zones.html` | Zone configuration |
| 3 | Shipping Methods | `settings/shipping-methods.html` | Carrier setup |
| 4 | Free Shipping | `settings/free-shipping.html` | Free shipping rules |
| 5 | Tax Rates | `settings/tax-rates.html` | Tax configuration |
| 6 | Tax Exemptions | `settings/tax-exemptions.html` | Tax exemptions |
| 7 | Payments | `settings/payments.html` | Payment gateways |
| 8 | Checkout | `settings/checkout.html` | Checkout options |
| 9 | Deposits | `settings/deposits.html` | Deposit settings |
| 10 | Lead Times | `settings/lead-times.html` | Production times |
| 11 | Units | `settings/units.html` | Measurement units |
| 12 | Locations | `settings/locations.html` | Business locations |
| 13 | Email Notifications | `settings/email-notifications.html` | Email settings |
| 14 | SMS Notifications | `settings/sms-notifications.html` | SMS settings |
| 15 | Admin Alerts | `settings/admin-alerts.html` | Alert configuration |

### 8.19 Security (9 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Security Center | `security/index.html` | Security dashboard |
| 2 | Users | `security/users.html` | Admin user management |
| 3 | Permissions | `security/permissions.html` | Role-based access |
| 4 | Two-Factor | `security/two-factor.html` | 2FA settings |
| 5 | Sessions | `security/sessions.html` | Active sessions |
| 6 | SSO | `security/sso.html` | Single sign-on |
| 7 | API Security | `security/api-security.html` | API keys |
| 8 | Firewall | `security/firewall.html` | IP blocking |
| 9 | Audit Logs | `security/audit-logs.html` | Activity logs |

### 8.20 Reports (17 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Reports Hub | `reports-hub/index.html` | Reports navigation |
| 2 | Sales Report | `reports/sales.html` | Sales analytics |
| 3 | Sales by Region | `reports/sales-by-region.html` | Regional breakdown |
| 4 | Products Report | `reports/products.html` | Product performance |
| 5 | Bestsellers | `reports/bestsellers.html` | Top products |
| 6 | Low Performers | `reports/low-performers.html` | Underperforming |
| 7 | Customers Report | `reports/customers.html` | Customer analytics |
| 8 | LTV Report | `reports/ltv.html` | Lifetime value |
| 9 | Cohorts | `reports/cohorts.html` | Cohort analysis |
| 10 | Profit Report | `reports/profit.html` | Profitability |
| 11 | Payments Report | `reports/payments.html` | Payment analytics |
| 12 | Discounts Report | `reports/discounts.html` | Discount usage |
| 13 | Production Report | `reports/production.html` | Manufacturing KPIs |
| 14 | Lead Time Report | `reports/lead-time.html` | Fulfillment times |
| 15 | Shipping Report | `reports/shipping.html` | Shipping analytics |
| 16 | Returns Report | `reports/returns.html` | Return rates |
| 17 | Sample Conversion | `reports/sample-conversion.html` | Sample to order |
| 18 | Config Trends | `reports/config-trends.html` | Configuration trends |
| 19 | Tax Reports | `tax-reports.html` | Tax reporting |

### 8.21 Integrations (2 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Apps | `integrations/apps.html` | Third-party apps |
| 2 | Import/Export | `integrations/import-export.html` | Data import/export |
| 3 | Bulk Import | `bulk-import.html` | Bulk data import |
| 4 | Webhooks | `webhooks.html` | Webhook management |

### 8.22 Compliance (2 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Backups | `compliance/backups.html` | Data backups |
| 2 | Data Export | `compliance/data-export.html` | GDPR exports |

### 8.23 Help (4 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Documentation | `help/docs.html` | Help docs |
| 2 | Support | `help/support.html` | Support tickets |
| 3 | Changelog | `help/changelog.html` | Version history |
| 4 | Status | `help/status.html` | System status |

### 8.24 Tools (3 pages)

| # | Page | File | Purpose |
|---|------|------|---------|
| 1 | Cache | `tools/cache.html` | Cache management |
| 2 | Performance | `tools/performance.html` | Performance monitor |
| 3 | Errors | `tools/errors.html` | Error logs |

---

## Summary by Section

| Section | Pages |
|---------|-------|
| Customer-Facing | 20 |
| Landing Pages | 9 |
| Guides | 5 |
| Policies | 7 |
| Dealer Portal | 6 |
| Technician Portal | 7 |
| Manufacturer Portal | 2 |
| Admin - Core | 8 |
| Admin - Catalog | 18 |
| Admin - Zebra | 3 |
| Admin - Orders | 12 |
| Admin - Production | 6 |
| Admin - Customers | 6 |
| Admin - Trade | 8 |
| Admin - Installations | 7 |
| Admin - Marketing | 18 |
| Admin - Pricing | 4 |
| Admin - Content | 15 |
| Admin - Guides | 6 |
| Admin - Policies | 5 |
| Admin - Navigation | 2 |
| Admin - Online Store | 5 |
| Admin - Theme | 6 |
| Admin - SEO | 4 |
| Admin - Settings | 15 |
| Admin - Security | 9 |
| Admin - Reports | 19 |
| Admin - Integrations | 4 |
| Admin - Compliance | 2 |
| Admin - Help | 4 |
| Admin - Tools | 3 |
| **TOTAL** | **245** |

---

## API Endpoint Summary

Each portal has its own authentication and API namespace:

| Portal | Auth Endpoint | API Prefix | Token Type |
|--------|---------------|------------|------------|
| Customer | `POST /api/customer/login` | `/api/customer/*` | `customer_token` |
| Dealer | `POST /api/dealer/login` | `/api/dealer/*` | `dealer_token` |
| Technician | `POST /api/technician/login` | `/api/technician/*` | `technician_token` |
| Manufacturer | `POST /api/manufacturer/login` | `/api/manufacturer/*` | `mfr_token` |
| Admin | `POST /api/admin/login` | `/api/admin/*` | `admin_token` |

---

*This document is auto-generated from the codebase. For detailed documentation of each page, see [COMPREHENSIVE_SYSTEM_DOCUMENTATION.md](COMPREHENSIVE_SYSTEM_DOCUMENTATION.md)*
