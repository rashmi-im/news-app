/**
 * NewsWave — script.js
 * Full app logic: infinite scroll, bookmarks, country selector,
 * category filtering, keyword search, dark/light mode
 */

'use strict';

/* ──────────────────────────────────────────────
   STATE
────────────────────────────────────────────── */
const state = {
  category: CONFIG.defaultCategory,
  country: CONFIG.defaultCountry,
  query: '',
  page: 1,
  totalResults: 0,
  articles: [],
  bookmarks: [],
  isLoading: false,
  isSearchMode: false,
  reachedEnd: false,
};

/* ──────────────────────────────────────────────
   DOM
────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

const DOM = {
  sidebar:         $('sidebar'),
  menuBtn:         $('menuBtn'),
  catNav:          $('catNav'),
  countrySelect:   $('countrySelect'),
  trendingTags:    $('trendingTags'),
  searchInput:     $('searchInput'),
  searchKbd:       $('searchKbd'),
  themeBtn:        $('themeBtn'),
  themeIcon:       $('themeIcon'),
  themeLabel:      $('themeLabel'),
  liveClock:       $('liveClock'),
  tickerText:      $('tickerText'),
  feedTag:         $('feedTag'),
  feedCount:       $('feedCount'),
  feedTitle:       $('feedTitle'),
  loaderOverlay:   $('loaderOverlay'),
  loaderText:      $('loaderText'),
  newsGrid:        $('newsGrid'),
  errorPanel:      $('errorPanel'),
  errorMsg:        $('errorMsg'),
  retryBtn:        $('retryBtn'),
  noResults:       $('noResults'),
  noResultsTerm:   $('noResultsTerm'),
  scrollSentinel:  $('scrollSentinel'),
  scrollLoader:    $('scrollLoader'),
  endOfFeed:       $('endOfFeed'),
  bmCount:         $('bmCount'),
  viewBookmarksBtn:$('viewBookmarksBtn'),
  bmOverlay:       $('bmOverlay'),
  bmList:          $('bmList'),
  bmEmpty:         $('bmEmpty'),
  bmClose:         $('bmClose'),
  clearBookmarksBtn:$('clearBookmarksBtn'),
};

/* ──────────────────────────────────────────────
   INIT
────────────────────────────────────────────── */
function init() {
  loadPreferences();
  buildCategoryNav();
  buildCountrySelect();
  bindEvents();
  startClock();
  fetchFeed(true);
}

/* ──────────────────────────────────────────────
   PREFERENCES (localStorage)
────────────────────────────────────────────── */
function loadPreferences() {
  // Theme
  const theme = localStorage.getItem('nw-theme') || 'dark';
  applyTheme(theme);

  // Country
  const country = localStorage.getItem('nw-country') || CONFIG.defaultCountry;
  state.country = country;

  // Bookmarks
  try {
    state.bookmarks = JSON.parse(localStorage.getItem('nw-bookmarks') || '[]');
  } catch {
    state.bookmarks = [];
  }
  updateBookmarkCount();
}

function savePreferences() {
  localStorage.setItem('nw-theme', document.documentElement.dataset.theme);
  localStorage.setItem('nw-country', state.country);
  localStorage.setItem('nw-bookmarks', JSON.stringify(state.bookmarks));
}

/* ──────────────────────────────────────────────
   BUILD SIDEBAR UI
────────────────────────────────────────────── */
function buildCategoryNav() {
  DOM.catNav.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat.id === state.category ? ' active' : '');
    btn.dataset.id = cat.id;
    btn.innerHTML = `<span class="cat-icon">${cat.icon}</span>${cat.label}`;
    btn.addEventListener('click', () => {
      state.isSearchMode = false;
      DOM.searchInput.value = '';
      selectCategory(cat.id);
      closeSidebar();
    });
    DOM.catNav.appendChild(btn);
  });
}

function buildCountrySelect() {
  DOM.countrySelect.innerHTML = '';
  COUNTRIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = c.label;
    opt.selected = c.code === state.country;
    DOM.countrySelect.appendChild(opt);
  });
}

