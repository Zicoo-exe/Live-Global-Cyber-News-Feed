const express = require('express');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// XML Parser setup
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '__cdata',
  trimValues: true,
  parseTagValue: false
});

// Curated List of Trusted Cyber Intelligence & News RSS Feeds
const RSS_FEEDS = [
  {
    id: 'thn',
    name: 'The Hacker News',
    url: 'https://feeds.feedburner.com/TheHackersNews',
    defaultCategory: 'VULNERABILITY',
    weight: 1.2
  },
  {
    id: 'bleeping',
    name: 'BleepingComputer',
    url: 'https://www.bleepingcomputer.com/feed/',
    defaultCategory: 'RANSOMWARE',
    weight: 1.2
  },
  {
    id: 'securityweek',
    name: 'SecurityWeek',
    url: 'https://www.securityweek.com/feed/',
    defaultCategory: 'CYBERCRIME',
    weight: 1.1
  },
  {
    id: 'cyberscoop',
    name: 'CyberScoop',
    url: 'https://cyberscoop.com/feed/',
    defaultCategory: 'CYBERCRIME',
    weight: 1.1
  },
  {
    id: 'darkreading',
    name: 'Dark Reading',
    url: 'https://www.darkreading.com/rss.xml',
    defaultCategory: 'VULNERABILITY',
    weight: 1.0
  },
  {
    id: 'wired',
    name: 'Wired Security',
    url: 'https://www.wired.com/feed/category/security/latest/rss',
    defaultCategory: 'INTERNET_TECH',
    weight: 1.0
  },
  {
    id: 'cisa',
    name: 'CISA Alerts',
    url: 'https://www.cisa.gov/uscert/ncas/current-activity.xml',
    defaultCategory: 'DEFENSE_ADVISORY',
    weight: 1.3
  },
  {
    id: 'gnews_crime',
    name: 'Global Cybercrime Wire',
    url: 'https://news.google.com/rss/search?q=cybercrime+OR+ransomware+OR+%22data+breach%22+OR+hacker+arrest&hl=en-US&gl=US&ceid=US:en',
    defaultCategory: 'CYBERCRIME',
    weight: 1.0
  },
  {
    id: 'gnews_threats',
    name: 'Global Threat Watch',
    url: 'https://news.google.com/rss/search?q=%22zero-day%22+OR+%22cyber+attack%22+OR+%22security+vulnerability%22+when:7d&hl=en-US&gl=US&ceid=US:en',
    defaultCategory: 'VULNERABILITY',
    weight: 1.0
  },
  {
    id: 'gnews_arrests',
    name: 'Cybercrime Busts & FBI Wire',
    url: 'https://news.google.com/rss/search?q=(%22hacker+arrested%22+OR+%22cybercrime+indictment%22+OR+%22interpol%22+OR+%22extradited%22+OR+%22darknet+bust%22)+when:30d&hl=en-US&gl=US&ceid=US:en',
    defaultCategory: 'CYBERCRIME',
    weight: 1.2
  }
];

// In-memory feed cache
let cachedArticles = [];
let lastSyncTimestamp = null;
let isSyncing = false;
let syncStats = {
  totalFeeds: RSS_FEEDS.length,
  successfulFeeds: 0,
  failedFeeds: 0,
  totalItems: 0,
  criticalCount: 0,
  breachCount: 0
};

