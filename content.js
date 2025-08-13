// YouTube Keyboard Navigation - Chrome Extension
// Designed for accessibility and users with physical disabilities
// Navigate YouTube videos using WASD keys

let currentIndex = 0;
let thumbnails = [];
let isInitialized = false;

// Initialize navigation system
function initializeNavigation() {
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
        
        highlightThumbnail(currentIndex);
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
        
        // Apply bright green highlight with glow effect
        const highlightStyle = `
            border: 8px solid #00FF00 !important;
            box-shadow: 0 0 30px #00FF00 !important;
            outline: 4px solid #00FF00 !important;
            outline-offset: 4px !important;
            transform: scale(1.05) !important;
            z-index: 9999 !important;
            position: relative !important;
            background-color: rgba(0, 255, 0, 0.1) !important;
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
            
            // If we're on a video page and at the first thumbnail, focus on video player
            if (currentIndex === 0 && window.location.href.includes('/watch?v=')) {
                // Clear highlight from current thumbnail
                document.querySelectorAll('[data-youtube-nav-highlight]').forEach(el => {
                    el.removeAttribute('data-youtube-nav-highlight');
                    el.style.cssText = el.getAttribute('data-original-style') || '';
                    el.removeAttribute('data-original-style');
                });
                
                // Find and focus on the video player area
                const videoTargets = [
                    document.querySelector('#player-container'),
                    document.querySelector('#movie_player'),
                    document.querySelector('#ytd-player'),
                    document.querySelector('video'),
                    document.querySelector('#player'),
                    document.querySelector('.html5-video-player'),
                    document.querySelector('#primary #player-theater-container')
                ];
                
                let videoElement = null;
                for (const target of videoTargets) {
                    if (target && target.getBoundingClientRect().height > 0) {
                        videoElement = target;
                        break;
                    }
                }
                
                if (videoElement) {
                    // Scroll to show the entire video player
                    videoElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                        inline: 'nearest'
                    });
                    
                    // Try to focus on the video element if possible
                    const video = videoElement.querySelector('video');
                    if (video) {
                        video.focus();
                    }
                } else {
                    // Fallback: scroll to top of page
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
                
                // Reset to first thumbnail to maintain navigation state
                currentIndex = 0;
            } else {
                currentIndex = Math.max(currentIndex - 1, 0);
                highlightThumbnail(currentIndex);
            }
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
            
            const newIndex = Math.max(currentIndex - 5, 0);
            
            // If we're on a video page and would go to index 0, focus on video player
            if (newIndex === 0 && window.location.href.includes('/watch?v=')) {
                // Clear highlight from current thumbnail
                document.querySelectorAll('[data-youtube-nav-highlight]').forEach(el => {
                    el.removeAttribute('data-youtube-nav-highlight');
                    el.style.cssText = el.getAttribute('data-original-style') || '';
                    el.removeAttribute('data-original-style');
                });
                
                // Find and focus on the video player area
                const videoTargets = [
                    document.querySelector('#player-container'),
                    document.querySelector('#movie_player'),
                    document.querySelector('#ytd-player'),
                    document.querySelector('video'),
                    document.querySelector('#player'),
                    document.querySelector('.html5-video-player'),
                    document.querySelector('#primary #player-theater-container')
                ];
                
                let videoElement = null;
                for (const target of videoTargets) {
                    if (target && target.getBoundingClientRect().height > 0) {
                        videoElement = target;
                        break;
                    }
                }
                
                if (videoElement) {
                    // Scroll to show the entire video player
                    videoElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                        inline: 'nearest'
                    });
                    
                    // Try to focus on the video element if possible
                    const video = videoElement.querySelector('video');
                    if (video) {
                        video.focus();
                    }
                } else {
                    // Fallback: scroll to top of page
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }
                
                // Set to first thumbnail to maintain navigation state
                currentIndex = 0;
            } else {
                currentIndex = newIndex;
                highlightThumbnail(currentIndex);
            }
            break;
            
        case 'enter': // Play the selected video
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
            e.preventDefault();
            window.location.href = 'https://www.youtube.com';
            break;
    }
});

// Monitor YouTube's single-page-app navigation
let lastUrl = location.href;
new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        isInitialized = false;
        setTimeout(() => {
            initializeNavigation();
        }, 1000);
    }
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
}, 5000);