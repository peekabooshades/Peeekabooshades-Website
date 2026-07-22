

    // ============================================
    // DYNAMIC THEME LOADING FROM ADMIN PORTAL
    // ============================================

    // Load and apply theme settings from admin portal
    async function loadThemeSettings() {
      try {
        const slug = window.location.pathname.split('/').pop();

        // Load theme and content
        const response = await fetch(`/api/product-page-content/${slug}`);
        const result = await response.json();

        if (result.success) {
          applyTheme(result.data.theme);
          applyContent(result.data.content);
        }

        // Load layout settings from product page sections
        const layoutResponse = await fetch(`/api/product-page-sections/${slug}`);
        const layoutResult = await layoutResponse.json();

        if (layoutResult.success && layoutResult.layout) {
          applyLayout(layoutResult.layout);
        }
        // Apply CSS styles from admin
        if (layoutResult.success && layoutResult.styles) {
          applyCustomStyles(layoutResult.styles);
        }
        // Re-apply element styles AFTER custom styles to ensure they take priority
        if (layoutResult.success && layoutResult.layout && layoutResult.layout.elements) {
          applyElementStyles(layoutResult.layout.elements);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
        // Apply default theme on error
        applyDefaultTheme();
      }
    }

    // Apply custom CSS styles from admin
    function applyCustomStyles(styles) {
      if (!styles || Object.keys(styles).length === 0) return;

      const root = document.documentElement;

      // Page Background
      if (styles.pageBackground) {
        document.body.style.backgroundColor = styles.pageBackground;
        const section = document.querySelector('.product-detail-section');
        if (section) section.style.backgroundColor = styles.pageBackground;
      }

      // Title Styling
      const title = document.querySelector('.product-info h1, .product-title');
      if (title) {
        if (styles.titleFont) title.style.fontFamily = styles.titleFont + ', serif';
        if (styles.titleSize) title.style.fontSize = styles.titleSize;
        if (styles.titleColor) title.style.color = styles.titleColor;
        if (styles.titleWeight) title.style.fontWeight = styles.titleWeight;
      }

      // Body Text Styling
      const productInfo = document.querySelector('.product-info');
      if (productInfo) {
        if (styles.bodyFont) productInfo.style.fontFamily = styles.bodyFont + ', sans-serif';
        if (styles.bodySize) productInfo.style.fontSize = styles.bodySize;
        if (styles.bodyColor) {
          productInfo.querySelectorAll('p, .description').forEach(el => {
            el.style.color = styles.bodyColor;
          });
        }
      }

      // Price Styling
      const price = document.querySelector('.product-price, .price');
      if (price) {
        if (styles.priceSize) price.style.fontSize = styles.priceSize;
        if (styles.priceColor) price.style.color = styles.priceColor;
        if (styles.priceWeight) price.style.fontWeight = styles.priceWeight;
      }

      // Button Styling
      document.querySelectorAll('.add-to-cart-btn, .primary-btn, button[type="submit"]').forEach(btn => {
        if (styles.buttonBackground) btn.style.backgroundColor = styles.buttonBackground;
        if (styles.buttonColor) btn.style.color = styles.buttonColor;
        if (styles.buttonBorderRadius) btn.style.borderRadius = styles.buttonBorderRadius;
        if (styles.buttonPadding) btn.style.padding = styles.buttonPadding;
      });

      // Select Shades Dropdown Styling
      const selectShades = document.querySelector('.select-shades-dropdown, .select-shades-btn');
      if (selectShades) {
        if (styles.selectShadesBackground) selectShades.style.backgroundColor = styles.selectShadesBackground;
        if (styles.selectShadesBorder) selectShades.style.border = styles.selectShadesBorder;
        if (styles.selectShadesBorderRadius) selectShades.style.borderRadius = styles.selectShadesBorderRadius;
      }

      // Option Boxes Styling
      document.querySelectorAll('.option-section, .collapsible-header, .configurator-option').forEach(option => {
        if (styles.optionBackground) option.style.backgroundColor = styles.optionBackground;
        if (styles.optionBorder) option.style.border = styles.optionBorder;
        if (styles.optionBorderRadius) option.style.borderRadius = styles.optionBorderRadius;
        if (styles.optionPadding) option.style.padding = styles.optionPadding;
      });

      // Gallery Styling
      const gallery = document.querySelector('.product-gallery');
      if (gallery) {
        if (styles.galleryWidth) {
          gallery.style.width = styles.galleryWidth;
          // Update grid template
          const container = document.querySelector('.product-detail-container');
          if (container) {
            container.style.gridTemplateColumns = `${styles.galleryWidth} 1fr`;
          }
        }
        if (styles.galleryBorderRadius) {
          gallery.querySelectorAll('img, .main-image').forEach(img => {
            img.style.borderRadius = styles.galleryBorderRadius;
          });
        }
      }

      // Spacing
      if (styles.sectionSpacing) {
        document.querySelectorAll('.product-info > *').forEach(el => {
          el.style.marginBottom = styles.sectionSpacing;
        });
      }

      console.log('Custom styles applied:', styles);
    }

    // Apply layout settings from admin
    function applyLayout(layout) {
      const container = document.querySelector('.product-detail-container');
      if (!container) return;

      // Gallery Position: left or right
      if (layout.galleryPosition === 'right') {
        container.classList.add('layout-gallery-right');
      } else {
        container.classList.remove('layout-gallery-right');
      }

      // Sticky configurator
      const productInfo = document.querySelector('.product-info');
      if (productInfo && layout.stickyConfigurator) {
        productInfo.style.position = 'sticky';
        productInfo.style.top = '20px';
        productInfo.style.height = 'fit-content';
      }

      // Breadcrumbs visibility
      const breadcrumbs = document.querySelector('.breadcrumbs, .breadcrumb');
      if (breadcrumbs && layout.showBreadcrumbs === false) {
        breadcrumbs.style.display = 'none';
      }

      // Configurator style
      const dropdown = document.getElementById('selectShadesDropdown');
      if (dropdown && layout.configuratorStyle === 'expanded') {
        // Auto-expand the configurator
        dropdown.classList.add('expanded');
        const menu = dropdown.querySelector('.select-shades-menu');
        if (menu) menu.style.display = 'block';
      }

      // Apply element positions and alignments
      if (layout.elementPositions) {
        applyElementPositions(layout.elementPositions);
      }

      // Apply element visibility from layout builder (hide deleted/hidden elements)
      if (layout.elements && Array.isArray(layout.elements)) {
        applyElementVisibility(layout.elements);
        // Also apply element column positions (move elements between left/right)
        applyElementColumns(layout.elements);
        // Apply gallery images from layout builder
        applyGalleryImages(layout.elements);
        // Apply element typography and styling
        applyElementStyles(layout.elements);
      }

      console.log('Layout applied:', layout);
    }

    // Apply typography and styling settings to elements
    function applyElementStyles(elements) {
      // Apply price element styling
      const priceElement = elements.find(el => el.id === 'price');
      if (priceElement && priceElement.settings) {
        const settings = priceElement.settings;
        const priceContainerDiv = document.getElementById('priceContainer');
        const priceEl = document.querySelector('.product-price');
        const priceLabelEl = document.getElementById('priceLabel');

        // Apply price label settings
        if (priceLabelEl) {
          // Show/hide label
          if (settings.showPriceLabel === false || settings.priceLabelPosition === 'none') {
            priceLabelEl.style.display = 'none';
          } else {
            priceLabelEl.style.display = '';
            // Label text
            if (settings.priceLabelText) {
              priceLabelEl.textContent = settings.priceLabelText;
            }
            // Label font size
            if (settings.priceLabelFontSize) {
              priceLabelEl.style.fontSize = settings.priceLabelFontSize;
            }
            // Label color
            if (settings.priceLabelColor) {
              priceLabelEl.style.color = settings.priceLabelColor;
            }
          }
        }

        // Apply position (left or above)
        if (priceContainerDiv) {
          if (settings.priceLabelPosition === 'above') {
            priceContainerDiv.classList.add('position-above');
          } else {
            priceContainerDiv.classList.remove('position-above');
          }
        }

        // Apply price typography
        if (priceEl) {
          // Apply font family
          if (settings.priceFontFamily && settings.priceFontFamily !== 'inherit') {
            priceEl.style.fontFamily = settings.priceFontFamily;
          }
          // Apply font size
          if (settings.priceFontSize) {
            priceEl.style.fontSize = settings.priceFontSize;
          }
          // Apply font weight
          if (settings.priceFontWeight) {
            priceEl.style.fontWeight = settings.priceFontWeight;
          }
          // Apply color
          if (settings.priceColor) {
            priceEl.style.color = settings.priceColor;
          }
        }

        console.log('Price styles applied:', settings);
      }

      // Apply product title styling
      const titleElement = elements.find(el => el.id === 'productTitle');
      if (titleElement && titleElement.settings) {
        const settings = titleElement.settings;
        const titleEl = document.getElementById('productTitle');
        const descEl = document.getElementById('productDescription');
        const titleSection = titleEl?.closest('.product-title-section') || titleEl?.parentElement;

        // Apply title text from settings
        if (titleEl && settings.title) {
          titleEl.textContent = settings.title;
        }
        // Apply description text from settings
        if (descEl && settings.description) {
          descEl.textContent = settings.description;
        }

        // Title Typography
        if (titleEl) {
          // Font Family (use titleFontFamily or legacy fontFamily)
          if (settings.titleFontFamily || settings.fontFamily) {
            titleEl.style.setProperty('font-family', settings.titleFontFamily || settings.fontFamily, 'important');
          }
          // Font Size (use titleFontSize or legacy fontSize)
          if (settings.titleFontSize || settings.fontSize) {
            titleEl.style.setProperty('font-size', settings.titleFontSize || settings.fontSize, 'important');
          }
          // Font Weight
          if (settings.titleFontWeight) {
            titleEl.style.setProperty('font-weight', settings.titleFontWeight, 'important');
          }
          // Italic
          titleEl.style.setProperty('font-style', settings.titleItalic ? 'italic' : 'normal', 'important');
          // Underline
          titleEl.style.setProperty('text-decoration', settings.titleUnderline ? 'underline' : 'none', 'important');
          // Uppercase
          titleEl.style.setProperty('text-transform', settings.titleUppercase ? 'uppercase' : 'none', 'important');
          // Title Color (use titleColor or legacy fontColor)
          if (settings.titleColor || settings.fontColor) {
            titleEl.style.setProperty('color', settings.titleColor || settings.fontColor, 'important');
          }
          // Text Alignment
          if (settings.titleAlign) {
            titleEl.style.setProperty('text-align', settings.titleAlign, 'important');
          }
        }

        // Description Typography
        if (descEl) {
          if (settings.descFontFamily) {
            descEl.style.setProperty('font-family', settings.descFontFamily, 'important');
          }
          if (settings.descFontSize) {
            descEl.style.setProperty('font-size', settings.descFontSize, 'important');
          }
          if (settings.descColor) {
            descEl.style.setProperty('color', settings.descColor, 'important');
          }
          // Align description to match title
          if (settings.titleAlign) {
            descEl.style.setProperty('text-align', settings.titleAlign, 'important');
          }
        }

        // Background & Spacing (apply to title section container)
        if (titleSection) {
          // Background Color (respect transparent toggle)
          if (settings.backgroundTransparent) {
            titleSection.style.backgroundColor = 'transparent';
          } else if (settings.backgroundColor) {
            titleSection.style.backgroundColor = settings.backgroundColor;
          }
          // Padding
          if (settings.padding) {
            titleSection.style.padding = settings.padding;
          }
          // Border Radius
          if (settings.borderRadius) {
            titleSection.style.borderRadius = settings.borderRadius;
          }
        }

        console.log('Title styles applied:', settings);
      }

      // Apply addToCart button styling
      const addToCartElement = elements.find(el => el.id === 'addToCart');
      if (addToCartElement && addToCartElement.settings) {
        const settings = addToCartElement.settings;
        const addToCartBtn = document.querySelector('.add-to-cart-btn, #addToCartBtn');

        if (addToCartBtn) {
          if (settings.buttonColor) addToCartBtn.style.backgroundColor = settings.buttonColor;
          if (settings.buttonTextColor) addToCartBtn.style.color = settings.buttonTextColor;
          if (settings.fontFamily) addToCartBtn.style.fontFamily = settings.fontFamily;
          if (settings.fontSize) addToCartBtn.style.fontSize = settings.fontSize;
          if (settings.borderRadius) addToCartBtn.style.borderRadius = settings.borderRadius;
        }
      }
    }

    // Apply gallery images from layout builder settings
    function applyGalleryImages(elements) {
      const galleryElement = elements.find(el => el.id === 'gallery');
      if (!galleryElement || !galleryElement.settings || !galleryElement.settings.images) {
        console.log('No gallery images in layout settings');
        return;
      }

      const images = galleryElement.settings.images.filter(img => img && img.trim() !== '');
      if (images.length === 0) {
        console.log('No valid gallery images found');
        return;
      }

      console.log('Applying gallery images from layout:', images);

      const mainImageEl = document.getElementById('mainProductImage');
      const thumbnailColumn = document.querySelector('.thumbnail-column');

      // Update main image
      if (mainImageEl && images[0]) {
        mainImageEl.src = images[0];
        mainImageEl.alt = 'Product Image';
      }

      // Update thumbnails
      if (thumbnailColumn && images.length > 0) {
        thumbnailColumn.innerHTML = images.slice(0, 5).map((img, i) => `
          <div class="thumb-item ${i === 0 ? 'active' : ''}" onclick="changeImage(this, '${img}')">
            <img src="${img}" alt="Thumbnail ${i + 1}">
          </div>
        `).join('');
      }

      console.log('Gallery images applied successfully');
    }

    // Move elements to left or right column based on layout settings
    function applyElementColumns(elements) {
      const leftColumn = document.querySelector('.product-gallery, .gallery-section');
      const rightColumn = document.querySelector('.product-info, .configurator-section');

      if (!leftColumn || !rightColumn) {
        console.log('Columns not found for element repositioning');
        return;
      }

      // Element ID to DOM selector mapping
      const elementSelectors = {
        selectShades: '#selectShadesDropdown, .select-shades-dropdown',
        productTitle: '#productTitle, .product-info h1',
        price: '#priceContainer, #productPrice, .product-price-container, .product-price',
        features: '.feature-badges, .product-features',
        trustBadges: '#trustBadges, .trust-badges',
        configurator: '.configurator-options, .collapsible-sections',
        addToCart: '#addToCartBtn, .add-to-cart-btn',
        requestQuote: '.request-quote-btn',
        quantity: '.quantity-selector'
      };

      // Find elements that should be in the left column (not gallery)
      elements.forEach(element => {
        if (element.deleted || element.hidden) return;
        if (element.id === 'gallery') return; // Gallery is fixed

        const selector = elementSelectors[element.id];
        if (!selector) return;

        const el = document.querySelector(selector);
        if (!el) return;

        // If element should be in left column but is currently in right
        if (element.column === 'left' && rightColumn.contains(el)) {
          // Move to left column (after gallery)
          leftColumn.appendChild(el);
          el.style.marginTop = '20px';
          console.log(`Moved ${element.id} to left column`);
        }
        // If element should be in right column but is in left
        else if (element.column === 'right' && leftColumn.contains(el)) {
          rightColumn.appendChild(el);
          console.log(`Moved ${element.id} to right column`);
        }
      });
    }

    // Apply element visibility based on layout builder settings
    function applyElementVisibility(elements) {
      console.log('Applying element visibility for:', elements.length, 'elements');

      // Map element IDs to their DOM selectors (multiple selectors for each element)
      const elementSelectors = {
        selectShades: ['#selectShadesDropdown', '.select-shades-dropdown', '.select-shades-btn'],
        productTitle: ['#productTitle', '.product-title-section', '.product-info h1'],
        price: ['#priceContainer', '#productPrice', '.product-price-container', '.product-price', '.price-section', '.price-display'],
        features: ['#productFeatures', '.product-features', '.feature-badges', '.features-list'],
        trustBadges: ['#trustBadges', '.trust-badges', '.trust-section', '.guarantee-badges'],
        configurator: ['.configurator-options', '.option-section', '.shade-configurator', '.collapsible-sections'],
        addToCart: ['#addToCartBtn', '.add-to-cart-btn', '.cart-button'],
        requestQuote: ['#requestQuoteBtn', '.request-quote-btn', '.quote-button'],
        buyWithShopPay: ['.shop-pay-section', '.express-checkout', '.payment-buttons'],
        quantity: ['#quantitySection', '.quantity-selector', '.quantity-input', '.qty-wrapper'],
        productDetails: ['.product-details-section', '.product-details-accordion', '.product-details-container'],
        specifications: ['.product-specifications', '.specs-section', '.product-details-section .product-details-accordion:nth-child(2)'],
        reviews: ['#reviewsSection', '.customer-reviews', '.reviews-section'],
        deliveryInfo: ['#deliverySection', '.delivery-info', '.shipping-info']
      };

      // Create a style element for hiding elements (more reliable than inline styles)
      let hideStyle = document.getElementById('admin-hide-styles');
      if (!hideStyle) {
        hideStyle = document.createElement('style');
        hideStyle.id = 'admin-hide-styles';
        document.head.appendChild(hideStyle);
      }

      let cssRules = '';

      elements.forEach(element => {
        // Check if element is hidden or deleted
        if (element.hidden === true || element.deleted === true) {
          const selectors = elementSelectors[element.id];
          if (selectors && Array.isArray(selectors)) {
            // Add CSS rules to hide elements
            selectors.forEach(selector => {
              cssRules += `${selector} { display: none !important; visibility: hidden !important; }\n`;
            });

            // Also try to hide via JavaScript
            selectors.forEach(selector => {
              try {
                const foundElements = document.querySelectorAll(selector);
                foundElements.forEach(el => {
                  el.style.setProperty('display', 'none', 'important');
                  el.style.setProperty('visibility', 'hidden', 'important');
                  el.setAttribute('data-hidden-by-admin', 'true');
                });
                if (foundElements.length > 0) {
                  console.log(`Hidden ${foundElements.length} element(s) for ${element.id} using: ${selector}`);
                }
              } catch (e) {
                console.warn(`Error hiding ${element.id}:`, e);
              }
            });
          }
        }
      });

      // Apply CSS rules
      hideStyle.textContent = cssRules;
      if (cssRules) {
        console.log('Applied CSS hide rules:', cssRules);
      }
    }

    // Apply element positions (order and alignment)
    function applyElementPositions(positions) {
      const productInfo = document.querySelector('.product-info');
      if (!productInfo) return;

      // Map element keys to their DOM selectors
      const elementMap = {
        selectShades: '#selectShadesDropdown, .select-shades-dropdown',
        productTitle: '#productTitle, .product-title-section, .product-info > h1:first-of-type',
        price: '#priceContainer, #productPrice, .product-price-container, .product-price, .price-display',
        features: '#productFeatures, .feature-badges, .product-features',
        trustBadges: '#trustBadges, .trust-badges, .guarantee-badges',
        configurator: '.configurator-options, .product-options, .collapsible-sections'
      };

      // Apply alignment to each element
      Object.entries(positions).forEach(([key, config]) => {
        const selectors = elementMap[key];
        if (!selectors) return;

        // Try each selector
        selectors.split(', ').forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            // Create a wrapper div if needed for proper alignment
            let wrapper = el.parentElement;

            // For Select Shades, we need special handling
            if (key === 'selectShades') {
              // Make sure the element displays as a block for alignment to work
              el.style.display = 'block';
              el.style.width = 'fit-content';

              if (config.align === 'center') {
                el.style.marginLeft = 'auto';
                el.style.marginRight = 'auto';
              } else if (config.align === 'right') {
                el.style.marginLeft = 'auto';
                el.style.marginRight = '0';
                el.style.float = 'right';
              } else {
                el.style.marginLeft = '0';
                el.style.marginRight = 'auto';
                el.style.float = 'none';
              }
              console.log(`Applied ${config.align} alignment to selectShades`);
            } else {
              // Standard alignment for other elements
              if (config.align === 'center') {
                el.style.textAlign = 'center';
                el.style.marginLeft = 'auto';
                el.style.marginRight = 'auto';
              } else if (config.align === 'right') {
                el.style.textAlign = 'right';
                el.style.marginLeft = 'auto';
                el.style.marginRight = '0';
              } else {
                el.style.textAlign = 'left';
                el.style.marginLeft = '0';
                el.style.marginRight = 'auto';
              }
            }

            // Apply order for flexbox/grid ordering
            if (config.order) {
              el.style.order = config.order;
            }
          });
        });
      });

      // Reorder elements within product-info based on order values
      reorderProductInfoElements(positions);
    }

    // Reorder elements within the product-info container
    // Note: This uses CSS order property which only works with flex/grid layouts
    // For now, we'll only apply alignment without reordering to avoid breaking the layout
    function reorderProductInfoElements(positions) {
      // Disabled DOM reordering to prevent layout issues
      // The element order will stay as defined in HTML
      // Only alignment is applied via applyElementPositions()
      console.log('Element positions configured:', positions);
    }

    // Apply theme colors and fonts to CSS variables
    function applyTheme(theme) {
      const root = document.documentElement;

      // Apply colors
      if (theme.colors) {
        root.style.setProperty('--golden-brown', theme.colors.primary || '#8E6545');
        root.style.setProperty('--golden-brown-dark', theme.colors.primaryDark || '#7A5539');
        root.style.setProperty('--dark-brown', theme.colors.primary || '#8E6545');
        root.style.setProperty('--text-dark', theme.colors.textDark || '#333333');
        root.style.setProperty('--text-brown', theme.colors.primary || '#8E6545');
        root.style.setProperty('--text-light', theme.colors.textLight || '#666666');
        root.style.setProperty('--text-muted', theme.colors.textMuted || '#999999');
        root.style.setProperty('--bg-cream', theme.colors.bgCream || '#F8F6F3');
        root.style.setProperty('--bg-light', theme.colors.bgLight || '#FAFAFA');
        root.style.setProperty('--bg-white', theme.colors.bgWhite || '#FFFFFF');
        root.style.setProperty('--border-light', theme.colors.borderLight || '#E8E8E8');
        root.style.setProperty('--border-medium', theme.colors.borderMedium || '#D4D4D4');
        root.style.setProperty('--success-green', theme.colors.success || '#28a745');
        root.style.setProperty('--error-red', theme.colors.error || '#dc3545');

        // Update body background color
        document.body.style.backgroundColor = theme.colors.secondary || '#F6F1EB';
        document.body.style.color = theme.colors.primary || '#8E6545';
      }

      // Apply fonts
      if (theme.fonts) {
        // Load custom font if URL provided
        if (theme.fonts.primary?.url) {
          loadFont(theme.fonts.primary.url);
        }
        if (theme.fonts.primary?.family) {
          document.body.style.fontFamily = `'${theme.fonts.primary.family}', sans-serif`;
        }
        if (theme.fonts.sizes?.base) {
          document.body.style.fontSize = theme.fonts.sizes.base;
        }
      }
    }

    // Load external font
    function loadFont(url) {
      if (!url) return;
      const existingLink = document.querySelector(`link[href="${url}"]`);
      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
      }
    }

    // Apply content from admin portal
    function applyContent(content) {
      // Apply header content
      if (content.header) {
        const logoText = document.querySelector('.logo-text');
        if (logoText && content.header.logoText) {
          logoText.innerHTML = content.header.logoText.replace(' ', '<span> ') + '</span>';
        }
      }

      // Apply top bar content
      if (content.topBar) {
        const phoneEl = document.querySelector('.top-bar-left span:first-child');
        const emailEl = document.querySelector('.top-bar-left span:last-child');
        if (phoneEl && content.topBar.phone) {
          phoneEl.innerHTML = `<i class="fas fa-phone-alt"></i> ${content.topBar.phone}`;
        }
        if (emailEl && content.topBar.email) {
          emailEl.innerHTML = `<i class="fas fa-envelope"></i> ${content.topBar.email}`;
        }
      }

      // Apply footer content
      if (content.footer) {
        const copyrightEl = document.querySelector('.footer-copyright');
        if (copyrightEl && content.footer.copyright) {
          copyrightEl.textContent = content.footer.copyright;
        }
      }

      // Apply trust badges
      if (content.trustBadges && content.trustBadges.length > 0) {
        const trustBadgesContainer = document.querySelector('.trust-badges');
        if (trustBadgesContainer) {
          trustBadgesContainer.innerHTML = content.trustBadges.map(badge => `
            <div class="trust-badge">
              <i class="fas ${badge.icon}"></i>
              <span>${badge.title}</span>
            </div>
          `).join('');
        }
      }
    }

    // Apply default theme when API fails
    function applyDefaultTheme() {
      const root = document.documentElement;
      root.style.setProperty('--golden-brown', '#8E6545');
      root.style.setProperty('--golden-brown-dark', '#7A5539');
      root.style.setProperty('--dark-brown', '#8E6545');
    }

    // Zoom Modal Functions
    function openZoomModal(imageSrc, caption) {
      const modal = document.getElementById('zoomModal');
      const image = document.getElementById('zoomModalImage');
      const captionEl = document.getElementById('zoomModalCaption');

      image.src = imageSrc;
      captionEl.textContent = caption;
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeZoomModal() {
      const modal = document.getElementById('zoomModal');
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }

    // Close modal on background click
    document.getElementById('zoomModal')?.addEventListener('click', function(e) {
      if (e.target === this) closeZoomModal();
    });

    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeZoomModal();
    });

    // Product data
    let product = null;
    let basePrice = 40.00;

    // Product options loaded from database
    let productOptionsData = null;

    // Manufacturer data
    let manufacturersData = [];
    let selectedManufacturer = null;
    let manufacturerPricingAvailable = true;

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
      // Load theme settings first
      loadThemeSettings();

      loadProduct();
      loadProductOptions(); // Load options from database
      loadManufacturers(); // Load manufacturers for dropdown
      loadTrendingProducts();
      updateCartCount();
      updateDimensionsValue();

      // Add click handlers for all fabric swatches
      document.querySelectorAll('.fabric-swatch').forEach(swatch => {
        swatch.addEventListener('click', function(event) {
          selectFabricSwatch(this, event);
        });
      });
    });

    // Store motor brands data globally
    let motorBrandsData = [];

    // Load product options from database and update DOM
    async function loadProductOptions() {
      const slug = window.location.pathname.split('/').pop();

      try {
        const response = await fetch(`/api/products/${slug}/options`);
        const result = await response.json();

        if (result.success && result.options) {
          productOptionsData = result.options;
          console.log('Product options loaded:', productOptionsData);

          // Store motor brands if available
          if (result.motorBrands && result.motorBrands.length > 0) {
            motorBrandsData = result.motorBrands;
            console.log('Motor brands loaded:', motorBrandsData);
          }

          renderDynamicOptions();
        }
      } catch (error) {
        console.error('Error loading product options:', error);
        // Keep default hardcoded options if API fails
      }
    }

    // Render dynamic options based on database data
    function renderDynamicOptions() {
      if (!productOptionsData) return;

      // Update Mount Type options
      if (productOptionsData.mountType) {
        renderOptionSwatches('mountTypeSwatches', productOptionsData.mountType.options, 'mountType', true);
      }

      // Update Control Type options
      if (productOptionsData.controlType) {
        renderOptionSwatches('controlTypeSwatches', productOptionsData.controlType.options, 'controlType', true, true);
      }

      // Update Remote Type options with dynamic prices
      if (productOptionsData.remoteType) {
        renderRemoteTypeOptions('remoteTypeSwatches', productOptionsData.remoteType.options);
      }

      // Update Solar Panel options with dynamic prices
      if (productOptionsData.solarPanel) {
        renderSolarPanelOptions('solarTypeSwatches', productOptionsData.solarPanel.options);
      }

      // Update Motor Brands dynamically
      if (motorBrandsData && motorBrandsData.length > 0) {
        renderMotorBrandsOptions('motorBrandSwatches', motorBrandsData);
      }

      // Update Valance Type (Cassette) options with priceType support
      if (productOptionsData.valanceType) {
        renderPricedOptions('cassetteSwatches', productOptionsData.valanceType.options, 'cassette', 'large');
      }

      // Update Bottom Rail options with priceType support
      if (productOptionsData.bottomRail) {
        renderPricedOptions('bottomBarSwatches', productOptionsData.bottomRail.options, 'bottomBar', 'medium');
      }

      // Update Roller Type options
      if (productOptionsData.rollerType) {
        renderOptionSwatches('rollerTypeSwatches', productOptionsData.rollerType.options, 'rollerType', true, false, 'medium', true);
      }

      // Update Side Cover options
      if (productOptionsData.sideCover) {
        renderSideCoverOptions('sideCoverSwatches', productOptionsData.sideCover.options);
      }

      // Update Accessories
      if (productOptionsData.accessories) {
        renderAccessoriesOptions(productOptionsData.accessories.options);
        // Update accessory prices for calculation
        updateAccessoryPrices();
      }

      // Recalculate price after options are rendered
      calculatePrice();

      // Apply initial Control Type state (Manual is default - hide motorized options)
      applyControlTypeRules();
    }

    // Load manufacturers from API
    async function loadManufacturers() {
      const manufacturerContainer = document.getElementById('manufacturerOptions');
      if (!manufacturerContainer) return;

      // Determine product type from URL or product data
      const slug = window.location.pathname.split('/').pop();
      let productType = 'roller'; // Default

      if (slug.includes('zebra')) {
        productType = 'zebra';
      } else if (slug.includes('honeycomb') || slug.includes('cellular')) {
        productType = 'honeycomb';
      } else if (slug.includes('roman')) {
        productType = 'roman';
      }

      try {
        const response = await fetch(`/api/manufacturers?productType=${productType}`);
        const result = await response.json();

        if (result.success && result.manufacturers) {
          manufacturersData = result.manufacturers;
          console.log('Manufacturers loaded:', manufacturersData);
          renderManufacturerOptions(manufacturersData, productType);
        } else {
          manufacturerContainer.innerHTML = '<div style="padding: 15px; color: #666; text-align: center;">No manufacturers available</div>';
        }
      } catch (error) {
        console.error('Error loading manufacturers:', error);
        manufacturerContainer.innerHTML = '<div style="padding: 15px; color: #dc3545; text-align: center;">Error loading manufacturers</div>';
      }
    }

    // Render manufacturer options
    function renderManufacturerOptions(manufacturers, productType) {
      const container = document.getElementById('manufacturerOptions');
      if (!container) return;

      if (!manufacturers || manufacturers.length === 0) {
        container.innerHTML = '<div style="padding: 15px; color: #666; text-align: center;">No manufacturers available for this product type</div>';
        return;
      }

      let html = '';
      manufacturers.forEach((mfr, index) => {
        const isAvailable = mfr.pricingLinked === true;
        const isFirst = index === 0 && isAvailable;

        html += `
          <div class="manufacturer-option ${isFirst ? 'selected' : ''} ${!isAvailable ? 'coming-soon' : ''}"
               data-manufacturer-id="${mfr.id}"
               data-pricing-linked="${isAvailable}"
               onclick="selectManufacturer('${mfr.id}', ${isAvailable})">
            <div class="manufacturer-info">
              <div class="manufacturer-name">
                ${mfr.name}
                <span class="manufacturer-badge ${isAvailable ? 'available' : 'coming-soon'}">
                  ${isAvailable ? 'Available' : 'Coming Soon'}
                </span>
              </div>
              <div class="manufacturer-meta">
                ${isAvailable ? `Lead time: ${mfr.leadTimeDays || 14} days` : 'Pricing not yet configured'}
              </div>
            </div>
            <div class="manufacturer-radio"></div>
          </div>
        `;
      });

      container.innerHTML = html;

      // Auto-select the first available manufacturer
      const firstAvailable = manufacturers.find(m => m.pricingLinked === true);
      if (firstAvailable) {
        selectedManufacturer = firstAvailable;
        manufacturerPricingAvailable = true;
        updateManufacturerValue(firstAvailable.name);
        document.getElementById('manufacturerComingSoon').style.display = 'none';
      } else {
        // No manufacturer with pricing, show coming soon
        manufacturerPricingAvailable = false;
        updateManufacturerValue('Coming Soon');
        showManufacturerComingSoon(manufacturers[0]);
      }
    }

    // Select a manufacturer
    function selectManufacturer(manufacturerId, pricingAvailable) {
      const manufacturer = manufacturersData.find(m => m.id === manufacturerId);
      if (!manufacturer) return;

      // Update UI selection
      document.querySelectorAll('.manufacturer-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      document.querySelector(`.manufacturer-option[data-manufacturer-id="${manufacturerId}"]`)?.classList.add('selected');

      selectedManufacturer = manufacturer;
      manufacturerPricingAvailable = pricingAvailable;

      if (pricingAvailable) {
        // Pricing is available
        updateManufacturerValue(manufacturer.name);
        document.getElementById('manufacturerComingSoon').style.display = 'none';
        // Recalculate price with selected manufacturer
        calculatePrice();
      } else {
        // Pricing not available - show coming soon
        updateManufacturerValue(manufacturer.name + ' (Coming Soon)');
        showManufacturerComingSoon(manufacturer);
      }
    }

    // Show coming soon message for manufacturer
    function showManufacturerComingSoon(manufacturer) {
      const banner = document.getElementById('manufacturerComingSoon');
      const message = document.getElementById('comingSoonMessage');
      if (banner && message) {
        message.textContent = `${manufacturer.name} pricing will be available soon. Please select another manufacturer or check back later.`;
        banner.style.display = 'block';
      }

      // Update price display to show Coming Soon
      const priceElement = document.querySelector('.price');
      if (priceElement) {
        priceElement.innerHTML = '<span style="color: #8E6545;">Coming Soon</span>';
      }
    }

    // Update the manufacturer selected value display
    function updateManufacturerValue(value) {
      const el = document.getElementById('manufacturerValue');
      if (el) el.textContent = value;
    }

    // Apply Control Type rules - call on page load and when control type changes
    function applyControlTypeRules() {
      const selectedControlType = document.querySelector('#controlTypeSwatches .hardware-option.selected');
      if (!selectedControlType) return;

      const controlType = selectedControlType.getAttribute('data-value') || 'manual';

      const chainLocationGroup = document.getElementById('chainLocationGroup');
      const chainTypeGroup = document.getElementById('chainTypeGroup');
      const motorBrandGroup = document.getElementById('motorBrandGroup');
      const motorizedLocationGroup = document.getElementById('motorizedLocationGroup');
      const motorTypeGroup = document.getElementById('motorTypeGroup');
      const remoteTypeGroup = document.getElementById('remoteTypeGroup');
      const solarPanelGroup = document.getElementById('solarPanelGroup');

      // Helper to show group
      function showGroup(group) {
        if (group) {
          group.style.display = 'block';
          group.style.opacity = '1';
          group.style.pointerEvents = 'auto';
        }
      }

      // Helper to hide group
      function hideGroup(group) {
        if (group) {
          group.style.display = 'none';
          group.style.opacity = '0.5';
          group.style.pointerEvents = 'none';
        }
      }

      if (controlType === 'motorized') {
        // MOTORIZED: Show motor options, hide chain
        showGroup(motorBrandGroup);
        showGroup(motorizedLocationGroup);
        showGroup(motorTypeGroup);
        showGroup(remoteTypeGroup);
        showGroup(solarPanelGroup);
        hideGroup(chainLocationGroup);
        hideGroup(chainTypeGroup);
      } else if (controlType === 'manual') {
        // MANUAL: Show chain, hide all motor options
        showGroup(chainLocationGroup);
        showGroup(chainTypeGroup);
        hideGroup(motorBrandGroup);
        hideGroup(motorizedLocationGroup);
        hideGroup(motorTypeGroup);
        hideGroup(remoteTypeGroup);
        hideGroup(solarPanelGroup);
      } else {
        // CORDLESS: Hide ALL options
        hideGroup(chainLocationGroup);
        hideGroup(chainTypeGroup);
        hideGroup(motorBrandGroup);
        hideGroup(motorizedLocationGroup);
        hideGroup(motorTypeGroup);
        hideGroup(remoteTypeGroup);
        hideGroup(solarPanelGroup);
      }
    }

    // Render Motor Brands dynamically from API
    function renderMotorBrandsOptions(containerId, brands) {
      const container = document.getElementById(containerId);
      if (!container || !brands || brands.length === 0) return;

      container.innerHTML = brands.map((brand, index) => {
        const isSelected = index === 0 ? 'selected' : '';
        const bgColor = index === 0 ? '#8E6545' : 'transparent';
        const textColor = index === 0 ? '#FFFFFF' : '#333';
        const borderColor = index === 0 ? '#8E6545' : '#D4D4D4';
        const priceDisplay = brand.priceType === 'sqm' ? `from $${brand.price.toFixed(2)}/m²` : `from $${brand.price.toFixed(0)}`;

        return `
          <button type="button" class="motor-brand-btn ${isSelected}" data-value="${brand.value}" data-price="${brand.price}" data-price-type="${brand.priceType || 'flat'}" onclick="selectMotorBrand(this)" style="padding: 12px 24px; border: 2px solid ${borderColor}; border-radius: 8px; background: ${bgColor}; color: ${textColor}; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
            ${brand.label} (${priceDisplay})
          </button>
        `;
      }).join('');
    }

    // Render Remote Type options dynamically
    function renderRemoteTypeOptions(containerId, options) {
      const container = document.getElementById(containerId);
      if (!container || !options || options.length === 0) return;

      container.innerHTML = options.map((opt, index) => {
        const isSelected = opt.isDefault ? 'selected' : '';
        const bgColor = opt.isDefault ? '#8E6545' : 'transparent';
        const textColor = opt.isDefault ? '#FFFFFF' : '#333';
        const borderColor = opt.isDefault ? '#8E6545' : '#D4D4D4';
        const priceDisplay = opt.price > 0 ? ` (+$${opt.price.toFixed(2)})` : '';

        return `
          <button type="button" class="remote-btn ${isSelected}" data-value="${opt.value}" data-price="${opt.price || 0}" onclick="selectRemoteType(this)" style="padding: 12px 24px; border: 2px solid ${borderColor}; border-radius: 8px; background: ${bgColor}; color: ${textColor}; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
            ${opt.name}${priceDisplay}
          </button>
        `;
      }).join('');
    }

    // Render Solar Panel options with dynamic prices
    function renderSolarPanelOptions(containerId, options) {
      const container = document.getElementById(containerId);
      if (!container || !options || options.length === 0) return;

      container.innerHTML = options.map(opt => {
        const isSelected = opt.isDefault ? 'selected' : '';
        const bgColor = opt.isDefault ? '#8E6545' : 'transparent';
        const textColor = opt.isDefault ? '#FFFFFF' : '#333';
        const borderColor = opt.isDefault ? '#8E6545' : '#D4D4D4';
        const priceDisplay = opt.price > 0 ? ` (+$${opt.price.toFixed(2)})` : '';

        return `
          <button type="button" class="solar-btn ${isSelected}" data-value="${opt.value}" data-price="${opt.price || 0}" onclick="selectSolarType(this)" style="padding: 12px 32px; border: 2px solid ${borderColor}; border-radius: 8px; background: ${bgColor}; color: ${textColor}; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
            ${opt.name}${priceDisplay}
          </button>
        `;
      }).join('');
    }

    // Render options with priceType support (valance, bottom rail)
    function renderPricedOptions(containerId, options, optionType, size = 'normal') {
      const container = document.getElementById(containerId);
      if (!container || !options || options.length === 0) return;

      let imgWidth = '100px', imgHeight = '80px';
      if (size === 'large') { imgWidth = '150px'; imgHeight = '120px'; }
      if (size === 'medium') { imgWidth = '120px'; imgHeight = '80px'; }

      container.innerHTML = options.map(opt => {
        const isSelected = opt.isDefault ? 'selected' : '';
        const borderStyle = opt.isDefault ? '3px solid #8E6545' : '2px solid #E5E5E5';

        // Handle per-sqm pricing display
        let priceText = '';
        if (opt.price > 0) {
          if (opt.priceType === 'sqm') {
            priceText = `<br>(+$${opt.price.toFixed(2)}/m²)`;
          } else {
            priceText = `<br>(+$${opt.price.toFixed(0)})`;
          }
        }

        return `
          <div class="hardware-option ${isSelected}" data-value="${opt.value}" data-price="${opt.price || 0}" data-price-type="${opt.priceType || 'flat'}" onclick="selectHardwareOption(this, '${optionType}', event)" style="text-align: center; cursor: pointer;">
            <div style="width: ${imgWidth}; height: ${imgHeight}; border-radius: 8px; overflow: visible; border: ${borderStyle}; background: #f5f5f5; margin-bottom: 8px; display: flex; align-items: center; justify-content: center;">
              ${opt.image ? `<img src="${opt.image}" alt="${opt.name}" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : ''}
            </div>
            <span style="font-size: 12px; color: #666;">${opt.name}${priceText}</span>
          </div>
        `;
      }).join('');
    }

    // Generic function to render option swatches
    function renderOptionSwatches(containerId, options, optionType, hasImage = true, isControlType = false, size = 'normal', hasDescription = false) {
      const container = document.getElementById(containerId);
      if (!container || !options || options.length === 0) return;

      // Determine sizes based on type
      let imgWidth = '100px', imgHeight = '80px';
      if (size === 'large') { imgWidth = '150px'; imgHeight = '120px'; }
      if (size === 'medium') { imgWidth = '120px'; imgHeight = '80px'; }

      container.innerHTML = options.map((opt, index) => {
        const isSelected = opt.isDefault ? 'selected' : '';
        const borderStyle = opt.isDefault ? '3px solid #8E6545' : '2px solid #E5E5E5';
        const priceText = opt.price > 0 ? ` (+$${opt.price.toFixed(0)})` : '';

        const clickHandler = isControlType
          ? `onclick="selectControlType(this, event)"`
          : `onclick="selectHardwareOption(this, '${optionType}', event)"`;

        return `
          <div class="hardware-option ${isSelected}" data-value="${opt.value}" data-price="${opt.price}" ${clickHandler} style="text-align: center; cursor: pointer;">
            ${hasImage && opt.image ? `
              <div style="width: ${imgWidth}; height: ${imgHeight}; border-radius: 8px; overflow: hidden; border: ${borderStyle}; background: #ffffff; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; padding: 4px;">
                <img src="${opt.image}" alt="${opt.name}" style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;">
              </div>
            ` : ''}
            <span style="font-size: 11px; color: #333; font-weight: 500;">${opt.name}${priceText}</span>
            ${hasDescription && opt.description ? `<br><span style="font-size: 9px; color: #888;">${opt.description}</span>` : ''}
          </div>
        `;
      }).join('');
    }

    // Render side cover color options
    function renderSideCoverOptions(containerId, options) {
      const container = document.getElementById(containerId);
      if (!container || !options || options.length === 0) return;

      container.innerHTML = options.map(opt => {
        const isSelected = opt.isDefault ? 'selected' : '';
        const borderStyle = opt.isDefault ? '3px solid #8E6545' : '2px solid #E5E5E5';

        return `
          <div class="hardware-option ${isSelected}" data-value="${opt.value}" data-price="${opt.price}" onclick="selectHardwareOption(this, 'sideCover', event)" style="text-align: center; cursor: pointer;">
            <div style="width: 60px; height: 45px; border-radius: 8px; overflow: hidden; border: ${borderStyle}; background: ${opt.color || '#FFFFFF'}; margin-bottom: 8px;"></div>
            <span style="font-size: 11px; color: #666;">${opt.name}</span>
          </div>
        `;
      }).join('');
    }

    // Render accessories options
    function renderAccessoriesOptions(options) {
      const grid = document.querySelector('.accessories-grid');
      if (!grid || !options || options.length === 0) return;

      grid.innerHTML = options.map(opt => {
        const optionId = opt.value.replace(/[^a-zA-Z0-9]/g, '');
        return `
          <div class="accessory-item" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; background: #ffffff; border-radius: 12px; border: 1px solid #e5e5e5; transition: all 0.2s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #f5ebe0 0%, #e8ddd0 100%); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8E6545" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
                </svg>
              </div>
              <div>
                <span style="font-size: 14px; font-weight: 600; color: #333; display: block;">${opt.name}</span>
                <span style="font-size: 12px; color: #8E6545; font-weight: 600;">$${opt.price.toFixed(2)}</span>
              </div>
            </div>
            <div class="accessory-qty" style="display: flex; align-items: center; gap: 8px;">
              <button onclick="changeAccessoryQty('${optionId}', -1)" style="width: 32px; height: 32px; border: 1px solid #8E6545; border-radius: 8px; background: #fff; cursor: pointer; font-size: 18px; color: #8E6545; transition: all 0.2s;">−</button>
              <input type="number" id="${optionId}Qty" value="0" min="0" max="${opt.maxQty || 10}" onchange="calculatePrice()" style="width: 45px; height: 32px; border: 1px solid #8E6545; border-radius: 8px; text-align: center; font-size: 14px; font-weight: 600; color: #8E6545;">
              <button onclick="changeAccessoryQty('${optionId}', 1)" style="width: 32px; height: 32px; border: 1px solid #8E6545; border-radius: 8px; background: #fff; cursor: pointer; font-size: 18px; color: #8E6545; transition: all 0.2s;">+</button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Load product
    async function loadProduct() {
      const slug = window.location.pathname.split('/').pop();

      try {
        const response = await fetch(`/api/products/${slug}`);
        const result = await response.json();

        if (result.success) {
          product = result.data;

          // Check if product is available
          if (!product.is_active || product.is_discontinued) {
            showProductUnavailable(product);
            return;
          }

          displayProduct(product);

          // TICKET 015: Track product view
          if (typeof trackEvent === 'function') {
            trackEvent('product_view', {
              productId: product.id,
              productName: product.name,
              product_id: product.id,
              product_name: product.name
            });
          }

          // Check stock status
          if (product.stock_status === 'out_of_stock') {
            showOutOfStock();
          }
        } else {
          showProductUnavailable(null);
        }
      } catch (error) {
        console.error('Error loading product:', error);
        showProductUnavailable(null);
      }

      calculatePrice();
    }

    // Show product unavailable message
    function showProductUnavailable(product) {
      const mainContent = document.querySelector('.product-page-container');
      if (mainContent) {
        mainContent.innerHTML = `
          <div style="text-align: center; padding: 100px 20px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="none" viewBox="0 0 24 24" stroke="#999" style="margin-bottom: 20px;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
            </svg>
            <h1 style="font-size: 28px; color: #333; margin-bottom: 15px;">Product Unavailable</h1>
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
              ${product ? 'This product has been discontinued or is no longer available.' : 'The product you are looking for could not be found.'}
            </p>
            <a href="/shop" style="display: inline-block; padding: 12px 30px; background: #8E6545; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Browse Our Products
            </a>
          </div>
        `;
      }
    }

    // Show out of stock message and disable Add to Cart
    function showOutOfStock() {
      const addToCartBtn = document.querySelector('.btn-add-cart');
      if (addToCartBtn) {
        addToCartBtn.disabled = true;
        addToCartBtn.style.opacity = '0.5';
        addToCartBtn.style.cursor = 'not-allowed';
        addToCartBtn.innerHTML = '<i class="fas fa-times-circle"></i> Out of Stock';
        addToCartBtn.onclick = function(e) {
          e.preventDefault();
          showToast('This product is currently out of stock', 'error');
        };
      }

      // Add out of stock banner
      const priceSection = document.querySelector('.price-section') || document.querySelector('.total-price');
      if (priceSection) {
        const banner = document.createElement('div');
        banner.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 12px 16px; border-radius: 6px; margin-top: 15px; text-align: center; font-weight: 500;';
        banner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> This product is currently out of stock. Please check back later.';
        priceSection.parentNode.insertBefore(banner, priceSection.nextSibling);
      }
    }

    // Display product
    function displayProduct(product) {
      document.getElementById('productTitle').textContent = product.name;
      document.getElementById('productDescription').textContent = product.description || '';
      document.getElementById('basePrice').textContent = product.base_price.toFixed(2);
      basePrice = product.base_price;

      // Update product images if available
      if (product.image_url || (product.gallery_images && product.gallery_images.length > 0)) {
        updateProductGallery(product);
      }

      // Update SEO elements
      updateProductSEO(product);

      // ============================================
      // NEW PRODUCT CONTENT FIELDS
      // ============================================

      // Display tagline if available
      if (product.tagline) {
        const descEl = document.getElementById('productDescription');
        if (descEl) {
          const taglineHtml = `<span style="display: block; font-size: 16px; color: #8E6545; font-weight: 500; margin-bottom: 8px;">${product.tagline}</span>`;
          descEl.insertAdjacentHTML('beforebegin', taglineHtml);
        }
      }

      // Display promo badge if available
      if (product.promo_badge) {
        const titleEl = document.getElementById('productTitle');
        if (titleEl) {
          const badgeHtml = `<span style="display: inline-block; background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-left: 10px; vertical-align: middle;">${product.promo_badge}</span>`;
          titleEl.insertAdjacentHTML('beforeend', badgeHtml);
        }
      }

      // Display compare price (strike-through) if available
      if (product.compare_price && product.compare_price > product.base_price) {
        const priceEl = document.getElementById('basePrice');
        if (priceEl && priceEl.parentElement) {
          const savingsPercent = Math.round((1 - product.base_price / product.compare_price) * 100);
          const comparePriceHtml = `
            <span style="text-decoration: line-through; color: #999; font-size: 16px; margin-left: 10px;">$${product.compare_price.toFixed(2)}</span>
            <span style="background: #22c55e; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 8px;">Save ${savingsPercent}%</span>
          `;
          priceEl.insertAdjacentHTML('afterend', comparePriceHtml);
        }
      }

      // Display recommended rooms if available
      if (product.recommended_rooms && product.recommended_rooms.length > 0) {
        displayRecommendedRooms(product.recommended_rooms);
      }

      // Display specs in product details if available
      if (product.specs) {
        displayProductSpecs(product.specs);
      }

      // Display light control options if available
      if (product.light_control) {
        displayLightControlOptions(product.light_control);
      }
    }

    // Display recommended rooms section
    function displayRecommendedRooms(rooms) {
      const roomIcons = {
        'living-room': 'fa-couch',
        'bedroom': 'fa-bed',
        'kitchen': 'fa-utensils',
        'bathroom': 'fa-bath',
        'office': 'fa-briefcase',
        'dining': 'fa-chair',
        'nursery': 'fa-baby',
        'basement': 'fa-house-chimney'
      };

      const roomNames = {
        'living-room': 'Living Room',
        'bedroom': 'Bedroom',
        'kitchen': 'Kitchen',
        'bathroom': 'Bathroom',
        'office': 'Office',
        'dining': 'Dining Room',
        'nursery': 'Nursery',
        'basement': 'Basement'
      };

      const roomsHtml = `
        <div style="margin-top: 20px; padding: 16px; background: #f9f7f4; border-radius: 10px; border-left: 4px solid #8E6545;">
          <span style="font-size: 13px; font-weight: 600; color: #333; display: block; margin-bottom: 12px;">
            <i class="fas fa-check-circle" style="color: #22c55e; margin-right: 6px;"></i>Perfect For
          </span>
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${rooms.map(room => `
              <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: white; border-radius: 20px; font-size: 12px; color: #666; border: 1px solid #e5e7eb;">
                <i class="fas ${roomIcons[room] || 'fa-home'}" style="color: #8E6545;"></i>
                ${roomNames[room] || room.replace('-', ' ')}
              </span>
            `).join('')}
          </div>
        </div>
      `;

      // Insert after product description
      const descEl = document.getElementById('productDescription');
      if (descEl) {
        descEl.insertAdjacentHTML('afterend', roomsHtml);
      }
    }

    // Display product specs - DISABLED
    function displayProductSpecs(specs) {
      return; // Quick Specs section removed per user request
    }

    // Display light control options
    function displayLightControlOptions(lightControl) {
      if (!lightControl) return;

      const options = [];
      if (lightControl.lightFiltering) options.push('Light Filtering');
      if (lightControl.roomDarkening) options.push('Room Darkening');
      if (lightControl.blackout) options.push('Blackout');

      if (options.length === 0) return;

      // This info could be displayed in shade style section or as badges
      console.log('Light control options available:', options);
    }

    // Update SEO meta tags, title, and JSON-LD schema
    function updateProductSEO(product) {
      const productType = product.category_name || 'Window Shades';
      const slug = product.slug || '';

      // Update page title
      document.title = `${product.name} | Custom ${productType} | Peekaboo Shades`;

      // Update meta description
      const metaDesc = document.getElementById('meta-description');
      if (metaDesc) {
        const description = product.description
          ? product.description.substring(0, 155) + (product.description.length > 155 ? '...' : '')
          : `Shop ${product.name} - premium custom ${productType.toLowerCase()} starting at $${product.base_price}. Free shipping on orders over $199.`;
        metaDesc.setAttribute('content', description);
      }

      // Update canonical URL
      const canonical = document.getElementById('canonical-link');
      if (canonical) {
        canonical.setAttribute('href', `https://peekabooshades.com/product/${slug}`);
      }

      // Update Product Schema
      const productSchema = document.getElementById('product-schema');
      if (productSchema) {
        const schema = {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": product.name,
          "description": product.description || `Premium custom ${productType.toLowerCase()} from Peekaboo Shades`,
          "image": product.image_url ? `https://peekabooshades.com${product.image_url}` : undefined,
          "brand": {
            "@type": "Brand",
            "name": "Peekaboo Shades"
          },
          "sku": product.id,
          "category": productType,
          "offers": {
            "@type": "Offer",
            "url": `https://peekabooshades.com/product/${slug}`,
            "priceCurrency": "USD",
            "price": product.base_price,
            "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            "availability": product.stock_status === 'out_of_stock'
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
            "seller": {
              "@type": "Organization",
              "name": "Peekaboo Shades"
            }
          }
        };
        productSchema.textContent = JSON.stringify(schema);
      }

      // Update Breadcrumb Schema
      const breadcrumbSchema = document.getElementById('breadcrumb-schema');
      if (breadcrumbSchema) {
        const categorySlug = product.category_slug || 'shop';
        const schema = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://peekabooshades.com/"},
            {"@type": "ListItem", "position": 2, "name": productType, "item": `https://peekabooshades.com/shop?category=${categorySlug}`},
            {"@type": "ListItem", "position": 3, "name": product.name, "item": `https://peekabooshades.com/product/${slug}`}
          ]
        };
        breadcrumbSchema.textContent = JSON.stringify(schema);
      }
    }

    // Update product gallery with images from database
    function updateProductGallery(product) {
      const mainImageEl = document.getElementById('mainProductImage');
      const thumbnailColumn = document.querySelector('.thumbnail-column');

      // Collect all available images
      const images = [];
      if (product.image_url) {
        images.push(product.image_url);
      }
      if (product.gallery_images && Array.isArray(product.gallery_images)) {
        images.push(...product.gallery_images);
      }

      if (images.length === 0) return;

      // Update main image
      mainImageEl.src = images[0];
      mainImageEl.alt = product.name;

      // Update thumbnails
      if (thumbnailColumn && images.length > 0) {
        thumbnailColumn.innerHTML = images.slice(0, 4).map((img, i) => `
          <div class="thumb-item ${i === 0 ? 'active' : ''}" onclick="changeImage(this, '${img}')">
            <img src="${img}" alt="Thumbnail ${i + 1}">
          </div>
        `).join('');
      }
    }

    // Change main image
    function changeImage(thumb, imageUrl) {
      document.querySelectorAll('.thumb-item').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      document.getElementById('mainProductImage').src = imageUrl;
    }

    // Toggle accordion
    function toggleAccordion(accordion) {
      const wasOpen = accordion.classList.contains('open');
      document.querySelectorAll('.accordion-section').forEach(a => a.classList.remove('open'));
      if (!wasOpen) {
        accordion.classList.add('open');
      }
    }

    // Update selected value display
    function updateSelectedValue(name) {
      const select = document.getElementById(name);
      const valueSpan = document.getElementById(name + 'Value');
      if (select && valueSpan) {
        valueSpan.textContent = select.options[select.selectedIndex].text;
      }
    }

    // Current unit state
    let currentUnit = 'in';

    // Conversion factors (to inches)
    const conversionFactors = {
      'in': 1,
      'cm': 2.54,
      'mm': 25.4
    };

    // Change unit
    function changeUnit(newUnit) {
      const widthInput = document.getElementById('widthInput');
      const heightInput = document.getElementById('heightInput');

      // Get current values in inches
      const widthInInches = parseFloat(widthInput.value) / conversionFactors[currentUnit] * conversionFactors['in'];
      const heightInInches = parseFloat(heightInput.value) / conversionFactors[currentUnit] * conversionFactors['in'];

      // Convert to new unit
      const newWidth = widthInInches * conversionFactors[newUnit];
      const newHeight = heightInInches * conversionFactors[newUnit];

      // Update inputs
      widthInput.value = newUnit === 'in' ? newWidth.toFixed(1) : newWidth.toFixed(2);
      heightInput.value = newUnit === 'in' ? newHeight.toFixed(1) : newHeight.toFixed(2);

      // Update unit labels
      document.getElementById('widthUnit').textContent = newUnit;
      document.getElementById('heightUnit').textContent = newUnit;

      // Update button styles
      document.querySelectorAll('.unit-btn').forEach(btn => {
        if (btn.dataset.unit === newUnit) {
          btn.style.background = '#8E6545';
          btn.style.color = 'white';
          btn.classList.add('active');
        } else {
          btn.style.background = '#fff';
          btn.style.color = '#333';
          btn.classList.remove('active');
        }
      });

      currentUnit = newUnit;
      updateDimensionsValue();
      updateConversionDisplay();
    }

    // Update conversion display
    function updateConversionDisplay() {
      const widthInput = document.getElementById('widthInput');
      const heightInput = document.getElementById('heightInput');

      // Get current values in inches
      const widthInInches = parseFloat(widthInput.value) / conversionFactors[currentUnit] * conversionFactors['in'];
      const heightInInches = parseFloat(heightInput.value) / conversionFactors[currentUnit] * conversionFactors['in'];

      // Calculate all conversions
      const widthCm = widthInInches * 2.54;
      const heightCm = heightInInches * 2.54;
      const widthMm = widthInInches * 25.4;
      const heightMm = heightInInches * 25.4;

      // Update display
      document.getElementById('convInches').innerHTML = `<strong>Inches:</strong> ${widthInInches.toFixed(1)} x ${heightInInches.toFixed(1)} in`;
      document.getElementById('convCm').innerHTML = `<strong>Cm:</strong> ${widthCm.toFixed(2)} x ${heightCm.toFixed(2)} cm`;
      document.getElementById('convMm').innerHTML = `<strong>Mm:</strong> ${widthMm.toFixed(1)} x ${heightMm.toFixed(1)} mm`;
    }

    // Update dimensions value display
    function updateDimensionsValue() {
      const width = document.getElementById('widthInput').value;
      const height = document.getElementById('heightInput').value;
      const unit = currentUnit;
      const valueSpan = document.getElementById('dimensionsValue');
      if (valueSpan) {
        valueSpan.textContent = width + ' x ' + height + ' ' + unit;
      }
      updateConversionDisplay();
    }

    // Select swatch
    function selectSwatch(swatch, type) {
      const container = swatch.parentElement;
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      calculatePrice();
    }

    // Select filter button (Light Filtering toggle)
    function selectFilterBtn(btn) {
      const container = btn.parentElement;
      container.querySelectorAll('.filter-toggle-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#333333';
        b.style.borderColor = '#D4D4D4';
        b.classList.remove('selected');
      });
      btn.style.background = '#8E6545';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#8E6545';
      btn.classList.add('selected');

      // Show/hide fabric swatches based on selection
      const filterValue = btn.dataset.value;
      document.getElementById('blackoutFabrics').style.display = 'none';
      document.getElementById('semiBlackoutFabrics').style.display = 'none';
      document.getElementById('transparentFabrics').style.display = 'none';
      const superBlackoutEl = document.getElementById('superBlackoutFabrics');
      if (superBlackoutEl) superBlackoutEl.style.display = 'none';

      if (filterValue === 'blackout') {
        document.getElementById('blackoutFabrics').style.display = 'flex';
        // Select first swatch in blackout
        const firstSwatch = document.querySelector('#blackoutFabrics .fabric-swatch');
        if (firstSwatch) selectFabricSwatch(firstSwatch);
      } else if (filterValue === 'semi-blackout') {
        document.getElementById('semiBlackoutFabrics').style.display = 'flex';
        // Select first swatch in semi-blackout
        const firstSwatch = document.querySelector('#semiBlackoutFabrics .fabric-swatch');
        if (firstSwatch) selectFabricSwatch(firstSwatch);
      } else if (filterValue === 'transparent') {
        document.getElementById('transparentFabrics').style.display = 'flex';
        // Select first swatch in transparent
        const firstSwatch = document.querySelector('#transparentFabrics .fabric-swatch');
        if (firstSwatch) selectFabricSwatch(firstSwatch);
      } else if (filterValue === 'super-blackout') {
        if (superBlackoutEl) superBlackoutEl.style.display = 'flex';
        // Select first swatch in super-blackout
        const firstSwatch = document.querySelector('#superBlackoutFabrics .fabric-swatch');
        if (firstSwatch) selectFabricSwatch(firstSwatch);
      }

      calculatePrice();
    }

    // Select fabric swatch
    function selectFabricSwatch(swatch, event) {
      if (event) event.preventDefault();
      const scrollPos = window.scrollY;
      // Remove selection from all fabric swatches across all groups
      document.querySelectorAll('.fabric-group .fabric-swatch').forEach(s => {
        s.classList.remove('selected');
        const img = s.querySelector('img');
        if (img) img.style.border = '2px solid transparent';
      });
      swatch.classList.add('selected');
      const img = swatch.querySelector('img');
      if (img) img.style.border = '3px solid #8E6545';
      calculatePrice();
      window.scrollTo(0, scrollPos);
    }

    // Select hardware swatch
    function selectHardware(swatch, type) {
      const container = swatch.parentElement;
      container.querySelectorAll('.hardware-swatch').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
    }

    // Select hardware option (new design with images)
    function selectHardwareOption(option, type, event) {
      if (event) event.preventDefault();
      const scrollPos = window.scrollY;
      const container = option.parentElement;
      container.querySelectorAll('.hardware-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.querySelector('div').style.border = '2px solid #E5E5E5';
      });
      option.classList.add('selected');
      option.querySelector('div').style.border = '3px solid #8E6545';
      calculatePrice();
      window.scrollTo(0, scrollPos);
    }

    // Select chain side button
    function selectChainSide(btn) {
      const container = btn.parentElement;
      container.querySelectorAll('.chain-side-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#333333';
        b.style.borderColor = '#D4D4D4';
        b.classList.remove('selected');
      });
      btn.style.background = '#8E6545';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#8E6545';
      btn.classList.add('selected');
    }

    // Select control type (Manual/Cordless/Motorized)
    function selectControlType(option, event) {
      if (event) event.preventDefault();
      const scrollPos = window.scrollY;
      const container = option.parentElement;
      container.querySelectorAll('.hardware-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.querySelector('div').style.border = '2px solid #E5E5E5';
      });
      option.classList.add('selected');
      option.querySelector('div').style.border = '3px solid #8E6545';

      // CONTROL TYPE → OPTIONS ENGINE
      // Strict rules for showing/hiding options based on control type:
      // Manual: Enable Chain Location, Chain Type, Hide Motor Type/Brand/Remote/Solar
      // Cordless: Hide ALL (Chain, Motor, Remote, Solar)
      // Motorized: Enable Motor Type/Brand/Remote/Solar, Hide Chain

      const chainLocationGroup = document.getElementById('chainLocationGroup');
      const chainTypeGroup = document.getElementById('chainTypeGroup');
      const motorBrandGroup = document.getElementById('motorBrandGroup');
      const motorizedLocationGroup = document.getElementById('motorizedLocationGroup');
      const motorTypeGroup = document.getElementById('motorTypeGroup');
      const remoteTypeGroup = document.getElementById('remoteTypeGroup');
      const solarPanelGroup = document.getElementById('solarPanelGroup');
      const priceNote = document.getElementById('controlTypePriceNote');
      const selectedValue = option.getAttribute('data-value');

      // Helper function to show a group with animation
      function showGroup(group) {
        if (group) {
          group.style.display = 'block';
          group.style.animation = 'slideDown 0.3s ease';
          group.style.opacity = '1';
          group.style.pointerEvents = 'auto';
        }
      }

      // Helper function to hide and disable a group
      function hideGroup(group) {
        if (group) {
          group.style.display = 'none';
          group.style.opacity = '0.5';
          group.style.pointerEvents = 'none';
        }
      }

      // Update price note based on control type
      if (priceNote) {
        if (selectedValue === 'motorized') {
          priceNote.innerHTML = '<span style="color: #1565c0; font-weight: 600;">Motorized: Standard fabric rate</span> + Motor Brand cost';
        } else if (selectedValue === 'cordless') {
          priceNote.innerHTML = '<span style="color: #e65100; font-weight: 600;">Cordless: +$3.25/m² fabric</span> (includes cordless spring)';
        } else {
          priceNote.innerHTML = '<span style="color: #28a745; font-weight: 600;">Manual: Standard fabric rate</span>';
        }
      }

      if (selectedValue === 'motorized') {
        // MOTORIZED: Show motor options, hide chain
        showGroup(motorBrandGroup);
        showGroup(motorizedLocationGroup);
        showGroup(motorTypeGroup);
        showGroup(remoteTypeGroup);
        showGroup(solarPanelGroup);
        hideGroup(chainLocationGroup);
        hideGroup(chainTypeGroup);

        // Auto-select accessories for motorized
        const smartHubInput = document.getElementById('smartHubQty');
        const usbChargerInput = document.getElementById('usbChargerQty');
        if (smartHubInput && parseInt(smartHubInput.value) === 0) {
          smartHubInput.value = 1;
        }
        if (usbChargerInput && parseInt(usbChargerInput.value) === 0) {
          usbChargerInput.value = 1;
        }
      } else if (selectedValue === 'manual') {
        // MANUAL: Show chain, hide all motor options
        showGroup(chainLocationGroup);
        showGroup(chainTypeGroup);
        hideGroup(motorBrandGroup);
        hideGroup(motorizedLocationGroup);
        hideGroup(motorTypeGroup);
        hideGroup(remoteTypeGroup);
        hideGroup(solarPanelGroup);
      } else {
        // CORDLESS: Hide ALL options (chain, motor, remote, solar)
        hideGroup(chainLocationGroup);
        hideGroup(chainTypeGroup);
        hideGroup(motorBrandGroup);
        hideGroup(motorizedLocationGroup);
        hideGroup(motorTypeGroup);
        hideGroup(remoteTypeGroup);
        hideGroup(solarPanelGroup);
      }

      calculatePrice();
      window.scrollTo(0, scrollPos);
    }

    // Select chain location (Left/Right)
    function selectChainLocation(btn) {
      const container = btn.parentElement;
      container.querySelectorAll('.chain-location-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#333';
        b.style.border = '2px solid #D4D4D4';
        b.classList.remove('selected');
      });
      btn.style.background = '#8E6545';
      btn.style.color = '#FFFFFF';
      btn.style.border = '2px solid #8E6545';
      btn.classList.add('selected');
    }

    // Select chain type (Plastic/Steel)
    let selectedChainType = 'bead-chain-plastic';
    let chainTypePrice = 0;

    function selectChainType(option) {
      const container = option.parentElement;
      container.querySelectorAll('.chain-type-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.querySelector('.chain-type-img').style.border = '2px solid #D4D4D4';
      });
      option.classList.add('selected');
      option.querySelector('.chain-type-img').style.border = '3px solid #8E6545';
      selectedChainType = option.dataset.value;
      chainTypePrice = parseFloat(option.dataset.price) || 0;
      calculatePrice();
    }

    // Open chain image zoom modal
    function openChainZoom(imageSrc, title) {
      // Create modal overlay
      const modal = document.createElement('div');
      modal.id = 'chainZoomModal';
      modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer;';
      modal.onclick = () => modal.remove();

      // Create modal content
      modal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%; text-align: center;" onclick="event.stopPropagation();">
          <button onclick="document.getElementById('chainZoomModal').remove()" style="position: absolute; top: -40px; right: 0; background: none; border: none; color: white; font-size: 24px; cursor: pointer;">
            <i class="fas fa-times"></i>
          </button>
          <img src="${imageSrc}" alt="${title}" style="max-width: 100%; max-height: 80vh; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
          <p style="color: white; font-size: 18px; margin-top: 15px; font-weight: 600;">${title}</p>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Select motor location (Right/Left)
    function selectMotorLocation(btn) {
      const container = btn.parentElement;
      container.querySelectorAll('.motor-location-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#333';
        b.style.border = '2px solid #D4D4D4';
        b.classList.remove('selected');
      });
      btn.style.background = '#8E6545';
      btn.style.color = '#FFFFFF';
      btn.style.border = '2px solid #8E6545';
      btn.classList.add('selected');
    }

    // Select motor type button
    function selectMotorType(btn) {
      const container = btn.parentElement;
      container.querySelectorAll('.motor-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#333333';
        b.style.borderColor = '#D4D4D4';
        b.classList.remove('selected');
      });
      btn.style.background = '#8E6545';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#8E6545';
      btn.classList.add('selected');
      calculatePrice();
    }

    // Select motor brand button (AOK/Dooya)
    function selectMotorBrand(btn) {
      const container = btn.parentElement;
      container.querySelectorAll('.motor-brand-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#333333';
        b.style.borderColor = '#D4D4D4';
        b.classList.remove('selected');
      });
      btn.style.background = '#8E6545';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#8E6545';
      btn.classList.add('selected');
      calculatePrice();
    }

    // Select remote type button
    function selectRemoteType(btn) {
      const container = btn.parentElement;
      container.querySelectorAll('.remote-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#333333';
        b.style.borderColor = '#D4D4D4';
        b.classList.remove('selected');
      });
      btn.style.background = '#8E6545';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#8E6545';
      btn.classList.add('selected');
    }

    // Select solar type button
    function selectSolarType(btn) {
      const container = btn.parentElement;
      container.querySelectorAll('.solar-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#333333';
        b.style.borderColor = '#D4D4D4';
        b.classList.remove('selected');
      });
      btn.style.background = '#8E6545';
      btn.style.color = '#FFFFFF';
      btn.style.borderColor = '#8E6545';
      btn.classList.add('selected');
      calculatePrice();
    }

    // Change quantity
    function changeQuantity(delta) {
      const input = document.getElementById('quantityInput');
      let value = parseInt(input.value) + delta;
      if (value < 1) value = 1;
      if (value > 99) value = 99;
      input.value = value;
      calculatePrice();
    }

    // Change accessory quantity
    function changeAccessoryQty(accessory, delta) {
      const inputId = accessory + 'Qty';
      const input = document.getElementById(inputId);
      if (!input) return;

      let value = parseInt(input.value) + delta;
      if (value < 0) value = 0;
      if (value > 10) value = 10;
      input.value = value;

      // Highlight the accessory item when quantity > 0
      const accessoryItem = input.closest('.accessory-item');
      if (accessoryItem) {
        if (value > 0) {
          accessoryItem.style.borderColor = '#8E6545';
          accessoryItem.style.boxShadow = '0 2px 8px rgba(142, 101, 69, 0.15)';
        } else {
          accessoryItem.style.borderColor = '#e5e5e5';
          accessoryItem.style.boxShadow = 'none';
        }
      }

      calculatePrice();
    }

    // Accessory prices - loaded dynamically from API, fallback to these defaults
    let accessoryPrices = {
      smartHub: 23.50,
      usbCharger: 5.00
    };

    // Update accessory prices from product options when loaded
    function updateAccessoryPrices() {
      if (productOptionsData && productOptionsData.accessories && productOptionsData.accessories.options) {
        productOptionsData.accessories.options.forEach(acc => {
          const key = acc.value.replace(/[^a-zA-Z0-9]/g, '');
          accessoryPrices[key] = acc.price || accessoryPrices[key] || 0;
        });

        // Update displayed prices in the UI
        const smartHubPriceEl = document.getElementById('smartHubPrice');
        const usbChargerPriceEl = document.getElementById('usbChargerPrice');
        if (smartHubPriceEl) smartHubPriceEl.textContent = '$' + accessoryPrices.smartHub.toFixed(2);
        if (usbChargerPriceEl) usbChargerPriceEl.textContent = '$' + accessoryPrices.usbCharger.toFixed(2);
      }
    }

    // Debounce timer for API calls
    let priceCalculationTimeout = null;
    let lastPricingResponse = null;

    // Calculate price by calling backend pricing API
    function calculatePrice() {
      // Debounce API calls (wait 300ms after last input)
      if (priceCalculationTimeout) {
        clearTimeout(priceCalculationTimeout);
      }

      priceCalculationTimeout = setTimeout(() => {
        calculatePriceFromAPI();
      }, 300);
    }

    // Actually call the pricing API
    async function calculatePriceFromAPI() {
      // Get dimensions (always in inches)
      let width = parseFloat(document.getElementById('widthInput').value) || 24;
      let height = parseFloat(document.getElementById('heightInput').value) || 36;

      // Convert to inches if not already
      width = width / conversionFactors[currentUnit];
      height = height / conversionFactors[currentUnit];

      const quantity = parseInt(document.getElementById('quantityInput').value) || 1;
      const warranty = document.getElementById('extendedWarranty').checked;

      // Get product slug from URL
      const productSlug = window.location.pathname.split('/').pop();

      // Determine product type from slug
      let productType = 'roller';
      if (productSlug.includes('zebra')) productType = 'zebra';
      else if (productSlug.includes('roman')) productType = 'roman';
      else if (productSlug.includes('honeycomb')) productType = 'honeycomb';

      // Get selected fabric code
      const fabricSwatch = document.querySelector('.fabric-group .fabric-swatch.selected');
      const fabricCode = fabricSwatch?.dataset.code || null;

      // Get control type
      const controlTypeOption = document.querySelector('#controlTypeSwatches .hardware-option.selected');
      let controlType = 'manual';
      if (controlTypeOption) {
        const ctValue = controlTypeOption.dataset.value || '';
        if (ctValue.includes('cordless')) controlType = 'cordless';
        else if (ctValue.includes('motor')) controlType = 'motorized';
      }

      // Get hardware options
      const cassetteOption = document.querySelector('#cassetteSwatches .hardware-option.selected');
      const bottomBarOption = document.querySelector('#bottomBarSwatches .hardware-option.selected');
      const rollerTypeOption = document.querySelector('#rollerTypeSwatches .hardware-option.selected');
      const mountTypeOption = document.querySelector('#mountTypeSwatches .hardware-option.selected');

      // Build options object
      const options = {
        controlType,
        standardCassette: cassetteOption?.dataset.value || null,
        standardBottomBar: bottomBarOption?.dataset.value || null,
        rollerType: rollerTypeOption?.dataset.value || null,
        mountType: mountTypeOption?.dataset.value || null,
        // Map hardware selectors to pricing engine option names
        valanceType: cassetteOption?.dataset.value || null,
        bottomRail: bottomBarOption?.dataset.value || null
      };

      // Motor brand, type and remote type if motorized
      const motorBrandOption = document.querySelector('#motorBrandSwatches .motor-brand-btn.selected');
      const motorTypeOption = document.querySelector('#motorTypeSwatches .motor-btn.selected');
      const remoteTypeOption = document.querySelector('#remoteTypeSwatches .remote-btn.selected');
      const solarTypeOption = document.querySelector('#solarTypeSwatches .solar-btn.selected');
      if (controlType === 'motorized') {
        options.motorBrand = motorBrandOption?.dataset.value || 'aok';
        options.motorType = motorTypeOption?.dataset.value || null;
        options.remoteType = remoteTypeOption?.dataset.value || null;
        options.solarType = solarTypeOption?.dataset.value || null;
      }

      // Accessories (Smart Hub, USB Charger)
      const smartHubQty = parseInt(document.getElementById('smartHubQty')?.value) || 0;
      const usbChargerQty = parseInt(document.getElementById('usbChargerQty')?.value) || 0;
      options.smartHubQty = smartHubQty;
      options.usbChargerQty = usbChargerQty;

      // Build API request
      const pricingRequest = {
        productSlug,
        productType,
        width,
        height,
        quantity,
        fabricCode,
        options,
        includeShipping: false,
        includeTax: false,
        manufacturerId: selectedManufacturer?.id || null
      };

      // Check if manufacturer pricing is available before calling API
      if (!manufacturerPricingAvailable && selectedManufacturer) {
        // Show Coming Soon state
        displayComingSoonPricing(selectedManufacturer);
        return;
      }

      try {
        const response = await fetch('/api/v1/pricing/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pricingRequest)
        });

        const result = await response.json();

        if (result.success) {
          // Check if this is a "coming soon" response
          if (result.comingSoon) {
            displayComingSoonPricing(result.manufacturer || selectedManufacturer);
            return;
          }
          lastPricingResponse = result;
          displayPricingResult(result, warranty, quantity);
        } else {
          console.error('Pricing API error:', result.error);
          // Do not invent a price on API error — show unavailable + block cart.
          displayPriceUnavailable();
        }
      } catch (error) {
        console.error('Failed to fetch pricing:', error);
        // Do not invent a price on network failure — show unavailable + block cart.
        displayPriceUnavailable();
      }
    }

    // Display "price unavailable" state when the pricing API fails.
    // BUG-B001-residual: never invent a client-side price — the old fallback
    // used a hardcoded $20/m² that did not match the server pricing engine.
    function displayPriceUnavailable() {
      const priceElement = document.querySelector('.price');
      if (priceElement) {
        priceElement.innerHTML = `
          <div style="text-align: center;">
            <span style="color: #8E6545; font-size: 20px; font-weight: 600;">Price unavailable</span>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
              We couldn't reach our pricing service. Please retry.
            </div>
          </div>
        `;
      }
      const breakdownContainer = document.getElementById('priceBreakdown');
      if (breakdownContainer) {
        breakdownContainer.innerHTML = `
          <div style="padding: 20px; text-align: center; background: #fff3cd; border-radius: 8px; margin: 10px 0;">
            <i class="fas fa-exclamation-triangle" style="font-size: 22px; color: #856404; margin-bottom: 10px;"></i>
            <p style="margin: 0; color: #856404; font-weight: 500;">Pricing temporarily unavailable</p>
            <p style="margin: 5px 0 0; font-size: 12px; color: #856404;">
              Please adjust an option or reload the page to get an up-to-date price.
            </p>
          </div>
        `;
      }
      const addToCartBtn = document.querySelector('.add-to-cart-btn');
      if (addToCartBtn) {
        addToCartBtn.disabled = true;
        addToCartBtn.style.opacity = '0.5';
        addToCartBtn.style.cursor = 'not-allowed';
        addToCartBtn.title = 'Price unavailable — please retry';
      }
    }

    // Display Coming Soon pricing state
    function displayComingSoonPricing(manufacturer) {
      const priceElement = document.querySelector('.price');
      if (priceElement) {
        priceElement.innerHTML = `
          <div style="text-align: center;">
            <span style="color: #8E6545; font-size: 24px; font-weight: 600;">Coming Soon</span>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">
              ${manufacturer?.name || 'Manufacturer'} pricing not yet available
            </div>
          </div>
        `;
      }

      // Update breakdown to show coming soon message
      const breakdownContainer = document.getElementById('priceBreakdown');
      if (breakdownContainer) {
        breakdownContainer.innerHTML = `
          <div style="padding: 20px; text-align: center; background: #fff3cd; border-radius: 8px; margin: 10px 0;">
            <i class="fas fa-clock" style="font-size: 24px; color: #856404; margin-bottom: 10px;"></i>
            <p style="margin: 0; color: #856404; font-weight: 500;">Pricing Coming Soon</p>
            <p style="margin: 5px 0 0; font-size: 12px; color: #856404;">
              ${manufacturer?.name || 'This manufacturer'} is not yet configured in our pricing system.
              Please select another manufacturer or check back later.
            </p>
          </div>
        `;
      }

      // Disable add to cart button
      const addToCartBtn = document.querySelector('.add-to-cart-btn');
      if (addToCartBtn) {
        addToCartBtn.disabled = true;
        addToCartBtn.style.opacity = '0.5';
        addToCartBtn.style.cursor = 'not-allowed';
        addToCartBtn.title = 'Pricing not available for this manufacturer';
      }
    }

    // Display pricing result from API
    function displayPricingResult(result, warranty, quantity) {
      const breakdown = [];
      const pricing = result.pricing;

      // Base fabric price (manufacturer cost + margin = unit base price)
      const fabricBasePrice = pricing.manufacturerCost.unitCost + pricing.margin.amount;
      breakdown.push({
        name: `Fabric (${result.fabricCode || 'Standard'})`,
        price: fabricBasePrice
      });

      // Show area calculation if available
      if (result.dimensions.squareMeters) {
        const areaInfo = result.dimensions.minAreaApplied
          ? `Area: ${result.dimensions.squareMeters} m² (min applied)`
          : `Area: ${result.dimensions.squareMeters} m²`;
        breakdown.push({ name: areaInfo, price: 0, info: true });
      }

      // Light Filtering
      const lightFilterOption = document.querySelector('#lightFilteringSwatches .filter-toggle-btn.selected');
      if (lightFilterOption) {
        const lightFilterName = lightFilterOption.textContent.trim();
        breakdown.push({ name: `Light Filtering: ${lightFilterName}`, price: 0, info: true });
      }

      // Hardware options from API breakdown
      if (pricing.options && pricing.options.breakdown) {
        pricing.options.breakdown.forEach(opt => {
          // Format display name nicely
          let displayName = opt.name;
          // Capitalize first letter of each word
          displayName = displayName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          // Add prefix based on type
          if (opt.type === 'motorization') displayName = 'Control Type: ' + displayName;
          else if (opt.type === 'motor_type') displayName = 'Motor Type: ' + displayName;
          else if (opt.type === 'remote') displayName = 'Remote: ' + displayName;
          else if (opt.type === 'mount_type') displayName = 'Mount Type: ' + displayName;
          else if (opt.type === 'valance_type') displayName = 'Valance: ' + displayName;
          else if (opt.type === 'bottom_rail') displayName = 'Bottom Rail: ' + displayName;

          if (opt.price > 0) {
            breakdown.push({ name: displayName, price: opt.price });
          } else {
            breakdown.push({ name: displayName, price: 0, info: true });
          }
        });
      }

      // Add hardware options prices from DOM (for items not in API response)
      const cassetteOption = document.querySelector('#cassetteSwatches .hardware-option.selected');
      const bottomBarOption = document.querySelector('#bottomBarSwatches .hardware-option.selected');
      const rollerTypeOption = document.querySelector('#rollerTypeSwatches .hardware-option.selected');
      const controlTypeOption = document.querySelector('#controlTypeSwatches .hardware-option.selected');
      const mountTypeOption = document.querySelector('#mountTypeSwatches .hardware-option.selected');

      let additionalOptionsTotal = 0;

      // Cassette/Valance - check if already in API breakdown
      const hasValanceInBreakdown = pricing.options?.breakdown?.some(o => o.type === 'valance_type');
      if (cassetteOption && !hasValanceInBreakdown) {
        const cassettePrice = parseFloat(cassetteOption.dataset.price) || 0;
        if (cassettePrice > 0) {
          additionalOptionsTotal += cassettePrice;
          breakdown.push({ name: `Valance: ${cassetteOption.querySelector('span')?.textContent.split('(')[0].trim() || 'Standard'}`, price: cassettePrice });
        }
      }
      // Bottom Bar/Rail - check if already in API breakdown
      const hasBottomRailInBreakdown = pricing.options?.breakdown?.some(o => o.type === 'bottom_rail');
      if (bottomBarOption && !hasBottomRailInBreakdown) {
        const bottomBarPrice = parseFloat(bottomBarOption.dataset.price) || 0;
        if (bottomBarPrice > 0) {
          additionalOptionsTotal += bottomBarPrice;
          breakdown.push({ name: `Bottom Rail: ${bottomBarOption.querySelector('span')?.textContent.split('(')[0].trim() || 'Standard'}`, price: bottomBarPrice });
        }
      }
      if (rollerTypeOption) {
        const rollerTypePrice = parseFloat(rollerTypeOption.dataset.price) || 0;
        if (rollerTypePrice > 0) {
          additionalOptionsTotal += rollerTypePrice;
          breakdown.push({ name: `Roller Type: ${rollerTypeOption.querySelector('span')?.textContent.split('(')[0].trim() || 'Standard'}`, price: rollerTypePrice });
        }
      }
      // Control type (motorization) is already in API breakdown, don't add again
      // Only add if API didn't include motorization
      const hasMotorizationInBreakdown = pricing.options?.breakdown?.some(o => o.type === 'motorization');
      if (controlTypeOption && !hasMotorizationInBreakdown) {
        const controlTypePrice = parseFloat(controlTypeOption.dataset.price) || 0;
        if (controlTypePrice > 0) {
          additionalOptionsTotal += controlTypePrice;
          breakdown.push({ name: `Control Type: ${controlTypeOption.querySelector('span')?.textContent.split('(')[0].trim() || 'Manual'}`, price: controlTypePrice });
        }
      }
      // Mount type is now included in API breakdown, check to avoid duplicates
      const hasMountInBreakdown = pricing.options?.breakdown?.some(o => o.type === 'mount_type');
      if (mountTypeOption && !hasMountInBreakdown) {
        const mountTypePrice = parseFloat(mountTypeOption.dataset.price) || 0;
        if (mountTypePrice > 0) {
          additionalOptionsTotal += mountTypePrice;
          breakdown.push({ name: `Mount Type: ${mountTypeOption.querySelector('span')?.textContent.split('(')[0].trim() || 'Inside'}`, price: mountTypePrice });
        }
      }

      // Chain Type (Steel chain adds extra cost)
      const controlType = controlTypeOption?.getAttribute('data-value') || 'manual';
      if (controlType === 'manual' && chainTypePrice > 0) {
        additionalOptionsTotal += chainTypePrice;
      }

      // Motor Type and Remote Type are already included in API breakdown with prices
      // Only add them as info if they weren't in the API response
      const hasMotorInBreakdown = pricing.options?.breakdown?.some(o => o.type === 'motor_type' || o.type === 'motorization');
      const hasRemoteInBreakdown = pricing.options?.breakdown?.some(o => o.type === 'remote');

      const motorTypeOption = document.querySelector('#motorTypeSwatches .motor-btn.selected');
      if (motorTypeOption && motorTypeOption.dataset.value && !hasMotorInBreakdown) {
        breakdown.push({ name: `Motor: ${motorTypeOption.textContent.trim()}`, price: 0, info: true });
      }

      const remoteTypeOption = document.querySelector('#remoteTypeSwatches .remote-btn.selected');
      if (remoteTypeOption && remoteTypeOption.dataset.value && !hasRemoteInBreakdown) {
        breakdown.push({ name: `Remote: ${remoteTypeOption.textContent.trim()}`, price: 0, info: true });
      }

      // Chain Side
      const chainSideOption = document.querySelector('#chainLocationSwatches .chain-location-btn.selected');
      if (chainSideOption) {
        breakdown.push({ name: `Chain Position: ${chainSideOption.textContent.trim()}`, price: 0, info: true });
      }

      // Chain Type
      const chainTypeOption = document.querySelector('#chainTypeSwatches .chain-type-option.selected');
      if (chainTypeOption && controlType === 'manual') {
        const chainTypeName = chainTypeOption.dataset.value === 'bead-chain-metal' ? 'Steel Chain' : 'Plastic Chain';
        const chainPrice = parseFloat(chainTypeOption.dataset.price) || 0;
        if (chainPrice > 0) {
          breakdown.push({ name: chainTypeName, price: chainPrice });
        } else {
          breakdown.push({ name: chainTypeName, price: 0, info: true });
        }
      }

      // Warranty
      let warrantyPrice = 0;
      if (warranty) {
        warrantyPrice = 15;
        breakdown.push({ name: '3-Year Extended Warranty', price: warrantyPrice });
      }

      // Quantity multiplier
      if (quantity > 1) {
        breakdown.push({ name: `Quantity: ${quantity}x`, price: 0, multiplier: true });
      }

      // Accessories are now included in API lineTotal (not multiplied by quantity)
      // Just display them from the API response
      if (pricing.accessories && pricing.accessories.breakdown) {
        pricing.accessories.breakdown.forEach(acc => {
          breakdown.push({ name: acc.name, price: acc.price });
        });
      }

      // Calculate total: API lineTotal already includes (unitPrice × qty) + accessories
      // Only add warranty (which is per-unit) and any additional DOM options
      const warrantyTotal = warrantyPrice * quantity;
      const additionalTotal = additionalOptionsTotal * quantity;
      const totalPrice = pricing.lineTotal + warrantyTotal + additionalTotal;

      document.getElementById('totalPrice').textContent = totalPrice.toFixed(2);
      updatePriceBreakdown(breakdown, totalPrice);

      // Log pricing details for debugging
      console.log('Pricing from API:', {
        fabricCode: result.fabricCode,
        dimensions: result.dimensions,
        manufacturerCost: pricing.manufacturerCost,
        margin: pricing.margin,
        unitPrice: pricing.unitPrice,
        lineTotal: pricing.lineTotal,
        accessories: pricing.accessories,
        displayTotal: totalPrice
      });

      // Re-enable add-to-cart button when valid pricing is displayed
      const addToCartBtn = document.getElementById('addToCartBtn');
      if (addToCartBtn) {
        addToCartBtn.disabled = false;
        addToCartBtn.style.opacity = '1';
        addToCartBtn.style.cursor = 'pointer';
        addToCartBtn.title = '';
      }
    }

    // Fallback price calculation if API fails
    // DEPRECATED (BUG-B001-residual): no longer called. Invented a client-side
    // price ($20/m²) that diverged from the server pricing engine. Kept only
    // for reference; do not re-wire — use displayPriceUnavailable() on failure.
    function fallbackPriceCalculation(width, height, quantity, warranty) {
      const breakdown = [];

      // Size calculation using m² formula
      const INCHES_TO_METERS = 0.0254;
      const widthMeters = width * INCHES_TO_METERS;
      const heightMeters = height * INCHES_TO_METERS;
      let areaSqMeters = widthMeters * heightMeters;
      const minArea = 1.2; // Minimum 1.2 m² for roller blinds
      areaSqMeters = Math.max(areaSqMeters, minArea);

      // Approximate price per m² for fallback (fabric price)
      const pricePerSqMeter = 20; // Approximate customer price per m²
      let price = areaSqMeters * pricePerSqMeter;

      breakdown.push({
        name: `Fabric (${areaSqMeters.toFixed(2)} m²)`,
        price: price
      });

      // Get hardware option prices
      const cassetteOption = document.querySelector('#cassetteSwatches .hardware-option.selected');
      const bottomBarOption = document.querySelector('#bottomBarSwatches .hardware-option.selected');
      const rollerTypeOption = document.querySelector('#rollerTypeSwatches .hardware-option.selected');
      const controlTypeOption = document.querySelector('#controlTypeSwatches .hardware-option.selected');
      const mountTypeOption = document.querySelector('#mountTypeSwatches .hardware-option.selected');

      if (cassetteOption) {
        const cassettePrice = parseFloat(cassetteOption.dataset.price) || 0;
        price += cassettePrice;
        if (cassettePrice > 0) breakdown.push({ name: 'Cassette', price: cassettePrice });
      }
      if (bottomBarOption) {
        const bottomBarPrice = parseFloat(bottomBarOption.dataset.price) || 0;
        price += bottomBarPrice;
        if (bottomBarPrice > 0) breakdown.push({ name: 'Bottom Bar', price: bottomBarPrice });
      }
      if (rollerTypeOption) {
        const rollerTypePrice = parseFloat(rollerTypeOption.dataset.price) || 0;
        price += rollerTypePrice;
        if (rollerTypePrice > 0) breakdown.push({ name: 'Roller Type', price: rollerTypePrice });
      }
      if (controlTypeOption) {
        const controlTypePrice = parseFloat(controlTypeOption.dataset.price) || 0;
        price += controlTypePrice;
        if (controlTypePrice > 0) breakdown.push({ name: 'Control Type', price: controlTypePrice });
      }
      if (mountTypeOption) {
        const mountTypePrice = parseFloat(mountTypeOption.dataset.price) || 0;
        price += mountTypePrice;
        if (mountTypePrice > 0) breakdown.push({ name: 'Mount Type', price: mountTypePrice });
      }

      // Solar Panel
      const solarTypeOption = document.querySelector('#solarTypeSwatches .solar-btn.selected');
      if (solarTypeOption) {
        const solarPrice = parseFloat(solarTypeOption.dataset.price) || 0;
        price += solarPrice;
        if (solarPrice > 0) breakdown.push({ name: 'Solar Panel', price: solarPrice });
      }

      if (warranty) {
        price += 15;
        breakdown.push({ name: '3-Year Extended Warranty', price: 15 });
      }

      if (quantity > 1) {
        breakdown.push({ name: `Quantity: ${quantity}x`, price: 0, multiplier: true });
      }

      // Accessories
      let accessoriesTotal = 0;
      if (productOptionsData && productOptionsData.accessories && productOptionsData.accessories.options) {
        productOptionsData.accessories.options.forEach(opt => {
          const optionId = opt.value.replace(/[^a-zA-Z0-9]/g, '');
          const qtyInput = document.getElementById(`${optionId}Qty`);
          if (qtyInput) {
            const qty = parseInt(qtyInput.value) || 0;
            if (qty > 0) {
              const itemTotal = qty * opt.price;
              accessoriesTotal += itemTotal;
              breakdown.push({ name: `${opt.name} x${qty}`, price: itemTotal });
            }
          }
        });
      }

      const totalPrice = (price * quantity) + accessoriesTotal;
      document.getElementById('totalPrice').textContent = totalPrice.toFixed(2);
      updatePriceBreakdown(breakdown, totalPrice);
    }

    // Update price breakdown display
    function updatePriceBreakdown(breakdown, total) {
      const container = document.getElementById('breakdownItems');
      if (!container) return;

      let html = '';
      breakdown.forEach(item => {
        if (item.multiplier) {
          html += `<div style="display: flex; justify-content: space-between; padding: 6px 0; color: #8E6545; font-weight: 500;">
            <span><i class="fas fa-times" style="margin-right: 6px;"></i>${item.name}</span>
            <span>-</span>
          </div>`;
        } else if (item.info) {
          html += `<div style="display: flex; justify-content: space-between; padding: 6px 0; color: #888;">
            <span><i class="fas fa-check" style="margin-right: 6px; color: #28a745;"></i>${item.name}</span>
            <span style="color: #28a745;">Included</span>
          </div>`;
        } else {
          const priceDisplay = item.price > 0 ? `+$${item.price.toFixed(2)}` : (item.price < 0 ? `-$${Math.abs(item.price).toFixed(2)}` : '$0.00');
          const priceColor = item.price > 0 ? '#333' : (item.price < 0 ? '#28a745' : '#888');
          html += `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee;">
            <span>${item.name}</span>
            <span style="font-weight: 500; color: ${priceColor};">${priceDisplay}</span>
          </div>`;
        }
      });

      container.innerHTML = html;
      document.getElementById('breakdownSubtotal').textContent = total.toFixed(2);
    }

    // Toggle price breakdown visibility
    function togglePriceBreakdown() {
      const details = document.getElementById('breakdownDetails');
      const icon = document.getElementById('breakdownToggleIcon');
      if (details.style.display === 'none') {
        details.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
      } else {
        details.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
      }
    }

    // Add to cart
    async function addToCart() {
      const width = document.getElementById('widthInput').value;
      const height = document.getElementById('heightInput').value;
      const quantity = document.getElementById('quantityInput').value;
      const roomLabel = document.getElementById('roomLabel').value;
      const warranty = document.getElementById('extendedWarranty').checked;

      // Get accessory quantities
      const smartHubQty = parseInt(document.getElementById('smartHubQty')?.value) || 0;
      const usbChargerQty = parseInt(document.getElementById('usbChargerQty')?.value) || 0;

      // ============================================
      // VALIDATION - BUG-005 FIX
      // ============================================

      // Validate dimensions
      const widthNum = parseFloat(width);
      const heightNum = parseFloat(height);

      // UNIT BUG FIX: the width/height inputs hold the value in the currently
      // selected unit (in/cm/mm). The price PREVIEW (calculatePriceFromAPI)
      // converts to inches, but add-to-cart previously sent the RAW value, so a
      // cm or mm entry was priced as inches (2.54x / 25.4x overcharge on the
      // order). Convert to inches here too, and validate the inch value.
      const widthInches = widthNum / conversionFactors[currentUnit];
      const heightInches = heightNum / conversionFactors[currentUnit];

      if (!width || isNaN(widthInches) || widthInches < 12 || widthInches > 120) {
        showToast('Please enter a valid width (12-120 inches)', 'error');
        document.getElementById('widthInput').focus();
        return;
      }

      if (!height || isNaN(heightInches) || heightInches < 12 || heightInches > 120) {
        showToast('Please enter a valid height (12-120 inches)', 'error');
        document.getElementById('heightInput').focus();
        return;
      }

      // Validate fabric selection
      const selectedFabric = document.querySelector('.fabric-group .fabric-swatch.selected');
      if (!selectedFabric) {
        showToast('Please select a fabric', 'error');
        return;
      }

      // Validate motorized options
      const controlType = document.querySelector('#controlTypeSwatches .hardware-option.selected')?.dataset.value || 'manual';

      if (controlType === 'motorized') {
        const motorBrand = document.querySelector('#motorBrandSwatches .motor-brand-btn.selected')?.dataset.value;
        const motorType = document.querySelector('#motorTypeSwatches .motor-btn.selected')?.dataset.value;

        if (!motorBrand) {
          showToast('Please select a motor brand for motorized blinds', 'error');
          return;
        }

        if (!motorType) {
          showToast('Please select a motor type for motorized blinds', 'error');
          return;
        }
      }

      // Validate price is calculated
      const totalPrice = parseFloat(document.getElementById('totalPrice').textContent);
      if (isNaN(totalPrice) || totalPrice <= 0) {
        showToast('Price calculation error. Please refresh and try again.', 'error');
        return;
      }

      // ============================================
      // END VALIDATION
      // ============================================

      const configuration = {
        lightFiltering: document.querySelector('#lightFilteringSwatches .filter-toggle-btn.selected')?.dataset.value || 'blackout',
        fabricCode: document.querySelector('.fabric-group .fabric-swatch.selected')?.dataset.code || '82143A',
        fabricColor: document.querySelector('.fabric-group .fabric-swatch.selected')?.dataset.color || '82143A',
        standardCassette: document.querySelector('#cassetteSwatches .hardware-option.selected')?.dataset.value || 'fabric-insert',
        standardBottomBar: document.querySelector('#bottomBarSwatches .hardware-option.selected')?.dataset.value || 'standard',
        chainSide: document.querySelector('#chainLocationSwatches .chain-location-btn.selected')?.dataset.value || 'left',
        chainType: document.querySelector('#chainTypeSwatches .chain-type-option.selected')?.dataset.value || 'bead-chain-plastic',
        rollerType: document.querySelector('#rollerTypeSwatches .hardware-option.selected')?.dataset.value || 'standard-roll-back',
        mountType: document.querySelector('#mountTypeSwatches .hardware-option.selected')?.dataset.value || 'inside',
        controlType: document.querySelector('#controlTypeSwatches .hardware-option.selected')?.dataset.value || 'manual',
        // Motor brand is critical for pricing - must match what pricing API uses
        motorBrand: document.querySelector('#motorBrandSwatches .motor-brand-btn.selected')?.dataset.value || '',
        motorType: document.querySelector('#motorTypeSwatches .motor-btn.selected')?.dataset.value || '',
        remoteType: document.querySelector('#remoteTypeSwatches .remote-btn.selected')?.dataset.value || '',
        solarType: document.querySelector('#solarTypeSwatches .solar-btn.selected')?.dataset.value || '',
        // Accessories
        smartHubQty: smartHubQty,
        usbChargerQty: usbChargerQty
      };

      // totalPrice already validated above
      const unitPrice = totalPrice / parseInt(quantity);

      const sessionId = getSessionId();

      try {
        const response = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            productId: product?.id || 'demo-product',
            quantity: parseInt(quantity),
            width: widthInches,
            height: heightInches,
            roomLabel,
            configuration,
            unitPrice,
            extendedWarranty: warranty
          })
        });

        const result = await response.json();
        if (result.success) {
          showToast('Added to cart!', 'success');
          updateCartCount();

          // TICKET 015: Track add to cart
          if (typeof trackEvent === 'function') {
            trackEvent('add_to_cart', {
              productId: product?.id,
              productName: product?.name,
              product_id: product?.id,
              product_name: product?.name,
              fabricCode: configuration.fabricCode,
              quantity: parseInt(quantity),
              value: totalPrice
            });
          }
        }
      } catch (error) {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        cart.push({
          id: Date.now().toString(),
          productId: product?.id || 'demo-product',
          productName: document.getElementById('productTitle').textContent,
          quantity: parseInt(quantity),
          width: widthInches,
          height: heightInches,
          roomLabel,
          configuration,
          unitPrice,
          extendedWarranty: warranty
        });
        localStorage.setItem('cart', JSON.stringify(cart));
        showToast('Added to cart!', 'success');
        updateCartCount();
      }
    }

    // Open quote modal
    function openQuoteModal() {
      document.getElementById('quoteModal').classList.add('active');
    }

    // Close quote modal
    function closeQuoteModal() {
      document.getElementById('quoteModal').classList.remove('active');
    }

    // Submit quote -> Shopify native contact form (emails the store: peekabooshades.pro@gmail.com)
    async function submitQuote(e) {
      if (e) e.preventDefault();
      var val = function(id){ var el=document.getElementById(id); return el ? (el.value||'') : ''; };
      var name = val('quoteName'), email = val('quoteEmail'), phone = val('quotePhone'), message = val('quoteMessage');
      if (!email) { showToast('Please enter your email so we can send your quote.', 'error'); return; }

      var pick = function(sel){ var el=document.querySelector(sel); return el ? (el.getAttribute('data-code') || el.getAttribute('data-value') || (el.textContent||'').trim()) : '—'; };
      var control = pick('#controlTypeSwatches .hardware-option.selected');
      var lines = [
        'Product: ' + ((document.getElementById('productTitle')||{}).textContent || 'Roller Shades'),
        'Fabric (SKU): ' + pick('.fabric-swatch.selected'),
        'Width x Height: ' + val('widthInput') + ' x ' + val('heightInput') + ' in',
        'Quantity: ' + val('quantityInput'),
        'Mount: ' + pick('#mountTypeSwatches .hardware-option.selected'),
        'Control: ' + control,
        'Valance: ' + pick('#cassetteSwatches .hardware-option.selected'),
        'Bottom Rail: ' + pick('#bottomBarSwatches .hardware-option.selected')
      ];
      if (control === 'motorized') {
        lines.push('Motor: ' + pick('#motorBrandSwatches .motor-brand-btn.selected'));
        lines.push('Remote: ' + pick('#remoteTypeSwatches .remote-btn.selected'));
        lines.push('Solar Panel: ' + pick('#solarTypeSwatches .solar-btn.selected'));
      }
      lines.push('Estimated total: $' + ((document.getElementById('totalPrice')||{}).textContent || ''));

      var body = 'QUOTE REQUEST\n\n' + lines.join('\n') +
                 '\n\nName: ' + name + '\nPhone: ' + phone + '\n\nMessage:\n' + (message || '(none)');

      var params = new URLSearchParams();
      params.append('form_type', 'contact');
      params.append('utf8', '✓');
      params.append('contact[email]', email);
      params.append('contact[body]', body);

      var btn = document.querySelector('#quoteForm [type="submit"], .request-quote-btn');
      if (btn) { btn.disabled = true; }

      function emailFallback(){
        var subject = 'Quote Request — ' + ((document.getElementById('productTitle')||{}).textContent || 'Roller Shades');
        var href = 'mailto:peekabooshades.pro@gmail.com'
          + '?subject=' + encodeURIComponent(subject)
          + '&body=' + encodeURIComponent(body);
        showToast('Opening your email app to send the quote to PeekabooShades…', 'success');
        closeQuoteModal();
        window.location.href = href;
      }

      try {
        var resp = await fetch('/contact', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        });
        if (resp.ok || resp.redirected) {
          showToast('Quote request sent! We\'ll email you shortly.', 'success');
          closeQuoteModal();
          var f = document.getElementById('quoteForm'); if (f) f.reset();
        } else {
          emailFallback(); // Shopify blocked the direct post (e.g. 403) -> open prefilled email
        }
      } catch (error) {
        emailFallback();
      } finally {
        if (btn) { btn.disabled = false; }
      }
    }

    // ============================================
    // SAVE FOR LATER FUNCTIONALITY
    // ============================================

    let savedQuoteData = null;

    // Open save for later modal
    function openSaveForLaterModal() {
      document.getElementById('saveForLaterModal').classList.add('active');
      document.getElementById('saveForLaterForm').style.display = 'block';
      document.getElementById('saveForLaterSuccess').style.display = 'none';
    }

    // Close save for later modal
    function closeSaveForLaterModal() {
      document.getElementById('saveForLaterModal').classList.remove('active');
    }

    // Get current product configuration
    function getCurrentConfiguration() {
      const widthInput = document.getElementById('widthInput');
      const heightInput = document.getElementById('heightInput');
      const quantityInput = document.getElementById('quantityInput');
      const totalPriceEl = document.getElementById('totalPrice');

      // Get selected options
      const selectedFabric = document.querySelector('.fabric-swatch.selected');
      const fabricName = selectedFabric ? (selectedFabric.title || selectedFabric.dataset.name) : 'Standard';
      const fabricImage = selectedFabric ? selectedFabric.style.backgroundImage.replace(/url\(['"]?/, '').replace(/['"]?\)/, '') : '';

      // Get control type
      const controlTypeSelect = document.getElementById('controlType');
      const controlType = controlTypeSelect ? controlTypeSelect.value : 'chain';

      // Get mount type
      const mountSelect = document.getElementById('mountType');
      const mountType = mountSelect ? mountSelect.value : 'inside';

      return {
        productId: product?.id || null,
        productName: document.getElementById('productTitle')?.textContent || 'Window Treatment',
        name: document.getElementById('productTitle')?.textContent || 'Window Treatment',
        width: widthInput ? widthInput.value : '',
        height: heightInput ? heightInput.value : '',
        quantity: quantityInput ? parseInt(quantityInput.value) || 1 : 1,
        price: totalPriceEl ? parseFloat(totalPriceEl.textContent) || 0 : 0,
        unitPrice: totalPriceEl ? parseFloat(totalPriceEl.textContent) || 0 : 0,
        fabric: fabricName,
        fabricName: fabricName,
        fabricImage: fabricImage,
        image: fabricImage || (product?.images?.[0] || PKIMG['pk-placeholder.png']),
        controlType: controlType,
        mount: mountType,
        category: product?.category || 'shades'
      };
    }

    // Submit save for later
    async function submitSaveForLater(e) {
      e.preventDefault();

      const quoteName = document.getElementById('saveQuoteName').value;
      const email = document.getElementById('saveQuoteEmail').value;
      const customerName = document.getElementById('saveQuoteCustomerName').value;

      const config = getCurrentConfiguration();

      try {
        const response = await fetch('/api/quotes/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: quoteName || config.productName,
            customerEmail: email,
            customerName: customerName,
            items: [{
              ...config,
              addedAt: new Date().toISOString()
            }],
            subtotal: config.price * config.quantity,
            source: 'product_page'
          })
        });

        const result = await response.json();

        if (result.success) {
          savedQuoteData = result;

          // Show success state
          document.getElementById('saveForLaterForm').style.display = 'none';
          document.getElementById('saveForLaterSuccess').style.display = 'block';
          document.getElementById('savedShareCode').textContent = result.quote.shareCode;

          showToast('Quote saved successfully!', 'success');
        } else {
          showToast(result.error || 'Error saving quote', 'error');
        }
      } catch (error) {
        console.error('Error saving quote:', error);
        showToast('Error saving quote. Please try again.', 'error');
      }
    }

    // Copy saved quote link
    function copySavedQuoteLink() {
      if (!savedQuoteData) return;

      const shareUrl = window.location.origin + '/quote/' + savedQuoteData.quote.shareCode;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Quote link copied!', 'success');
      }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Quote link copied!', 'success');
      });
    }

    // Toggle FAQ
    function toggleFaq(item) {
      item.classList.toggle('active');
    }

    // Toggle Product Details
    function toggleProductDetails(accordion) {
      accordion.classList.toggle('open');
      const icon = accordion.querySelector('.product-details-icon');
      if (accordion.classList.contains('open')) {
        icon.textContent = '−';
      } else {
        icon.textContent = '+';
      }
    }

    // Toggle Shades Dropdown
    function toggleShadesDropdown() {
      const dropdown = document.getElementById('selectShadesDropdown');
      dropdown.classList.toggle('open');
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      const dropdown = document.getElementById('selectShadesDropdown');
      if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });

    // Image Zoom Modal Functions
    let currentZoom = 1;
    const zoomStep = 0.25;
    const maxZoom = 3;
    const minZoom = 0.5;

    function openZoomModal(imageSrc, caption) {
      const modal = document.getElementById('zoomModal');
      const zoomImage = document.getElementById('zoomImage');
      const zoomCaption = document.getElementById('zoomCaption');

      zoomImage.src = imageSrc;
      zoomCaption.textContent = caption || '';
      currentZoom = 1;
      zoomImage.style.transform = `scale(${currentZoom})`;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeZoomModal(event) {
      if (event && event.target !== event.currentTarget) return;
      const modal = document.getElementById('zoomModal');
      modal.classList.remove('active');
      document.body.style.overflow = '';
      currentZoom = 1;
    }

    function zoomIn() {
      if (currentZoom < maxZoom) {
        currentZoom += zoomStep;
        document.getElementById('zoomImage').style.transform = `scale(${currentZoom})`;
      }
    }

    function zoomOut() {
      if (currentZoom > minZoom) {
        currentZoom -= zoomStep;
        document.getElementById('zoomImage').style.transform = `scale(${currentZoom})`;
      }
    }

    function resetZoom() {
      currentZoom = 1;
      document.getElementById('zoomImage').style.transform = `scale(${currentZoom})`;
    }

    // Close zoom modal on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeZoomModal();
      }
    });

    // Share product
    function shareProduct() {
      if (navigator.share) {
        navigator.share({
          title: document.getElementById('productTitle').textContent,
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        showToast('Link copied!', 'success');
      }
    }

    // Load trending products
    async function loadTrendingProducts() {
      const productImages = [
        'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=400',
        'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=400',
        'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400'
      ];

      const trendingProducts = [
        { name: 'Affordable Custom Roller Blinds & shades', price: 40.00, slug: 'affordable-custom-roller-blinds' },
        { name: 'Energy Efficient Roman Shades', price: 89.79, slug: 'energy-efficient-roman-shades' },
        { name: 'Affordable Custom Zebra Window Blinds', price: 50.00, slug: 'affordable-zebra-window-blinds' },
        { name: 'Affordable Custom Roller Blinds & shades', price: 40.00, slug: 'blackout-roller-blinds' }
      ];

      const grid = document.getElementById('trendsGrid');
      grid.innerHTML = trendingProducts.map((p, i) => `
        <div class="product-card" onclick="window.location.href='/product/${p.slug}'">
          <div class="product-card-image">
            <img src="${productImages[i]}" alt="${p.name}">
          </div>
          <div class="product-card-info">
            <h3 class="product-card-title">${p.name}</h3>
            <div class="product-card-price">$${p.price.toFixed(2)} USD</div>
          </div>
        </div>
      `).join('');
    }

    // Close modals on outside click
    document.getElementById('quoteModal').addEventListener('click', function(e) {
      if (e.target === this) closeQuoteModal();
    });

    // ============================================
    // IMAGE POSITION EDITOR - Press Ctrl+Shift+E to toggle
    // ============================================
    let imageEditorActive = false;
    let currentEditingImage = null;
    let editorPanel = null;

    // Create editor panel
    function createEditorPanel() {
      const panel = document.createElement('div');
      panel.id = 'imageEditorPanel';
      panel.innerHTML = `
        <style>
          #imageEditorPanel {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: 'Montserrat', sans-serif;
            display: none;
          }
          #imageEditorPanel.active { display: block; }
          .editor-header {
            background: #8E6545;
            color: white;
            padding: 15px;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .editor-header h3 { margin: 0; font-size: 14px; }
          .editor-close { background: none; border: none; color: white; font-size: 20px; cursor: pointer; }
          .editor-body { padding: 15px; }
          .editor-info { background: #F6F1EB; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 12px; color: #666; }
          .editor-label { font-size: 12px; font-weight: 600; color: #333; margin-bottom: 8px; display: block; }
          .editor-slider-group { margin-bottom: 15px; }
          .editor-slider { width: 100%; margin: 5px 0; }
          .editor-value { font-size: 11px; color: #8E6545; font-weight: 600; }
          .editor-preview {
            width: 100%; height: 120px; border: 2px dashed #ccc; border-radius: 8px;
            overflow: hidden; margin-bottom: 15px; background: #f5f5f5;
            display: flex; align-items: center; justify-content: center;
          }
          .editor-preview img { width: 100%; height: 100%; }
          .editor-btn {
            width: 100%; padding: 12px; background: #8E6545; color: white;
            border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
            margin-bottom: 8px; font-size: 13px;
          }
          .editor-btn:hover { background: #7A5639; }
          .editor-btn.secondary { background: #E5E5E5; color: #333; }
          .editor-code {
            background: #1a1a1a; color: #4ade80; padding: 10px; border-radius: 8px;
            font-size: 11px; font-family: monospace; word-break: break-all; margin-top: 10px;
          }
          .editable-image {
            outline: 3px dashed #8E6545 !important;
            cursor: move !important;
            position: relative;
          }
          .editable-image::after {
            content: 'Click to Edit';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(142, 101, 69, 0.9);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            pointer-events: none;
          }
        .pk-home-wrap{position:relative;}
</style>
        <div class="editor-header">
          <h3>🎨 Image Position Editor</h3>
          <button class="editor-close" onclick="toggleImageEditor()">&times;</button>
        </div>
        <div class="editor-body">
          <div class="editor-info">
            <strong>How to use:</strong><br>
            1. Click on any hardware image to select it<br>
            2. Use sliders to adjust position<br>
            3. Copy the generated CSS code
          </div>
          <div id="editorContent">
            <p style="text-align: center; color: #999; font-size: 13px;">Click on an image to start editing</p>
          </div>
        </div>
      `;
      document.body.appendChild(panel);
      return panel;
    }

    // Toggle editor mode
    function toggleImageEditor() {
      imageEditorActive = !imageEditorActive;

      if (!editorPanel) {
        editorPanel = createEditorPanel();
      }

      if (imageEditorActive) {
        editorPanel.classList.add('active');
        enableImageSelection();
        showToast('Image Editor Enabled - Click on images to edit', 'success');
      } else {
        editorPanel.classList.remove('active');
        disableImageSelection();
        showToast('Image Editor Disabled', 'info');
      }
    }

    // Enable image selection
    function enableImageSelection() {
      const images = document.querySelectorAll('.hardware-option img, .hardware-swatches img');
      images.forEach(img => {
        img.classList.add('editable-image');
        img.addEventListener('click', selectImageForEdit);
      });
    }

    // Disable image selection
    function disableImageSelection() {
      const images = document.querySelectorAll('.editable-image');
      images.forEach(img => {
        img.classList.remove('editable-image');
        img.removeEventListener('click', selectImageForEdit);
      });
      currentEditingImage = null;
    }

    // Select image for editing
    function selectImageForEdit(e) {
      e.preventDefault();
      e.stopPropagation();

      // Remove previous selection
      document.querySelectorAll('.editable-image.selected').forEach(img => {
        img.classList.remove('selected');
        img.style.outline = '3px dashed #8E6545';
      });

      currentEditingImage = e.target;
      currentEditingImage.classList.add('selected');
      currentEditingImage.style.outline = '3px solid #4ade80';

      // Get current object-position
      const style = window.getComputedStyle(currentEditingImage);
      let objectPosition = style.objectPosition || '50% 50%';
      let objectFit = style.objectFit || 'cover';

      // Parse position values
      const posMatch = objectPosition.match(/(\d+)%\s*(\d+)%/);
      let posX = posMatch ? parseInt(posMatch[1]) : 50;
      let posY = posMatch ? parseInt(posMatch[2]) : 50;

      // Update editor content
      const editorContent = document.getElementById('editorContent');
      editorContent.innerHTML = `
        <div class="editor-preview">
          <img id="previewImage" src="${currentEditingImage.src}" style="object-fit: ${objectFit}; object-position: ${posX}% ${posY}%;">
        </div>

        <div class="editor-slider-group">
          <label class="editor-label">Horizontal Position (X): <span class="editor-value" id="posXValue">${posX}%</span></label>
          <input type="range" class="editor-slider" id="posXSlider" min="0" max="100" value="${posX}" oninput="updateImagePosition()">
        </div>

        <div class="editor-slider-group">
          <label class="editor-label">Vertical Position (Y): <span class="editor-value" id="posYValue">${posY}%</span></label>
          <input type="range" class="editor-slider" id="posYSlider" min="0" max="100" value="${posY}" oninput="updateImagePosition()">
        </div>

        <div class="editor-slider-group">
          <label class="editor-label">Object Fit:</label>
          <select id="objectFitSelect" onchange="updateImagePosition()" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #ccc;">
            <option value="contain" ${objectFit === 'contain' ? 'selected' : ''}>Contain (show full image)</option>
            <option value="cover" ${objectFit === 'cover' ? 'selected' : ''}>Cover (fill container)</option>
            <option value="fill" ${objectFit === 'fill' ? 'selected' : ''}>Fill (stretch)</option>
          </select>
        </div>

        <button class="editor-btn" onclick="applyToImage()">✓ Apply Changes</button>
        <button class="editor-btn secondary" onclick="resetImage()">↺ Reset to Default</button>

        <div class="editor-code" id="generatedCode">
          object-fit: ${objectFit};<br>object-position: ${posX}% ${posY}%;
        </div>
        <button class="editor-btn secondary" onclick="copyCode()" style="margin-top: 8px;">📋 Copy CSS Code</button>
      `;
    }

    // Update image position in real-time
    function updateImagePosition() {
      if (!currentEditingImage) return;

      const posX = document.getElementById('posXSlider').value;
      const posY = document.getElementById('posYSlider').value;
      const objectFit = document.getElementById('objectFitSelect').value;

      document.getElementById('posXValue').textContent = posX + '%';
      document.getElementById('posYValue').textContent = posY + '%';

      // Update preview
      const preview = document.getElementById('previewImage');
      preview.style.objectPosition = `${posX}% ${posY}%`;
      preview.style.objectFit = objectFit;

      // Update actual image
      currentEditingImage.style.objectPosition = `${posX}% ${posY}%`;
      currentEditingImage.style.objectFit = objectFit;

      // Update code
      document.getElementById('generatedCode').innerHTML = `object-fit: ${objectFit};<br>object-position: ${posX}% ${posY}%;`;
    }

    // Apply changes
    function applyToImage() {
      if (!currentEditingImage) return;
      showToast('Changes applied! Copy the CSS code to make permanent.', 'success');
    }

    // Reset image
    function resetImage() {
      if (!currentEditingImage) return;
      currentEditingImage.style.objectPosition = '50% 50%';
      currentEditingImage.style.objectFit = 'contain';

      document.getElementById('posXSlider').value = 50;
      document.getElementById('posYSlider').value = 50;
      document.getElementById('objectFitSelect').value = 'contain';
      updateImagePosition();
    }

    // Copy generated code
    function copyCode() {
      const code = document.getElementById('generatedCode').innerText;
      navigator.clipboard.writeText(code);
      showToast('CSS code copied to clipboard!', 'success');
    }

    // Keyboard shortcut: Ctrl+Shift+E
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        toggleImageEditor();
      }
    });

    // Add edit button to page
    const editButton = document.createElement('button');
    editButton.innerHTML = '🎨 Edit Images';
    editButton.style.cssText = 'position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; background: #8E6545; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; z-index: 9999; font-family: Montserrat, sans-serif; box-shadow: 0 4px 15px rgba(0,0,0,0.2);';
    editButton.onclick = toggleImageEditor;
    document.body.appendChild(editButton);
  


    // Fabric Zoom Functions
    const fabricSpecsData = {
      // Will be populated from technical_specifications.json
    };

    function openFabricZoom(code, imageSrc, event) {
      event.stopPropagation();
      const modal = document.getElementById('fabricZoomModal');
      const img = document.getElementById('zoomFabricImage');
      const codeEl = document.getElementById('zoomFabricCode');
      const specsEl = document.getElementById('zoomFabricSpecs');

      img.src = imageSrc;
      codeEl.textContent = 'Fabric Code: ' + code;

      // Show modal
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeFabricZoom() {
      const modal = document.getElementById('fabricZoomModal');
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }

    // Close on background click
    document.getElementById('fabricZoomModal').addEventListener('click', function(e) {
      if (e.target === this) {
        closeFabricZoom();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeFabricZoom();
      }
    });

    // Add hover effect to show zoom buttons
    document.querySelectorAll('.fabric-swatch').forEach(swatch => {
      swatch.addEventListener('mouseenter', function() {
        const zoomBtn = this.querySelector('.zoom-btn');
        if (zoomBtn) zoomBtn.style.opacity = '1';
      });
      swatch.addEventListener('mouseleave', function() {
        const zoomBtn = this.querySelector('.zoom-btn');
        if (zoomBtn) zoomBtn.style.opacity = '0';
      });
    });
  


    // Load product content from API
    async function loadProductContent() {
      try {
        // Use fast combined endpoint - single request for all data
        const response = await fetch('/api/product-page-data');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Render fabrics
            if (data.fabrics && data.fabrics.length > 0) {
              renderFabricsFromAPI(data.fabrics);
            }
            // Cache data for later use
            window.productPageData = data;
          }
        }

        // Load room labels
        const roomLabelsRes = await fetch('/api/room-labels');
        if (roomLabelsRes.ok) {
          const roomData = await roomLabelsRes.json();
          if (roomData.success && roomData.data && roomData.data.length > 0) {
            renderRoomLabels(roomData.data);
          }
        }
      } catch (error) {
        console.log('Using default content, API not available:', error.message);
      }
    }

    // Render fabrics from API data
    function renderFabricsFromAPI(fabrics) {
      const blackoutContainer = document.getElementById('blackoutFabrics');
      const semiBlackoutContainer = document.getElementById('semiBlackoutFabrics');
      const transparentContainer = document.getElementById('transparentFabrics');

      // Filter active fabrics by type
      const activeFabrics = fabrics.filter(f => f.isActive);
      const blackoutFabrics = activeFabrics.filter(f => f.filterType === 'blackout');
      const semiBlackoutFabrics = activeFabrics.filter(f => f.filterType === 'semi-blackout');
      const transparentFabrics = activeFabrics.filter(f => f.filterType === 'transparent');

      // Sort by sortOrder
      const sortByOrder = (a, b) => (a.sortOrder || 999) - (b.sortOrder || 999);

      // Render each category
      if (blackoutContainer && blackoutFabrics.length > 0) {
        blackoutContainer.innerHTML = blackoutFabrics.sort(sortByOrder).map(f => createFabricSwatchHTML(f)).join('');
        attachZoomHoverEvents(blackoutContainer);
      }

      if (semiBlackoutContainer && semiBlackoutFabrics.length > 0) {
        semiBlackoutContainer.innerHTML = semiBlackoutFabrics.sort(sortByOrder).map(f => createFabricSwatchHTML(f)).join('');
        attachZoomHoverEvents(semiBlackoutContainer);
      }

      if (transparentContainer && transparentFabrics.length > 0) {
        transparentContainer.innerHTML = transparentFabrics.sort(sortByOrder).map(f => createFabricSwatchHTML(f)).join('');
        attachZoomHoverEvents(transparentContainer);
      }
    }

    // Create HTML for a single fabric swatch
    function createFabricSwatchHTML(fabric) {
      const code = escapeHtml(fabric.code);
      const imageUrl = fabric.imageUrl;

      return `
        <div class="fabric-swatch" data-code="${code}" onclick="selectFabricSwatch(this, event)" style="width: 90px; text-align: center; cursor: pointer; position: relative;">
          <div class="swatch-img-container">
            <img src="${imageUrl}" alt="${code}" loading="lazy" decoding="async" style="width: 75px; height: 75px; border-radius: 8px; object-fit: cover; border: 2px solid transparent;" onerror="this.src=PKIMG['pk-placeholder.png']">
            <button type="button" class="zoom-btn" onclick="openFabricZoom('${code}', '${imageUrl}', event)" title="Zoom">🔍</button>
          </div>
          <span style="font-size: 10px; color: #5C4A3A; display: block; margin-top: 4px;">${code}</span>
        </div>
      `;
    }

    // Attach zoom hover events to fabric swatches
    function attachZoomHoverEvents(container) {
      container.querySelectorAll('.fabric-swatch').forEach(swatch => {
        swatch.addEventListener('mouseenter', function() {
          const zoomBtn = this.querySelector('.zoom-btn');
          if (zoomBtn) zoomBtn.style.opacity = '1';
        });
        swatch.addEventListener('mouseleave', function() {
          const zoomBtn = this.querySelector('.zoom-btn');
          if (zoomBtn) zoomBtn.style.opacity = '0';
        });
      });
    }

    // Render room labels dynamically
    function renderRoomLabels(labels) {
      const roomSelect = document.getElementById('roomLabel');
      if (roomSelect && labels.length > 0) {
        roomSelect.innerHTML = labels.map(label =>
          `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`
        ).join('');
      }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Render product features
    function renderProductFeatures(items) {
      const container = document.getElementById('productFeatures');
      if (!container || !items || items.length === 0) return;

      container.innerHTML = items.map(item => `
        <div style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: #fff; border: 1px solid #E8E4E0; border-radius: 20px; font-size: 13px; color: #333;">
          <i class="fas ${escapeHtml(item.icon || 'fa-check')}" style="color: #8E6545;"></i>
          <span>${escapeHtml(item.text || '')}</span>
        </div>
      `).join('');
      container.style.display = 'flex';
    }

    // Render trust badges
    function renderTrustBadges(items) {
      const container = document.getElementById('trustBadges');
      if (!container || !items || items.length === 0) return;

      container.innerHTML = items.map(item => `
        <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #333;">
          <i class="fas ${escapeHtml(item.icon || 'fa-shield-alt')}" style="color: #8E6545; font-size: 18px;"></i>
          <span>${escapeHtml(item.text || '')}</span>
        </div>
      `).join('');
      container.style.display = 'flex';
    }

    // Load product specifications from API
    async function loadProductSpecs() {
      try {
        const productSlug = window.location.pathname.split('/').pop();

        // Determine product type from slug
        let productType = 'roller';
        if (productSlug.includes('zebra')) productType = 'zebra';
        else if (productSlug.includes('roman')) productType = 'roman';
        else if (productSlug.includes('honeycomb')) productType = 'honeycomb';

        const response = await fetch(`/api/specs?productType=${productType}`);
        if (!response.ok) return;

        const result = await response.json();
        if (!result.success || !result.data) return;

        const specs = result.data;

        // Update Product Details section
        if (specs.features && specs.features.length > 0) {
          const featuresList = document.getElementById('productFeaturesList');
          if (featuresList) {
            featuresList.innerHTML = specs.features.map(f => `<li>${escapeHtml(f)}</li>`).join('');
          }
        }

        if (specs.careInstructions) {
          const careEl = document.getElementById('careInstructions');
          if (careEl) careEl.textContent = specs.careInstructions;
        }

        if (specs.warranty) {
          const warrantyEl = document.getElementById('warrantyInfo');
          if (warrantyEl) warrantyEl.textContent = specs.warranty;
        }

        // Update Product Catalogs section
        if (specs.description?.long) {
          const featuresText = document.getElementById('catalogFeaturesText');
          if (featuresText) featuresText.innerHTML = specs.description.long;
        }

        // Update Valance Options
        if (specs.specifications?.valanceTypes && specs.specifications.valanceTypes.length > 0) {
          const valanceGrid = document.getElementById('valanceGrid');
          if (valanceGrid) {
            valanceGrid.innerHTML = specs.specifications.valanceTypes.map(v => `
              <div class="catalog-item">
                <strong>${escapeHtml(v.name || v.code)}</strong>
                <span>${escapeHtml(v.dimensions || v.tubeSize || '')}</span>
              </div>
            `).join('');
          }

          // Update side cover colors if available
          if (specs.specifications.sideCoverColors) {
            const sideCoverEl = document.getElementById('sideCoverColors');
            if (sideCoverEl) {
              sideCoverEl.innerHTML = `<strong>Side Cover Colors:</strong> ${specs.specifications.sideCoverColors.map(c => escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))).join(', ')}`;
            }
          }
        }

        // Update Bottom Rail Options
        if (specs.specifications?.bottomRails && specs.specifications.bottomRails.length > 0) {
          const bottomRailGrid = document.getElementById('bottomRailGrid');
          if (bottomRailGrid) {
            bottomRailGrid.innerHTML = specs.specifications.bottomRails.map(b => `
              <div class="catalog-item">
                <strong>${escapeHtml(b.name || b.code)}</strong>
                <span>${b.colors ? escapeHtml(b.colors.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')) : ''}</span>
              </div>
            `).join('');
          }
        }

        // Update Roll Types as Configuration Features
        if (specs.specifications?.rollTypes) {
          const configList = document.getElementById('configFeaturesList');
          if (configList) {
            let configItems = [];
            specs.specifications.rollTypes.forEach(rt => {
              if (rt.toLowerCase().includes('forward')) {
                configItems.push(`<li><strong>Forward Roll:</strong> Fabric rolls off the back, closest to glazing</li>`);
              } else if (rt.toLowerCase().includes('reverse')) {
                configItems.push(`<li><strong>Reverse Roll:</strong> Fabric rolls off the front, extra clearance for window handles</li>`);
              }
            });
            configItems.push(`<li><strong>Rectangular:</strong> Standard window shape</li>`);
            configItems.push(`<li><strong>Multiple Linked:</strong> Single motor operates two or more blinds</li>`);
            configList.innerHTML = configItems.join('');
          }
        }

        // Update Light Blocker Options
        if (specs.specifications?.lightBlocker) {
          const lightBlockerGrid = document.getElementById('lightBlockerGrid');
          if (lightBlockerGrid && specs.specifications.lightBlocker.types) {
            lightBlockerGrid.innerHTML = specs.specifications.lightBlocker.types.map(t => `
              <div class="catalog-item">
                <strong>${escapeHtml(t)}</strong>
                <span>${specs.specifications.lightBlocker.colors ? escapeHtml(specs.specifications.lightBlocker.colors.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')) : ''}</span>
              </div>
            `).join('');
          }
        }

        // Update Size Chart with dimensions from specs
        if (specs.specifications?.dimensions) {
          const dims = specs.specifications.dimensions;
          const minW = dims.minWidth?.value || 30;
          const maxW = dims.maxWidth?.value || 300;
          const minH = dims.minHeight?.value || 50;
          const maxH = dims.maxHeight?.value || 430;

          // Update note with actual specs
          const sizeNote = document.getElementById('sizeChartNote');
          if (sizeNote) {
            const minArea = specs.specifications.minimumArea;
            let noteText = `<strong>Note:</strong> Size range: ${minW}-${maxW}cm (width) x ${minH}-${maxH}cm (height).`;
            if (minArea) {
              noteText += ` Minimum billable area: ${minArea.value} ${minArea.unit}.`;
            }
            if (result.commonSpecs?.motors?.minWidthForAM28Motor) {
              noteText += ` Minimum width for AM28 motorized: ${result.commonSpecs.motors.minWidthForAM28Motor}.`;
            }
            sizeNote.innerHTML = noteText;
          }
        }

        console.log('Product specs loaded from API:', productType);
      } catch (error) {
        console.log('Specs API not available, using default content:', error.message);
      }
    }

    // Load content when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
      loadProductContent();
      loadPageSections();
      loadProductSpecs();
    });

    // Load page sections from the page builder
    async function loadPageSections() {
      try {
        const slug = window.location.pathname.split('/').pop();
        const response = await fetch(`/api/product-page-sections/${slug}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.sections) {
            applyPageSections(data.sections);
          }
        }
      } catch (error) {
        console.log('Page sections not available:', error.message);
      }
    }

    // Apply page sections to the product page
    function applyPageSections(sections) {
      sections.forEach(section => {
        if (!section.isVisible) return;

        switch (section.type) {
          case 'product-title':
            if (section.data?.title) {
              const titleEl = document.getElementById('productTitle');
              if (titleEl) titleEl.textContent = section.data.title;
            }
            if (section.data?.description) {
              const descEl = document.getElementById('productDescription');
              if (descEl) descEl.textContent = section.data.description;
            }
            break;

          case 'image-gallery':
            if (section.data?.mainImage || section.data?.images?.length > 0) {
              updateProductGalleryFromSections(section.data);
            }
            break;

          case 'features':
            if (section.data?.items && section.data.items.length > 0) {
              renderProductFeatures(section.data.items);
            }
            break;

          case 'trust-badges':
            if (section.data?.items && section.data.items.length > 0) {
              renderTrustBadges(section.data.items);
            }
            break;
        }
      });
    }

    // Update gallery from section data
    function updateProductGalleryFromSections(data) {
      const mainImageEl = document.getElementById('mainProductImage');
      const thumbnailColumn = document.querySelector('.thumbnail-column');

      const images = [];
      if (data.mainImage) images.push(data.mainImage);
      if (data.images && Array.isArray(data.images)) {
        images.push(...data.images.filter(Boolean));
      }

      if (images.length === 0) return;

      // Update main image
      if (mainImageEl) {
        mainImageEl.src = images[0];
      }

      // Update thumbnails
      if (thumbnailColumn && images.length > 0) {
        thumbnailColumn.innerHTML = images.slice(0, 4).map((img, i) => `
          <div class="thumb-item ${i === 0 ? 'active' : ''}" onclick="changeImage(this, '${img}')">
            <img src="${img}" alt="Thumbnail ${i + 1}">
          </div>
        `).join('');
      }
    }

    // Listen for messages from the page editor (for live preview)
    window.addEventListener('message', function(event) {
      if (event.data.type === 'UPDATE_PAGE_SECTIONS') {
        applyPageSections(event.data.sections);
      }
      if (event.data.type === 'HIGHLIGHT_SECTION') {
        // Could add visual highlighting of sections here
        console.log('Highlight section:', event.data.sectionId);
      }
    });
  

/* ==== Peekaboo Shopify overrides: no backend, so run client-side ==== */

// 1) Manufacturer: only PeekabooShades \u2014 render it selected (kills the infinite "Loading manufacturers\u2026")
window.loadManufacturers = function(){
  var c = document.getElementById('manufacturerOptions');
  if(!c) return;
  c.innerHTML =
    '<div class="manufacturer-option selected" data-manufacturer-id="peekabooshades" data-pricing-linked="true" onclick="return false;">'
    + '<div class="manufacturer-info"><div class="manufacturer-name">PeekabooShades '
    + '<span class="manufacturer-badge available">Available</span></div>'
    + '<div class="manufacturer-meta">Premium roller shade manufacturer</div></div>'
    + '<div class="manufacturer-radio"></div></div>'
    + '<div class="manufacturer-option" data-manufacturer-id="clarashades" onclick="window.location.href=\'/pages/clara-shades\'; return false;" style="cursor:pointer;">'
    + '<div class="manufacturer-info"><div class="manufacturer-name">Clara Shades '
    + '<span class="manufacturer-badge available">Simulator</span></div>'
    + '<div class="manufacturer-meta">Design &amp; visualize your shades — opens the Shade Simulator</div></div>'
    + '<div class="manufacturer-radio"></div></div>';
  window.selectedManufacturer = 'peekabooshades';
};

// 2) Backend data loaders -> no-op (keep the static PeekabooShades HTML already on the page)
window.loadProduct = function(){};
window.loadProductOptions = function(){};
window.loadProductContent = function(){};
window.loadProductSpecs = function(){};

// 3) REAL pricing — GitHub per-m² engine (fabric SKU × area × margin + options)
window.PK_ROLLER_PRICING = {"82086K":[12.99,18.99,40,40],"82086W":[12.99,16.24,40,40],"82086B":[12.99,16.24,40,40],"82086C":[12.99,16.24,40,40],"82086E":[12.99,16.24,40,40],"82067E":[13.34,16.59,40,40],"82067F":[13.34,16.59,40,40],"82159A":[13.27,16.59,40,40],"82159C":[13.27,16.59,40,40],"82159D":[13.27,16.59,40,40],"82159E":[13.27,16.59,40,40],"82006S":[13.34,16.59,40,40],"82006H":[13.34,16.59,40,40],"82006F":[13.34,16.59,40,40],"82010G":[14.03,17.28,40,40],"82010V":[14.03,17.28,40,40],"82010J":[14.03,17.28,40,40],"82010T":[14.03,17.28,40,40],"82010E":[14.03,17.28,40,40],"82010L":[14.03,17.28,40,40],"82010Y":[14.03,17.28,40,40],"82010I":[14.03,17.28,40,40],"82010M":[14.03,17.28,40,40],"82067M":[14.03,17.28,40,40],"82067N":[14.03,17.28,40,40],"82067G":[14.03,17.28,40,40],"82067H":[14.03,17.28,40,40],"82067I":[14.03,17.28,40,40],"82067U":[14.03,17.28,40,40],"82082A":[14.38,17.63,40,40],"82082B":[14.38,17.63,40,40],"82082K":[14.38,17.63,40,40],"82082D":[14.38,17.63,40,40],"82082I":[14.38,17.63,40,40],"82082C":[14.38,17.63,40,40],"82086F":[14.45,17.69,40,40],"82086G":[14.45,17.69,40,40],"82086H":[14.45,17.69,40,40],"82086J":[14.45,17.69,40,40],"82072C":[14.51,17.76,40,40],"82072D":[14.51,17.76,40,40],"82072I":[14.51,17.76,40,40],"82027F":[14.72,17.97,40,40],"82027G":[14.72,17.97,40,40],"82027A":[14.72,17.97,40,40],"82027B":[14.72,17.97,40,40],"82027C":[14.72,17.97,40,40],"82027E":[14.72,17.97,40,40],"82027H":[14.72,17.97,40,40],"82076A":[14.72,17.97,40,40],"82076B":[14.72,17.97,40,40],"82076C":[14.72,17.97,40,40],"82076D":[14.72,17.97,40,40],"82146A":[14.72,17.97,40,40],"82146B":[14.72,17.97,40,40],"82146C":[14.72,17.97,40,40],"82146D":[14.72,17.97,40,40],"82146E":[14.72,17.97,40,40],"82006A":[14.93,18.18,40,40],"82006B":[14.93,18.18,40,40],"82006C":[14.93,18.18,40,40],"82006O":[14.93,18.18,40,40],"82006Q":[14.93,18.18,40,40],"82006R":[14.93,18.18,40,40],"82006M":[14.93,18.18,40,40],"82006L":[14.93,18.18,40,40],"82006N":[14.93,18.18,40,40],"82141A":[15.41,18.66,40,40],"82141B":[15.41,18.66,40,40],"82141C":[15.41,18.66,40,40],"82141D":[15.41,18.66,40,40],"82156A":[15.41,18.66,40,40],"82156B":[15.41,18.66,40,40],"82156C":[15.41,18.66,40,40],"82156D":[15.41,18.66,40,40],"82156E":[15.41,18.66,40,40],"82156F":[15.41,18.66,40,40],"82167A":[15.41,18.66,40,40],"82167B":[15.41,18.66,40,40],"82167C":[15.41,18.66,40,40],"82167D":[15.41,18.66,40,40],"82167E":[15.41,18.66,40,40],"82072F":[15.41,18.66,40,40],"82072G":[15.41,18.66,40,40],"82072H":[15.41,18.66,40,40],"82067K":[15.76,19.01,40,40],"82067L":[15.76,19.01,40,40],"82067A":[15.76,19.01,40,40],"82067B":[15.76,19.01,40,40],"82067O":[15.76,19.01,40,40],"82067P":[15.76,19.01,40,40],"82067C":[15.76,19.01,40,40],"82067V":[15.76,19.01,40,40],"82161A":[15.76,19.01,40,40],"82161B":[15.76,19.01,40,40],"82161C":[15.76,19.01,40,40],"82144A":[16.1,19.35,40,40],"82144B":[16.1,19.35,40,40],"82144C":[16.1,19.35,40,40],"82144D":[16.1,19.35,40,40],"82026A":[16.1,19.35,40,40],"82026B":[16.1,19.35,40,40],"82026C":[16.1,19.35,40,40],"82026E":[16.1,19.35,40,40],"82026F":[16.1,19.35,40,40],"82137A":[16.45,19.7,40,40],"82137D":[16.45,19.7,40,40],"82137E":[16.45,19.7,40,40],"82137C":[16.45,19.7,40,40],"82137F":[16.45,19.7,40,40],"82137G":[16.45,19.7,40,40],"82137B":[16.45,19.7,40,40],"82147A":[16.45,19.7,40,40],"82147B":[16.45,19.7,40,40],"82147C":[16.45,19.7,40,40],"82147D":[16.45,19.7,40,40],"82066A":[17.14,20.39,40,40],"82066B":[17.14,20.39,40,40],"82066C":[17.14,20.39,40,40],"82066D":[17.14,20.39,40,40],"82066E":[17.14,20.39,40,40],"82066F":[17.14,20.39,40,40],"82066G":[17.14,20.39,40,40],"82032A":[19.91,23.15,40,40],"82032B":[19.91,23.15,50,50],"82032D":[19.91,23.15,40,40],"82032E":[19.91,23.15,40,40],"82032F":[19.91,23.15,40,40],"82032G":[19.91,23.15,40,40],"82032H":[19.91,23.15,40,40],"82032I":[19.91,23.15,40,40],"82143A":[19.91,23.15,40,40],"82143B":[19.91,23.15,40,40],"82143C":[19.91,23.15,40,40],"82132D":[20.94,24.19,40,40],"82132E":[20.94,24.19,40,40],"82132F":[20.94,24.19,40,40],"82132G":[20.94,24.19,40,40],"82170A":[21.28,24.53,40,40],"82170B":[21.28,24.53,40,40],"82170C":[21.28,24.53,40,40],"82133A":[17.14,20.39,40,40],"82133B":[17.14,20.39,40,40],"82133C":[17.14,20.39,40,40],"82133D":[17.14,20.39,40,40],"82133E":[17.14,20.39,40,40],"82077A":[17.14,20.39,40,40],"82077B":[17.14,20.39,40,40],"82077C":[17.14,20.39,40,40],"82077D":[17.14,20.39,40,40],"82028F":[17.14,20.39,40,40],"82028G":[17.14,20.39,40,40],"82028H":[17.14,20.39,40,40],"82028A":[17.14,20.39,40,40],"82028B":[17.14,20.39,40,40],"82028C":[17.14,20.39,40,40],"82028E":[17.14,20.39,40,40],"82024A":[17.14,20.39,40,40],"82024B":[17.14,20.39,40,40],"82024C":[17.14,20.39,40,40],"82024E":[17.14,20.39,40,40]};
function pkRow(l,v){ return '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>'+l+'</span><span>$'+(Math.round(v*100)/100).toFixed(2)+'</span></div>'; }
window.calculatePriceFromAPI = function(){
  try {
    var g=function(id){return document.getElementById(id);};
    var r2=function(n){return Math.round(n*100)/100;};
    var w=parseFloat((g('widthInput')||{}).value)||24;
    var h=parseFloat((g('heightInput')||{}).value)||36;
    var qty=parseInt((g('quantityInput')||{}).value)||1; if(qty<1)qty=1;
    // control type
    var ctEl=document.querySelector('#controlTypeSwatches .hardware-option.selected');
    var ctv=ctEl?(ctEl.getAttribute('data-value')||'manual'):'manual';
    var controlType=ctv.indexOf('cordless')>-1?'cordless':(ctv.indexOf('motor')>-1?'motorized':'manual');
    // fabric SKU
    var fEl=document.querySelector('.fabric-swatch.selected');
    var code=fEl?((fEl.getAttribute('data-code')||'').toUpperCase()):'';
    var rec=window.PK_ROLLER_PRICING[code];
    var perSqM,priced;
    var margin=100; // 100% margin on all products (per business rule)
    if(rec){ priced=true; perSqM=(controlType==='cordless')?(rec[1]||rec[0]):rec[0]; }
    else { priced=false; perSqM=14.00; }
    // area m2, min 1.2 (GitHub roller rule)
    var rawArea=(w*0.0254)*(h*0.0254);
    var area=Math.max(rawArea,1.2);
    var fabricCost=area*perSqM;
    var base=fabricCost*(1+margin/100);
    // per-unit options — sum EVERY selected priced option (chain, motor, motor-type, remote, solar, etc.), gated by control type
    var perUnit=0, opts=[];
    var pkLabel=function(el){ var s=el.querySelector('span'); return s?((s.textContent||'').trim().slice(0,40)):((el.getAttribute('data-value')||'Option')); };
    document.querySelectorAll('[data-price].selected').forEach(function(el){
      var p=parseFloat(el.getAttribute('data-price'))||0;
      if(p<=0) return;
      // motor/motor-type/remote/solar apply only to motorized shades
      if(el.closest('#motorBrandSwatches,#motorTypeSwatches,#remoteTypeSwatches,#solarTypeSwatches') && controlType!=='motorized') return;
      // chain applies only to manual/cordless (chain-operated) shades
      if(el.closest('#chainTypeSwatches') && controlType==='motorized') return;
      perUnit+=p; opts.push([pkLabel(el),p]);
    });
    var unitPrice=base+perUnit;
    // accessories (added once, not × qty) + warranty — margin/selling prices
    var smartHub=parseInt((g('smartHubQty')||{}).value)||0;
    var usb=parseInt((g('usbChargerQty')||{}).value)||0;
    var accessories=smartHub*32.90+usb*7.00;
    var warranty=(g('extendedWarranty')||{}).checked?25:0;
    var lineTotal=unitPrice*qty+accessories+warranty;
    // update headline numbers
    var bp=g('basePrice'); if(bp) bp.textContent=r2(unitPrice).toFixed(2);
    var tp=g('totalPrice'); if(tp) tp.textContent=r2(lineTotal).toFixed(2);
    var sp=g('summaryTotal'); if(sp) sp.textContent='$'+r2(lineTotal).toFixed(2);
    var sub=g('breakdownSubtotal'); if(sub) sub.textContent=r2(lineTotal).toFixed(2);
    // breakdown
    var bi=g('breakdownItems');
    if(bi){
      var rows='';
      rows+=pkRow('Fabric '+(code||'—')+' ('+r2(area)+' m\u00b2 \u00d7 $'+perSqM+'/m\u00b2)', r2(fabricCost));
      rows+=pkRow('Margin ('+margin+'%)', r2(base-fabricCost));
      for(var i=0;i<opts.length;i++) rows+=pkRow(opts[i][0], opts[i][1]);
      rows+=pkRow('Unit price', r2(unitPrice));
      if(qty>1) rows+=pkRow('Quantity \u00d7'+qty, r2(unitPrice*qty));
      if(accessories>0) rows+=pkRow('Accessories', r2(accessories));
      if(warranty>0) rows+=pkRow('Extended warranty (3 yr)', warranty);
      if(!priced) rows+='<div style="color:#b8860b;font-size:11px;margin-top:6px;">* Estimated \u2014 this fabric code is not yet in the price list.</div>';
      bi.innerHTML=rows;
    }
    window.PK_LAST_PRICE={code:code,controlType:controlType,width:w,height:h,qty:qty,unitPrice:r2(unitPrice),lineTotal:r2(lineTotal)};
  } catch(e){ if(window.console) console.warn('pk price calc',e); }
};
window.calculatePrice = function(){ window.calculatePriceFromAPI(); };

// Quote form: put the full configuration into the hidden field, then let the Shopify contact form submit natively
window.fillQuoteConfig = function(){
  try {
    var pick = function(sel){ var el=document.querySelector(sel); return el ? (el.getAttribute('data-code') || el.getAttribute('data-value') || (el.textContent||'').trim()) : '-'; };
    var val = function(id){ var el=document.getElementById(id); return el ? (el.value||'') : ''; };
    var control = pick('#controlTypeSwatches .hardware-option.selected');
    var parts = [
      'Product: ' + ((document.getElementById('productTitle')||{}).textContent || 'Roller Shades'),
      'Fabric SKU: ' + pick('.fabric-swatch.selected'),
      'Size: ' + val('widthInput') + 'x' + val('heightInput') + ' in',
      'Qty: ' + val('quantityInput'),
      'Mount: ' + pick('#mountTypeSwatches .hardware-option.selected'),
      'Control: ' + control,
      'Valance: ' + pick('#cassetteSwatches .hardware-option.selected'),
      'Bottom Rail: ' + pick('#bottomBarSwatches .hardware-option.selected')
    ];
    if (control === 'motorized') {
      parts.push('Motor: ' + pick('#motorBrandSwatches .motor-brand-btn.selected'));
      parts.push('Remote: ' + pick('#remoteTypeSwatches .remote-btn.selected'));
      parts.push('Solar: ' + pick('#solarTypeSwatches .solar-btn.selected'));
    }
    parts.push('Estimated total: $' + ((document.getElementById('totalPrice')||{}).textContent || ''));
    var f = document.getElementById('quoteConfigField'); if (f) f.value = parts.join(' | ');
  } catch(e){}
  return true; // allow the native Shopify contact-form submit to proceed
};

// 4) Add to cart -> quote (no custom-price cart yet)
window.addToCart = function(){
  try { showToast('Thanks! For a custom quote on this configuration, please contact PeekabooShades.', 'success'); }
  catch(e){ alert('Please contact PeekabooShades for a custom quote.'); }
};

// 5) Seed price + manufacturer, and recalc after ANY option click/change (validation)
(function(){
  function recalc(){ setTimeout(function(){ try{ window.calculatePriceFromAPI(); }catch(e){} }, 30); }
  function boot(){
    try{ window.loadManufacturers(); }catch(e){}
    try{ window.calculatePriceFromAPI(); }catch(e){}
    document.addEventListener('click', function(e){
      if (e.target.closest && e.target.closest('.fabric-swatch, .hardware-option, .chain-type-option, .swatch-img-container, [onclick*="select"]')) recalc();
    });
    document.addEventListener('change', recalc);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();


/* ==== Main image hover-zoom (magnify into the hovered region) ==== */
(function(){
  function initZoom(){
    var box = document.querySelector('.main-image');
    if(!box) return;
    box.addEventListener('mouseenter', function(){ if(box.querySelector('img')) box.classList.add('pk-zooming'); });
    box.addEventListener('mouseleave', function(){
      box.classList.remove('pk-zooming');
      var img = box.querySelector('img'); if(img) img.style.transformOrigin = 'center center';
    });
    box.addEventListener('mousemove', function(e){
      var img = box.querySelector('img'); if(!img) return;
      var r = box.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 100;
      var y = ((e.clientY - r.top) / r.height) * 100;
      img.style.transformOrigin = x + '% ' + y + '%';
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initZoom); else initZoom();
})();
