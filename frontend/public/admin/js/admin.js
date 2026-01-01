/**
 * Admin Panel JavaScript Utilities
 * Handles authentication, API calls, and common UI functions
 */

// API Base URL
const API_BASE = '/api/admin';

// Auth Token Management
const Auth = {
  TOKEN_KEY: 'admin_token',
  USER_KEY: 'admin_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    localStorage.setItem(this.TOKEN_KEY, token);
  },

  getUser() {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  setUser(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  // Check auth and redirect if not logged in
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/admin/login.html';
      return false;
    }
    return true;
  },

  // Redirect to dashboard if already logged in
  redirectIfLoggedIn() {
    if (this.isLoggedIn()) {
      window.location.href = '/admin/';
      return true;
    }
    return false;
  }
};

// API Request Helper
const API = {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = Auth.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      // Handle unauthorized (token expired)
      if (response.status === 401) {
        Auth.clear();
        window.location.href = '/admin/login.html';
        return null;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

// Auth API
const AuthAPI = {
  async login(email, password) {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    if (data.success) {
      Auth.setToken(data.token);
      Auth.setUser(data.admin);
    }

    return data;
  },

  async verify() {
    try {
      return await API.get('/verify');
    } catch {
      return null;
    }
  },

  logout() {
    Auth.clear();
    window.location.href = '/admin/login.html';
  }
};

// Dashboard API
const DashboardAPI = {
  getStats() {
    return API.get('/dashboard');
  }
};

// Products API
const ProductsAPI = {
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return API.get(`/products${query ? `?${query}` : ''}`);
  },

  getById(id) {
    return API.get(`/products/${id}`);
  },

  create(product) {
    return API.post('/products', product);
  },

  update(id, product) {
    return API.put(`/products/${id}`, product);
  },

  delete(id) {
    return API.delete(`/products/${id}`);
  },

  toggleActive(id) {
    return API.put(`/products/${id}/toggle`);
  },

  toggleFeatured(id) {
    return API.put(`/products/${id}/featured`);
  }
};

// Orders API
const OrdersAPI = {
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return API.get(`/orders${query ? `?${query}` : ''}`);
  },

  getById(id) {
    return API.get(`/orders/${id}`);
  },

  updateStatus(id, status) {
    return API.put(`/orders/${id}/status`, { status });
  },

  delete(id) {
    return API.delete(`/orders/${id}`);
  }
};

// Quotes API
const QuotesAPI = {
  getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return API.get(`/quotes${query ? `?${query}` : ''}`);
  },

  getById(id) {
    return API.get(`/quotes/${id}`);
  },

  updateStatus(id, status) {
    return API.put(`/quotes/${id}/status`, { status });
  },

  delete(id) {
    return API.delete(`/quotes/${id}`);
  }
};

// Categories API
const CategoriesAPI = {
  getAll() {
    return API.get('/categories');
  },

  create(category) {
    return API.post('/categories', category);
  },

  update(id, category) {
    return API.put(`/categories/${id}`, category);
  },

  delete(id) {
    return API.delete(`/categories/${id}`);
  }
};

// Fabrics API
const FabricsAPI = {
  getAll() {
    return API.get('/fabrics');
  },

  create(fabric) {
    return API.post('/fabrics', fabric);
  },

  update(id, fabric) {
    return API.put(`/fabrics/${id}`, fabric);
  },

  delete(id) {
    return API.delete(`/fabrics/${id}`);
  },

  toggle(id) {
    return API.put(`/fabrics/${id}/toggle`);
  },

  reorder(fabricIds) {
    return API.put('/fabrics/reorder', { fabricIds });
  }
};

// Hardware Options API
const HardwareAPI = {
  getCategory(category) {
    return API.get(`/hardware/${category}`);
  },

  createOption(category, option) {
    return API.post(`/hardware/${category}`, option);
  },

  updateOption(category, id, option) {
    return API.put(`/hardware/${category}/${id}`, option);
  },

  deleteOption(category, id) {
    return API.delete(`/hardware/${category}/${id}`);
  }
};

// Accessories API
const AccessoriesAPI = {
  getAll() {
    return API.get('/accessories');
  },

  create(accessory) {
    return API.post('/accessories', accessory);
  },

  update(id, accessory) {
    return API.put(`/accessories/${id}`, accessory);
  },

  delete(id) {
    return API.delete(`/accessories/${id}`);
  }
};

// Product Content API
const ProductContentAPI = {
  getGallery() {
    return API.get('/product-content/gallery');
  },

  updateGallery(gallery) {
    return API.put('/product-content/gallery', gallery);
  },

  getSimulator() {
    return API.get('/product-content/simulator');
  },

  updateSimulator(simulator) {
    return API.put('/product-content/simulator', simulator);
  },

  getRoomLabels() {
    return API.get('/room-labels');
  },

  updateRoomLabels(labels) {
    return API.put('/room-labels', { labels });
  }
};

