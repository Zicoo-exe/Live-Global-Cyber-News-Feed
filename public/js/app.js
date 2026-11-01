/**
 * CYBERPULSE // Live Cyber Intelligence Application
 * Real-Time Feed Engine, Internet Search, and Telemetry Hub
 */

(function () {
  'use strict';

  // State
  const state = {
    allArticles: [],
    displayedArticles: [],
    selectedArticle: null,
    currentCategory: 'ALL',
    currentSeverity: 'ALL',
    currentSource: 'ALL',
    searchQuery: '',
    sortOrder: 'newest',
    page: 1,
    pageSize: 30,
    bookmarks: new Map(), // id -> article
    autoRefreshInterval: null,
    countdownTimer: null,
    countdownSeconds: 60,
    isSyncing: false,
    viewMode: 'grid'
  };

  // DOM Elements Cache
  const elements = {
    newsGrid: document.getElementById('news-grid-container'),
    emptyState: document.getElementById('empty-state-view'),
    emptyDesc: document.getElementById('empty-state-desc'),
    emptySearchBtn: document.getElementById('empty-search-web-btn'),
    paginationWrap: document.getElementById('pagination-controls'),
    loadMoreBtn: document.getElementById('load-more-btn'),
    loadedCountLabel: document.getElementById('loaded-count-label'),
    
    // Search elements
    searchInput: document.getElementById('cyber-search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    internetSearchBtn: document.getElementById('internet-search-btn'),
    activeFilterBanner: document.getElementById('active-filter-banner'),
    activeFilterText: document.getElementById('active-filter-text'),
    resetFilterBtn: document.getElementById('reset-filter-btn'),
    
    // Selects
    filterSeverity: document.getElementById('filter-severity'),
    filterSource: document.getElementById('filter-source'),
    sortOrder: document.getElementById('sort-order'),
    
    // Stats
    statTotal: document.getElementById('stat-total-articles'),
    statCritical: document.getElementById('stat-critical-count'),
    statBreach: document.getElementById('stat-breach-count'),
    statSources: document.getElementById('stat-sources-count'),
    statLastSync: document.getElementById('stat-last-sync-time'),
    
    // Ticker & Header
    tickerTrack: document.getElementById('ticker-track'),
    utcClock: document.getElementById('current-utc-clock'),
    syncNowBtn: document.getElementById('sync-now-btn'),
    syncIcon: document.getElementById('sync-icon'),
    autoRefreshToggle: document.getElementById('auto-refresh-toggle'),
    countdownBadge: document.getElementById('auto-refresh-countdown'),
    audioToggleBtn: document.getElementById('audio-toggle-btn'),
    audioIconMuted: document.getElementById('audio-icon-muted'),
    audioIconUnmuted: document.getElementById('audio-icon-unmuted'),
    audioStatusLabel: document.getElementById('audio-status-label'),
    
    // Category tabs
    categoryTabs: document.querySelectorAll('.cat-tab'),
    
    // Counts
    countAll: document.getElementById('count-all'),
    countCybercrime: document.getElementById('count-cybercrime'),
    countRansomware: document.getElementById('count-ransomware'),
    countBreaches: document.getElementById('count-breaches'),
    countVulns: document.getElementById('count-vulns'),
    countCisa: document.getElementById('count-cisa'),
    countAi: document.getElementById('count-ai'),
    countSaved: document.getElementById('count-saved'),
    
    // Layout
    viewGridBtn: document.getElementById('view-grid-btn'),
    viewListBtn: document.getElementById('view-list-btn'),
    
    // Dialog Modal
    dialog: document.getElementById('intel-dialog'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    modalTitle: document.getElementById('dialog-title'),
    modalSummary: document.getElementById('dialog-full-text'),
    modalSeverityBadge: document.getElementById('modal-severity-badge'),
    modalCategoryBadge: document.getElementById('modal-category-badge'),
    modalSourceLabel: document.getElementById('modal-source-label'),
    modalTimeLabel: document.getElementById('modal-time-label'),
    modalExactDate: document.getElementById('modal-exact-date'),
    modalIntelId: document.getElementById('modal-intel-id'),
    modalTagsContainer: document.getElementById('modal-tags-container'),
    modalImageContainer: document.getElementById('modal-image-container'),
    modalImage: document.getElementById('modal-image'),
    modalSourceLink: document.getElementById('modal-source-link'),
    modalBookmarkBtn: document.getElementById('modal-bookmark-btn'),
    modalBookmarkLabel: document.getElementById('modal-bookmark-label'),
    modalCopyLinkBtn: document.getElementById('modal-copy-link-btn'),
    
    toastHub: document.getElementById('toast-hub')
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  function init() {
    loadBookmarksFromStorage();
    setupEventListeners();
    setupModernWebDialogFallback();
    startUtcClock();
    updateAudioUI();
    fetchLiveFeeds();
    startAutoRefreshCycle();
  }

  // Load Saved Bookmarks from LocalStorage
  function loadBookmarksFromStorage() {
    try {
      const stored = localStorage.getItem('cyberpulse_bookmarks');
      if (stored) {
        const arr = JSON.parse(stored);
        arr.forEach(item => {
          if (item && item.id) state.bookmarks.set(item.id, item);
        });
      }
    } catch (e) {
      console.warn('Failed to load bookmarks', e);
    }
  }

  function saveBookmarksToStorage() {
    try {
      const arr = Array.from(state.bookmarks.values());
      localStorage.setItem('cyberpulse_bookmarks', JSON.stringify(arr));
      updateCategoryCounts();
    } catch (e) {
      console.warn('Failed to persist bookmarks', e);
    }
  }

  // Modern Web Guidance: Dialog fallback for closedby="any"
  function setupModernWebDialogFallback() {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e, dialog) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, dialog); });
        dialog.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e, dialog)) dialog.close(); });
      }
    }
  }

  // Live UTC Clock in Ticker
  function startUtcClock() {
    function updateClock() {
      const now = new Date();
      elements.utcClock.textContent = now.toUTCString().slice(17, 25) + ' UTC';
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  // Audio Toggle UI
  function updateAudioUI() {
    const isMuted = window.cyberSound.isMuted;
    if (isMuted) {
      elements.audioIconMuted.classList.remove('hidden');
      elements.audioIconUnmuted.classList.add('hidden');
      elements.audioStatusLabel.textContent = 'AUDIO OFF';
    } else {
      elements.audioIconMuted.classList.add('hidden');
      elements.audioIconUnmuted.classList.remove('hidden');
      elements.audioStatusLabel.textContent = 'AUDIO ON';
    }
  }

  // Toast Notification
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'alert') icon = '⚡';
    
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    elements.toastHub.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // ==========================================
  // DATA FETCHING & API INTERACTION
  // ==========================================

  // Fetch live articles from local proxy
  async function fetchLiveFeeds(showSpinner = true) {
    if (state.isSyncing) return;
    state.isSyncing = true;
    
    if (showSpinner) {
      elements.syncIcon.classList.add('spinning');
    }

    try {
      const res = await fetch('/api/news?limit=200');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      
      if (json.status === 'ok' && Array.isArray(json.data)) {
        state.allArticles = json.data;
        updateStats(json.stats);
        updateCategoryCounts();
        updateTicker(json.data.slice(0, 10));
        applyFiltersAndRender();
        window.cyberSound.playRadarPing();
      }
    } catch (err) {
      console.error('Failed to load feeds:', err);
      showToast('Feed sync error. Check connectivity.', 'alert');
    } finally {
      state.isSyncing = false;
      elements.syncIcon.classList.remove('spinning');
      state.countdownSeconds = 60;
    }
  }

  // Force Manual Sync
  async function forceSyncAll() {
    window.cyberSound.playClick();
    elements.syncIcon.classList.add('spinning');
    showToast('Connecting to 10 global threat networks...', 'info');

    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const json = await res.json();
      if (json.status === 'ok') {
        showToast(`Feed sync complete: ${json.stats.totalItems} alerts indexed.`, 'success');
        await fetchLiveFeeds(false);
      }
    } catch (err) {
      showToast('Manual sync encountered an error.', 'alert');
    } finally {
      elements.syncIcon.classList.remove('spinning');
    }
  }

  // Live Internet Search (Queries Google News & external web live)
  async function executeLiveInternetSearch(query) {
    if (!query || !query.trim()) return;
    window.cyberSound.playClick();
    
    const cleanQ = query.trim();
    showToast(`Scouring live internet for "${cleanQ}"...`, 'info');
    elements.internetSearchBtn.disabled = true;

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(cleanQ)}`);
      if (!res.ok) throw new Error('Search failed');
      const json = await res.json();

      if (json.status === 'ok' && Array.isArray(json.data)) {
        // Merge with existing allArticles without duplicate links
        const existingUrls = new Set(state.allArticles.map(a => a.link));
        const newItems = json.data.filter(item => !existingUrls.has(item.link));
        
        state.allArticles = [...newItems, ...state.allArticles];
        updateCategoryCounts();

        // Switch to query search view
        state.searchQuery = cleanQ;
        state.currentCategory = 'ALL';
        elements.searchInput.value = cleanQ;
        elements.clearSearchBtn.classList.remove('hidden');

        applyFiltersAndRender();
        showToast(`Found ${json.data.length} live internet reports!`, 'success');
        window.cyberSound.playRadarPing();
      }
    } catch (err) {
      showToast('Live search error. Please try again.', 'alert');
    } finally {
      elements.internetSearchBtn.disabled = false;
    }
  }

  // Update Stats Counter
  function updateStats(stats) {
    if (!stats) return;
    elements.statTotal.textContent = stats.totalItems || state.allArticles.length;
    elements.statCritical.textContent = stats.criticalCount || 0;
    elements.statBreach.textContent = stats.breachCount || 0;
    elements.statSources.textContent = stats.successfulFeeds ? `${stats.successfulFeeds} / ${stats.totalFeeds}` : '10 ONLINE';
    
    if (stats.lastSync) {
      const d = new Date(stats.lastSync);
      elements.statLastSync.textContent = `Updated ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  // Update Top Breaking Ticker
  function updateTicker(items) {
    if (!items || items.length === 0) return;
    elements.tickerTrack.innerHTML = '';
    
    items.forEach(item => {
      const span = document.createElement('span');
      span.className = 'ticker-item';
      span.textContent = `[${item.source}] ${item.title}`;
      span.addEventListener('click', () => {
        openModalWithArticle(item);
      });
      elements.tickerTrack.appendChild(span);
    });
  }

  // Update Category Badge Counts
  function updateCategoryCounts() {
    const list = state.allArticles;
    elements.countAll.textContent = list.length;
    elements.countCybercrime.textContent = list.filter(a => a.category === 'CYBERCRIME').length;
    elements.countRansomware.textContent = list.filter(a => a.category === 'RANSOMWARE').length;
    elements.countBreaches.textContent = list.filter(a => a.category === 'DATA_BREACH').length;
    elements.countVulns.textContent = list.filter(a => a.category === 'VULNERABILITY').length;
    elements.countCisa.textContent = list.filter(a => a.category === 'DEFENSE_ADVISORY').length;
    elements.countAi.textContent = list.filter(a => a.category === 'AI_EMERGING').length;
    elements.countSaved.textContent = state.bookmarks.size;
  }

  // ==========================================
  // FILTERING, SORTING & RENDERING
  // ==========================================
  function applyFiltersAndRender() {
    let list = [...state.allArticles];

    // 1. Category Filter
    if (state.currentCategory === 'SAVED') {
      list = Array.from(state.bookmarks.values());
    } else if (state.currentCategory !== 'ALL') {
      list = list.filter(a => a.category === state.currentCategory);
    }

    // 2. Severity Filter
    if (state.currentSeverity !== 'ALL') {
      list = list.filter(a => a.severity === state.currentSeverity);
    }

    // 3. Source Filter
    if (state.currentSource !== 'ALL') {
      list = list.filter(a => a.source.toLowerCase() === state.currentSource.toLowerCase());
    }

    // 4. Search Filter
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(a => 
        a.title.toLowerCase().includes(q) ||
        a.snippet.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q) ||
        (a.tags && a.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // 5. Sorting
    if (state.sortOrder === 'newest') {
      list.sort((a, b) => b.timestamp - a.timestamp);
    } else if (state.sortOrder === 'oldest') {
      list.sort((a, b) => a.timestamp - b.timestamp);
    } else if (state.sortOrder === 'severity') {
      const priority = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, INFO: 1 };
      list.sort((a, b) => (priority[b.severity] || 0) - (priority[a.severity] || 0) || (b.timestamp - a.timestamp));
    }

    state.displayedArticles = list;
    state.page = 1;

    // Active filter banner
    if (state.searchQuery || state.currentCategory !== 'ALL' || state.currentSeverity !== 'ALL' || state.currentSource !== 'ALL') {
      elements.activeFilterBanner.classList.remove('hidden');
      const parts = [];
      if (state.searchQuery) parts.push(`Query: "${state.searchQuery}"`);
      if (state.currentCategory !== 'ALL') parts.push(`Category: ${state.currentCategory}`);
      if (state.currentSeverity !== 'ALL') parts.push(`Severity: ${state.currentSeverity}`);
      if (state.currentSource !== 'ALL') parts.push(`Source: ${state.currentSource}`);
      elements.activeFilterText.textContent = `Active Filter (${list.length} results): ${parts.join(' | ')}`;
    } else {
      elements.activeFilterBanner.classList.add('hidden');
    }

    renderGrid();
  }

  // Render news cards
  function renderGrid() {
    const total = state.displayedArticles.length;
    const itemsToShow = state.displayedArticles.slice(0, state.page * state.pageSize);

    if (total === 0) {
      elements.newsGrid.innerHTML = '';
      elements.emptyState.classList.remove('hidden');
      elements.paginationWrap.classList.add('hidden');
      
      if (state.searchQuery) {
        elements.emptyDesc.textContent = `No stored reports found for "${state.searchQuery}". Click below to search live internet sources.`;
        elements.emptySearchBtn.classList.remove('hidden');
      } else {
        elements.emptyDesc.textContent = 'No threat reports match your selected criteria.';
        elements.emptySearchBtn.classList.add('hidden');
      }
      return;
    }

    elements.emptyState.classList.add('hidden');
    elements.newsGrid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    itemsToShow.forEach(article => {
      fragment.appendChild(createArticleCard(article));
    });
    elements.newsGrid.appendChild(fragment);

    // Pagination button
    if (itemsToShow.length < total) {
      elements.paginationWrap.classList.remove('hidden');
      elements.loadedCountLabel.textContent = `(${itemsToShow.length} / ${total})`;
    } else {
      elements.paginationWrap.classList.add('hidden');
    }
  }

  // Highlight search terms safely
  function highlightText(text, query) {
    if (!query || !query.trim()) return escapeHTML(text);
    const escaped = escapeRegex(query.trim());
    const re = new RegExp(`(${escaped})`, 'gi');
    return escapeHTML(text).replace(re, '<mark class="search-highlight">$1</mark>');
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Relative Time Helper
  function getRelativeTime(timestamp) {
    const diffMs = Date.now() - timestamp;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Category Icon & Label
  function getCategoryLabel(cat) {
    switch (cat) {
      case 'CYBERCRIME': return '🚨 Cybercrime & Arrests';
      case 'RANSOMWARE': return '☣️ Ransomware & Malware';
      case 'DATA_BREACH': return '🔓 Data Breach & Leaks';
      case 'VULNERABILITY': return '⚡ Zero-Day & CVE';
      case 'DEFENSE_ADVISORY': return '🛡️ CISA & Defenses';
      case 'AI_EMERGING': return '🤖 AI & Emerging Threat';
      default: return '🌐 Internet Tech & Web';
    }
  }

  // Create Card Element
  function createArticleCard(article) {
    const card = document.createElement('article');
    card.className = `intel-card severity-${article.severity.toLowerCase()}`;
    card.setAttribute('data-id', article.id);

    const isBookmarked = state.bookmarks.has(article.id);
    const timeAgo = getRelativeTime(article.timestamp);
    const highlightedTitle = highlightText(article.title, state.searchQuery);
    const highlightedSnippet = highlightText(article.snippet, state.searchQuery);

    let tagsHtml = '';
    if (article.tags && article.tags.length > 0) {
      tagsHtml = `<div class="card-tags">` +
        article.tags.map(tag => `<span class="ioc-tag">#${escapeHTML(tag)}</span>`).join('') +
        `</div>`;
    }

    card.innerHTML = `
      <div class="card-header-stripe" aria-hidden="true"></div>
      <div class="card-body">
        <div class="card-meta-row">
          <div class="meta-badges">
            <span class="badge badge-${article.severity.toLowerCase()}">${article.severity}</span>
            <span class="badge badge-category">${article.category}</span>
          </div>
          <div class="time-stamp" title="${new Date(article.timestamp).toLocaleString()}">${timeAgo}</div>
        </div>
        <div class="card-meta-row">
          <span class="source-stamp">📡 ${escapeHTML(article.source)}</span>
        </div>
        <h3 class="card-title">${highlightedTitle}</h3>
        <p class="card-snippet">${highlightedSnippet}</p>
        ${tagsHtml}
      </div>
      <div class="card-footer">
        <button type="button" class="card-action-btn btn-intel" data-action="read">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>Intel Brief</span>
        </button>
        <button type="button" class="card-action-btn ${isBookmarked ? 'bookmarked' : ''}" data-action="bookmark" title="Bookmark report">
          <svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span>${isBookmarked ? 'Saved' : 'Save'}</span>
        </button>
        <a href="${escapeHTML(article.link)}" target="_blank" rel="noopener noreferrer" class="card-source-link" title="Open publisher report">
          <span>Source</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </a>
      </div>
    `;

    // Event Delegation on card clicks
    card.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const action = actionBtn.getAttribute('data-action');
        if (action === 'read') {
          openModalWithArticle(article);
        } else if (action === 'bookmark') {
          toggleBookmark(article);
        }
        return;
      }

      // Title click opens modal
      if (e.target.closest('.card-title')) {
        openModalWithArticle(article);
      }
    });

    return card;
  }

  // Toggle Bookmark
  function toggleBookmark(article) {
    window.cyberSound.playClick();
    if (state.bookmarks.has(article.id)) {
      state.bookmarks.delete(article.id);
      showToast('Removed from saved intel', 'info');
    } else {
      state.bookmarks.set(article.id, article);
      showToast('Saved to intel bookmarks', 'success');
    }
    saveBookmarksToStorage();
    
    // Re-render if in SAVED category
    if (state.currentCategory === 'SAVED') {
      applyFiltersAndRender();
    } else {
      // Update individual card button state
      const card = elements.newsGrid.querySelector(`[data-id="${article.id}"]`);
      if (card) {
        const btn = card.querySelector('[data-action="bookmark"]');
        const isSaved = state.bookmarks.has(article.id);
        btn.classList.toggle('bookmarked', isSaved);
        btn.querySelector('span').textContent = isSaved ? 'Saved' : 'Save';
      }
    }

    // Also update modal bookmark button if open
    if (state.selectedArticle && state.selectedArticle.id === article.id) {
      updateModalBookmarkState();
    }
  }

  // ==========================================
  // MODAL LOGIC (MODERN WEB GUIDANCE)
  // ==========================================
  function openModalWithArticle(article) {
    state.selectedArticle = article;
    window.cyberSound.playClick();

    // Populate Modal Content
    elements.modalTitle.textContent = article.title;
    elements.modalSummary.textContent = article.fullSummary || article.snippet;
    
    // Badges
    elements.modalSeverityBadge.className = `badge badge-${article.severity.toLowerCase()}`;
    elements.modalSeverityBadge.textContent = article.severity;
    elements.modalCategoryBadge.textContent = getCategoryLabel(article.category);
    elements.modalSourceLabel.textContent = `📡 ${article.source}`;
    elements.modalTimeLabel.textContent = getRelativeTime(article.timestamp);
    elements.modalExactDate.textContent = new Date(article.timestamp).toUTCString();
    elements.modalIntelId.textContent = article.id;
    
    // Image banner if exists
    if (article.imageUrl) {
      elements.modalImage.src = article.imageUrl;
      elements.modalImageContainer.classList.remove('hidden');
    } else {
      elements.modalImageContainer.classList.add('hidden');
    }

    // Tags
    elements.modalTagsContainer.innerHTML = '';
    if (article.tags && article.tags.length > 0) {
      article.tags.forEach(t => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'ioc-tag';
        tagSpan.textContent = `#${t}`;
        elements.modalTagsContainer.appendChild(tagSpan);
      });
    } else {
      elements.modalTagsContainer.innerHTML = '<span class="ioc-tag">#cybersecurity</span><span class="ioc-tag">#incident</span>';
    }

    // Source Link
    elements.modalSourceLink.href = article.link;

    updateModalBookmarkState();

    // Open natively as modal (Modern Web Guidance Rule 1)
    elements.dialog.showModal();
  }

  function updateModalBookmarkState() {
    if (!state.selectedArticle) return;
    const isSaved = state.bookmarks.has(state.selectedArticle.id);
    elements.modalBookmarkBtn.classList.toggle('bookmarked', isSaved);
    elements.modalBookmarkLabel.textContent = isSaved ? 'Bookmarked' : 'Bookmark';
  }

  function closeModal() {
    elements.dialog.close();
    state.selectedArticle = null;
  }

  // ==========================================
  // EVENT LISTENERS & AUTO REFRESH
  // ==========================================
  function setupEventListeners() {
    // 1. Search Input typing (real-time filter with debounce)
    let searchDebounce;
    elements.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      const val = e.target.value;
      elements.clearSearchBtn.classList.toggle('hidden', !val);

      searchDebounce = setTimeout(() => {
        state.searchQuery = val.trim();
        applyFiltersAndRender();
      }, 250);
    });

    // Enter key triggers live internet search if pressed
    elements.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = elements.searchInput.value.trim();
        if (val) executeLiveInternetSearch(val);
      }
    });

    // Clear search button
    elements.clearSearchBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.clearSearchBtn.classList.add('hidden');
      state.searchQuery = '';
      applyFiltersAndRender();
      elements.searchInput.focus();
    });

    // Search Web button
    elements.internetSearchBtn.addEventListener('click', () => {
      const val = elements.searchInput.value.trim();
      if (val) executeLiveInternetSearch(val);
      else elements.searchInput.focus();
    });

    // Empty state search web button
    elements.emptySearchBtn.addEventListener('click', () => {
      const val = state.searchQuery || elements.searchInput.value.trim();
      if (val) executeLiveInternetSearch(val);
    });

    // Reset filter link
    elements.resetFilterBtn.addEventListener('click', () => {
      state.searchQuery = '';
      state.currentCategory = 'ALL';
      state.currentSeverity = 'ALL';
      state.currentSource = 'ALL';
      elements.searchInput.value = '';
      elements.clearSearchBtn.classList.add('hidden');
      elements.filterSeverity.value = 'ALL';
      elements.filterSource.value = 'ALL';
      elements.categoryTabs.forEach(t => t.classList.toggle('active', t.dataset.category === 'ALL'));
      applyFiltersAndRender();
    });

    // Trending Query Pills
    document.querySelectorAll('.query-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const query = pill.dataset.query;
        elements.searchInput.value = query;
        elements.clearSearchBtn.classList.remove('hidden');
        state.searchQuery = query;
        applyFiltersAndRender();
        window.cyberSound.playClick();
      });
    });

    // Category Tabs
    elements.categoryTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.categoryTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.currentCategory = tab.dataset.category;
        window.cyberSound.playClick();
        applyFiltersAndRender();
      });
    });

    // Selects
    elements.filterSeverity.addEventListener('change', (e) => {
      state.currentSeverity = e.target.value;
      window.cyberSound.playClick();
      applyFiltersAndRender();
    });

    elements.filterSource.addEventListener('change', (e) => {
      state.currentSource = e.target.value;
      window.cyberSound.playClick();
      applyFiltersAndRender();
    });

    elements.sortOrder.addEventListener('change', (e) => {
      state.sortOrder = e.target.value;
      window.cyberSound.playClick();
      applyFiltersAndRender();
    });

    // Sync button
    elements.syncNowBtn.addEventListener('click', forceSyncAll);

    // Audio toggle button
    elements.audioToggleBtn.addEventListener('click', () => {
      const newMuted = !window.cyberSound.isMuted;
      window.cyberSound.setMuted(newMuted);
      updateAudioUI();
      if (!newMuted) window.cyberSound.playRadarPing();
    });

    // Auto-refresh switch
    elements.autoRefreshToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        startAutoRefreshCycle();
        showToast('Live stream polling active', 'info');
      } else {
        stopAutoRefreshCycle();
        showToast('Live stream polling paused', 'info');
      }
    });

    // View mode toggle
    elements.viewGridBtn.addEventListener('click', () => {
      state.viewMode = 'grid';
      elements.viewGridBtn.classList.add('active');
      elements.viewListBtn.classList.remove('active');
      elements.newsGrid.classList.remove('list-view');
    });

    elements.viewListBtn.addEventListener('click', () => {
      state.viewMode = 'list';
      elements.viewListBtn.classList.add('active');
      elements.viewGridBtn.classList.remove('active');
      elements.newsGrid.classList.add('list-view');
    });

    // Load More pagination
    elements.loadMoreBtn.addEventListener('click', () => {
      state.page++;
      window.cyberSound.playClick();
      renderGrid();
    });

    // Modal Close
    elements.modalCloseBtn.addEventListener('click', closeModal);

    // Modal Bookmark button
    elements.modalBookmarkBtn.addEventListener('click', () => {
      if (state.selectedArticle) {
        toggleBookmark(state.selectedArticle);
      }
    });

    // Modal Copy Link
    elements.modalCopyLinkBtn.addEventListener('click', () => {
      if (state.selectedArticle && state.selectedArticle.link) {
        navigator.clipboard.writeText(state.selectedArticle.link).then(() => {
          showToast('Article link copied to clipboard!', 'success');
          window.cyberSound.playClick();
        }).catch(() => {
          showToast('Failed to copy link', 'alert');
        });
      }
    });

    // Global Keyboard Shortcut: [Ctrl + /] or [/] to focus search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== elements.searchInput && !elements.dialog.open) {
        e.preventDefault();
        elements.searchInput.focus();
        elements.searchInput.select();
      }
    });
  }

  // Auto-refresh countdown cycle
  function startAutoRefreshCycle() {
    stopAutoRefreshCycle();
    state.countdownSeconds = 60;
    elements.countdownBadge.textContent = `${state.countdownSeconds}s`;

    state.countdownTimer = setInterval(() => {
      state.countdownSeconds--;
      if (state.countdownSeconds <= 0) {
        state.countdownSeconds = 60;
        fetchLiveFeeds(false);
      }
      elements.countdownBadge.textContent = `${state.countdownSeconds}s`;
    }, 1000);
  }

  function stopAutoRefreshCycle() {
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    elements.countdownBadge.textContent = 'OFF';
  }

  // Boot up
  init();
})();