/* ──────────────────────────────────────────────
   EVENT BINDING
────────────────────────────────────────────── */
function bindEvents() {
  // Hamburger / sidebar
  DOM.menuBtn.addEventListener('click', toggleSidebar);

  // Close sidebar when clicking outside
  document.addEventListener('click', e => {
    if (!DOM.sidebar.contains(e.target) && !DOM.menuBtn.contains(e.target)) {
      closeSidebar();
    }
  });

  // Country selector
  DOM.countrySelect.addEventListener('change', () => {
    state.country = DOM.countrySelect.value;
    savePreferences();
    if (!state.isSearchMode) fetchFeed(true);
  });

  // Search
  DOM.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = DOM.searchInput.value.trim();
      if (q) startSearch(q);
      else if (state.isSearchMode) cancelSearch();
    }
    if (e.key === 'Escape') {
      DOM.searchInput.blur();
      if (state.isSearchMode) cancelSearch();
    }
  });

  // Clear search when input is emptied
  DOM.searchInput.addEventListener('input', e => {
    if (!e.target.value.trim() && state.isSearchMode) cancelSearch();
  });

  // Trending tags → quick search
  DOM.trendingTags.querySelectorAll('.tag').forEach(tag => {
    tag.addEventListener('click', () => {
      DOM.searchInput.value = tag.textContent;
      startSearch(tag.textContent);
      closeSidebar();
    });
  });

  // Theme toggle
  DOM.themeBtn.addEventListener('click', toggleTheme);

  // Retry
  DOM.retryBtn.addEventListener('click', () => fetchFeed(true));

  // Bookmarks
  DOM.viewBookmarksBtn.addEventListener('click', openBookmarks);
  DOM.bmClose.addEventListener('click', closeBookmarks);
  DOM.bmOverlay.addEventListener('click', e => {
    if (e.target === DOM.bmOverlay) closeBookmarks();
  });
  DOM.clearBookmarksBtn.addEventListener('click', clearAllBookmarks);

  // Infinite scroll — IntersectionObserver
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !state.isLoading && !state.reachedEnd) {
      loadMore();
    }
  }, { rootMargin: '300px' });
  observer.observe(DOM.scrollSentinel);
}

/* ──────────────────────────────────────────────
   NAVIGATION
────────────────────────────────────────────── */
function selectCategory(id) {
  state.category = id;
  state.query = '';
  state.isSearchMode = false;

  // Update active button
  DOM.catNav.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id);
  });

  const cat = CATEGORIES.find(c => c.id === id);
  DOM.feedTitle.textContent = cat ? cat.label + ' News' : 'News';
  DOM.feedTag.textContent = id.toUpperCase();

  fetchFeed(true);
}

function startSearch(query) {
  state.query = query;
  state.isSearchMode = true;
  DOM.feedTitle.textContent = `"${query}"`;
  DOM.feedTag.textContent = 'SEARCH';

  // Deactivate categories
  DOM.catNav.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));

  fetchFeed(true);
}

function cancelSearch() {
  state.isSearchMode = false;
  state.query = '';
  DOM.searchInput.value = '';
  selectCategory(state.category);
}

/* ──────────────────────────────────────────────
   SIDEBAR
────────────────────────────────────────────── */
function toggleSidebar() {
  DOM.sidebar.classList.toggle('open');
}

function closeSidebar() {
  DOM.sidebar.classList.remove('open');
}

/* ──────────────────────────────────────────────
   THEME
────────────────────────────────────────────── */
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  savePreferences();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (theme === 'dark') {
    DOM.themeIcon.textContent = '☀';
    DOM.themeLabel.textContent = 'Light Mode';
  } else {
    DOM.themeIcon.textContent = '☾';
    DOM.themeLabel.textContent = 'Dark Mode';
  }
}

/* ──────────────────────────────────────────────
   CLOCK
────────────────────────────────────────────── */
function startClock() {
  const tick = () => {
    const now = new Date();
    DOM.liveClock.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  };
  tick();
  setInterval(tick, 1000);
}

/* ──────────────────────────────────────────────
   FETCH
────────────────────────────────────────────── */
/**
 * Primary fetch entry point.
 * @param {boolean} reset - true = fresh load, false = next page
 */
async function fetchFeed(reset = false) {
  if (state.isLoading) return;
  state.isLoading = true;

  if (reset) {
    state.page = 1;
    state.articles = [];
    state.reachedEnd = false;
    DOM.newsGrid.innerHTML = '';
    DOM.endOfFeed.style.display = 'none';
    showMainLoader(true);
    hideError();
    DOM.noResults.style.display = 'none';
  } else {
    DOM.scrollLoader.style.display = 'flex';
  }

  const url = buildUrl(state.page);

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.status === 'error') {
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    const fresh = (data.articles || []).filter(
      a => a.title && a.title !== '[Removed]' && a.url
    );

    state.totalResults = data.totalResults || 0;

    if (reset) {
      state.articles = fresh;
      if (fresh.length === 0) {
        showNoResults();
      } else {
        renderCards(fresh, 0);
        updateTicker(fresh);
      }
    } else {
      const startIndex = state.articles.length;
      state.articles = [...state.articles, ...fresh];
      renderCards(fresh, startIndex);
    }

    // Update count label
    DOM.feedCount.textContent = state.totalResults
      ? `${state.articles.length.toLocaleString()} / ${Math.min(state.totalResults, 100).toLocaleString()} stories`
      : '';

    // Check if end reached
    const maxAllowed = Math.min(state.totalResults, 100);
    if (fresh.length < CONFIG.pageSize || state.articles.length >= maxAllowed) {
      state.reachedEnd = true;
      if (state.articles.length > 0) {
        DOM.endOfFeed.style.display = 'block';
      }
    } else {
      state.page += 1;
    }

  } catch (err) {
    console.error('[NewsWave]', err);
    if (reset) showError(err.message);
  } finally {
    state.isLoading = false;
    showMainLoader(false);
    DOM.scrollLoader.style.display = 'none';
  }
}

