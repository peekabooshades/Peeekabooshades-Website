/**
 * Peekaboo Shades - Main JavaScript
 * Handles global functionality across all pages
 */

// ============================================
// SESSION MANAGEMENT
// ============================================

function getSessionId() {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

// ============================================
// CART FUNCTIONS
// ============================================

async function updateCartCount() {
  const sessionId = getSessionId();
  let count = 0;

  try {
    const response = await fetch(`/api/cart/${sessionId}`);
    const result = await response.json();
    if (result.success) {
      count = result.data.reduce((sum, item) => sum + item.quantity, 0);
    }
  } catch (error) {
    // Fall back to localStorage
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    count = cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  const cartCountElements = document.querySelectorAll('#cartCount, .cart-count');
  cartCountElements.forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// MOBILE MENU
// ============================================

function toggleMobileMenu() {
  const nav = document.querySelector('.main-nav');
  nav.classList.toggle('mobile-open');
}

// ============================================
// SCROLL EFFECTS
// ============================================

let lastScroll = 0;
window.addEventListener('scroll', () => {
  const header = document.querySelector('.main-header');
  if (!header) return;

  const currentScroll = window.pageYOffset;

  if (currentScroll > 100) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }

  lastScroll = currentScroll;
});

// ============================================
// LAZY LOADING IMAGES
// ============================================

function lazyLoadImages() {
  const images = document.querySelectorAll('img[data-src]');

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
      }
    });
  });

  images.forEach(img => imageObserver.observe(img));
}

// ============================================
// FORM VALIDATION
// ============================================

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePhone(phone) {
  const re = /^[\d\s\-\+\(\)]{10,}$/;
  return re.test(phone);
}

// ============================================
// PRICE FORMATTING
// ============================================

function formatPrice(price) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price);
}

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Error saving to localStorage:', e);
    return false;
  }
}

function getFromLocalStorage(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return defaultValue;
  }
}

// ============================================
// DEBOUNCE & THROTTLE
// ============================================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

const searchProducts = debounce(async (query) => {
  if (!query || query.length < 2) return;

  try {
    const response = await fetch(`/api/products?search=${encodeURIComponent(query)}`);
    const result = await response.json();

    if (result.success) {
      displaySearchResults(result.data);
    }
  } catch (error) {
    console.error('Search error:', error);
  }
}, 300);

function displaySearchResults(products) {
  // Implementation depends on UI design
  console.log('Search results:', products);
}

// ============================================
// WISHLIST FUNCTIONS
// ============================================

function getWishlist() {
  return getFromLocalStorage('wishlist', []);
}

function addToWishlist(productId) {
  const wishlist = getWishlist();
  if (!wishlist.includes(productId)) {
    wishlist.push(productId);
    saveToLocalStorage('wishlist', wishlist);
    showToast('Added to wishlist!', 'success');
    updateWishlistCount();
  }
}

function removeFromWishlist(productId) {
  const wishlist = getWishlist();
  const index = wishlist.indexOf(productId);
  if (index > -1) {
    wishlist.splice(index, 1);
    saveToLocalStorage('wishlist', wishlist);
    showToast('Removed from wishlist');
    updateWishlistCount();
  }
}

function updateWishlistCount() {
  const wishlist = getWishlist();
  const countElements = document.querySelectorAll('.wishlist-count');
  countElements.forEach(el => {
    el.textContent = wishlist.length;
    el.style.display = wishlist.length > 0 ? 'flex' : 'none';
  });
}

// ============================================
// RECENTLY VIEWED
// ============================================

function addToRecentlyViewed(product) {
  const recent = getFromLocalStorage('recentlyViewed', []);

  // Remove if already exists
  const index = recent.findIndex(p => p.id === product.id);
  if (index > -1) {
    recent.splice(index, 1);
  }

  // Add to beginning
  recent.unshift(product);

  // Keep only last 10
  if (recent.length > 10) {
    recent.pop();
  }

  saveToLocalStorage('recentlyViewed', recent);
}

function getRecentlyViewed() {
  return getFromLocalStorage('recentlyViewed', []);
}

// ============================================
// ANALYTICS HELPERS
// ============================================

function trackEvent(eventName, eventData = {}) {
  // Implementation for analytics tracking
  console.log('Track Event:', eventName, eventData);

  // Example: Google Analytics
  if (typeof gtag !== 'undefined') {
    gtag('event', eventName, eventData);
  }
}

function trackPageView(pageName) {
  trackEvent('page_view', { page_name: pageName });
}

function trackAddToCart(product, quantity) {
  trackEvent('add_to_cart', {
    product_id: product.id,
    product_name: product.name,
    quantity: quantity
  });
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  // Initialize cart count
  updateCartCount();

  // Initialize wishlist count
  updateWishlistCount();

  // Initialize lazy loading
  lazyLoadImages();

  // Track page view
  trackPageView(document.title);

  // Mobile menu toggle
  const menuToggle = document.querySelector('.menu-toggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', toggleMobileMenu);
  }

  // Search input
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchProducts(e.target.value);
    });
  }
});

// ============================================
// EXPOSE GLOBAL FUNCTIONS
// ============================================

window.getSessionId = getSessionId;
window.updateCartCount = updateCartCount;
window.showToast = showToast;
window.formatPrice = formatPrice;
window.addToWishlist = addToWishlist;
window.removeFromWishlist = removeFromWishlist;
window.trackEvent = trackEvent;
