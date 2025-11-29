// YouTube Keyboard Navigation - Chrome Extension
// Designed for accessibility and users with physical disabilities
// Navigate YouTube videos using WASD keys

let currentIndex = 0;
let thumbnails = [];
let isInitialized = false;

// Force 4 items per row in grid
function forceGridLayout() {
    const items = document.querySelectorAll('ytd-rich-item-renderer');
    items.forEach(item => {
        item.style.setProperty('width', '24%', 'important');
        item.style.setProperty('max-width', '24%', 'important');
        item.style.setProperty('min-width', '0', 'important');
        item.style.setProperty('margin', '0 0.5% 8px 0.5%', 'important');
        item.style.setProperty('display', 'block', 'important');
    });
}

// Apply overlay styles to video thumbnails
function applyOverlayStyles() {
    // Also force grid layout
    forceGridLayout();
    // Target ytd-rich-item-renderer which contains yt-lockup-view-model on YouTube home page
    const richItemElements = document.querySelectorAll('ytd-rich-item-renderer');

    richItemElements.forEach(element => {
        // Skip if already processed
        if (element.hasAttribute('data-overlay-applied')) {
            return;
        }

        // Find the lockup view model (new YouTube structure)
        const lockup = element.querySelector('yt-lockup-view-model');
        if (!lockup) return;

        element.setAttribute('data-overlay-applied', 'true');

        // The lockup contains the thumbnail and metadata
        // Find thumbnail container
        const thumbnailContainer = lockup.querySelector('yt-thumbnail-view-model, [class*="thumbnail"]');

        // Find metadata container - look for elements with title/metadata in class names
        const metadataContainer = lockup.querySelector('[class*="details"], [class*="metadata"], yt-lockup-metadata-view-model');

        if (thumbnailContainer && metadataContainer) {
            // Make lockup relative for positioning
            lockup.style.setProperty('position', 'relative', 'important');

            // Style the metadata element to overlay on the thumbnail (bottom 20%)
            metadataContainer.style.setProperty('position', 'absolute', 'important');
            metadataContainer.style.setProperty('bottom', '0', 'important');
            metadataContainer.style.setProperty('left', '0', 'important');
            metadataContainer.style.setProperty('right', '0', 'important');
            // Solid background for text area, gradient only above text
            metadataContainer.style.setProperty('background', 'linear-gradient(to top, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.65) 90%, transparent 100%)', 'important');
            metadataContainer.style.setProperty('padding', '4px 6px 4px 6px', 'important');
            metadataContainer.style.setProperty('margin', '0', 'important');
            metadataContainer.style.setProperty('z-index', '10', 'important');
            metadataContainer.style.setProperty('max-height', '20%', 'important');
            metadataContainer.style.setProperty('overflow', 'hidden', 'important');

            // Make all text semi-transparent white with smaller font
            const allTextElements = metadataContainer.querySelectorAll('*');
            allTextElements.forEach(el => {
                el.style.setProperty('color', 'rgba(255, 255, 255, 0.7)', 'important');
                el.style.setProperty('font-size', '10px', 'important');
                el.style.setProperty('line-height', '1.2', 'important');
            });

            // Also style any links
            const allLinks = metadataContainer.querySelectorAll('a');
            allLinks.forEach(link => {
                link.style.setProperty('color', 'rgba(255, 255, 255, 0.7)', 'important');
            });
        }
    });

    // Also handle older ytd-rich-grid-media structure (fallback)
    const richGridMediaElements = document.querySelectorAll('ytd-rich-grid-media');
    richGridMediaElements.forEach(element => {
        if (element.hasAttribute('data-overlay-applied')) return;
        element.setAttribute('data-overlay-applied', 'true');

        element.style.setProperty('position', 'relative', 'important');

        const thumbnail = element.querySelector('ytd-thumbnail');
        const details = element.querySelector('#details');

        if (thumbnail && details) {
            details.style.setProperty('position', 'absolute', 'important');
            details.style.setProperty('bottom', '0', 'important');
            details.style.setProperty('left', '0', 'important');
            details.style.setProperty('right', '0', 'important');
            details.style.setProperty('background', 'linear-gradient(to top, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.65) 90%, transparent 100%)', 'important');
            details.style.setProperty('padding', '4px 6px 4px 6px', 'important');
            details.style.setProperty('margin', '0', 'important');
            details.style.setProperty('z-index', '10', 'important');
            details.style.setProperty('max-height', '20%', 'important');
            details.style.setProperty('overflow', 'hidden', 'important');

            const allTextElements = details.querySelectorAll('*');
            allTextElements.forEach(el => {
                el.style.setProperty('color', 'rgba(255, 255, 255, 0.7)', 'important');
                el.style.setProperty('font-size', '10px', 'important');
                el.style.setProperty('line-height', '1.2', 'important');
            });
        }
    });
}