function loadMore() {
  if (!state.reachedEnd) fetchFeed(false);
}

/**
 * Build API URL based on current state
 */
function buildUrl(page) {
  const { apiKey, baseUrl, pageSize } = CONFIG;
  if (state.isSearchMode && state.query) {
    return `${baseUrl}/everything?q=${encodeURIComponent(state.query)}&pageSize=${pageSize}&page=${page}&sortBy=publishedAt&language=en&apiKey=${apiKey}`;
  }
  return `${baseUrl}/top-headlines?country=${state.country}&category=${state.category}&pageSize=${pageSize}&page=${page}&apiKey=${apiKey}`;
}

/* ──────────────────────────────────────────────
   RENDER CARDS
────────────────────────────────────────────── */
/**
 * Render an array of articles into the grid
 * @param {Array} articles
 * @param {number} startIndex - global index offset for animation stagger
 */
function renderCards(articles, startIndex) {
  const fragment = document.createDocumentFragment();

  articles.forEach((article, i) => {
    const globalIndex = startIndex + i;
    const card = buildCard(article, globalIndex);
    fragment.appendChild(card);
  });

  DOM.newsGrid.appendChild(fragment);
}

/**
 * Build a single card DOM element
 */
function buildCard(article, index) {
  const isFeatured = index === 0;
  const isSaved = isBookmarked(article.url);

  const card = document.createElement('article');
  card.className = `news-card${isFeatured ? ' featured' : ''}`;
  card.style.animationDelay = `${Math.min(index % 12, 8) * 60}ms`;

  const cat = CATEGORIES.find(c => c.id === state.category);
  const catLabel = cat ? cat.label : state.category;
  const imgSrc = article.urlToImage;
  const fallbackIcon = cat ? cat.icon : '📰';

  card.innerHTML = `
    <div class="card-img">
      ${imgSrc
        ? `<img src="${esc(imgSrc)}" alt="${esc(article.title)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\"placeholder\\">${fallbackIcon}</div>'">`
        : `<div class="placeholder">${fallbackIcon}</div>`}
      <span class="card-source-badge">${esc(article.source?.name || 'Unknown')}</span>
      <button class="bm-btn${isSaved ? ' saved' : ''}" data-url="${esc(article.url)}" title="${isSaved ? 'Remove bookmark' : 'Save article'}">
        ${isSaved ? '★' : '☆'}
      </button>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-cat">${esc(catLabel)}</span>
        <span class="card-time">${timeAgo(article.publishedAt)}</span>
      </div>
      <h2 class="card-title">${esc(article.title)}</h2>
      ${article.description
        ? `<p class="card-desc">${esc(article.description)}</p>`
        : ''}
      <div class="card-footer">
        <a class="read-link" href="${esc(article.url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
          Read Full Story
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
        <button class="card-share-btn" title="Copy link" onclick="event.stopPropagation(); copyLink('${esc(article.url)}')">⎘</button>
      </div>
    </div>
  `;

  // Open article on card click
  card.addEventListener('click', () => window.open(article.url, '_blank', 'noopener'));

  // Bookmark button
  card.querySelector('.bm-btn').addEventListener('click', e => {
    e.stopPropagation();
    toggleBookmark(article, e.currentTarget);
  });

  return card;
}

/* ──────────────────────────────────────────────
   TICKER
────────────────────────────────────────────── */
function updateTicker(articles) {
  const headlines = articles
    .slice(0, 10)
    .map(a => a.title)
    .join('  ◆  ');
  DOM.tickerText.textContent = headlines + '  ◆  ';
}

/* ──────────────────────────────────────────────
   BOOKMARKS
────────────────────────────────────────────── */
function isBookmarked(url) {
  return state.bookmarks.some(b => b.url === url);
}

function toggleBookmark(article, btn) {
  if (isBookmarked(article.url)) {
    state.bookmarks = state.bookmarks.filter(b => b.url !== article.url);
    btn.textContent = '☆';
    btn.classList.remove('saved');
    btn.title = 'Save article';
  } else {
    if (state.bookmarks.length >= CONFIG.maxBookmarks) {
      alert('Bookmark limit reached (50). Remove some first.');
      return;
    }
    state.bookmarks.unshift({
      url: article.url,
      title: article.title,
      source: article.source?.name || '',
      image: article.urlToImage || '',
      savedAt: Date.now(),
    });
    btn.textContent = '★';
    btn.classList.add('saved');
    btn.title = 'Remove bookmark';
  }
  updateBookmarkCount();
  savePreferences();
}

function updateBookmarkCount() {
  DOM.bmCount.textContent = state.bookmarks.length;
}

function openBookmarks() {
  renderBookmarkList();
  DOM.bmOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeBookmarks() {
  DOM.bmOverlay.style.display = 'none';
  document.body.style.overflow = '';
}

function renderBookmarkList() {
  DOM.bmList.innerHTML = '';

  if (!state.bookmarks.length) {
    DOM.bmEmpty.style.display = 'flex';
    DOM.bmList.style.display = 'none';
    return;
  }

  DOM.bmEmpty.style.display = 'none';
  DOM.bmList.style.display = 'flex';

  state.bookmarks.forEach(bm => {
    const item = document.createElement('div');
    item.className = 'bm-item';
    item.innerHTML = `
      ${bm.image
        ? `<img class="bm-item-img" src="${esc(bm.image)}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : ''}
      <div class="bm-item-body">
        <div class="bm-item-title">${esc(bm.title)}</div>
        <div class="bm-item-source">${esc(bm.source)}</div>
      </div>
      <button class="bm-item-remove" data-url="${esc(bm.url)}" title="Remove">✕</button>
    `;
    item.querySelector('.bm-item-body').addEventListener('click', () => window.open(bm.url, '_blank', 'noopener'));
    item.querySelector('.bm-item-remove').addEventListener('click', e => {
      e.stopPropagation();
      removeBookmark(bm.url);
      renderBookmarkList();
    });
    DOM.bmList.appendChild(item);
  });
}

