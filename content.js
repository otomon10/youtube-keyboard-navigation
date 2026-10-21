// YouTube Keyboard Navigation - Chrome Extension
// Designed for accessibility and users with physical disabilities
// Navigate YouTube videos using WASD keys

let currentIndex = 0;
let thumbnails = [];
let isInitialized = false;
let hoveredThumbnail = null;
let navigationEnabled = false;
let previewTimeout = null;
let forcedHoverOverlay = null;
let previewGeneration = 0;
let currentZoomPercent = null;

// Mark supported video cards so CSS can position their metadata overlays.
function applyOverlayStyles() {
    if (!navigationEnabled) return;

    document.querySelectorAll('ytd-rich-item-renderer').forEach(element => {
        if (element.hasAttribute('data-overlay-applied')) return;

        const lockup = element.querySelector('yt-lockup-view-model');
        if (lockup && lockup.querySelector('yt-thumbnail-view-model') &&
            lockup.querySelector('yt-lockup-metadata-view-model')) {
            element.setAttribute('data-overlay-applied', 'true');
            if (element.matches(':hover')) setHoveredThumbnail(element);
        }
    });

    document.querySelectorAll('ytd-rich-grid-media').forEach(element => {
        if (element.querySelector('ytd-thumbnail') && element.querySelector('#details')) {
            element.setAttribute('data-overlay-applied', 'true');
            if (element.matches(':hover')) setHoveredThumbnail(element);
        }
    });
}

function setHoveredThumbnail(element) {
    if (hoveredThumbnail === element) return;
    if (hoveredThumbnail) hoveredThumbnail.removeAttribute('data-youtube-nav-hover');
    hoveredThumbnail = element;
    if (hoveredThumbnail) hoveredThumbnail.setAttribute('data-youtube-nav-hover', 'true');
}

document.addEventListener('pointerover', event => {
    if (!navigationEnabled) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    // YouTube renders the preview outside its card, so preserve that card's hover state.
    if (target.closest('ytd-video-preview')) return;

    const card = target.closest('ytd-rich-item-renderer[data-overlay-applied], ytd-rich-grid-media[data-overlay-applied]');
    setHoveredThumbnail(card);
});

document.addEventListener('pointerout', event => {
    if (!event.relatedTarget) setHoveredThumbnail(null);
});

function isVisibleVideo(element) {
    if (!element?.isConnected || element.closest('[hidden]')) return false;
    const link = element.matches('a[href*="/watch?v="]') ? element : element.querySelector('a[href*="/watch?v="]');
    const thumbnail = element.querySelector('yt-thumbnail-view-model, ytd-thumbnail, img[src*="ytimg.com"]');
    if (!link || !thumbnail) return false;

    return [element, thumbnail].every(node => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility === 'visible';
    });
}

// Initialize navigation system
function initializeNavigation(forceHighlight = true) {
    if (!navigationEnabled) return;
    applyOverlayStyles();

    const selected = thumbnails[currentIndex];
    const selectors = [
        'ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-video-renderer',
        'yt-lockup-view-model',
        'a[href*="/watch?v="]'
    ];

    thumbnails = [];
    for (const selector of selectors) {
        thumbnails = Array.from(document.querySelectorAll(selector)).filter(isVisibleVideo);
        if (thumbnails.length > 0) break;
    }

    if (thumbnails.length === 0) {
        document.querySelectorAll('[data-youtube-nav-highlight]').forEach(element => {
            element.removeAttribute('data-youtube-nav-highlight');
        });
        stopHoverPreview();
        isInitialized = false;
        return;
    }

    const selectedIndex = thumbnails.indexOf(selected);
    currentIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, Math.min(currentIndex, thumbnails.length - 1));
    if (!window.location.href.includes('/watch?v=') &&
        (forceHighlight || selectedIndex < 0 || !selected.hasAttribute('data-youtube-nav-highlight'))) {
        highlightThumbnail(currentIndex);
    }
    isInitialized = true;
}

// Apply visual highlight to the selected thumbnail
function highlightThumbnail(index) {
    if (!navigationEnabled || index < 0 || index >= thumbnails.length) return;
    
    // Remove existing highlights from all elements
    document.querySelectorAll('[data-youtube-nav-highlight]').forEach(el => {
        el.removeAttribute('data-youtube-nav-highlight');
    });
    
    // Apply highlight to selected element
    const thumb = thumbnails[index];
    if (thumb) {
        thumb.setAttribute('data-youtube-nav-highlight', 'true');

        // Smoothly scroll the selected element into view
        thumb.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // Trigger YouTube's hover preview
        scheduleHoverPreview(thumb);
    }
}

// Store the current preview element to stop it later
var currentPreviewElement = null;

