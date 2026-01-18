/**
 * PeekabooShades Admin AI Assistant
 * Collapsible sidebar panel with Claude-powered chat
 */

(function() {
  'use strict';

  // AI Assistant temporarily disabled
  return;

  // Chat state
  let isOpen = false;
  let messages = [];
  let isLoading = false;
  let conversationId = null;

  // Create sidebar HTML
  function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'ai-assistant-sidebar';
    sidebar.innerHTML = `
      <style>
        #ai-assistant-sidebar {
          position: fixed;
          top: 0;
          right: -400px;
          width: 400px;
          height: 100vh;
          background: #fff;
          box-shadow: -4px 0 20px rgba(0,0,0,0.15);
          z-index: 10000;
          transition: right 0.3s ease;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #ai-assistant-sidebar.open {
          right: 0;
        }
        #ai-toggle-btn {
          position: fixed;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
          border-radius: 12px 0 0 12px;
          cursor: pointer;
          z-index: 10001;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: -2px 2px 10px rgba(99, 102, 241, 0.3);
          transition: all 0.3s ease;
        }
        #ai-toggle-btn:hover {
          width: 56px;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        }
        #ai-toggle-btn svg {
          width: 24px;
          height: 24px;
          fill: white;
        }
        #ai-toggle-btn.open {
          right: 400px;
        }
        .ai-header {
          padding: 16px 20px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ai-header-icon {
          width: 40px;
          height: 40px;
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ai-header-icon svg {
          width: 24px;
          height: 24px;
          fill: white;
        }
        .ai-header-text h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        .ai-header-text p {
          margin: 2px 0 0;
          font-size: 12px;
          opacity: 0.9;
        }
        .ai-close-btn {
          margin-left: auto;
          background: rgba(255,255,255,0.2);
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .ai-close-btn:hover {
          background: rgba(255,255,255,0.3);
        }
        .ai-close-btn svg {
          width: 18px;
          height: 18px;
          fill: white;
        }
        .ai-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: #f8fafc;
        }
        .ai-message {
          margin-bottom: 16px;
          display: flex;
          gap: 10px;
        }
        .ai-message.user {
          flex-direction: row-reverse;
        }
        .ai-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ai-message.assistant .ai-message-avatar {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        }
        .ai-message.user .ai-message-avatar {
          background: #e2e8f0;
        }
        .ai-message-avatar svg {
          width: 18px;
          height: 18px;
          fill: white;
        }
        .ai-message.user .ai-message-avatar svg {
          fill: #64748b;
        }
        .ai-message-content {
          max-width: 280px;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.5;
        }
        .ai-message.assistant .ai-message-content {
          background: white;
          color: #1e293b;
          border: 1px solid #e2e8f0;
          border-radius: 4px 12px 12px 12px;
        }
        .ai-message.user .ai-message-content {
          background: #6366f1;
          color: white;
          border-radius: 12px 4px 12px 12px;
        }
        .ai-message-content code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
        }
        .ai-message.user .ai-message-content code {
          background: rgba(255,255,255,0.2);
        }
        .ai-message-content pre {
          background: #1e293b;
          color: #e2e8f0;
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 12px;
          margin: 8px 0;
        }
        .ai-message-content pre code {
          background: none;
          padding: 0;
          color: inherit;
        }
        .ai-typing {
          display: flex;
          gap: 4px;
          padding: 8px 0;
        }
        .ai-typing span {
          width: 8px;
          height: 8px;
          background: #94a3b8;
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out;
        }
        .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }
        .ai-input-area {
          padding: 16px;
          background: white;
          border-top: 1px solid #e2e8f0;
        }
        .ai-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }
        .ai-input-wrapper textarea {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 14px;
          resize: none;
          min-height: 44px;
          max-height: 120px;
          font-family: inherit;
          line-height: 1.4;
        }
        .ai-input-wrapper textarea:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .ai-send-btn {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, opacity 0.2s;
        }
        .ai-send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .ai-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ai-send-btn svg {
          width: 20px;
          height: 20px;
          fill: white;
        }
        .ai-welcome {
          text-align: center;
          padding: 40px 20px;
        }
        .ai-welcome-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        .ai-welcome-icon svg {
          width: 36px;
          height: 36px;
          fill: white;
        }
        .ai-welcome h4 {
          margin: 0 0 8px;
          font-size: 18px;
          color: #1e293b;
        }
        .ai-welcome p {
          margin: 0 0 20px;
          color: #64748b;
          font-size: 14px;
        }
        .ai-suggestions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ai-suggestion {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 13px;
          color: #475569;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }
        .ai-suggestion:hover {
          border-color: #6366f1;
          background: #f8fafc;
        }
        .ai-quick-actions {
          display: flex;
          gap: 8px;
          padding: 0 16px 12px;
          overflow-x: auto;
        }
        .ai-quick-action {
          background: #f1f5f9;
          border: none;
          border-radius: 16px;
          padding: 6px 12px;
          font-size: 12px;
          color: #64748b;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .ai-quick-action:hover {
          background: #e2e8f0;
          color: #475569;
        }
        .ai-clear-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 12px;
          cursor: pointer;
          padding: 8px;
          margin-left: auto;
        }
        .ai-clear-btn:hover {
          color: #64748b;
        }
      </style>

      <div class="ai-header">
        <div class="ai-header-icon">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </div>
        <div class="ai-header-text">
          <h3>Admin Copilot</h3>
          <p>Powered by Claude AI</p>
        </div>
        <button class="ai-close-btn" onclick="window.AIAssistant.toggle()">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div class="ai-quick-actions">
        <button class="ai-quick-action" onclick="window.AIAssistant.ask('Show order statistics')">Orders</button>
        <button class="ai-quick-action" onclick="window.AIAssistant.ask('Invoice summary')">Invoices</button>
        <button class="ai-quick-action" onclick="window.AIAssistant.ask('How to update pricing?')">Pricing</button>
        <button class="ai-quick-action" onclick="window.AIAssistant.ask('Recent customer activity')">Customers</button>
        <button class="ai-clear-btn" onclick="window.AIAssistant.clear()">Clear chat</button>
      </div>

      <div class="ai-messages" id="ai-messages">
        <div class="ai-welcome">
          <div class="ai-welcome-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          </div>
          <h4>Hi! I'm your Admin Copilot</h4>
          <p>I can help you with orders, invoices, pricing, and more. What would you like to know?</p>
          <div class="ai-suggestions">
            <button class="ai-suggestion" onclick="window.AIAssistant.ask('What are today\\'s orders?')">What are today's orders?</button>
            <button class="ai-suggestion" onclick="window.AIAssistant.ask('Show me pending invoices')">Show me pending invoices</button>
            <button class="ai-suggestion" onclick="window.AIAssistant.ask('How do I add a new fabric?')">How do I add a new fabric?</button>
          </div>
        </div>
      </div>

      <div class="ai-input-area">
        <div class="ai-input-wrapper">
          <textarea id="ai-input" placeholder="Ask me anything about your admin portal..." rows="1" onkeydown="window.AIAssistant.handleKeydown(event)"></textarea>
          <button class="ai-send-btn" id="ai-send-btn" onclick="window.AIAssistant.send()">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(sidebar);

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'ai-toggle-btn';
    toggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`;
    toggleBtn.onclick = () => window.AIAssistant.toggle();
    document.body.appendChild(toggleBtn);

    // Auto-resize textarea
    const textarea = document.getElementById('ai-input');
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  // Toggle sidebar
  function toggle() {
    isOpen = !isOpen;
    const sidebar = document.getElementById('ai-assistant-sidebar');
    const toggleBtn = document.getElementById('ai-toggle-btn');

    if (isOpen) {
      sidebar.classList.add('open');
      toggleBtn.classList.add('open');
      document.getElementById('ai-input').focus();
    } else {
      sidebar.classList.remove('open');
      toggleBtn.classList.remove('open');
    }
  }

  // Send message
  async function send() {
    const input = document.getElementById('ai-input');
    const message = input.value.trim();

    if (!message || isLoading) return;

    input.value = '';
    input.style.height = 'auto';

    await ask(message);
  }

  // Ask question
  async function ask(message) {
    if (isLoading) return;

    // Add user message
    messages.push({ role: 'user', content: message });
    renderMessages();

    // Show loading
    isLoading = true;
    document.getElementById('ai-send-btn').disabled = true;
    renderMessages();

    try {
      const token = localStorage.getItem('admin_token');

      // Check if token exists
      if (!token) {
        messages.push({ role: 'assistant', content: 'Please log in first. Go to /admin/login.html' });
        isLoading = false;
        document.getElementById('ai-send-btn').disabled = false;
        renderMessages();
        return;
      }

      const currentPage = window.location.pathname;

      console.log('Sending AI request...');
      const response = await fetch('/api/admin/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          conversationId,
          currentPage,
          context: {
            pageTitle: document.title,
            url: window.location.href
          }
        })
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (data.success) {
        conversationId = data.conversationId;
        const responseText = data.response || 'No response received';
        console.log('Adding assistant message:', responseText);
        messages.push({ role: 'assistant', content: responseText });
      } else {
        const errorMsg = `Sorry, I encountered an error: ${data.error || 'Unknown error'}`;
        console.log('Error message:', errorMsg);
        messages.push({ role: 'assistant', content: errorMsg });
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      messages.push({ role: 'assistant', content: 'Sorry, I could not connect to the AI service. Please try again.' });
    }

    isLoading = false;
    document.getElementById('ai-send-btn').disabled = false;
    renderMessages();
  }

  // Render messages
  function renderMessages() {
    console.log('renderMessages called, messages:', messages);
    const container = document.getElementById('ai-messages');

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="ai-welcome">
          <div class="ai-welcome-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          </div>
          <h4>Hi! I'm your Admin Copilot</h4>
          <p>I can help you with orders, invoices, pricing, and more. What would you like to know?</p>
          <div class="ai-suggestions">
            <button class="ai-suggestion" onclick="window.AIAssistant.ask('What are today\\'s orders?')">What are today's orders?</button>
            <button class="ai-suggestion" onclick="window.AIAssistant.ask('Show me pending invoices')">Show me pending invoices</button>
            <button class="ai-suggestion" onclick="window.AIAssistant.ask('How do I add a new fabric?')">How do I add a new fabric?</button>
          </div>
        </div>
      `;
      return;
    }

    let html = '';

    for (const msg of messages) {
      const avatar = msg.role === 'assistant'
        ? '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

      html += `
        <div class="ai-message ${msg.role}">
          <div class="ai-message-avatar">${avatar}</div>
          <div class="ai-message-content">${formatMessage(msg.content)}</div>
        </div>
      `;
    }

    if (isLoading) {
      html += `
        <div class="ai-message assistant">
          <div class="ai-message-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          </div>
          <div class="ai-message-content">
            <div class="ai-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  // Format message with markdown-like syntax
  function formatMessage(text) {
    // Guard against null/undefined
    if (!text) {
      console.warn('formatMessage received empty text:', text);
      return '(No response)';
    }
    if (typeof text !== 'string') {
      console.warn('formatMessage received non-string:', typeof text, text);
      text = String(text);
    }
    // Escape HTML
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Code blocks
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Line breaks
    text = text.replace(/\n/g, '<br>');

    return text;
  }

  // Handle keyboard
  function handleKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  // Clear chat
  function clear() {
    messages = [];
    conversationId = null;
    renderMessages();
  }

  // Initialize
  function init() {
    // Don't load on login page
    if (window.location.pathname.includes('/admin/login')) return;

    createSidebar();

    // Auto-open the sidebar on load
    setTimeout(() => {
      toggle();
    }, 500);
  }

  // Expose API
  window.AIAssistant = {
    toggle,
    send,
    ask,
    clear,
    handleKeydown
  };

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
