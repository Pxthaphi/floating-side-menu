/**
 * Floating Side Menu v2 - Public JS
 */
(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        const menu = document.getElementById('fsm-menu');
        const toggle = document.getElementById('fsm-toggle');
        const nav = document.getElementById('fsm-nav');
        
        if (!menu || !toggle) return;

        const isLeft = menu.classList.contains('fsm-side-left');
        const iconOpen = toggle.dataset.iconOpen || 'fa-chevron-left';
        const iconClosed = toggle.dataset.iconClosed || 'fa-chevron-right';
        let isOpen = true;

        // Set initial state - nav visible
        if (nav) {
            nav.style.visibility = 'visible';
            nav.style.opacity = '1';
            nav.style.transform = 'none';
        }

        // Auto-collapse on mobile
        if (window.innerWidth <= 768) {
            isOpen = false;
            // Use requestAnimationFrame to ensure initial state is set before adding collapsed class
            requestAnimationFrame(function() {
                menu.classList.add('fsm-collapsed');
                updateIcon();
            });
        }

        toggle.addEventListener('click', function() {
            isOpen = !isOpen;
            
            if (isOpen) {
                // Opening - remove collapsed class to trigger animation
                menu.classList.remove('fsm-collapsed');
            } else {
                // Closing - add collapsed class to trigger animation
                menu.classList.add('fsm-collapsed');
            }
            
            updateIcon();
            
            // Remove focus from button
            this.blur();
        });

        function updateIcon() {
            const icon = toggle.querySelector('i');
            if (!icon) return;
            
            // Remove all fa- classes except 'fas'
            const classes = icon.className.split(' ').filter(c => c === 'fas');
            icon.className = classes.join(' ') + ' ' + (isOpen ? iconOpen : iconClosed);
        }

        // Handle resize
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (window.innerWidth <= 768 && isOpen) {
                    menu.classList.add('fsm-collapsed');
                    isOpen = false;
                    updateIcon();
                }
            }, 250);
        });
    });
})();