// Helper: Strip HTML tags and clean up text
function cleanText(raw) {
  if (!raw) return '';
  if (typeof raw === 'object') {
    if (raw.__cdata) raw = raw.__cdata;
    else if (raw['#text']) raw = raw['#text'];
    else raw = JSON.stringify(raw);
  }
  return String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper: Extract image URL if available
function extractImage(item) {
  if (item['media:content'] && item['media:content']['@_url']) {
    return item['media:content']['@_url'];
  }
  if (item['enclosure'] && item['enclosure']['@_url']) {
    return item['enclosure']['@_url'];
  }
  if (item['media:thumbnail'] && item['media:thumbnail']['@_url']) {
    return item['media:thumbnail']['@_url'];
  }
  const desc = item.description || item.content || item['content:encoded'] || '';
  const descStr = typeof desc === 'object' ? (desc.__cdata || desc['#text'] || '') : String(desc);
  const match = descStr.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
  return match ? match[1] : null;
}

// Helper: Classify Category
function classifyCategory(title, snippet, defaultCat) {
  const combined = (title + ' ' + snippet).toLowerCase();
  
  if (/\b(ransomware|lockbit|blackcat|alphv|akira|encrypt|extort|decryptor)\b/.test(combined)) {
    return 'RANSOMWARE';
  }
  if (/\b(breach|leak|leaked|dump|exposed records|stolen credentials|compromised data|database leak)\b/.test(combined)) {
    return 'DATA_BREACH';
  }
  if (/\b(arrest|indicted|fbi|interpol|police|bust|scammer|jailed|sentenced|syndicate|fraud|extortionist|cartel|illicit)\b/.test(combined)) {
    return 'CYBERCRIME';
  }
  if (/\b(zero-day|0-day|cve-\d{4}-\d+|rce|remote code execution|vulnerability|flaw|exploit|privilege escalation|unpatched)\b/.test(combined)) {
    return 'VULNERABILITY';
  }
  if (/\b(cisa|alert|advisory|patch tuesday|mitigation|shield|defense|security update|guidelines)\b/.test(combined)) {
    return 'DEFENSE_ADVISORY';
  }
  if (/\b(ai|llm|deepfake|chatgpt|openai|machine learning|prompt injection|synthetic voice|generative ai)\b/.test(combined)) {
    return 'AI_EMERGING';
  }
  return defaultCat || 'INTERNET_TECH';
}

// Helper: Determine Threat Severity
function calculateSeverity(title, snippet) {
  const combined = (title + ' ' + snippet).toLowerCase();
  
  if (
    /\b(cvss 10|cvss 9|critical|zero-day|0-day|actively exploited|in the wild|emergency directive|mass exploitation|catastrophic|major breach)\b/.test(combined)
  ) {
    return 'CRITICAL';
  }
  if (
    /\b(high severity|remote code execution|rce|ransomware|hospital attack|fbi arrest|stolen million|data breach|unauthenticated|supply chain)\b/.test(combined)
  ) {
    return 'HIGH';
  }
  if (
    /\b(vulnerability|malware|phishing|exploit|trojan|botnet|bypass|privilege escalation|warning)\b/.test(combined)
  ) {
    return 'MEDIUM';
  }
  return 'INFO';
}

// Extract tags & CVEs
function extractTags(title, snippet) {
  const combined = (title + ' ' + snippet);
  const tags = new Set();
  
  // Find CVEs
  const cveMatches = combined.match(/CVE-\d{4}-\d{4,7}/gi);
  if (cveMatches) {
    cveMatches.slice(0, 3).forEach(cve => tags.add(cve.toUpperCase()));
  }
  
  // Specific threat actors / buzzwords
  const lower = combined.toLowerCase();
  const knownKeywords = [
    'ransomware', 'phishing', 'zero-day', 'ddos', 'malware', 'botnet',
    'fbi', 'cisa', 'darkweb', 'infostealer', 'deepfake', 'backdoor',
    'spyware', 'trojan', 'crypto scam', 'data breach', 'cloud security'
  ];
  
  knownKeywords.forEach(kw => {
    if (lower.includes(kw)) tags.add(kw);
  });
  
  return Array.from(tags).slice(0, 5);
}

// Helper: Robust Link Extractor
function extractLink(rawItem) {
  let link = rawItem.link;
  if (Array.isArray(link)) {
    const alt = link.find(l => typeof l === 'object' && l['@_rel'] === 'alternate');
    link = alt || link[0];
  }
  if (typeof link === 'object' && link !== null) {
    if (link['@_href']) link = link['@_href'];
    else if (link['#text']) link = link['#text'];
    else if (link.__cdata) link = link.__cdata;
    else link = String(Object.values(link)[0] || '');
  }
  if (!link && rawItem.guid) {
    link = typeof rawItem.guid === 'object' ? (rawItem.guid['#text'] || rawItem.guid['@_href'] || '') : rawItem.guid;
  }
  return String(link || '').trim();
}

// Normalize individual RSS / Atom item
function normalizeItem(rawItem, feedConfig) {
  const title = cleanText(rawItem.title) || 'Untitled Security Alert';
  const link = extractLink(rawItem);
  
  // Description / Snippet
  const rawDesc = rawItem.description || rawItem.summary || rawItem['content:encoded'] || '';
  const snippet = cleanText(rawDesc);
  
  // Publish Date
  let pubDate = new Date();
  if (rawItem.pubDate || rawItem.published || rawItem.updated || rawItem['dc:date']) {
    const parsed = new Date(rawItem.pubDate || rawItem.published || rawItem.updated || rawItem['dc:date']);
    if (!isNaN(parsed.getTime())) {
      pubDate = parsed;
    }
  }
  
  // Source name
  let sourceName = feedConfig.name;
  if (rawItem.source) {
    const src = cleanText(rawItem.source);
    if (src) sourceName = src;
  }

  // Image
  const imageUrl = extractImage(rawItem);
  
  // Classification
  const category = classifyCategory(title, snippet, feedConfig.defaultCategory);
  const severity = calculateSeverity(title, snippet);
  const tags = extractTags(title, snippet);
  
  // Unique ID safe string
  const baseKey = String(link || (title + pubDate.toISOString()));
  const id = Buffer.from(baseKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  
  return {
    id,
    title,
    link,
    snippet: snippet.length > 320 ? snippet.slice(0, 317) + '...' : snippet,
    fullSummary: snippet || 'Full details and telemetry available at original incident report.',
    source: sourceName,
    feedId: feedConfig.id,
    pubDate: pubDate.toISOString(),
    timestamp: pubDate.getTime(),
    category,
    severity,
    tags,
    imageUrl
  };
}

// Fetch single feed with timeout
async function fetchFeed(feedConfig) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  
  try {
    const response = await fetch(feedConfig.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberPulseBot/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const xml = await response.text();
    const parsed = xmlParser.parse(xml);
    
    let rawItems = [];
    if (parsed.rss && parsed.rss.channel && parsed.rss.channel.item) {
      rawItems = Array.isArray(parsed.rss.channel.item) ? parsed.rss.channel.item : [parsed.rss.channel.item];
    } else if (parsed.feed && parsed.feed.entry) {
      rawItems = Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
    } else if (parsed['rdf:RDF'] && parsed['rdf:RDF'].item) {
      rawItems = Array.isArray(parsed['rdf:RDF'].item) ? parsed['rdf:RDF'].item : [parsed['rdf:RDF'].item];
    }
    
    return rawItems.map(item => normalizeItem(item, feedConfig));
  } finally {
    clearTimeout(timeout);
  }
}

// Synchronize all feeds
async function syncAllFeeds() {
  if (isSyncing) return;
  isSyncing = true;
  
  console.log(`[CyberPulse] Synchronizing ${RSS_FEEDS.length} intelligence feeds...`);
  
  const results = await Promise.allSettled(RSS_FEEDS.map(feed => fetchFeed(feed)));
  
  const allArticles = [];
  const seenLinks = new Set();
  let successCount = 0;
  let failCount = 0;
  
  results.forEach((res, idx) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      successCount++;
      res.value.forEach(item => {
        if (item.link && !seenLinks.has(item.link)) {
          seenLinks.add(item.link);
          allArticles.push(item);
        }
      });
    } else {
      failCount++;
      console.warn(`[CyberPulse] Feed failed: ${RSS_FEEDS[idx].name} ->`, res.reason ? res.reason.message : 'Unknown error');
    }
  });
  
  // Sort by date descending
  allArticles.sort((a, b) => b.timestamp - a.timestamp);
  
  cachedArticles = allArticles;
  lastSyncTimestamp = new Date().toISOString();
  
  // Compute stats
  syncStats = {
    totalFeeds: RSS_FEEDS.length,
    successfulFeeds: successCount,
    failedFeeds: failCount,
    totalItems: cachedArticles.length,
    criticalCount: cachedArticles.filter(a => a.severity === 'CRITICAL').length,
    breachCount: cachedArticles.filter(a => a.category === 'DATA_BREACH' || a.category === 'CYBERCRIME').length,
    lastSync: lastSyncTimestamp
  };
  
  console.log(`[CyberPulse] Sync completed: ${cachedArticles.length} live cyber intelligence items indexed (${syncStats.criticalCount} critical).`);
  isSyncing = false;
}