// Stop YouTube's hover preview on the previous thumbnail
function stopHoverPreview() {
    previewGeneration++;
    clearTimeout(previewTimeout);
    previewTimeout = null;
    if (forcedHoverOverlay) {
        forcedHoverOverlay.classList.remove('ytThumbnailHoverOverlayViewModelHostForceHover');
        forcedHoverOverlay = null;
    }

    // Dispatch mouseleave on the previous element
    if (currentPreviewElement) {
        var mouseLeave = new MouseEvent('mouseleave', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        var mouseOut = new MouseEvent('mouseout', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        currentPreviewElement.dispatchEvent(mouseLeave);
        currentPreviewElement.dispatchEvent(mouseOut);
        currentPreviewElement = null;
    }
}

function scheduleHoverPreview(element) {
    stopHoverPreview();
    const generation = previewGeneration;
    const thumbnail = element.querySelector('yt-thumbnail-view-model, ytd-thumbnail') || element;
    const transitions = thumbnail.getAnimations().filter(animation => animation.transitionProperty === 'scale');

    // Native preview bounds must be measured after the thumbnail finishes resizing.
    Promise.allSettled(transitions.map(animation => animation.finished)).then(() => {
        if (navigationEnabled && generation === previewGeneration && element.isConnected &&
            element.hasAttribute('data-youtube-nav-highlight')) {
            triggerHoverPreview(element);
        }
    });
}

// Trigger YouTube's hover preview on the selected thumbnail
function triggerHoverPreview(element) {
    if (!navigationEnabled) return;
    // Stop any existing preview first
    stopHoverPreview();

    // Find the thumbnail container - try multiple selectors
    var selectors = [
        'yt-thumbnail-view-model',
        'ytd-thumbnail',
        '#thumbnail',
        'a#thumbnail',
        '.ytd-thumbnail',
        '[id="thumbnail"]'
    ];

    var target = null;
    for (var i = 0; i < selectors.length; i++) {
        target = element.querySelector(selectors[i]);
        if (target) break;
    }

    if (!target) target = element;
    currentPreviewElement = target;

    // Dispatch mouse events to multiple potential targets
    var targets = [target, element];
    var lockup = element.querySelector('yt-lockup-view-model');
    if (lockup) targets.push(lockup);

    targets.forEach(function(t) {
        var rect = t.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;

        var mouseEnter = new MouseEvent('mouseenter', {
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY,
            view: window
        });
        var mouseOver = new MouseEvent('mouseover', {
            bubbles: true,
            cancelable: true,
            clientX: centerX,
            clientY: centerY,
            view: window
        });

        t.dispatchEvent(mouseEnter);
        t.dispatchEvent(mouseOver);
    });

    // Wait a bit then try to add the force hover class
    previewTimeout = setTimeout(function() {
        previewTimeout = null;
        if (!navigationEnabled || currentPreviewElement !== target) return;
        forcedHoverOverlay = element.querySelector('thumbnail-hover-overlay-view-model');
        if (forcedHoverOverlay) {
            forcedHoverOverlay.classList.add('ytThumbnailHoverOverlayViewModelHostForceHover');
        }
    }, 100);
}

// Handle all keyboard navigation events
document.addEventListener('keydown', (e) => {
    if (!navigationEnabled || youtubeNavSettings.isOpen || e.defaultPrevented ||
        e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.composedPath().some(node => node instanceof Element &&
        (node.matches('input, textarea, select, button, [role="textbox"], [data-youtube-nav-settings-entry]') || node.isContentEditable))) return;
    if (!['a', 'd', 'w', 's', 'enter', 'r'].includes(e.key.toLowerCase())) return;

    // Check if we're on a video watch page
    const isVideoPage = window.location.href.includes('/watch?v=');

    // On video pages, only allow 'r' key (return to home)
    // Disable all navigation (WASD) and highlighting to not interfere with video controls
    if (isVideoPage && ['a', 'd', 'w', 's'].includes(e.key.toLowerCase())) {
        return; // Let YouTube handle these keys
    }

    // Initialize if not ready
    if (!isInitialized) {
        initializeNavigation();
        if (!isInitialized) return;
    }

    // No thumbnails available
    if (thumbnails.length === 0) return;

    switch(e.key.toLowerCase()) {
        case 'd': // Move right (next video)
            e.preventDefault();

            // Auto-load more content when near the end
            if (currentIndex >= thumbnails.length - 3) {
                const oldLength = thumbnails.length;
                initializeNavigation();

                if (thumbnails.length <= oldLength) {
                    currentIndex = Math.min(currentIndex, thumbnails.length - 1);
                } else {
                    currentIndex = Math.min(currentIndex + 1, thumbnails.length - 1);
                }
            } else {
                currentIndex = Math.min(currentIndex + 1, thumbnails.length - 1);
            }

            highlightThumbnail(currentIndex);
            break;

        case 'a': // Move left (previous video)
            e.preventDefault();
            currentIndex = Math.max(currentIndex - 1, 0);
            highlightThumbnail(currentIndex);
            break;

        case 's': // Move down (jump 5 videos forward)
            e.preventDefault();

            const oldIndex = currentIndex;
            currentIndex = Math.min(currentIndex + 5, thumbnails.length - 1);

            // Auto-load more content when jumping near the end
            if (currentIndex >= thumbnails.length - 3) {
                initializeNavigation();
                currentIndex = Math.min(oldIndex + 5, thumbnails.length - 1);
            }

            highlightThumbnail(currentIndex);
            break;

        case 'w': // Move up (jump 5 videos backward)
            e.preventDefault();
            currentIndex = Math.max(currentIndex - 5, 0);
            highlightThumbnail(currentIndex);
            break;
            
        case 'enter': // Play the selected video
            // Only allow Enter key on non-video pages (home, search results, etc.)
            // Disabled on video watch pages to avoid interfering with video playback controls
            if (window.location.href.includes('/watch?v=')) {
                return; // Exit early on video pages
            }

            if (thumbnails[currentIndex]) {
                e.preventDefault();
                const thumb = thumbnails[currentIndex];
                
                // Try multiple methods to find and click the video link
                const clickTargets = [
                    thumb.querySelector('a[href*="/watch?v="]'),
                    thumb.querySelector('a#video-title-link'),
                    thumb.querySelector('a.ytd-video-renderer'),
                    thumb.querySelector('a.ytd-compact-video-renderer'),
                    thumb.closest('a[href*="/watch?v="]'),
                    thumb.closest('a'),
                    thumb.querySelector('#thumbnail'),
                    thumb.querySelector('ytd-thumbnail'),
                    thumb.querySelector('img'),
                    thumb.querySelector('#video-title'),
                    thumb.querySelector('.ytd-video-meta-block'),
                    thumb
                ];
                
                let clicked = false;
                for (const target of clickTargets) {
                    if (target && !clicked) {
                        try {
                            // Method 1: Direct navigation via href
                            if (target.href && target.href.includes('/watch?v=')) {
                                window.location.href = target.href;
                                clicked = true;
                                break;
                            }
                            
                            // Method 2: Simulate click event
                            if (typeof target.click === 'function') {
                                target.click();
                                clicked = true;
                                break;
                            }
                            
                            // Method 3: Dispatch mouse event
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            target.dispatchEvent(clickEvent);
                            clicked = true;
                            break;
                            
                        } catch (error) {
                            // Continue to next target if this one fails
                            continue;
                        }
                    }
                }
            }
            break;
            
        case 'r': // Return to YouTube home page
            // Only allow on video watch pages, not on home page
            const currentUrl = window.location.href;
            const isHomePage = currentUrl === 'https://www.youtube.com/' ||
                              currentUrl === 'https://www.youtube.com' ||
                              currentUrl.match(/^https:\/\/www\.youtube\.com\/?\?/);

            if (isHomePage) {
                return; // Exit early if already on home page
            }

            e.preventDefault();
            window.location.href = 'https://www.youtube.com';
            break;
    }
});

function refreshNavigation() {
    initializeNavigation(false);
}

let lastUrl = location.href;
let overlayStyleTimeout = null;

function queueNavigationRefresh() {
    if (!navigationEnabled || overlayStyleTimeout !== null) return;
    // Throttle rather than debounce so continuous page updates cannot delay selection.
    overlayStyleTimeout = setTimeout(() => {
        overlayStyleTimeout = null;
        refreshNavigation();
    }, 100);
}

new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        isInitialized = false;
        stopHoverPreview();
        document.querySelectorAll('[data-youtube-nav-highlight]').forEach(element => {
            element.removeAttribute('data-youtube-nav-highlight');
        });
    }
    queueNavigationRefresh();
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'href'] });

