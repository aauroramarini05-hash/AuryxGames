// script.js
// Advanced logic for AuryxPlus 2.0. This script manages fetching data
// from the YouTube Data API, rendering video cards, showing detailed
// information, handling user preferences (region, theme, max results,
// auto-refresh), and providing a custom video player built on top of
// the YouTube Iframe API. All interactions are fully client‑side and
// persistent via localStorage.

(function () {
    // API key provided by the user. Replace this with your own key if
    // you hit quota limits or encounter API restrictions.
    const apiKey = "AIzaSyC99LTYUpRIRAC57b1C4RuUToiuYAggfH4";

    // Grab DOM elements once at the start
    const videoListEl = document.getElementById('video-list');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const asideButtons = document.querySelectorAll('aside button[data-cat]');
    // Page navigation buttons (live counters pages)
    const pageButtons = document.querySelectorAll('aside button[data-page]');
    const btnLatest = document.getElementById('btn-latest');
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.getElementById('modal-close');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsForm = document.getElementById('settings-form');
    const regionSelect = document.getElementById('setting-region');
    const maxResultsSelect = document.getElementById('setting-maxResults');
    const themeSelect = document.getElementById('setting-theme');
    const refreshInput = document.getElementById('setting-refresh');
    const playerOverlay = document.getElementById('player-overlay');
    const playerContainer = document.getElementById('player-container');
    const playPauseBtn = document.getElementById('play-pause');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const durationTimeEl = document.getElementById('duration-time');
    const volumeBar = document.getElementById('volume-bar');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const playerClose = document.getElementById('player-close');

    // Initialise AOS (Animate on Scroll) for entrance animations
    AOS.init({
        duration: 600,
        once: true,
    });

    // State variables
    let currentCategory = '';
    let autoRefreshTimer = null;
    let player = null;
    let progressInterval = null;

    // Default preferences
    const defaultSettings = {
        region: 'IT',
        maxResults: 8,
        theme: 'dark',
        autoRefresh: 0
    };
    // Load preferences from localStorage
    function loadSettings() {
        try {
            const stored = localStorage.getItem('auryxplus-settings');
            return stored ? { ...defaultSettings, ...JSON.parse(stored) } : { ...defaultSettings };
        } catch (err) {
            return { ...defaultSettings };
        }
    }
    let settings = loadSettings();

    // Save preferences to localStorage
    function saveSettings() {
        localStorage.setItem('auryxplus-settings', JSON.stringify(settings));
    }

    // Apply settings to the UI and behaviour
    function applySettings() {
        // Theme toggling via CSS classes
        document.body.classList.toggle('light-theme', settings.theme === 'light');
        document.body.classList.toggle('dark-theme', settings.theme === 'dark');
        // Populate the settings form with current values
        regionSelect.value = settings.region;
        maxResultsSelect.value = settings.maxResults;
        themeSelect.value = settings.theme;
        refreshInput.value = settings.autoRefresh;
        // Manage auto-refresh timer
        if (autoRefreshTimer) clearInterval(autoRefreshTimer);
        if (settings.autoRefresh && Number(settings.autoRefresh) > 0) {
            autoRefreshTimer = setInterval(() => {
                loadTrending(currentCategory);
            }, settings.autoRefresh * 60 * 1000);
        }
    }

    // Utility: format large numbers for readability (Italian locale)
    function formatNumber(num) {
        if (!num || isNaN(num)) return 'N/A';
        return new Intl.NumberFormat('it-IT').format(Number(num));
    }
    // Utility: format ISO date
    function formatDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString('it-IT', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    // Utility: format seconds into hh:mm:ss
    function formatTime(sec) {
        if (isNaN(sec)) return '0:00';
        sec = Math.floor(sec);
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return (h > 0 ? `${h}:` : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    // Animate a number inside a span element from previous to new value
    function animateCountSpan(span, newValue) {
        const prev = parseInt(span.dataset.value || '0', 10);
        // If unchanged or invalid, just update instantly
        if (isNaN(newValue) || prev === newValue) {
            span.dataset.value = newValue;
            const label = span.dataset.label || '';
            span.textContent = `${label}: ${formatNumber(newValue)}`;
            return;
        }
        const label = span.dataset.label || '';
        const start = prev;
        const end = newValue;
        span.dataset.value = newValue;
        const duration = 1000; // milliseconds
        const startTime = performance.now();
        function tick(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const current = Math.floor(start + (end - start) * progress);
            span.textContent = `${label}: ${formatNumber(current)}`;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // Periodically refresh statistics for visible cards
    let liveStatsInterval = null;

    // Timers for live subscriber and view counters
    let channelMonitorTimer = null;
    let viewsMonitorTimer = null;
    function startLiveStats() {
        if (liveStatsInterval) clearInterval(liveStatsInterval);
        // Update every 30 seconds
        liveStatsInterval = setInterval(() => {
            const cards = document.querySelectorAll('.video-card');
            cards.forEach(card => {
                const vid = card.dataset.videoId;
                const chId = card.dataset.channelId;
                if (vid) {
                    updateStats(card, vid, chId);
                }
            });
        }, 30000);
    }

    /**
     * Animate a live counter span with colour indication for increases/decreases.
     * When the value increases, the text flashes green; when it decreases, red.
     * Uses animateCountSpan internally for smooth number transitions.
     * @param {HTMLElement} span
     * @param {number} newValue
     */
    function animateLiveSpan(span, newValue) {
        const prev = parseInt(span.dataset.value || '0', 10);
        // Determine direction
        let direction = '';
        if (!isNaN(prev)) {
            if (newValue > prev) direction = 'up';
            else if (newValue < prev) direction = 'down';
        }
        span.classList.remove('count-up', 'count-down');
        if (direction === 'up') span.classList.add('count-up');
        else if (direction === 'down') span.classList.add('count-down');
        animateCountSpan(span, newValue);
    }

    /**
     * Animate a number element for live counters without prefix labels.
     * Applies colour indication and a pulse effect when values change.
     * @param {HTMLElement} span
     * @param {number} newValue
     */
    function animateLiveNumber(span, newValue) {
        const prev = parseInt(span.dataset.value || '0', 10);
        // Determine direction
        let direction = '';
        if (!isNaN(prev)) {
            if (newValue > prev) direction = 'up';
            else if (newValue < prev) direction = 'down';
        }
        span.classList.remove('count-up', 'count-down');
        if (direction === 'up') span.classList.add('count-up');
        else if (direction === 'down') span.classList.add('count-down');
        // Pulse animation
        span.classList.add('pulse');
        setTimeout(() => span.classList.remove('pulse'), 600);
        span.dataset.value = newValue;
        const start = isNaN(prev) ? 0 : prev;
        const end = newValue;
        const duration = 800;
        const startTime = performance.now();
        function tick(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const current = Math.floor(start + (end - start) * progress);
            span.textContent = formatNumber(current);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    /**
     * Resolve a channel identifier or handle or URL to a channel ID.
     * @param {string} input
     * @returns {Promise<string|null>}
     */
    async function resolveChannelId(input) {
        input = input.trim();
        if (!input) return null;
        try {
            // If URL, parse path
            if (/^https?:\/\//i.test(input)) {
                const u = new URL(input);
                // /channel/UCxxxx
                const parts = u.pathname.split('/').filter(Boolean);
                if (parts[0] === 'channel' && parts[1]) {
                    return parts[1];
                }
                // @handle or handle path
                if (parts[0] && parts[0].startsWith('@')) {
                    input = parts[0].substring(1);
                } else if (parts[0] === 'c' || parts[0] === 'user') {
                    input = parts[1] || input;
                }
            }
            // If looks like channel ID (starts with UC and length > 10)
            if (/^UC[a-zA-Z0-9_-]{20,}$/.test(input)) {
                return input;
            }
            // If handle starting with @
            if (input.startsWith('@')) {
                input = input.substring(1);
            }
            // Use search API to find channel ID by query
            const url = new URL('https://www.googleapis.com/youtube/v3/search');
            url.search = new URLSearchParams({
                part: 'snippet',
                type: 'channel',
                q: input,
                maxResults: 1,
                key: apiKey
            });
            const res = await fetch(url);
            const data = await res.json();
            const item = data.items && data.items[0];
            if (item) {
                return item.id.channelId;
            }
            return null;
        } catch (err) {
            console.error('Errore risoluzione channel ID', err);
            return null;
        }
    }

    /**
     * Resolve a video identifier or URL or query to a video ID.
     * @param {string} input
     * @returns {Promise<string|null>}
     */
    async function resolveVideoId(input) {
        input = input.trim();
        if (!input) return null;
        try {
            // If URL, parse query parameters and path
            if (/^https?:\/\//i.test(input)) {
                const u = new URL(input);
                // watch?v=ID
                const vParam = u.searchParams.get('v');
                if (vParam) return vParam;
                // youtu.be/ID or shorts/ID
                const parts = u.pathname.split('/').filter(Boolean);
                if (u.host.includes('youtu.be') && parts[0]) return parts[0];
                if (parts[0] === 'shorts' && parts[1]) return parts[1];
            }
            // If string length 11 typical video ID
            if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
                return input;
            }
            // Use search API to find video ID by query
            const url = new URL('https://www.googleapis.com/youtube/v3/search');
            url.search = new URLSearchParams({
                part: 'snippet',
                type: 'video',
                q: input,
                maxResults: 1,
                key: apiKey
            });
            const res = await fetch(url);
            const data = await res.json();
            const item = data.items && data.items[0];
            if (item) {
                return item.id.videoId;
            }
            return null;
        } catch (err) {
            console.error('Errore risoluzione video ID', err);
            return null;
        }
    }

    /**
     * Fetch statistics for a channel (subscriber count, view count, video count, title).
     * @param {string} channelId
     */
    async function fetchChannelStats(channelId) {
        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/channels');
            url.search = new URLSearchParams({
                part: 'snippet,statistics',
                id: channelId,
                key: apiKey
            });
            const res = await fetch(url);
            const data = await res.json();
            const item = data.items && data.items[0];
            if (!item) return null;
            return {
                title: item.snippet.title,
                subs: parseInt(item.statistics.subscriberCount || '0', 10),
                views: parseInt(item.statistics.viewCount || '0', 10),
                videos: parseInt(item.statistics.videoCount || '0', 10)
            };
        } catch (err) {
            console.error('Errore fetch channel stats', err);
            return null;
        }
    }

    /**
     * Fetch statistics for a video (view count, like count, comment count, title).
     * @param {string} videoId
     */
    async function fetchVideoStats(videoId) {
        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/videos');
            url.search = new URLSearchParams({
                part: 'snippet,statistics',
                id: videoId,
                key: apiKey
            });
            const res = await fetch(url);
            const data = await res.json();
            const item = data.items && data.items[0];
            if (!item) return null;
            return {
                title: item.snippet.title,
                views: parseInt(item.statistics.viewCount || '0', 10),
                likes: parseInt(item.statistics.likeCount || '0', 10),
                comments: parseInt(item.statistics.commentCount || '0', 10)
            };
        } catch (err) {
            console.error('Errore fetch video stats', err);
            return null;
        }
    }

    /**
     * Load the live subscriber counter page. Provides a form to input a channel and displays
     * real‑time subscriber count with smooth animations. Updates every 5 seconds.
     */
    function loadLiveSubs() {
        // Stop any existing timers and live stats
        if (liveStatsInterval) { clearInterval(liveStatsInterval); liveStatsInterval = null; }
        if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
        if (channelMonitorTimer) { clearInterval(channelMonitorTimer); channelMonitorTimer = null; }
        if (viewsMonitorTimer) { clearInterval(viewsMonitorTimer); viewsMonitorTimer = null; }
        // Clear current content
        videoListEl.innerHTML = '';
        // Build HTML for live subscriber page
        const container = document.createElement('div');
        container.className = 'live-subs-container live-container';
        container.innerHTML = `
            <form id="subs-form">
                <input type="text" id="subs-input" placeholder="Inserisci ID canale, URL o @handle…" aria-label="canale input">
                <button type="submit">Monitora iscritti</button>
            </form>
            <div id="subs-output" class="live-output hidden">
                <h3 id="subs-channel-title"></h3>
                <div class="counter-block">
                    <div class="counter-item">
                        <span class="live-icon">👤</span>
                        <span id="subs-count" class="live-number" data-value="0"></span>
                        <span class="live-label">Iscritti</span>
                    </div>
                    <div class="counter-item">
                        <span class="live-icon">👁️</span>
                        <span id="subs-views" class="live-number" data-value="0"></span>
                        <span class="live-label">Visualizzazioni</span>
                    </div>
                </div>
            </div>
        `;
        videoListEl.appendChild(container);
        const form = container.querySelector('#subs-form');
        const input = container.querySelector('#subs-input');
        const output = container.querySelector('#subs-output');
        const titleEl = container.querySelector('#subs-channel-title');
        const subsSpan = container.querySelector('#subs-count');
        const viewsSpan = container.querySelector('#subs-views');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = input.value.trim();
            if (!query) return;
            // Stop previous timer
            if (channelMonitorTimer) { clearInterval(channelMonitorTimer); channelMonitorTimer = null; }
            // Resolve channel ID
            titleEl.textContent = 'Caricamento…';
            const channelId = await resolveChannelId(query);
            if (!channelId) {
                titleEl.textContent = 'Canale non trovato';
                output.classList.add('hidden');
                return;
            }
            async function updateChannelStats() {
                const stats = await fetchChannelStats(channelId);
                if (!stats) return;
                titleEl.textContent = stats.title;
                animateLiveNumber(subsSpan, stats.subs);
                animateLiveNumber(viewsSpan, stats.views);
            }
            // Fetch once and then every 5s
            await updateChannelStats();
            output.classList.remove('hidden');
            channelMonitorTimer = setInterval(updateChannelStats, 5000);
        });
    }

    /**
     * Load the live views counter page. Provides a form to input a video or channel and displays
     * real‑time view counts (and optionally likes/comments/subs) with smooth animations. Updates every 5 seconds.
     */
    function loadLiveViews() {
        // Stop any existing timers and live stats
        if (liveStatsInterval) { clearInterval(liveStatsInterval); liveStatsInterval = null; }
        if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
        if (channelMonitorTimer) { clearInterval(channelMonitorTimer); channelMonitorTimer = null; }
        if (viewsMonitorTimer) { clearInterval(viewsMonitorTimer); viewsMonitorTimer = null; }
        // Clear current content
        videoListEl.innerHTML = '';
        // Build HTML for live views page
        const container = document.createElement('div');
        container.className = 'live-views-container live-container';
        container.innerHTML = `
            <form id="views-form">
                <input type="text" id="views-input" placeholder="Inserisci ID video/canale o URL…" aria-label="input video o canale">
                <select id="views-type" aria-label="tipo">
                    <option value="video">Video</option>
                    <option value="channel">Canale</option>
                </select>
                <button type="submit">Monitora visualizzazioni</button>
            </form>
            <div id="views-output" class="live-output hidden">
                <h3 id="views-title"></h3>
                <div class="counter-block">
                    <div class="counter-item">
                        <span class="live-icon">👁️</span>
                        <span id="views-count" class="live-number" data-value="0"></span>
                        <span class="live-label">Visualizzazioni</span>
                    </div>
                    <div class="counter-item">
                        <span class="live-icon" id="extra-icon"></span>
                        <span id="views-extra" class="live-number" data-value="0"></span>
                        <span class="live-label" id="extra-label"></span>
                    </div>
                </div>
            </div>
        `;
        videoListEl.appendChild(container);
        const form = container.querySelector('#views-form');
        const input = container.querySelector('#views-input');
        const typeSelect = container.querySelector('#views-type');
        const output = container.querySelector('#views-output');
        const titleEl = container.querySelector('#views-title');
        const countSpan = container.querySelector('#views-count');
        const extraSpan = container.querySelector('#views-extra');
        const extraIcon = container.querySelector('#extra-icon');
        const extraLabel = container.querySelector('#extra-label');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const query = input.value.trim();
            const type = typeSelect.value;
            if (!query) return;
            // Stop previous timer
            if (viewsMonitorTimer) { clearInterval(viewsMonitorTimer); viewsMonitorTimer = null; }
            titleEl.textContent = 'Caricamento…';
            if (type === 'channel') {
                const channelId = await resolveChannelId(query);
                if (!channelId) {
                    titleEl.textContent = 'Canale non trovato';
                    output.classList.add('hidden');
                    return;
                }
                // Set second metric icon and label for channel (subscribers)
                extraIcon.textContent = '👤';
                extraLabel.textContent = 'Iscritti';
                async function updateChannelViews() {
                    const stats = await fetchChannelStats(channelId);
                    if (!stats) return;
                    titleEl.textContent = stats.title;
                    // Main count: total views
                    animateLiveNumber(countSpan, stats.views);
                    // Extra count: subscribers
                    animateLiveNumber(extraSpan, stats.subs);
                }
                await updateChannelViews();
                output.classList.remove('hidden');
                viewsMonitorTimer = setInterval(updateChannelViews, 5000);
            } else {
                // video
                const videoId = await resolveVideoId(query);
                if (!videoId) {
                    titleEl.textContent = 'Video non trovato';
                    output.classList.add('hidden');
                    return;
                }
                // Set second metric icon and label for video (likes)
                extraIcon.textContent = '👍';
                extraLabel.textContent = 'Mi piace';
                async function updateVideoViews() {
                    const stats = await fetchVideoStats(videoId);
                    if (!stats) return;
                    titleEl.textContent = stats.title;
                    // Main count: view count
                    animateLiveNumber(countSpan, stats.views);
                    // Extra count: likes
                    animateLiveNumber(extraSpan, stats.likes);
                }
                await updateVideoViews();
                output.classList.remove('hidden');
                viewsMonitorTimer = setInterval(updateVideoViews, 5000);
            }
        });
    }

    // Wait until YouTube API is available
    function waitForYTReady(callback) {
        if (window.YT && YT.Player) {
            callback();
        } else {
            setTimeout(() => waitForYTReady(callback), 100);
        }
    }

    // Start updating progress bar while video plays
    function startProgressInterval() {
        stopProgressInterval();
        progressInterval = setInterval(() => {
            if (!player) return;
            const current = player.getCurrentTime();
            const duration = player.getDuration();
            if (!isNaN(current) && !isNaN(duration) && duration > 0) {
                progressBar.value = (current / duration) * 100;
                currentTimeEl.textContent = formatTime(current);
                durationTimeEl.textContent = formatTime(duration);
            }
        }, 500);
    }
    function stopProgressInterval() {
        if (progressInterval) clearInterval(progressInterval);
        progressInterval = null;
    }

    // Initialise custom player with given video ID
    function openPlayer(videoId) {
        playerOverlay.classList.remove('hidden');
        waitForYTReady(() => {
            if (!player) {
                player = new YT.Player('player-container', {
                    videoId: videoId,
                    playerVars: { controls: 0, modestbranding: 1, rel: 0, fs: 0 },
                    events: {
                        onReady: () => {
                            durationTimeEl.textContent = formatTime(player.getDuration());
                            currentTimeEl.textContent = formatTime(player.getCurrentTime());
                            volumeBar.value = player.getVolume() / 100;
                        },
                        onStateChange: (event) => {
                            if (event.data === YT.PlayerState.PLAYING) {
                                playPauseBtn.textContent = '❚❚';
                                startProgressInterval();
                            } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                                playPauseBtn.textContent = '▶';
                                stopProgressInterval();
                            }
                        }
                    }
                });
            } else {
                player.loadVideoById(videoId);
            }
            // Reset UI controls on load
            progressBar.value = 0;
            playPauseBtn.textContent = '▶';
        });
    }

    // Event handlers for player controls
    playPauseBtn.addEventListener('click', () => {
        if (!player) return;
        const state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    });
    progressBar.addEventListener('input', () => {
        if (!player) return;
        const duration = player.getDuration();
        const seekTo = (progressBar.value / 100) * duration;
        player.seekTo(seekTo, true);
    });
    volumeBar.addEventListener('input', () => {
        if (!player) return;
        player.setVolume(volumeBar.value * 100);
    });
    fullscreenBtn.addEventListener('click', () => {
        const elem = playerOverlay;
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    });
    playerClose.addEventListener('click', () => {
        if (player) {
            player.stopVideo();
        }
        stopProgressInterval();
        playerOverlay.classList.add('hidden');
    });

    // Preferences modal handling
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal || e.target === settingsClose) {
            settingsModal.classList.add('hidden');
        }
    });
    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        settings.region = regionSelect.value;
        settings.maxResults = Number(maxResultsSelect.value);
        settings.theme = themeSelect.value;
        settings.autoRefresh = parseInt(refreshInput.value) || 0;
        saveSettings();
        applySettings();
        settingsModal.classList.add('hidden');
        loadTrending(currentCategory);
    });

    // Highlight active category button
    function setActiveButton(categoryId) {
        asideButtons.forEach(btn => {
            if (btn.dataset.cat === categoryId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Render videos to the list
    function renderVideos(videos) {
        videoListEl.innerHTML = '';
        videos.forEach((video) => {
            const videoId = video.id.videoId || video.id;
            const snippet = video.snippet;
            const channelId = snippet.channelId;
            const card = document.createElement('div');
            card.className = 'video-card';
            card.setAttribute('data-video-id', videoId);
            card.setAttribute('data-channel-id', channelId);
            card.setAttribute('data-aos', 'fade-up');
            // Card structure: we omit the default iframe; clicking card will open details
            card.innerHTML = `
                <div class="video-thumb">
                    <img src="https://i.ytimg.com/vi/${videoId}/hqdefault.jpg" alt="Anteprima" loading="lazy" />
                </div>
                <div class="video-info">
                    <h3>${snippet.title}</h3>
                    <span class="channel-name">${snippet.channelTitle}</span>
                    <div class="stats">
                        <span class="views">Visualizzazioni: …</span>
                        <span class="likes">Mi piace: …</span>
                        <span class="comments">Commenti: …</span>
                        <span class="published">Pubblicato: …</span>
                        <span class="subs">Iscritti: …</span>
                    </div>
                </div>`;
            // On click, open details modal
            card.addEventListener('click', () => {
                openDetails(videoId);
            });
            videoListEl.appendChild(card);
            // Fetch and inject statistics
            updateStats(card, videoId, channelId);
        });
        AOS.refresh();
        // Start live stats updating for these videos
        startLiveStats();
    }

    // Fetch statistics for video and channel, then update the card
    async function updateStats(card, videoId, channelId) {
        try {
            // Video statistics
            const vUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
            vUrl.search = new URLSearchParams({
                part: 'snippet,statistics',
                id: videoId,
                key: apiKey
            });
            const vRes = await fetch(vUrl);
            const vData = await vRes.json();
            const vItem = vData.items && vData.items[0];
            let views = '…';
            let likes = '…';
            let comments = '…';
            let published = '…';
            if (vItem) {
                views = formatNumber(vItem.statistics?.viewCount);
                likes = formatNumber(vItem.statistics?.likeCount);
                comments = formatNumber(vItem.statistics?.commentCount);
                published = formatDate(vItem.snippet?.publishedAt);
            }
            // Channel statistics
            let subs = '…';
            if (channelId) {
                const cUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
                cUrl.search = new URLSearchParams({
                    part: 'statistics',
                    id: channelId,
                    key: apiKey
                });
                const cRes = await fetch(cUrl);
                const cData = await cRes.json();
                const cItem = cData.items && cData.items[0];
                if (cItem) {
                    subs = formatNumber(cItem.statistics?.subscriberCount);
                }
            }
            // Update DOM with animated counters
            const statsDiv = card.querySelector('.stats');
            if (statsDiv) {
                const viewsSpan = statsDiv.querySelector('.views');
                const likesSpan = statsDiv.querySelector('.likes');
                const commentsSpan = statsDiv.querySelector('.comments');
                const publishedSpan = statsDiv.querySelector('.published');
                const subsSpan = statsDiv.querySelector('.subs');
                // Ensure labels stored for animation
                viewsSpan.dataset.label = 'Visualizzazioni';
                likesSpan.dataset.label = 'Mi piace';
                commentsSpan.dataset.label = 'Commenti';
                subsSpan.dataset.label = 'Iscritti';
                // Animate numeric values
                animateCountSpan(viewsSpan, parseInt(vItem?.statistics?.viewCount || views.replace(/\D/g, ''), 10));
                animateCountSpan(likesSpan, parseInt(vItem?.statistics?.likeCount || likes.replace(/\D/g, ''), 10));
                animateCountSpan(commentsSpan, parseInt(vItem?.statistics?.commentCount || comments.replace(/\D/g, ''), 10));
                animateCountSpan(subsSpan, parseInt(subs.replace(/\D/g, ''), 10));
                // Published does not animate
                publishedSpan.textContent = `Pubblicato: ${published}`;
            }
        } catch (err) {
            console.error('Errore recupero statistiche', err);
        }
    }

    // Fetch trending videos; categoryId empty string means general trending
    async function loadTrending(categoryId = '') {
        currentCategory = categoryId || '';
        setActiveButton(currentCategory);
        videoListEl.innerHTML = '<p>Caricamento tendenze…</p>';
        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/videos');
            const params = {
                part: 'snippet,statistics',
                chart: 'mostPopular',
                regionCode: settings.region,
                maxResults: settings.maxResults,
                key: apiKey
            };
            if (categoryId) params.videoCategoryId = categoryId;
            url.search = new URLSearchParams(params);
            const res = await fetch(url);
            const data = await res.json();
            if (!data.items) {
                videoListEl.innerHTML = '<p>Errore durante il caricamento.</p>';
                return;
            }
            const videos = data.items.map(v => ({
                id: v.id,
                snippet: v.snippet,
                statistics: v.statistics
            }));
            renderVideos(videos);
        } catch (err) {
            console.error(err);
            videoListEl.innerHTML = '<p>Errore di rete. Riprovare più tardi.</p>';
        }
    }

    // Search videos
    async function searchVideos(query) {
        if (!query) return;
        videoListEl.innerHTML = '<p>Caricamento risultati…</p>';
        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/search');
            url.search = new URLSearchParams({
                part: 'snippet',
                q: query,
                type: 'video',
                maxResults: settings.maxResults,
                key: apiKey
            });
            const res = await fetch(url);
            const data = await res.json();
            if (!data.items) {
                videoListEl.innerHTML = '<p>Nessun risultato trovato.</p>';
                return;
            }
            const videos = data.items.map(v => ({ id: v.id.videoId, snippet: v.snippet }));
            renderVideos(videos);
        } catch (err) {
            console.error(err);
            videoListEl.innerHTML = '<p>Errore durante la ricerca.</p>';
        }
    }

    // Load latest videos sorted by date
    async function loadLatestVideos() {
        videoListEl.innerHTML = '<p>Caricamento ultimi video…</p>';
        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/search');
            url.search = new URLSearchParams({
                part: 'snippet',
                order: 'date',
                type: 'video',
                maxResults: settings.maxResults,
                key: apiKey
            });
            const res = await fetch(url);
            const data = await res.json();
            const videos = (data.items || []).map(v => ({ id: v.id.videoId, snippet: v.snippet }));
            renderVideos(videos);
        } catch (err) {
            console.error(err);
            videoListEl.innerHTML = '<p>Errore nel caricamento degli ultimi video.</p>';
        }
    }

    // Display detailed information in a modal; include play button
    async function openDetails(videoId) {
        modal.classList.remove('hidden');
        modalContent.innerHTML = '<p>Caricamento dettagli…</p>';
        try {
            // Fetch video details
            const vUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
            vUrl.search = new URLSearchParams({
                part: 'snippet,statistics',
                id: videoId,
                key: apiKey
            });
            const vRes = await fetch(vUrl);
            const vData = await vRes.json();
            const vItem = vData.items && vData.items[0];
            if (!vItem) throw new Error('Video non trovato');
            // Channel details
            const channelId = vItem.snippet.channelId;
            let channelInfo = null;
            if (channelId) {
                const cUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
                cUrl.search = new URLSearchParams({
                    part: 'snippet,statistics',
                    id: channelId,
                    key: apiKey
                });
                const cRes = await fetch(cUrl);
                const cData = await cRes.json();
                channelInfo = cData.items && cData.items[0];
            }
            // Build modal HTML
            const htmlParts = [];
            htmlParts.push(`<button class="play-btn" data-video="${videoId}">▶ Riproduci</button>`);
            htmlParts.push(`<h2>${vItem.snippet.title}</h2>`);
            htmlParts.push(`<p class="channel-name">Canale: ${vItem.snippet.channelTitle}</p>`);
            htmlParts.push(`<div class="stats-row">`);
            htmlParts.push(`<div class="stat-item"><span class="stat-value">${formatNumber(vItem.statistics?.viewCount)}</span><span class="stat-label">Visualizzazioni</span></div>`);
            htmlParts.push(`<div class="stat-item"><span class="stat-value">${formatNumber(vItem.statistics?.likeCount)}</span><span class="stat-label">Mi piace</span></div>`);
            htmlParts.push(`<div class="stat-item"><span class="stat-value">${formatNumber(vItem.statistics?.commentCount)}</span><span class="stat-label">Commenti</span></div>`);
            htmlParts.push(`<div class="stat-item"><span class="stat-value">${formatDate(vItem.snippet.publishedAt)}</span><span class="stat-label">Pubblicato il</span></div>`);
            htmlParts.push(`</div>`);
            htmlParts.push(`<p class="description">${vItem.snippet.description ? vItem.snippet.description.replace(/\n/g, '<br>') : ''}</p>`);
            if (channelInfo) {
                htmlParts.push(`<hr><h3>Statistiche canale</h3>`);
                htmlParts.push(`<div class="stats-row">`);
                htmlParts.push(`<div class="stat-item"><span class="stat-value">${formatNumber(channelInfo.statistics?.subscriberCount)}</span><span class="stat-label">Iscritti</span></div>`);
                htmlParts.push(`<div class="stat-item"><span class="stat-value">${formatNumber(channelInfo.statistics?.videoCount)}</span><span class="stat-label">Video totali</span></div>`);
                htmlParts.push(`<div class="stat-item"><span class="stat-value">${formatNumber(channelInfo.statistics?.viewCount)}</span><span class="stat-label">Visualizzazioni totali</span></div>`);
                htmlParts.push(`</div>`);
            }
            modalContent.innerHTML = htmlParts.join('');
            // Attach play button listener
            const playBtn = modalContent.querySelector('.play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    openPlayer(videoId);
                });
            }
        } catch (err) {
            console.error(err);
            modalContent.innerHTML = `<p>Errore nel caricamento dei dettagli.</p>`;
        }
    }

    // Event listeners for search
    searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            // Clear active state on all navigation buttons when searching
            document.querySelectorAll('aside button').forEach(b => b.classList.remove('active'));
            searchVideos(query);
        }
    });
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });

    // Category button click
    asideButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active state from all navigation buttons
            document.querySelectorAll('aside button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.dataset.cat;
            loadTrending(cat);
        });
    });

    // Page buttons for live counters
    pageButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active state from all navigation buttons
            document.querySelectorAll('aside button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const page = btn.dataset.page;
            if (page === 'live-subs') {
                loadLiveSubs();
            } else if (page === 'live-views') {
                loadLiveViews();
            }
        });
    });
    // Latest videos button
    if (btnLatest) {
        btnLatest.addEventListener('click', () => {
            // Clear active state on all navigation buttons
            document.querySelectorAll('aside button').forEach(b => b.classList.remove('active'));
            btnLatest.classList.add('active');
            currentCategory = '';
            loadLatestVideos();
        });
    }

    // Modal close for details
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target === modalClose) {
            modal.classList.add('hidden');
            modalContent.innerHTML = '';
        }
    });

    // Apply settings on load
    applySettings();
    // Load general trending on initial load
    loadTrending('');
})();