// Live search across the entire internet via Google News RSS & in-memory cache
async function searchLiveInternet(query) {
  const cleanQ = query.trim();
  if (!cleanQ) return [];
  
  // 1. Search cached items first
  const qLower = cleanQ.toLowerCase();
  const matchedCache = cachedArticles.filter(item => {
    return item.title.toLowerCase().includes(qLower) ||
           item.snippet.toLowerCase().includes(qLower) ||
           item.source.toLowerCase().includes(qLower) ||
           item.tags.some(t => t.toLowerCase().includes(qLower));
  });
  
  // 2. Query live Google News RSS search for real-time external articles
  let internetResults = [];
  try {
    const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQ)}+when:30d&hl=en-US&gl=US&ceid=US:en`;
    const tempConfig = {
      id: 'gnews_live_search',
      name: 'Internet Live Query',
      defaultCategory: 'CYBERCRIME'
    };
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CyberPulseBot/1.0'
      }
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const xml = await response.text();
      const parsed = xmlParser.parse(xml);
      const rawItems = parsed.rss?.channel?.item || [];
      const list = Array.isArray(rawItems) ? rawItems : [rawItems];
      internetResults = list.map(item => normalizeItem(item, tempConfig));
    }
  } catch (err) {
    console.warn(`[CyberPulse] Live internet search fetch warning:`, err.message);
  }
  
  // Deduplicate against cache results
  const seenUrls = new Set(matchedCache.map(i => i.link));
  const uniqueLive = [];
  internetResults.forEach(item => {
    if (item.link && !seenUrls.has(item.link)) {
      seenUrls.add(item.link);
      uniqueLive.push(item);
    }
  });
  
  // Combine: local matches first, followed by live internet search matches
  const combined = [...matchedCache, ...uniqueLive];
  return combined;
}

// ==========================================
// API ROUTES
// ==========================================

// Get live news feed with filtering & pagination
app.get('/api/news', (req, res) => {
  const { category, severity, source, search, limit = 50, page = 1 } = req.query;
  
  let results = [...cachedArticles];
  
  // Filter by category
  if (category && category !== 'ALL') {
    results = results.filter(item => item.category === category);
  }
  
  // Filter by severity
  if (severity && severity !== 'ALL') {
    results = results.filter(item => item.severity === severity);
  }
  
  // Filter by source
  if (source && source !== 'ALL') {
    results = results.filter(item => item.source.toLowerCase() === source.toLowerCase() || item.feedId === source);
  }
  
  // Filter by search
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    results = results.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.snippet.toLowerCase().includes(q) ||
      item.source.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    );
  }
  
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const startIndex = (parsedPage - 1) * parsedLimit;
  const paginated = results.slice(startIndex, startIndex + parsedLimit);
  
  res.json({
    status: 'ok',
    total: results.length,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(results.length / parsedLimit),
    data: paginated,
    stats: syncStats
  });
});

// Live Internet Search API
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ status: 'error', message: 'Query string `q` is required' });
  }
  
  try {
    const results = await searchLiveInternet(q);
    res.json({
      status: 'ok',
      query: q,
      total: results.length,
      data: results
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Live Stats & System Telemetry
app.get('/api/stats', (req, res) => {
  res.json({
    status: 'ok',
    stats: syncStats,
    sources: RSS_FEEDS.map(f => ({ id: f.id, name: f.name, defaultCategory: f.defaultCategory })),
    ticker: cachedArticles.slice(0, 6).map(a => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      source: a.source,
      time: a.pubDate
    }))
  });
});

// Manual Force Sync endpoint
app.post('/api/sync', async (req, res) => {
  try {
    await syncAllFeeds();
    res.json({
      status: 'ok',
      message: 'Feeds synchronized successfully',
      stats: syncStats
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Serve frontend SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initial sync and start background scheduler (every 3 minutes)
syncAllFeeds();
setInterval(() => {
  console.log('[CyberPulse] Background recurring feed update triggered...');
  syncAllFeeds();
}, 3 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🛡️  CYBERPULSE // LIVE CYBER INTELLIGENCE RADAR RUNNING`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`⏱️  Auto-sync interval: every 3 minutes`);
  console.log(`======================================================\n`);
});