document.addEventListener('load', queueNavigationRefresh, true);
window.addEventListener('resize', queueNavigationRefresh);
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) queueNavigationRefresh();
});

function applyNavigationSettings(settings) {
    const zoomChanged = currentZoomPercent !== settings.zoomPercent;
    currentZoomPercent = settings.zoomPercent;
    document.documentElement.style.setProperty('--youtube-nav-scale', String(1 + settings.zoomPercent / 100));
    if (navigationEnabled === settings.enabled) {
        const selected = thumbnails[currentIndex];
        if (navigationEnabled && zoomChanged && selected?.hasAttribute('data-youtube-nav-highlight')) {
            scheduleHoverPreview(selected);
        }
        return;
    }

    navigationEnabled = settings.enabled;
    document.documentElement.toggleAttribute('data-youtube-nav-enabled', navigationEnabled);
    if (navigationEnabled) {
        initializeNavigation();
    } else {
        clearTimeout(overlayStyleTimeout);
        overlayStyleTimeout = null;
        stopHoverPreview();
        setHoveredThumbnail(null);
        document.querySelectorAll('[data-youtube-nav-highlight], [data-overlay-applied]').forEach(element => {
            element.removeAttribute('data-youtube-nav-highlight');
            element.removeAttribute('data-overlay-applied');
        });
        thumbnails = [];
        isInitialized = false;
    }
}

youtubeNavSettings.subscribe(applyNavigationSettings);
youtubeNavSettings.ready.then(applyNavigationSettings);

// Periodic fallback check for dynamic content
setInterval(refreshNavigation, 5000);