// Product Catalog API
const ProductCatalogAPI = {
  get() {
    return API.get('/product-catalog');
  },

  updateFeatures(features) {
    return API.put('/product-catalog/features', { features });
  },

  updateValance(descriptions) {
    return API.put('/product-catalog/valance', { descriptions });
  },

  updateBottomRail(descriptions) {
    return API.put('/product-catalog/bottomrail', { descriptions });
  },

  updateSizeChart(sizeChart) {
    return API.put('/product-catalog/sizechart', sizeChart);
  },

  updateCare(careInstructions) {
    return API.put('/product-catalog/care', { careInstructions });
  },

  updateWarranty(warrantyInfo) {
    return API.put('/product-catalog/warranty', { warrantyInfo });
  }
};

// FAQs API
const FAQsAPI = {
  getAll() {
    return API.get('/faqs');
  },

  create(faq) {
    return API.post('/faqs', faq);
  },

  update(id, faq) {
    return API.put(`/faqs/${id}`, faq);
  },

  delete(id) {
    return API.delete(`/faqs/${id}`);
  }
};

// Settings API
const SettingsAPI = {
  get() {
    return API.get('/settings');
  },

  update(settings) {
    return API.put('/settings', settings);
  },

  changePassword(currentPassword, newPassword) {
    return API.put('/password', { currentPassword, newPassword });
  }
};

// Toast Notifications
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 3000) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      error: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
      warning: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
      info: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(message) {
    this.show(message, 'success');
  },

  error(message) {
    this.show(message, 'error');
  },

  warning(message) {
    this.show(message, 'warning');
  },

  info(message) {
    this.show(message, 'info');
  }
};

// Modal Management
const Modal = {
  show(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  hide(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  confirm(title, message, onConfirm) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay active';
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove(); document.body.style.overflow = '';">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
            <button class="btn btn-danger" id="modal-confirm">Delete</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

      overlay.querySelector('#modal-cancel').onclick = () => {
        overlay.remove();
        document.body.style.overflow = '';
        resolve(false);
      };

      overlay.querySelector('#modal-confirm').onclick = () => {
        overlay.remove();
        document.body.style.overflow = '';
        resolve(true);
      };
    });
  }
};

// Loading State
const Loading = {
  overlay: null,

  show() {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'loading-overlay';
      this.overlay.innerHTML = '<div class="spinner"></div>';
    }
    document.body.appendChild(this.overlay);
  },

  hide() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.remove();
    }
  }
};

// Utility Functions
const Utils = {
  // Format currency
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  },

  // Format date
  formatDate(dateString, options = {}) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    });
  },

  // Format datetime
  formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Generate slug from text
  slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();
  },

  // Truncate text
  truncate(text, length = 50) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  },

  // Get URL parameters
  getUrlParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  },

  // Set URL parameter
  setUrlParam(key, value) {
    const url = new URL(window.location);
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
    window.history.replaceState({}, '', url);
  },

  // Escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Sidebar Navigation Active State
function initSidebarNav() {
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href && currentPath.endsWith(href.replace('/admin/', ''))) {
      item.classList.add('active');
    }
  });
}

// Profile Dropdown
function initProfileDropdown() {
  const profileBtn = document.querySelector('.header-profile');
  const dropdown = document.querySelector('.profile-dropdown');

  if (profileBtn && dropdown) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('active');
    });
  }
}

// Mobile Menu Toggle
function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const sidebar = document.querySelector('.admin-sidebar');

  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// Initialize user info in header
function initUserInfo() {
  const user = Auth.getUser();
  if (user) {
    const profileName = document.querySelector('.profile-name');
    const profileAvatar = document.querySelector('.profile-avatar');

    if (profileName) {
      profileName.textContent = user.name;
    }
    if (profileAvatar) {
      profileAvatar.textContent = user.name.charAt(0).toUpperCase();
    }
  }
}

// Common initialization
document.addEventListener('DOMContentLoaded', () => {
  initSidebarNav();
  initProfileDropdown();
  initMobileMenu();
  initUserInfo();
});

// Export for use in other scripts
// Upload API for image uploads
const UploadAPI = {
  async upload(file, category = null) {
    const formData = new FormData();
    formData.append('image', file);

    const url = category
      ? `${API_BASE}/upload/${category}`
      : `${API_BASE}/upload`;

    const token = Auth.getToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },

  async uploadWithName(file, category, filename) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('filename', filename);

    const url = `${API_BASE}/upload/${category}`;
    const token = Auth.getToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }
    return data;
  },

  async delete(url) {
    return API.delete('/upload', { url });
  }
};

window.Admin = {
  Auth,
  AuthAPI,
  API,
  DashboardAPI,
  ProductsAPI,
  OrdersAPI,
  QuotesAPI,
  CategoriesAPI,
  FabricsAPI,
  HardwareAPI,
  AccessoriesAPI,
  ProductContentAPI,
  ProductCatalogAPI,
  FAQsAPI,
  SettingsAPI,
  UploadAPI,
  Toast,
  Modal,
  Loading,
  Utils
};