// Initialize navigation system
function initializeNavigation() {
    // Apply overlay styles
    applyOverlayStyles();
    // Find all video elements on the page
    const allElements = document.querySelectorAll('ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-video-renderer');
    
    // Selectors for finding video elements in order of preference
    const selectors = [
        'ytd-compact-video-renderer, ytd-rich-item-renderer, ytd-video-renderer',
        'ytd-compact-video-renderer',
        'ytd-rich-item-renderer', 
        'ytd-video-renderer',
        'ytd-video-meta-block',
        'img[src*="ytimg.com"]',
        'img[src*="ggpht.com"]',
        'a[href*="/watch?v="]'
    ];
    
    const previousLength = thumbnails.length;
    const previousIndex = currentIndex;
    
    thumbnails = [];
    
    // Try each selector until we find video elements
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        
        if (elements.length > 0) {
            if (selector.includes('img')) {
                // For image elements, find their clickable parent container
                const imgThumbnails = Array.from(elements).map(img => {
                    let parent = img;
                    for (let i = 0; i < 5; i++) {
                        parent = parent.parentElement;
                        if (!parent) break;
                        if (parent.tagName === 'A' || parent.getAttribute('href')) {
                            return parent;
                        }
                    }
                    return img;
                });
                thumbnails = imgThumbnails;
            } else {
                thumbnails = Array.from(elements);
            }
            
            // Remove duplicate elements
            thumbnails = thumbnails.filter((el, index, arr) => arr.indexOf(el) === index);
            
            // Filter for elements that have visible dimensions
            thumbnails = thumbnails.filter(el => {
                try {
                    const rect = el.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                } catch (e) {
                    return false;
                }
            });
            
            if (thumbnails.length > 0) {
                break; // Found valid elements, stop searching
            }
        }
    }
    
    if (thumbnails.length > 0) {
        // Maintain current position when possible
        if (thumbnails.length > previousLength && previousIndex >= 0) {
            currentIndex = Math.min(previousIndex, thumbnails.length - 1);
        } else {
            currentIndex = Math.min(currentIndex, thumbnails.length - 1);
        }
        
        // Only auto-highlight on non-video pages to prevent unwanted scrolling
        if (!window.location.href.includes('/watch?v=')) {
            highlightThumbnail(currentIndex);
        }
        isInitialized = true;
    } else {
        isInitialized = false;
    }
}

// Apply visual highlight to the selected thumbnail
function highlightThumbnail(index) {
    if (index < 0 || index >= thumbnails.length) return;
    
    // Remove existing highlights from all elements
    document.querySelectorAll('[data-youtube-nav-highlight]').forEach(el => {
        el.removeAttribute('data-youtube-nav-highlight');
        el.style.cssText = el.getAttribute('data-original-style') || '';
        el.removeAttribute('data-original-style');
    });
    
    // Apply highlight to selected element
    const thumb = thumbnails[index];
    if (thumb) {
        // Store original styles for restoration
        thumb.setAttribute('data-original-style', thumb.style.cssText);
        thumb.setAttribute('data-youtube-nav-highlight', 'true');
        
        // Apply bright green highlight with glow effect (no layout shift)
        const highlightStyle = `
            box-shadow: 0 0 0 6px #00FF00, 0 0 30px #00FF00 !important;
            outline: none !important;
            z-index: 9999 !important;
            position: relative !important;
        `;
        
        thumb.style.cssText += highlightStyle;
        
        // Smoothly scroll the selected element into view
        thumb.scrollIntoView({
            behavior: 'smooth', 
            block: 'center'
        });
    }
}

// Handle all keyboard navigation events
document.addEventListener('keydown', (e) => {
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

// Monitor YouTube's single-page-app navigation and apply overlay styles
let lastUrl = location.href;
let overlayStyleTimeout = null;

new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        isInitialized = false;
        setTimeout(() => {
            initializeNavigation();
        }, 1000);
    }

    // Apply overlay styles with throttling to avoid performance issues
    if (overlayStyleTimeout) {
        clearTimeout(overlayStyleTimeout);
    }
    overlayStyleTimeout = setTimeout(() => {
        applyOverlayStyles();
    }, 500);
}).observe(document.body, { childList: true, subtree: true });

// Initialize the extension with multiple timing strategies for reliability
setTimeout(() => {
    initializeNavigation();
}, 1000);

setTimeout(() => {
    if (thumbnails.length < 10) {
        initializeNavigation();
    }
}, 3000);

setTimeout(() => {
    if (thumbnails.length < 10) {
        initializeNavigation();
    }
}, 5000);

// Handle different document ready states
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeNavigation, 500);
    });
} else {
    setTimeout(initializeNavigation, 500);
}

// Periodic fallback check for dynamic content
setInterval(() => {
    if (!isInitialized || thumbnails.length === 0) {
        initializeNavigation();
    }
    // Also apply overlay styles periodically
    applyOverlayStyles();
}, 5000);