function removeBookmark(url) {
  state.bookmarks = state.bookmarks.filter(b => b.url !== url);

  // Update any star buttons currently visible on cards
  document.querySelectorAll(`.bm-btn[data-url="${CSS.escape(url)}"]`).forEach(btn => {
    btn.textContent = '☆';
    btn.classList.remove('saved');
  });

  updateBookmarkCount();
  savePreferences();
}

function clearAllBookmarks() {
  if (!confirm('Clear all saved articles?')) return;
  state.bookmarks = [];
  updateBookmarkCount();
  savePreferences();
  document.querySelectorAll('.bm-btn.saved').forEach(btn => {
    btn.textContent = '☆';
    btn.classList.remove('saved');
  });
  renderBookmarkList();
}

/* ──────────────────────────────────────────────
   SHARE / COPY
────────────────────────────────────────────── */
function copyLink(url) {
  navigator.clipboard?.writeText(url).then(() => {
    // Brief visual feedback — swap icon momentarily
    const btns = document.querySelectorAll(`.card-share-btn`);
    // Find the button that triggered it by matching a nearby read-link href
    // Simple approach: just flash a toast
    showToast('Link copied!');
  }).catch(() => {});
}

function showToast(msg) {
  const existing = document.querySelector('.nw-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'nw-toast';
  t.textContent = msg;
  t.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:var(--neon); color:var(--bg-0); font-family:var(--font-mono);
    font-size:0.72rem; letter-spacing:0.1em; padding:10px 20px;
    border-radius:4px; z-index:9999; animation:fadeIn 0.2s ease;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ──────────────────────────────────────────────
   UI HELPERS
────────────────────────────────────────────── */
function showMainLoader(show) {
  DOM.loaderOverlay.style.display = show ? 'flex' : 'none';
}

function showError(msg) {
  DOM.errorMsg.textContent = msg || 'An error occurred. Check your API key.';
  DOM.errorPanel.style.display = 'block';
  DOM.newsGrid.innerHTML = '';
}

function hideError() {
  DOM.errorPanel.style.display = 'none';
}

function showNoResults() {
  DOM.noResultsTerm.textContent = state.isSearchMode ? state.query : state.category;
  DOM.noResults.style.display = 'flex';
}

/* ──────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────── */
/**
 * Relative time label
 */
function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * HTML escape to prevent XSS
 */
function esc(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str || '').replace(/[&<>"']/g, m => map[m]);
}

/* ──────────────────────────────────────────────
   START
────────────────────────────────────────────── */
init();
