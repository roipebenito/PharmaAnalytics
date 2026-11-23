/* ============================================================
   HERO BANNER ART & LOGO — matches each dashboard screen's .hero
   banner to its corresponding mascot illustration / wordmark.
   Positions are fixed in the settings below; the art is not movable.
   ============================================================ */
(function() {
    /* x = distance from the RIGHT edge of the hero, in pixels.
       BIGGER number  = moves the icon LEFT
       SMALLER number = moves the icon RIGHT (negative pushes it partly off-screen).

       y = distance ABOVE the BOTTOM edge of the hero, in pixels.
       BIGGER number  = pulls the icon HIGHER
       SMALLER number = lowers it (negative pushes it below the banner). */
    const ROUTE_ASSETS = {
        'overview': {
            src: 'assets/pharma-banner-logo.png?v=1',
            className: 'hero-banner-logo',
            x: 18,
            y: -6
        },
        'inventory': {
            src: 'assets/hero-icons/inventory.png?v=1',
            className: 'hero-banner-art',
            x: 200,
            y: -4
        },
        'removal requests': {
            src: 'assets/hero-icons/removals.png?v=1',
            className: 'hero-banner-art',
            x: 22,
            y: -4
        },
        'sales records': {
            src: 'assets/hero-icons/sales.png?v=1',
            className: 'hero-banner-art',
            x: 130,
            y: -4
        },
        'daily sales': {
            src: 'assets/hero-icons/daily-sales.png?v=1',
            className: 'hero-banner-art',
            x: 40,
            y: -8
        },
        'receipts': {
            src: 'assets/hero-icons/receipts.png?v=1',
            className: 'hero-banner-art',
            x: 22,
            y: -4
        },
        'accounts': {
            src: 'assets/hero-icons/accounts.png?v=2',
            className: 'hero-banner-art',
            x: 150,
            y: -4
        }
    };

    function getActivePageKey() {
        const navOn = document.querySelector('.nav.on');
        if (navOn) {
            const text = navOn.textContent.trim().toLowerCase();
            for (const key of Object.keys(ROUTE_ASSETS)) {
                if (text.includes(key)) return key;
            }
            return null;
        }
        const crumb = document.querySelector('.crumb');
        if (crumb) {
            const text = crumb.textContent.trim().toLowerCase();
            for (const key of Object.keys(ROUTE_ASSETS)) {
                if (text.includes(key)) return key;
            }
        }
        return null;
    }

    function syncHeroBannerArt(root) {
        if (!root || !root.querySelectorAll) return;
        const pageKey = getActivePageKey();
        const cfg = pageKey ? ROUTE_ASSETS[pageKey] : null;

        root.querySelectorAll('.hero').forEach(function(hero) {
            const existing = hero.querySelector('.hero-banner-logo, .hero-banner-art');
            const oldHandle = hero.querySelector('.art-drag-handle');
            if (oldHandle) oldHandle.remove();

            if (!cfg) {
                if (existing) existing.remove();
                return;
            }
            if (existing && existing.getAttribute('src') === cfg.src && existing.className === cfg.className) {
                return;
            }
            if (existing) existing.remove();

            const img = document.createElement('img');
            img.src = cfg.src;
            img.alt = 'PharmaAnalytics';
            img.className = cfg.className;
            img.style.setProperty('--art-right', cfg.x + 'px');
            img.style.setProperty('--art-bottom', cfg.y + 'px');

            const glow = hero.querySelector('.hero-glow');
            if (glow && glow.nextSibling) {
                hero.insertBefore(img, glow.nextSibling);
            } else {
                hero.insertBefore(img, hero.firstChild);
            }
        });
    }

    function boot() {
        const root = document.getElementById('root') || document.body;
        syncHeroBannerArt(root);

        const observer = new MutationObserver(function() {
            syncHeroBannerArt(root);
        });
        observer.observe(root, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();