/**
 * Floating Side Menu v2 - Admin JS
 */
(function($) {
    'use strict';

    // Helper function to convert color to CSS filter for SVG images
    function hexToFilter(color) {
        let r, g, b;
        
        if (color.startsWith('#')) {
            let hex = color.slice(1);
            // Support 8-digit hex (with alpha)
            if (hex.length === 8) {
                hex = hex.slice(0, 6);
            }
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            }
        } else if (color.startsWith('rgb')) {
            const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                r = parseInt(match[1]);
                g = parseInt(match[2]);
                b = parseInt(match[3]);
            } else {
                return 'brightness(0) saturate(100%) invert(1)';
            }
        } else {
            return 'brightness(0) saturate(100%) invert(1)';
        }
        
        // Check for white/near-white
        if (r > 250 && g > 250 && b > 250) {
            return 'brightness(0) saturate(100%) invert(1)';
        }
        
        // Check for black/near-black
        if (r < 10 && g < 10 && b < 10) {
            return 'brightness(0) saturate(100%)';
        }
        
        // Convert RGB to HSL
        const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
        const max = Math.max(rNorm, gNorm, bNorm);
        const min = Math.min(rNorm, gNorm, bNorm);
        const l = (max + min) / 2;
        let h = 0, s = 0;
        
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
                case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
                case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
            }
        }

        const hDeg = Math.round(h * 360);
        const sPct = Math.round(s * 100);
        const lPct = Math.round(l * 100);
        
        // Improved filter calculation
        const invert = lPct > 50 ? 1 : 0;
        const invertPct = invert ? Math.round((1 - (lPct / 100)) * 100) : Math.round(lPct);
        const sepia = sPct > 0 ? 100 : 0;
        let saturate = sPct > 0 ? Math.round(sPct * 20) : 0;
        saturate = Math.min(saturate, 2000);
        
        // Hue-rotate offset (sepia base is around 30 degrees)
        const hueOffset = sPct > 0 ? (hDeg - 30 + 360) % 360 : 0;
        
        // Brightness adjustment
        let brightness = 1;
        if (lPct > 50) {
            brightness = 0.5 + (lPct / 200);
        } else {
            brightness = lPct / 50;
        }
        brightness = Math.max(0.5, Math.min(2, brightness));
        
        if (sPct === 0) {
            // Grayscale
            const grayBrightness = lPct / 100;
            return `brightness(0) saturate(100%) invert(${lPct}%) brightness(${grayBrightness})`;
        }
        
        return `brightness(0) saturate(100%) invert(${invertPct}%) sepia(${sepia}%) saturate(${saturate}%) hue-rotate(${hueOffset}deg) brightness(${brightness})`;
    }

    const FSM = {
        currentTab: 'settings',
        currentSettingsTab: 'layout',
        currentBreakpoint: 'desktop', // 'desktop', 'tablet', 'mobile'
        borderRadiusLinked: true,
        paddingLinked: true,
        itemPaddingLinked: true,
        settings: {},
        items: [],
        loadedFonts: [],
        savedSettings: {},
        savedItems: [],
        publishedSettings: {},
        publishedItems: [],
        status: 'published',
        history: [],
        historyFilter: 'all',
        previewWindow: null,
        previewCheckInterval: null,

        init: function() {
            if (typeof fsmData !== 'undefined') {
                // Load draft if exists, otherwise load published
                if (fsmData.hasDraft && fsmData.draftSettings) {
                    this.settings = fsmData.draftSettings;
                    this.items = fsmData.draftItems || [];
                    this.status = 'draft';
                } else {
                    this.settings = fsmData.settings;
                    this.items = fsmData.items;
                    this.status = 'published';
                }
                
                // Ensure tablet and mobile are objects (not arrays from PHP)
                this.ensureResponsiveObjects(this.settings);
                
                // Store published state (also ensure objects)
                this.publishedSettings = JSON.parse(JSON.stringify(this.settings));
                this.publishedItems = JSON.parse(JSON.stringify(fsmData.items));
                // Store saved state for "Discard Changes"
                this.savedSettings = JSON.parse(JSON.stringify(this.settings));
                this.savedItems = JSON.parse(JSON.stringify(this.items));
                // Load history
                this.history = fsmData.history || [];
            }
            // Load initial font for preview
            this.loadInitialFonts();
            this.renderPanel();
            this.renderPreview();
            this.bindEvents();
        },
        
        /**
         * Ensure tablet and mobile are objects (not arrays from PHP)
         */
        ensureResponsiveObjects: function(settings) {
            if (!settings.tablet || Array.isArray(settings.tablet)) {
                settings.tablet = {};
            }
            if (!settings.mobile || Array.isArray(settings.mobile)) {
                settings.mobile = {};
            }
            if (!settings.breakpoints) {
                settings.breakpoints = { tablet: 1024, mobile: 768 };
            }
        },
        
        /**
         * Load initial fonts from settings and Elementor
         */
        loadInitialFonts: function() {
            const fonts = fsmData.fonts || {};
            
            // Load Elementor primary font
            if (fonts.elementor_primary) {
                this.loadGoogleFont(fonts.elementor_primary);
            }
            
            // Load all Elementor fonts
            if (fonts.elementor && fonts.elementor.length > 0) {
                fonts.elementor.forEach(f => {
                    if (f.font_family) {
                        this.loadGoogleFont(f.font_family);
                    }
                });
            }
            
            // Load current selected font
            const currentFont = this.settings.typography?.font_family || 'inherit';
            if (currentFont !== 'inherit') {
                // Extract font name from value like "'Kanit', sans-serif"
                const match = currentFont.match(/'([^']+)'/);
                if (match) {
                    this.loadGoogleFont(match[1]);
                }
            }
        },
        
        /**
         * Load Google Font dynamically
         */
        loadGoogleFont: function(fontName) {
            if (!fontName || fontName === 'inherit' || this.loadedFonts.includes(fontName)) {
                return;
            }
            
            // Skip system fonts
            const systemFonts = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'system-ui'];
            if (systemFonts.includes(fontName)) {
                return;
            }
            
            // Create link element
            const fontUrl = 'https://fonts.googleapis.com/css2?family=' + 
                encodeURIComponent(fontName.replace(/ /g, '+')) + 
                ':wght@400;500;600;700&display=swap';
            
            // Check if already loaded
            if ($('link[href*="' + encodeURIComponent(fontName.replace(/ /g, '+')) + '"]').length > 0) {
                this.loadedFonts.push(fontName);
                return;
            }
            
            $('<link>')
                .attr('rel', 'stylesheet')
                .attr('href', fontUrl)
                .appendTo('head');
            
            this.loadedFonts.push(fontName);
            console.log('FSM: Loaded font:', fontName);
        },

        bindEvents: function() {
            const self = this;

            // Main tabs
            $(document).on('click', '.fsm-tab', function() {
                $('.fsm-tab').removeClass('active');
                $(this).addClass('active');
                self.currentTab = $(this).data('tab');
                self.renderPanel();
            });

            // Open Preview button - track preview window
            $(document).on('click', '#fsm-open-preview', function() {
                self.previewWindow = window.open(fsmData.siteUrl, '_blank');
                self.updateLiveBadge();
                
                // Check periodically if window is still open
                self.previewCheckInterval = setInterval(function() {
                    self.updateLiveBadge();
                }, 1000);
            });
        },

        updateLiveBadge: function() {
            const badge = document.getElementById('fsm-live-badge');
            if (!badge) return;
            
            if (this.previewWindow && !this.previewWindow.closed) {
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
                if (this.previewCheckInterval) {
                    clearInterval(this.previewCheckInterval);
                    this.previewCheckInterval = null;
                }
            }
        },

        renderPanel: function() {
            const panel = $('#fsm-settings-panel');
            switch(this.currentTab) {
                case 'settings': panel.html(this.renderSettingsTab()); break;
                case 'items': panel.html(this.renderItemsTab()); break;
                case 'visibility': panel.html(this.renderVisibilityTab()); break;
                case 'export': panel.html(this.renderExportTab()); break;
            }
            this.bindPanelEvents();
            this.updateRadiusPreview();
        },

        renderSettingsTab: function() {
            const tabs = [
                { id: 'layout', label: 'Layout', icon: 'fa-th-large' },
                { id: 'style', label: 'Style', icon: 'fa-palette' },
                { id: 'toggle', label: 'Toggle', icon: 'fa-toggle-on' },
                { id: 'responsive', label: 'Responsive', icon: 'fa-mobile-alt' },
                { id: 'animation', label: 'Animation', icon: 'fa-magic' }
            ];

            const statusClass = this.status === 'published' ? 'fsm-status-published' : 'fsm-status-draft';
            const statusText = this.status === 'published' ? 'Published' : 'Draft';
            const statusInfo = this.status === 'draft' ? 'Changes not yet published' : 'All changes are live';
            const historyCount = this.history.length;

            let html = `
                <div class="fsm-panel-header">
                    <div class="fsm-status-bar ${statusClass}">
                        <div class="fsm-status-left">
                            <div class="fsm-status-indicator">
                                <span class="fsm-status-dot"></span>
                                <span class="fsm-status-text">${statusText}</span>
                            </div>
                            <span class="fsm-status-info">${statusInfo}</span>
                        </div>
                        <div class="fsm-status-right">
                            <div class="fsm-breakpoint-switcher">
                                <button class="fsm-bp-btn ${this.currentBreakpoint === 'desktop' ? 'active' : ''}" data-breakpoint="desktop" title="Desktop">
                                    <i class="fas fa-desktop"></i>
                                </button>
                                <button class="fsm-bp-btn ${this.currentBreakpoint === 'tablet' ? 'active' : ''}" data-breakpoint="tablet" title="Tablet (≤${this.settings.breakpoints?.tablet || 1024}px)">
                                    <i class="fas fa-tablet-alt"></i>
                                </button>
                                <button class="fsm-bp-btn ${this.currentBreakpoint === 'mobile' ? 'active' : ''}" data-breakpoint="mobile" title="Mobile (≤${this.settings.breakpoints?.mobile || 768}px)">
                                    <i class="fas fa-mobile-alt"></i>
                                </button>
                            </div>
                            <button class="fsm-history-trigger" id="fsm-show-history">
                                <i class="fas fa-history"></i> History${historyCount > 0 ? ` (${historyCount})` : ''}
                            </button>
                        </div>
                    </div>
                    <div class="fsm-settings-tabs">
            `;

            tabs.forEach(t => {
                html += `<button class="fsm-stab ${this.currentSettingsTab === t.id ? 'active' : ''}" data-stab="${t.id}"><i class="fas ${t.icon}"></i> ${t.label}</button>`;
            });

            html += `</div>
                </div>
                <div class="fsm-settings-content">
            `;

            switch(this.currentSettingsTab) {
                case 'layout': html += this.renderLayoutSettings(); break;
                case 'style': html += this.renderStyleSettings(); break;
                case 'toggle': html += this.renderToggleSettings(); break;
                case 'responsive': html += this.renderResponsiveSettings(); break;
                case 'animation': html += this.renderAnimationSettings(); break;
            }

            html += `</div>
                <div class="fsm-action-bar">
                    <div class="fsm-action-left">
                        <button class="fsm-btn fsm-btn-danger" id="fsm-reset-default"><i class="fas fa-trash-restore"></i> Reset to Default</button>
                    </div>
                    <div class="fsm-action-right">
                        <button class="fsm-btn fsm-btn-secondary" id="fsm-reset-saved"><i class="fas fa-undo"></i> Discard Changes</button>
                        <button class="fsm-btn fsm-btn-draft" id="fsm-save-draft"><i class="fas fa-file-alt"></i> Save to Draft</button>
                        <button class="fsm-btn fsm-btn-publish" id="fsm-publish"><i class="fas fa-cloud-upload-alt"></i> Publish</button>
                    </div>
                </div>
            `;
            return html;
        },

        renderPositionSettings: function() {
            const s = this.settings.position;
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-arrows-alt"></i> Position</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Side</label>
                            <select class="fsm-select" data-setting="position.side">
                                <option value="right" ${s.side === 'right' ? 'selected' : ''}>Right</option>
                                <option value="left" ${s.side === 'left' ? 'selected' : ''}>Left</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Vertical</label>
                            <input type="number" class="fsm-input" value="${s.vertical}" data-setting="position.vertical">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Unit</label>
                            <select class="fsm-select" data-setting="position.vertical_unit">
                                <option value="%" ${s.vertical_unit === '%' ? 'selected' : ''}>%</option>
                                <option value="px" ${s.vertical_unit === 'px' ? 'selected' : ''}>px</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Margin</label>
                            <input type="number" class="fsm-input" value="${s.margin}" data-setting="position.margin">
                        </div>
                    </div>
                </div>
            `;
        },

        // Layout Tab - รวม Position + Container
        renderLayoutSettings: function() {
            // Use getSettingValue for responsive support
            const s = {
                side: this.getSettingValue('position.side'),
                vertical: this.getSettingValue('position.vertical'),
                vertical_unit: this.getSettingValue('position.vertical_unit'),
                margin: this.getSettingValue('position.margin')
            };
            const c = {
                background_color: this.getSettingValue('container.background_color'),
                width: this.getSettingValue('container.width'),
                gap: this.getSettingValue('container.gap')
            };
            const p = {
                top: this.getSettingValue('container.padding.top'),
                right: this.getSettingValue('container.padding.right'),
                bottom: this.getSettingValue('container.padding.bottom'),
                left: this.getSettingValue('container.padding.left')
            };
            const br = {
                top_left: this.getSettingValue('container.border_radius.top_left'),
                top_right: this.getSettingValue('container.border_radius.top_right'),
                bottom_right: this.getSettingValue('container.border_radius.bottom_right'),
                bottom_left: this.getSettingValue('container.border_radius.bottom_left')
            };
            const bs = {
                x: this.getSettingValue('container.box_shadow.x'),
                y: this.getSettingValue('container.box_shadow.y'),
                blur: this.getSettingValue('container.box_shadow.blur'),
                spread: this.getSettingValue('container.box_shadow.spread')
            };
            const z_index = this.getSettingValue('z_index');
            
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-arrows-alt"></i> Position</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Side</label>
                            <select class="fsm-select" data-setting="position.side">
                                <option value="right" ${s.side === 'right' ? 'selected' : ''}>Right</option>
                                <option value="left" ${s.side === 'left' ? 'selected' : ''}>Left</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Vertical</label>
                            <input type="number" class="fsm-input" value="${s.vertical}" data-setting="position.vertical">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Unit</label>
                            <select class="fsm-select" data-setting="position.vertical_unit">
                                <option value="%" ${s.vertical_unit === '%' ? 'selected' : ''}>%</option>
                                <option value="px" ${s.vertical_unit === 'px' ? 'selected' : ''}>px</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Margin</label>
                            <input type="number" class="fsm-input" value="${s.margin}" data-setting="position.margin">
                        </div>
                    </div>
                </div>
                
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-square"></i> Container</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${c.background_color}" data-setting="container.background_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${c.background_color}" data-setting="container.background_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Width</label>
                            <input type="number" class="fsm-input" value="${c.width}" data-setting="container.width">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Gap</label>
                            <input type="number" class="fsm-input" value="${c.gap || 0}" data-setting="container.gap">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Z-Index</label>
                            <input type="number" class="fsm-input" value="${z_index}" data-setting="z_index">
                        </div>
                    </div>
                    
                    <div class="fsm-two-col" style="margin-top:16px">
                        <div class="fsm-editor-col">
                            <div class="fsm-label-row">
                                <label class="fsm-label">Padding</label>
                                <button class="fsm-link-btn ${this.paddingLinked ? 'linked' : ''}" id="fsm-padding-link">
                                    <i class="fas ${this.paddingLinked ? 'fa-link' : 'fa-unlink'}"></i>
                                </button>
                            </div>
                            <div class="fsm-padding-editor">
                                <div class="fsm-padding-box">
                                    <input type="number" class="fsm-pad-input top" value="${p.top}" data-padding="top">
                                    <input type="number" class="fsm-pad-input right" value="${p.right}" data-padding="right">
                                    <input type="number" class="fsm-pad-input bottom" value="${p.bottom}" data-padding="bottom">
                                    <input type="number" class="fsm-pad-input left" value="${p.left}" data-padding="left">
                                    <div class="fsm-padding-inner"></div>
                                </div>
                            </div>
                        </div>
                        <div class="fsm-editor-col">
                            <div class="fsm-label-row">
                                <label class="fsm-label">Border Radius</label>
                                <button class="fsm-link-btn ${this.borderRadiusLinked ? 'linked' : ''}" id="fsm-radius-link">
                                    <i class="fas ${this.borderRadiusLinked ? 'fa-link' : 'fa-unlink'}"></i>
                                </button>
                            </div>
                            <div class="fsm-radius-editor">
                                <div class="fsm-radius-box">
                                    <input type="number" class="fsm-radius-input top-left" value="${br.top_left}" data-corner="top_left">
                                    <input type="number" class="fsm-radius-input top-right" value="${br.top_right}" data-corner="top_right">
                                    <input type="number" class="fsm-radius-input bottom-right" value="${br.bottom_right}" data-corner="bottom_right">
                                    <input type="number" class="fsm-radius-input bottom-left" value="${br.bottom_left}" data-corner="bottom_left">
                                    <div class="fsm-radius-preview" id="fsm-radius-preview"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-clone"></i> Box Shadow</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">X Offset</label>
                            <input type="number" class="fsm-input" value="${bs.x}" data-setting="container.box_shadow.x">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Y Offset</label>
                            <input type="number" class="fsm-input" value="${bs.y}" data-setting="container.box_shadow.y">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Blur</label>
                            <input type="number" class="fsm-input" value="${bs.blur}" data-setting="container.box_shadow.blur">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Spread</label>
                            <input type="number" class="fsm-input" value="${bs.spread}" data-setting="container.box_shadow.spread">
                        </div>
                    </div>
                </div>
            `;
        },


        renderContainerSettings: function() {
            const c = this.settings.container;
            const p = c.padding;
            const br = c.border_radius;
            const bs = c.box_shadow;
            
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-square"></i> Container</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${c.background_color}" data-setting="container.background_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${c.background_color}" data-setting="container.background_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Width</label>
                            <input type="number" class="fsm-input" value="${c.width}" data-setting="container.width">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Gap</label>
                            <input type="number" class="fsm-input" value="${c.gap || 0}" data-setting="container.gap">
                        </div>
                    </div>
                    
                    <div class="fsm-two-col" style="margin-top:16px">
                        <div class="fsm-editor-col">
                            <div class="fsm-label-row">
                                <label class="fsm-label">Padding</label>
                                <button class="fsm-link-btn ${this.paddingLinked ? 'linked' : ''}" id="fsm-padding-link">
                                    <i class="fas ${this.paddingLinked ? 'fa-link' : 'fa-unlink'}"></i>
                                </button>
                            </div>
                            <div class="fsm-padding-editor">
                                <div class="fsm-padding-box">
                                    <input type="number" class="fsm-pad-input top" value="${p.top}" data-padding="top">
                                    <input type="number" class="fsm-pad-input right" value="${p.right}" data-padding="right">
                                    <input type="number" class="fsm-pad-input bottom" value="${p.bottom}" data-padding="bottom">
                                    <input type="number" class="fsm-pad-input left" value="${p.left}" data-padding="left">
                                    <div class="fsm-padding-inner"></div>
                                </div>
                            </div>
                        </div>
                        <div class="fsm-editor-col">
                            <div class="fsm-label-row">
                                <label class="fsm-label">Border Radius</label>
                                <button class="fsm-link-btn ${this.borderRadiusLinked ? 'linked' : ''}" id="fsm-radius-link">
                                    <i class="fas ${this.borderRadiusLinked ? 'fa-link' : 'fa-unlink'}"></i>
                                </button>
                            </div>
                            <div class="fsm-radius-editor">
                                <div class="fsm-radius-box">
                                    <input type="number" class="fsm-radius-input top-left" value="${br.top_left}" data-corner="top_left">
                                    <input type="number" class="fsm-radius-input top-right" value="${br.top_right}" data-corner="top_right">
                                    <input type="number" class="fsm-radius-input bottom-right" value="${br.bottom_right}" data-corner="bottom_right">
                                    <input type="number" class="fsm-radius-input bottom-left" value="${br.bottom_left}" data-corner="bottom_left">
                                    <div class="fsm-radius-preview" id="fsm-radius-preview"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="fsm-group" style="margin-top:16px">
                        <label class="fsm-label">Z-Index</label>
                        <input type="number" class="fsm-input" value="${this.settings.z_index}" data-setting="z_index" style="width:50%">
                    </div>
                </div>
                
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-clone"></i> Box Shadow</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">X Offset</label>
                            <input type="number" class="fsm-input" value="${bs.x}" data-setting="container.box_shadow.x">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Y Offset</label>
                            <input type="number" class="fsm-input" value="${bs.y}" data-setting="container.box_shadow.y">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Blur</label>
                            <input type="number" class="fsm-input" value="${bs.blur}" data-setting="container.box_shadow.blur">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Spread</label>
                            <input type="number" class="fsm-input" value="${bs.spread}" data-setting="container.box_shadow.spread">
                        </div>
                    </div>
                </div>
            `;
        },

        // Style Tab - รวม Typography + Icons + Item
        renderStyleSettings: function() {
            // Use getSettingValue for responsive support
            const t = {
                font_family: this.getSettingValue('typography.font_family'),
                font_size: this.getSettingValue('typography.font_size'),
                font_weight: this.getSettingValue('typography.font_weight'),
                line_height: this.getSettingValue('typography.line_height'),
                text_color: this.getSettingValue('typography.text_color'),
                hover_text_color: this.getSettingValue('typography.hover_text_color'),
                active_text_color: this.getSettingValue('typography.active_text_color'),
                text_align: this.getSettingValue('typography.text_align')
            };
            const h = this.settings.hover || {};
            const i = {
                size: this.getSettingValue('icon.size'),
                color: this.getSettingValue('icon.color'),
                hover_color: this.getSettingValue('icon.hover_color'),
                active_color: this.getSettingValue('icon.active_color'),
                spacing: this.getSettingValue('icon.spacing'),
                position: this.getSettingValue('icon.position'),
                align: this.getSettingValue('icon.align')
            };
            const fonts = fsmData.fonts || {};
            
            // Get item settings with responsive support
            const item = {
                padding: {
                    top: this.getSettingValue('item.padding.top') || 12,
                    right: this.getSettingValue('item.padding.right') || 12,
                    bottom: this.getSettingValue('item.padding.bottom') || 12,
                    left: this.getSettingValue('item.padding.left') || 12
                },
                border_radius: this.getSettingValue('item.border_radius') || 8,
                first_last_radius: this.getSettingValue('item.first_last_radius') || 'container',
                background_color: this.getSettingValue('item.background_color') || 'transparent',
                hover_background: this.getSettingValue('item.hover_background') || 'rgba(255,255,255,0.1)',
                active_background: this.getSettingValue('item.active_background') || 'rgba(255,255,255,0.15)',
                transition_duration: this.getSettingValue('item.transition_duration') || 200
            };
            const ip = item.padding;
            
            // Build font options
            let fontOptions = '';
            
            // System fonts
            if (fonts.system) {
                fontOptions += '<optgroup label="System Fonts">';
                fonts.system.forEach(f => {
                    const selected = t.font_family === f.value ? 'selected' : '';
                    fontOptions += `<option value="${f.value}" ${selected}>${f.label}</option>`;
                });
                fontOptions += '</optgroup>';
            }
            
            // Elementor fonts
            if (fonts.elementor && fonts.elementor.length > 0) {
                fontOptions += '<optgroup label="Elementor Fonts">';
                fonts.elementor.forEach(f => {
                    const selected = t.font_family === f.value || (t.font_family && t.font_family.includes(f.font_family)) ? 'selected' : '';
                    fontOptions += `<option value="${f.value}" data-font="${f.font_family}" ${selected}>${f.label}</option>`;
                });
                fontOptions += '</optgroup>';
            }
            
            // Popular Google Fonts
            const googleFonts = [
                { value: "'Inter', sans-serif", label: 'Inter' },
                { value: "'Roboto', sans-serif", label: 'Roboto' },
                { value: "'Open Sans', sans-serif", label: 'Open Sans' },
                { value: "'Poppins', sans-serif", label: 'Poppins' },
                { value: "'Noto Sans Thai', sans-serif", label: 'Noto Sans Thai' },
                { value: "'Sarabun', sans-serif", label: 'Sarabun' },
                { value: "'Prompt', sans-serif", label: 'Prompt' },
                { value: "'Kanit', sans-serif", label: 'Kanit' }
            ];
            
            fontOptions += '<optgroup label="Google Fonts">';
            googleFonts.forEach(f => {
                const fontName = f.label;
                const selected = t.font_family && t.font_family.includes(fontName) && !t.font_family.includes('apple') ? 'selected' : '';
                fontOptions += `<option value="${f.value}" data-font="${fontName}" ${selected}>${f.label}</option>`;
            });
            fontOptions += '</optgroup>';
            
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-font"></i> Typography</div>
                    <div class="fsm-grid">
                        <div class="fsm-group" style="grid-column: span 2;">
                            <label class="fsm-label">Font Family</label>
                            <select class="fsm-select fsm-font-select" data-setting="typography.font_family">
                                ${fontOptions}
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Font Size</label>
                            <input type="number" class="fsm-input" value="${t.font_size}" data-setting="typography.font_size">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Font Weight</label>
                            <select class="fsm-select" data-setting="typography.font_weight">
                                <option value="400" ${t.font_weight == 400 ? 'selected' : ''}>Normal</option>
                                <option value="500" ${t.font_weight == 500 ? 'selected' : ''}>Medium</option>
                                <option value="600" ${t.font_weight == 600 ? 'selected' : ''}>Semi Bold</option>
                                <option value="700" ${t.font_weight == 700 ? 'selected' : ''}>Bold</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Line Height</label>
                            <input type="number" class="fsm-input" value="${t.line_height || 1.4}" data-setting="typography.line_height" step="0.1">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Text Align</label>
                            <select class="fsm-select" data-setting="typography.text_align">
                                <option value="left" ${(t.text_align || 'center') === 'left' ? 'selected' : ''}>Left</option>
                                <option value="center" ${(t.text_align || 'center') === 'center' ? 'selected' : ''}>Center</option>
                                <option value="right" ${(t.text_align || 'center') === 'right' ? 'selected' : ''}>Right</option>
                            </select>
                        </div>
                    </div>
                    <p class="fsm-hint" style="color:#64748b;font-size:12px;margin-top:12px;">
                        <i class="fas fa-info-circle"></i> เลือก "Theme Default" เพื่อใช้ font จาก Elementor/WordPress theme${fonts.elementor_primary ? ` (ปัจจุบัน: ${fonts.elementor_primary})` : ''}
                    </p>
                </div>
                
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-palette"></i> Colors</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Text Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(t.text_color)}" data-setting="typography.text_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.text_color}" data-setting="typography.text_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Hover Text</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(t.hover_text_color || '#ffffff')}" data-setting="typography.hover_text_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.hover_text_color || '#ffffff'}" data-setting="typography.hover_text_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Active Text</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(t.active_text_color || '#ffffff')}" data-setting="typography.active_text_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.active_text_color || '#ffffff'}" data-setting="typography.active_text_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Icon Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(i.color)}" data-setting="icon.color">
                                <input type="text" class="fsm-input fsm-color-text" value="${i.color}" data-setting="icon.color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Hover Icon</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(i.hover_color || '#ffffff')}" data-setting="icon.hover_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${i.hover_color || '#ffffff'}" data-setting="icon.hover_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Active Icon</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(i.active_color || '#ffffff')}" data-setting="icon.active_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${i.active_color || '#ffffff'}" data-setting="icon.active_color">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-icons"></i> Icon Settings</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Icon Size</label>
                            <input type="number" class="fsm-input" value="${i.size}" data-setting="icon.size">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Spacing</label>
                            <input type="number" class="fsm-input" value="${i.spacing}" data-setting="icon.spacing">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Position</label>
                            <select class="fsm-select" data-setting="icon.position">
                                <option value="top" ${i.position === 'top' ? 'selected' : ''}>Above Label</option>
                                <option value="left" ${i.position === 'left' ? 'selected' : ''}>Left of Label</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Alignment</label>
                            <select class="fsm-select" data-setting="icon.align">
                                <option value="left" ${(i.align || 'center') === 'left' ? 'selected' : ''}>Left</option>
                                <option value="center" ${(i.align || 'center') === 'center' ? 'selected' : ''}>Center</option>
                                <option value="right" ${(i.align || 'center') === 'right' ? 'selected' : ''}>Right</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-square"></i> Item Style</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Border Radius</label>
                            <input type="number" class="fsm-input" value="${item.border_radius}" data-setting="item.border_radius">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">First/Last Radius</label>
                            <select class="fsm-select" data-setting="item.first_last_radius">
                                <option value="container" ${item.first_last_radius === 'container' ? 'selected' : ''}>ตาม Container</option>
                                <option value="item" ${item.first_last_radius === 'item' ? 'selected' : ''}>ตาม Item</option>
                                <option value="none" ${item.first_last_radius === 'none' ? 'selected' : ''}>ไม่มี (0)</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Transition (ms)</label>
                            <input type="number" class="fsm-input" value="${item.transition_duration}" data-setting="item.transition_duration">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(item.background_color || '#000000')}" data-setting="item.background_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${item.background_color}" data-setting="item.background_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Hover Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(item.hover_background || '#ffffff')}" data-setting="item.hover_background">
                                <input type="text" class="fsm-input fsm-color-text" value="${item.hover_background}" data-setting="item.hover_background">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Active Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(item.active_background || '#ffffff')}" data-setting="item.active_background">
                                <input type="text" class="fsm-input fsm-color-text" value="${item.active_background}" data-setting="item.active_background">
                            </div>
                        </div>
                    </div>
                    
                    <div class="fsm-label-row" style="margin-top: 16px;">
                        <label class="fsm-label">Item Padding</label>
                        <button class="fsm-link-btn ${this.itemPaddingLinked ? 'linked' : ''}" id="fsm-item-padding-link">
                            <i class="fas ${this.itemPaddingLinked ? 'fa-link' : 'fa-unlink'}"></i>
                        </button>
                    </div>
                    <div class="fsm-padding-editor">
                        <div class="fsm-padding-box fsm-item-padding-box">
                            <input type="number" class="fsm-pad-input top" value="${ip.top}" data-item-padding="top">
                            <input type="number" class="fsm-pad-input right" value="${ip.right}" data-item-padding="right">
                            <input type="number" class="fsm-pad-input bottom" value="${ip.bottom}" data-item-padding="bottom">
                            <input type="number" class="fsm-pad-input left" value="${ip.left}" data-item-padding="left">
                            <div class="fsm-padding-inner"></div>
                        </div>
                    </div>
                </div>
            `;
        },

        renderTypographySettings: function() {
            const t = this.settings.typography;
            const h = this.settings.hover || {};
            const fonts = fsmData.fonts || {};
            
            // Build font options
            let fontOptions = '';
            
            // System fonts
            if (fonts.system) {
                fontOptions += '<optgroup label="System Fonts">';
                fonts.system.forEach(f => {
                    const selected = t.font_family === f.value ? 'selected' : '';
                    fontOptions += `<option value="${f.value}" ${selected}>${f.label}</option>`;
                });
                fontOptions += '</optgroup>';
            }
            
            // Elementor fonts
            if (fonts.elementor && fonts.elementor.length > 0) {
                fontOptions += '<optgroup label="Elementor Fonts">';
                fonts.elementor.forEach(f => {
                    const selected = t.font_family === f.value || t.font_family.includes(f.font_family) ? 'selected' : '';
                    fontOptions += `<option value="${f.value}" data-font="${f.font_family}" ${selected}>${f.label}</option>`;
                });
                fontOptions += '</optgroup>';
            }
            
            // Popular Google Fonts
            const googleFonts = [
                { value: "'Inter', sans-serif", label: 'Inter' },
                { value: "'Roboto', sans-serif", label: 'Roboto' },
                { value: "'Open Sans', sans-serif", label: 'Open Sans' },
                { value: "'Poppins', sans-serif", label: 'Poppins' },
                { value: "'Noto Sans Thai', sans-serif", label: 'Noto Sans Thai' },
                { value: "'Sarabun', sans-serif", label: 'Sarabun' },
                { value: "'Prompt', sans-serif", label: 'Prompt' },
                { value: "'Kanit', sans-serif", label: 'Kanit' }
            ];
            
            fontOptions += '<optgroup label="Google Fonts">';
            googleFonts.forEach(f => {
                const fontName = f.label;
                const selected = t.font_family.includes(fontName) && !t.font_family.includes('apple') ? 'selected' : '';
                fontOptions += `<option value="${f.value}" data-font="${fontName}" ${selected}>${f.label}</option>`;
            });
            fontOptions += '</optgroup>';
            
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-font"></i> Typography</div>
                    <div class="fsm-grid">
                        <div class="fsm-group" style="grid-column: span 2;">
                            <label class="fsm-label">Font Family</label>
                            <select class="fsm-select fsm-font-select" data-setting="typography.font_family">
                                ${fontOptions}
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Font Size</label>
                            <input type="number" class="fsm-input" value="${t.font_size}" data-setting="typography.font_size">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Font Weight</label>
                            <select class="fsm-select" data-setting="typography.font_weight">
                                <option value="400" ${t.font_weight == 400 ? 'selected' : ''}>Normal</option>
                                <option value="500" ${t.font_weight == 500 ? 'selected' : ''}>Medium</option>
                                <option value="600" ${t.font_weight == 600 ? 'selected' : ''}>Semi Bold</option>
                                <option value="700" ${t.font_weight == 700 ? 'selected' : ''}>Bold</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Line Height</label>
                            <input type="number" class="fsm-input" value="${t.line_height || 1.4}" data-setting="typography.line_height" step="0.1">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Text Align</label>
                            <select class="fsm-select" data-setting="typography.text_align">
                                <option value="left" ${(t.text_align || 'center') === 'left' ? 'selected' : ''}>Left</option>
                                <option value="center" ${(t.text_align || 'center') === 'center' ? 'selected' : ''}>Center</option>
                                <option value="right" ${(t.text_align || 'center') === 'right' ? 'selected' : ''}>Right</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Text Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="#ffffff" data-setting="typography.text_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.text_color}" data-setting="typography.text_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Hover Text Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${t.hover_text_color || h.text_color || '#ffffff'}" data-setting="typography.hover_text_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.hover_text_color || h.text_color || '#ffffff'}" data-setting="typography.hover_text_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Active Text Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${t.active_text_color || '#ffffff'}" data-setting="typography.active_text_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.active_text_color || '#ffffff'}" data-setting="typography.active_text_color">
                            </div>
                        </div>
                    </div>
                    <p class="fsm-hint" style="color:#64748b;font-size:12px;margin-top:12px;">
                        <i class="fas fa-info-circle"></i> เลือก "Theme Default" เพื่อใช้ font จาก Elementor/WordPress theme${fonts.elementor_primary ? ` (ปัจจุบัน: ${fonts.elementor_primary})` : ''}
                    </p>
                </div>
            `;
        },

        renderIconSettings: function() {
            const i = this.settings.icon;
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-icons"></i> Icon Settings</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Icon Size</label>
                            <input type="number" class="fsm-input" value="${i.size}" data-setting="icon.size">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Spacing</label>
                            <input type="number" class="fsm-input" value="${i.spacing}" data-setting="icon.spacing">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Position</label>
                            <select class="fsm-select" data-setting="icon.position">
                                <option value="top" ${i.position === 'top' ? 'selected' : ''}>Above Label</option>
                                <option value="left" ${i.position === 'left' ? 'selected' : ''}>Left of Label</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Alignment</label>
                            <select class="fsm-select" data-setting="icon.align">
                                <option value="left" ${(i.align || 'center') === 'left' ? 'selected' : ''}>Left</option>
                                <option value="center" ${(i.align || 'center') === 'center' ? 'selected' : ''}>Center</option>
                                <option value="right" ${(i.align || 'center') === 'right' ? 'selected' : ''}>Right</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Icon Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="#ffffff" data-setting="icon.color">
                                <input type="text" class="fsm-input fsm-color-text" value="${i.color}" data-setting="icon.color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Hover Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${i.hover_color || '#ffffff'}" data-setting="icon.hover_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${i.hover_color || '#ffffff'}" data-setting="icon.hover_color">
                            </div>
                        </div>
                        <div class="fsm-group" style="grid-column: span 2;">
                            <label class="fsm-label">Active Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${i.active_color || '#ffffff'}" data-setting="icon.active_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${i.active_color || '#ffffff'}" data-setting="icon.active_color">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        renderItemSettings: function() {
            // Initialize item settings if not exists
            if (!this.settings.item) {
                this.settings.item = {
                    padding: { top: 12, right: 12, bottom: 12, left: 12 },
                    border_radius: 8,
                    first_last_radius: 'container',
                    background_color: 'transparent',
                    hover_background: 'rgba(255,255,255,0.1)',
                    active_background: 'rgba(255,255,255,0.15)',
                    transition_duration: 200
                };
            }
            const item = this.settings.item;
            const ip = item.padding || { top: 12, right: 12, bottom: 12, left: 12 };
            
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-square"></i> Item Settings</div>
                    
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Border Radius</label>
                            <input type="number" class="fsm-input" value="${item.border_radius || 8}" data-setting="item.border_radius">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">First/Last Radius</label>
                            <select class="fsm-select" data-setting="item.first_last_radius">
                                <option value="container" ${(item.first_last_radius || 'container') === 'container' ? 'selected' : ''}>ตาม Container</option>
                                <option value="item" ${item.first_last_radius === 'item' ? 'selected' : ''}>ตาม Item</option>
                                <option value="none" ${item.first_last_radius === 'none' ? 'selected' : ''}>ไม่มี (0)</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Transition (ms)</label>
                            <input type="number" class="fsm-input" value="${item.transition_duration || 200}" data-setting="item.transition_duration">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="#000000" data-setting="item.background_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${item.background_color || 'transparent'}" data-setting="item.background_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Hover Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="#ffffff" data-setting="item.hover_background">
                                <input type="text" class="fsm-input fsm-color-text" value="${item.hover_background || 'rgba(255,255,255,0.1)'}" data-setting="item.hover_background">
                            </div>
                        </div>
                        <div class="fsm-group" style="grid-column: span 2;">
                            <label class="fsm-label">Active Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="#ffffff" data-setting="item.active_background">
                                <input type="text" class="fsm-input fsm-color-text" value="${item.active_background || 'rgba(255,255,255,0.15)'}" data-setting="item.active_background">
                            </div>
                        </div>
                    </div>
                    
                    <div class="fsm-label-row" style="margin-top: 16px;">
                        <label class="fsm-label">Item Padding</label>
                        <button class="fsm-link-btn ${this.itemPaddingLinked ? 'linked' : ''}" id="fsm-item-padding-link">
                            <i class="fas ${this.itemPaddingLinked ? 'fa-link' : 'fa-unlink'}"></i>
                        </button>
                    </div>
                    <div class="fsm-padding-editor">
                        <div class="fsm-padding-box fsm-item-padding-box">
                            <input type="number" class="fsm-pad-input top" value="${ip.top}" data-item-padding="top">
                            <input type="number" class="fsm-pad-input right" value="${ip.right}" data-item-padding="right">
                            <input type="number" class="fsm-pad-input bottom" value="${ip.bottom}" data-item-padding="bottom">
                            <input type="number" class="fsm-pad-input left" value="${ip.left}" data-item-padding="left">
                            <div class="fsm-padding-inner"></div>
                        </div>
                    </div>
                </div>
            `;
        },


        renderToggleSettings: function() {
            // Use getSettingValue for responsive support
            const t = {
                enabled: this.getSettingValue('toggle.enabled'),
                icon_open: this.getSettingValue('toggle.icon_open'),
                icon_closed: this.getSettingValue('toggle.icon_closed'),
                icon_size: this.getSettingValue('toggle.icon_size'),
                icon_rotate: this.getSettingValue('toggle.icon_rotate'),
                background_color: this.getSettingValue('toggle.background_color'),
                icon_color: this.getSettingValue('toggle.icon_color'),
                hover_background: this.getSettingValue('toggle.hover_background'),
                hover_icon_color: this.getSettingValue('toggle.hover_icon_color'),
                active_background: this.getSettingValue('toggle.active_background'),
                active_icon_color: this.getSettingValue('toggle.active_icon_color'),
                size: this.getSettingValue('toggle.size'),
                width: this.getSettingValue('toggle.width'),
                border_radius: this.getSettingValue('toggle.border_radius'),
                align: this.getSettingValue('toggle.align')
            };
            
            const toggleIcons = [
                { value: 'fa-chevron-left', label: 'Chevron Left' },
                { value: 'fa-chevron-right', label: 'Chevron Right' },
                { value: 'fa-angle-left', label: 'Angle Left' },
                { value: 'fa-angle-right', label: 'Angle Right' },
                { value: 'fa-arrow-left', label: 'Arrow Left' },
                { value: 'fa-arrow-right', label: 'Arrow Right' },
                { value: 'fa-caret-left', label: 'Caret Left' },
                { value: 'fa-caret-right', label: 'Caret Right' },
                { value: 'fa-bars', label: 'Bars' },
                { value: 'fa-times', label: 'Close' },
                { value: 'fa-plus', label: 'Plus' },
                { value: 'fa-minus', label: 'Minus' }
            ];
            
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-toggle-on"></i> Toggle Button</div>
                    <div class="fsm-toggle-row">
                        <span class="fsm-label">Enable Toggle</span>
                        <button class="fsm-switch ${t.enabled ? 'on' : ''}" data-setting="toggle.enabled"></button>
                    </div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Icon (Open)</label>
                            <select class="fsm-select" data-setting="toggle.icon_open">
                                ${toggleIcons.map(icon => `<option value="${icon.value}" ${(t.icon_open || 'fa-chevron-left') === icon.value ? 'selected' : ''}>${icon.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Icon (Collapsed)</label>
                            <select class="fsm-select" data-setting="toggle.icon_closed">
                                ${toggleIcons.map(icon => `<option value="${icon.value}" ${(t.icon_closed || 'fa-chevron-right') === icon.value ? 'selected' : ''}>${icon.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Icon Size</label>
                            <input type="number" class="fsm-input" value="${t.icon_size || 14}" data-setting="toggle.icon_size">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Icon Rotate (deg)</label>
                            <input type="number" class="fsm-input" value="${t.icon_rotate || 0}" data-setting="toggle.icon_rotate" step="45">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Height</label>
                            <input type="number" class="fsm-input" value="${t.size}" data-setting="toggle.size">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Width</label>
                            <input type="number" class="fsm-input" value="${t.width || 28}" data-setting="toggle.width">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Radius</label>
                            <input type="number" class="fsm-input" value="${t.border_radius}" data-setting="toggle.border_radius">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Align</label>
                            <select class="fsm-select" data-setting="toggle.align">
                                <option value="top" ${(t.align || 'middle') === 'top' ? 'selected' : ''}>Top</option>
                                <option value="middle" ${(t.align || 'middle') === 'middle' ? 'selected' : ''}>Middle</option>
                                <option value="bottom" ${(t.align || 'middle') === 'bottom' ? 'selected' : ''}>Bottom</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-palette"></i> Toggle Colors</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(t.background_color)}" data-setting="toggle.background_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.background_color}" data-setting="toggle.background_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Icon Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(t.icon_color || '#ffffff')}" data-setting="toggle.icon_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.icon_color || '#ffffff'}" data-setting="toggle.icon_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Hover Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(t.hover_background || '#ffffff')}" data-setting="toggle.hover_background">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.hover_background || '#ffffff1a'}" data-setting="toggle.hover_background">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Hover Icon Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(t.hover_icon_color || '#ffffff')}" data-setting="toggle.hover_icon_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.hover_icon_color || '#ffffff'}" data-setting="toggle.hover_icon_color">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Active Background</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(t.active_background || '#ffffff')}" data-setting="toggle.active_background">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.active_background || '#ffffff26'}" data-setting="toggle.active_background">
                            </div>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Active Icon Color</label>
                            <div class="fsm-color-row">
                                <input type="color" class="fsm-color-picker" value="${this.colorToHex(t.active_icon_color || '#ffffff')}" data-setting="toggle.active_icon_color">
                                <input type="text" class="fsm-input fsm-color-text" value="${t.active_icon_color || '#ffffff'}" data-setting="toggle.active_icon_color">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        // Responsive Tab - แยกออกมาเป็น tab ใหม่
        renderResponsiveSettings: function() {
            const r = this.settings.responsive || {};
            const bp = this.settings.breakpoints || { tablet: 1024, mobile: 768 };
            
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-ruler-combined"></i> Breakpoint Settings</div>
                    <p class="fsm-hint" style="color:#64748b;font-size:12px;margin-bottom:16px;">
                        <i class="fas fa-info-circle"></i> กำหนดขนาดหน้าจอสำหรับแต่ละ breakpoint ใช้ปุ่มสลับ breakpoint ด้านบนเพื่อปรับแต่ง settings แยกตามขนาดหน้าจอ
                    </p>
                    <div class="fsm-breakpoint-config">
                        <div class="fsm-breakpoint-item tablet">
                            <div class="fsm-breakpoint-item-header">
                                <div class="fsm-breakpoint-item-icon"><i class="fas fa-tablet-alt"></i></div>
                                <span class="fsm-breakpoint-item-label">Tablet</span>
                            </div>
                            <div class="fsm-group">
                                <label class="fsm-label">Max Width (px)</label>
                                <input type="number" class="fsm-input" value="${bp.tablet || 1024}" data-setting="breakpoints.tablet">
                            </div>
                        </div>
                        <div class="fsm-breakpoint-item mobile">
                            <div class="fsm-breakpoint-item-header">
                                <div class="fsm-breakpoint-item-icon"><i class="fas fa-mobile-alt"></i></div>
                                <span class="fsm-breakpoint-item-label">Mobile</span>
                            </div>
                            <div class="fsm-group">
                                <label class="fsm-label">Max Width (px)</label>
                                <input type="number" class="fsm-input" value="${bp.mobile || 768}" data-setting="breakpoints.mobile">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-mobile-alt"></i> Mobile Behavior</div>
                    <div class="fsm-toggle-row">
                        <span class="fsm-label">Hide on Mobile</span>
                        <button class="fsm-switch ${r.hide_on_mobile ? 'on' : ''}" data-setting="responsive.hide_on_mobile"></button>
                    </div>
                    <div class="fsm-toggle-row">
                        <span class="fsm-label">Auto-collapse on Mobile</span>
                        <button class="fsm-switch ${r.auto_collapse_mobile !== false ? 'on' : ''}" data-setting="responsive.auto_collapse_mobile"></button>
                    </div>
                </div>
                
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-info-circle"></i> How to Use</div>
                    <div style="background: rgba(167, 139, 250, 0.08); padding: 16px; border-radius: 12px; border: 1px solid rgba(167, 139, 250, 0.15);">
                        <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 0;">
                            <strong style="color: var(--fsm-dark);">1.</strong> ใช้ปุ่ม <i class="fas fa-desktop"></i> <i class="fas fa-tablet-alt"></i> <i class="fas fa-mobile-alt"></i> ด้านบนเพื่อสลับ breakpoint<br><br>
                            <strong style="color: var(--fsm-dark);">2.</strong> เมื่ออยู่ใน Tablet หรือ Mobile mode การแก้ไข settings จะถูกบันทึกเป็น override สำหรับ breakpoint นั้น<br><br>
                            <strong style="color: var(--fsm-dark);">3.</strong> ค่าที่ไม่ได้ override จะ inherit จาก breakpoint ก่อนหน้า (Desktop → Tablet → Mobile)<br><br>
                            <strong style="color: var(--fsm-dark);">4.</strong> Preview จะแสดงผลตาม breakpoint ที่เลือก
                        </p>
                    </div>
                </div>
            `;
        },

        renderAnimationSettings: function() {
            // Use getSettingValue for responsive support
            const a = {
                duration: this.getSettingValue('animation.duration'),
                easing: this.getSettingValue('animation.easing'),
                type: this.getSettingValue('animation.type')
            };
            return `
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-magic"></i> Animation</div>
                    <div class="fsm-grid">
                        <div class="fsm-group">
                            <label class="fsm-label">Duration (ms)</label>
                            <input type="number" class="fsm-input" value="${a.duration}" data-setting="animation.duration">
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Easing</label>
                            <select class="fsm-select" data-setting="animation.easing">
                                <option value="ease" ${a.easing === 'ease' ? 'selected' : ''}>Ease</option>
                                <option value="ease-in" ${a.easing === 'ease-in' ? 'selected' : ''}>Ease In</option>
                                <option value="ease-out" ${a.easing === 'ease-out' ? 'selected' : ''}>Ease Out</option>
                                <option value="linear" ${a.easing === 'linear' ? 'selected' : ''}>Linear</option>
                            </select>
                        </div>
                        <div class="fsm-group">
                            <label class="fsm-label">Type</label>
                            <select class="fsm-select" data-setting="animation.type">
                                <option value="slide" ${a.type === 'slide' ? 'selected' : ''}>Slide</option>
                                <option value="fade" ${a.type === 'fade' ? 'selected' : ''}>Fade</option>
                                <option value="scale" ${a.type === 'scale' ? 'selected' : ''}>Scale</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        },

        renderItemsTab: function() {
            const statusClass = this.status === 'published' ? 'fsm-status-published' : 'fsm-status-draft';
            const statusText = this.status === 'published' ? 'Published' : 'Draft';
            const statusInfo = this.status === 'draft' ? 'Changes not yet published' : 'All changes are live';

            let html = `<div class="fsm-settings-content">
                <div class="fsm-status-bar ${statusClass}">
                    <div class="fsm-status-indicator">
                        <span class="fsm-status-dot"></span>
                        <span class="fsm-status-text">${statusText}</span>
                    </div>
                    <span class="fsm-status-info">${statusInfo}</span>
                </div>
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-list"></i> Menu Items</div>
                    <div id="fsm-items-list">
            `;

            this.items.forEach(item => {
                const iconHtml = this.getIconPreview(item);
                html += `
                    <div class="fsm-item-row" data-id="${item.id}" draggable="true">
                        <i class="fas fa-grip-vertical fsm-drag-handle"></i>
                        <div class="fsm-item-icon">${iconHtml}</div>
                        <span class="fsm-item-label">${this.escapeHtml(item.label)}</span>
                        <span class="fsm-item-url">${this.escapeHtml(item.url)}</span>
                        <button class="fsm-btn-edit" data-id="${item.id}"><i class="fas fa-pen"></i></button>
                        <button class="fsm-btn-delete" data-id="${item.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `;
            });

            html += `
                    </div>
                    <button class="fsm-add-item-btn" id="fsm-add-item"><i class="fas fa-plus"></i> Add Item</button>
                </div>
            </div>
            <div class="fsm-action-bar">
                <div class="fsm-action-left"></div>
                <div class="fsm-action-right">
                    <button class="fsm-btn fsm-btn-draft" id="fsm-save-draft"><i class="fas fa-file-alt"></i> Save to Draft</button>
                    <button class="fsm-btn fsm-btn-publish" id="fsm-publish"><i class="fas fa-cloud-upload-alt"></i> Publish</button>
                </div>
            </div>
            `;
            return html;
        },

        getIconPreview: function(item) {
            if (item.icon_type === 'image' && item.icon_url) {
                return `<img src="${item.icon_url}" alt="">`;
            } else if (item.icon_type === 'dashicons' && item.icon) {
                return `<span class="dashicons ${item.icon}"></span>`;
            } else if (item.icon) {
                return `<i class="fas ${item.icon}"></i>`;
            }
            return '<i class="fas fa-link"></i>';
        },

        renderVisibilityTab: function() {
            const v = this.settings.visibility;
            const statusClass = this.status === 'published' ? 'fsm-status-published' : 'fsm-status-draft';
            const statusText = this.status === 'published' ? 'Published' : 'Draft';
            const statusInfo = this.status === 'draft' ? 'Changes not yet published' : 'All changes are live';

            return `<div class="fsm-settings-content">
                <div class="fsm-status-bar ${statusClass}">
                    <div class="fsm-status-indicator">
                        <span class="fsm-status-dot"></span>
                        <span class="fsm-status-text">${statusText}</span>
                    </div>
                    <span class="fsm-status-info">${statusInfo}</span>
                </div>
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-eye"></i> Visibility Rules</div>
                    <div class="fsm-group">
                        <label class="fsm-label">Display Mode</label>
                        <select class="fsm-select" data-setting="visibility.mode">
                            <option value="all" ${v.mode === 'all' ? 'selected' : ''}>All Pages</option>
                            <option value="include" ${v.mode === 'include' ? 'selected' : ''}>Include Specific</option>
                            <option value="exclude" ${v.mode === 'exclude' ? 'selected' : ''}>Exclude Specific</option>
                        </select>
                    </div>
                    <div class="fsm-toggle-row">
                        <span class="fsm-label">Show on Homepage</span>
                        <button class="fsm-switch ${v.show_on_home ? 'on' : ''}" data-setting="visibility.show_on_home"></button>
                    </div>
                    <div class="fsm-toggle-row">
                        <span class="fsm-label">Show on Archives</span>
                        <button class="fsm-switch ${v.show_on_archive ? 'on' : ''}" data-setting="visibility.show_on_archive"></button>
                    </div>
                    <div class="fsm-toggle-row">
                        <span class="fsm-label">Show on Single Posts</span>
                        <button class="fsm-switch ${v.show_on_single ? 'on' : ''}" data-setting="visibility.show_on_single"></button>
                    </div>
                </div>
            </div>
            <div class="fsm-action-bar">
                <div class="fsm-action-left"></div>
                <div class="fsm-action-right">
                    <button class="fsm-btn fsm-btn-draft" id="fsm-save-draft"><i class="fas fa-file-alt"></i> Save to Draft</button>
                    <button class="fsm-btn fsm-btn-publish" id="fsm-publish"><i class="fas fa-cloud-upload-alt"></i> Publish</button>
                </div>
            </div>
            `;
        },

        renderExportTab: function() {
            return `<div class="fsm-settings-content">
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-file-export"></i> Export Settings</div>
                    <p style="color:#64748b;margin-bottom:16px;">Download all settings as a JSON file.</p>
                    <button class="fsm-btn fsm-btn-primary" id="fsm-export"><i class="fas fa-download"></i> Export</button>
                </div>
                <div class="fsm-section">
                    <div class="fsm-section-title"><i class="fas fa-file-import"></i> Import Settings</div>
                    <p style="color:#64748b;margin-bottom:16px;">Upload a JSON file to restore settings.</p>
                    <input type="file" id="fsm-import-file" accept=".json" style="display:none">
                    <button class="fsm-btn fsm-btn-secondary" id="fsm-import"><i class="fas fa-upload"></i> Import</button>
                </div>
            </div>
            `;
        },


        bindPanelEvents: function() {
            const self = this;

            // Breakpoint Switcher
            $(document).off('click', '.fsm-bp-btn').on('click', '.fsm-bp-btn', function() {
                const bp = $(this).data('breakpoint');
                self.currentBreakpoint = bp;
                self.renderPanel();
                self.renderPreview();
            });

            // Settings tabs
            $(document).off('click', '.fsm-stab').on('click', '.fsm-stab', function() {
                $('.fsm-stab').removeClass('active');
                $(this).addClass('active');
                self.currentSettingsTab = $(this).data('stab');
                self.renderPanel();
            });

            // Font family change - load Google Font
            $(document).off('change', '.fsm-font-select').on('change', '.fsm-font-select', function() {
                const $selected = $(this).find('option:selected');
                const fontName = $selected.data('font');
                if (fontName && fontName !== 'inherit') {
                    self.loadGoogleFont(fontName);
                }
            });

            // Show History Modal
            $(document).off('click', '#fsm-show-history').on('click', '#fsm-show-history', function() {
                self.showHistoryModal();
            });

            // Input changes - use setSettingValue for responsive support
            $(document).off('input', '.fsm-input, .fsm-select').on('input change', '.fsm-input, .fsm-select', function() {
                const setting = $(this).data('setting');
                if (setting) {
                    let value = $(this).val();
                    if ($(this).attr('type') === 'number') value = parseFloat(value) || 0;
                    self.setSettingValue(setting, value);
                    self.renderPreview();
                }
            });

            // Color picker - use setSettingValue for responsive support
            $(document).off('input', '.fsm-color-picker').on('input', '.fsm-color-picker', function() {
                const setting = $(this).data('setting');
                const $text = $(this).siblings('.fsm-color-text');
                if ($text.length) $text.val($(this).val());
                self.setSettingValue(setting, $(this).val());
                self.renderPreview();
            });

            // Toggle switch - use setSettingValue for responsive support
            $(document).off('click', '.fsm-switch').on('click', '.fsm-switch', function() {
                $(this).toggleClass('on');
                const setting = $(this).data('setting');
                self.setSettingValue(setting, $(this).hasClass('on'));
                self.renderPreview();
            });

            // Reset breakpoint override button
            $(document).off('click', '.fsm-reset-override').on('click', '.fsm-reset-override', function() {
                const setting = $(this).data('setting');
                self.removeBreakpointOverride(setting);
                self.renderPanel();
                self.renderPreview();
            });

            // Padding link
            $(document).off('click', '#fsm-padding-link').on('click', '#fsm-padding-link', function() {
                self.paddingLinked = !self.paddingLinked;
                $(this).toggleClass('linked', self.paddingLinked);
                $(this).find('i').attr('class', self.paddingLinked ? 'fas fa-link' : 'fas fa-unlink');
            });

            // Padding inputs - use setSettingValue for responsive support
            $(document).off('input', '.fsm-pad-input').on('input', '.fsm-pad-input', function() {
                const value = parseInt($(this).val()) || 0;
                if (self.paddingLinked) {
                    $('.fsm-pad-input').val(value);
                    self.setSettingValue('container.padding.top', value);
                    self.setSettingValue('container.padding.right', value);
                    self.setSettingValue('container.padding.bottom', value);
                    self.setSettingValue('container.padding.left', value);
                } else {
                    self.setSettingValue('container.padding.' + $(this).data('padding'), value);
                }
                self.renderPreview();
            });

            // Radius link
            $(document).off('click', '#fsm-radius-link').on('click', '#fsm-radius-link', function() {
                self.borderRadiusLinked = !self.borderRadiusLinked;
                $(this).toggleClass('linked', self.borderRadiusLinked);
                $(this).find('i').attr('class', self.borderRadiusLinked ? 'fas fa-link' : 'fas fa-unlink');
            });

            // Radius inputs - use setSettingValue for responsive support
            $(document).off('input', '.fsm-radius-input').on('input', '.fsm-radius-input', function() {
                const value = parseInt($(this).val()) || 0;
                if (self.borderRadiusLinked) {
                    $('.fsm-radius-input').val(value);
                    self.setSettingValue('container.border_radius.top_left', value);
                    self.setSettingValue('container.border_radius.top_right', value);
                    self.setSettingValue('container.border_radius.bottom_right', value);
                    self.setSettingValue('container.border_radius.bottom_left', value);
                } else {
                    self.setSettingValue('container.border_radius.' + $(this).data('corner'), value);
                }
                self.updateRadiusPreview();
                self.renderPreview();
            });

            // Item padding link
            $(document).off('click', '#fsm-item-padding-link').on('click', '#fsm-item-padding-link', function() {
                self.itemPaddingLinked = !self.itemPaddingLinked;
                $(this).toggleClass('linked', self.itemPaddingLinked);
                $(this).find('i').attr('class', self.itemPaddingLinked ? 'fas fa-link' : 'fas fa-unlink');
            });

            // Item padding inputs - use setSettingValue for responsive support
            $(document).off('input', '[data-item-padding]').on('input', '[data-item-padding]', function() {
                const value = parseInt($(this).val()) || 0;
                if (self.itemPaddingLinked) {
                    $('[data-item-padding]').val(value);
                    self.setSettingValue('item.padding.top', value);
                    self.setSettingValue('item.padding.right', value);
                    self.setSettingValue('item.padding.bottom', value);
                    self.setSettingValue('item.padding.left', value);
                } else {
                    self.setSettingValue('item.padding.' + $(this).data('item-padding'), value);
                }
                self.renderPreview();
            });

            // Delete item
            $(document).off('click', '.fsm-btn-delete').on('click', '.fsm-btn-delete', function() {
                const id = parseInt($(this).data('id'));
                self.items = self.items.filter(i => i.id !== id);
                self.renderPanel();
                self.renderPreview();
            });

            // Edit item
            $(document).off('click', '.fsm-btn-edit').on('click', '.fsm-btn-edit', function() {
                const id = parseInt($(this).data('id'));
                self.showEditModal(id);
            });

            // Add item
            $(document).off('click', '#fsm-add-item').on('click', '#fsm-add-item', function() {
                const newId = self.items.length > 0 ? Math.max(...self.items.map(i => i.id)) + 1 : 1;
                self.items.push({
                    id: newId,
                    icon_type: 'fontawesome',
                    icon: 'fa-link',
                    icon_size: null,
                    label: 'New Item',
                    url: '#',
                    target: '_self'
                });
                self.renderPanel();
                self.renderPreview();
                self.showEditModal(newId);
            });

            // Save to Draft
            $(document).off('click', '#fsm-save-draft').on('click', '#fsm-save-draft', function() {
                self.saveDraft();
            });

            // Publish
            $(document).off('click', '#fsm-publish').on('click', '#fsm-publish', function() {
                self.publish();
            });

            // Reset to Default
            $(document).off('click', '#fsm-reset-default').on('click', '#fsm-reset-default', function() {
                if (confirm('รีเซ็ตทุกการตั้งค่ากลับเป็นค่าเริ่มต้น? (ต้องกด Publish เพื่อบันทึก)')) {
                    self.settings = JSON.parse(JSON.stringify(fsmData.defaults));
                    // Ensure responsive objects after reset
                    self.ensureResponsiveObjects(self.settings);
                    self.items = [
                        { id: 1, icon_type: 'fontawesome', icon: 'fa-home', icon_size: null, label: 'Home', url: '#', target: '_self' },
                        { id: 2, icon_type: 'fontawesome', icon: 'fa-info-circle', icon_size: null, label: 'About', url: '#about', target: '_self' },
                        { id: 3, icon_type: 'fontawesome', icon: 'fa-envelope', icon_size: null, label: 'Contact', url: '#contact', target: '_self' }
                    ];
                    self.currentBreakpoint = 'desktop';
                    self.status = 'draft';
                    self.renderPanel();
                    self.renderPreview();
                    self.showToast('Reset to default (not published)', 'info');
                }
            });
            
            // Discard Changes (Reset to Published)
            $(document).off('click', '#fsm-reset-saved').on('click', '#fsm-reset-saved', function() {
                if (confirm('ยกเลิกการแก้ไขทั้งหมดและกลับไปค่าที่ Publish ล่าสุด?')) {
                    self.settings = JSON.parse(JSON.stringify(self.publishedSettings));
                    // Ensure responsive objects after discard
                    self.ensureResponsiveObjects(self.settings);
                    self.items = JSON.parse(JSON.stringify(self.publishedItems));
                    self.currentBreakpoint = 'desktop';
                    self.status = 'published';
                    self.discardDraft();
                    self.renderPanel();
                    self.renderPreview();
                    self.showToast('Changes discarded', 'info');
                }
            });

            // Export
            $(document).off('click', '#fsm-export').on('click', '#fsm-export', function() {
                // Include responsive settings (tablet, mobile, breakpoints)
                const data = { 
                    settings: self.settings, 
                    items: self.items,
                    version: '2.0.0' // Add version for future compatibility
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'floating-side-menu-settings.json';
                a.click();
                URL.revokeObjectURL(url);
            });

            // Import
            $(document).off('click', '#fsm-import').on('click', '#fsm-import', function() {
                $('#fsm-import-file').click();
            });

            $(document).off('change', '#fsm-import-file').on('change', '#fsm-import-file', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const data = JSON.parse(e.target.result);
                            if (data.settings) {
                                self.settings = data.settings;
                                // Ensure responsive objects after import
                                self.ensureResponsiveObjects(self.settings);
                            }
                            if (data.items) {
                                // Check icon_url for external hosts
                                const currentHost = fsmData.siteUrl;
                                let hasExternalIcons = false;
                                
                                data.items = data.items.map(item => {
                                    if (item.icon_type === 'image' && item.icon_url) {
                                        // Check if icon_url is from different host
                                        if (!item.icon_url.startsWith(currentHost)) {
                                            hasExternalIcons = true;
                                            // Clear external URL, keep icon_type as image so user knows to upload
                                            item.icon_url = '';
                                        }
                                    }
                                    return item;
                                });
                                
                                self.items = data.items;
                                
                                if (hasExternalIcons) {
                                    self.showToast('บาง icon เป็นของ host อื่น กรุณาอัพโหลดใหม่', 'warning');
                                }
                            }
                            // Reset to desktop view after import
                            self.currentBreakpoint = 'desktop';
                            self.renderPanel();
                            self.renderPreview();
                            self.showToast('Settings imported!', 'success');
                        } catch (err) {
                            self.showToast('Invalid JSON file', 'error');
                        }
                    };
                    reader.readAsText(file);
                }
            });

            // Drag & drop
            this.initDragDrop();
        },


        initDragDrop: function() {
            const self = this;
            const list = document.getElementById('fsm-items-list');
            if (!list) return;

            let draggedItem = null;
            let draggedIndex = -1;

            $(list).find('.fsm-item-row').each(function(index) {
                const row = this;
                
                row.addEventListener('dragstart', function(e) {
                    draggedItem = this;
                    draggedIndex = index;
                    this.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });

                row.addEventListener('dragend', function() {
                    this.classList.remove('dragging');
                    draggedItem = null;
                    draggedIndex = -1;
                    $(list).find('.fsm-drag-placeholder').remove();
                });

                row.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    if (this === draggedItem) return;
                    
                    const rect = this.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    
                    $(list).find('.fsm-drag-placeholder').remove();
                    const placeholder = $('<div class="fsm-drag-placeholder">Drop here</div>');
                    
                    if (e.clientY < midY) {
                        $(this).before(placeholder);
                    } else {
                        $(this).after(placeholder);
                    }
                });

                row.addEventListener('drop', function(e) {
                    e.preventDefault();
                    if (this === draggedItem) return;
                    
                    const rect = this.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    const dropIndex = $(this).index();
                    
                    const item = self.items.splice(draggedIndex, 1)[0];
                    const newIndex = e.clientY < midY ? dropIndex : dropIndex + 1;
                    self.items.splice(newIndex > draggedIndex ? newIndex - 1 : newIndex, 0, item);
                    
                    self.renderPanel();
                    self.renderPreview();
                });
            });
        },

        showEditModal: function(itemId) {
            const self = this;
            const item = this.items.find(i => i.id === itemId);
            if (!item) return;

            const iconHtml = this.getIconPreview(item);

            const modal = $(`
                <div class="fsm-modal-overlay">
                    <div class="fsm-modal fsm-edit-modal">
                        <div class="fsm-modal-header">
                            <span class="fsm-modal-title">Edit Menu Item</span>
                            <button class="fsm-modal-close"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="fsm-modal-body">
                            <div class="fsm-edit-icon-section">
                                <button class="fsm-edit-icon-btn" id="fsm-change-icon">${iconHtml}</button>
                                <span class="fsm-edit-icon-hint">Click to change icon</span>
                            </div>
                            <div class="fsm-edit-form">
                                <div class="fsm-group">
                                    <label class="fsm-label">Label</label>
                                    <input type="text" class="fsm-input" id="fsm-edit-label" value="${this.escapeHtml(item.label)}">
                                </div>
                                <div class="fsm-group">
                                    <label class="fsm-label">URL</label>
                                    <input type="text" class="fsm-input" id="fsm-edit-url" value="${this.escapeHtml(item.url)}">
                                </div>
                                <div class="fsm-grid">
                                    <div class="fsm-group">
                                        <label class="fsm-label">Icon Size (px)</label>
                                        <input type="number" class="fsm-input" id="fsm-edit-icon-size" value="${item.icon_size || ''}" placeholder="Default">
                                    </div>
                                    <div class="fsm-group">
                                        <label class="fsm-label">Target</label>
                                        <select class="fsm-select" id="fsm-edit-target">
                                            <option value="_self" ${item.target === '_self' ? 'selected' : ''}>Same Tab</option>
                                            <option value="_blank" ${item.target === '_blank' ? 'selected' : ''}>New Tab</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="fsm-modal-footer">
                            <button class="fsm-btn fsm-btn-primary" id="fsm-save-item" style="width:100%"><i class="fas fa-check"></i> Save Changes</button>
                        </div>
                    </div>
                </div>
            `);

            $('body').append(modal);

            const closeModal = () => modal.remove();
            modal.find('.fsm-modal-close').on('click', closeModal);
            modal.on('click', function(e) { if (e.target === this) closeModal(); });

            modal.find('#fsm-change-icon').on('click', function() {
                self.showIconPicker(itemId, function() {
                    $(this).html(self.getIconPreview(item));
                }.bind(this));
            });

            modal.find('#fsm-save-item').on('click', function() {
                item.label = modal.find('#fsm-edit-label').val();
                item.url = modal.find('#fsm-edit-url').val();
                const iconSize = modal.find('#fsm-edit-icon-size').val();
                item.icon_size = iconSize ? parseInt(iconSize) : null;
                item.target = modal.find('#fsm-edit-target').val();
                
                closeModal();
                self.renderPanel();
                self.renderPreview();
                self.showToast('Item updated!', 'success');
            });
        },


        showIconPicker: function(itemId, callback) {
            const self = this;
            const item = this.items.find(i => i.id === itemId);
            const currentType = item ? item.icon_type : 'fontawesome';

            const faIcons = [
                'fa-home', 'fa-user', 'fa-envelope', 'fa-phone', 'fa-cog', 'fa-star',
                'fa-heart', 'fa-search', 'fa-shopping-cart', 'fa-bell', 'fa-calendar',
                'fa-camera', 'fa-comment', 'fa-download', 'fa-edit', 'fa-file',
                'fa-folder', 'fa-globe', 'fa-image', 'fa-info-circle', 'fa-link',
                'fa-list', 'fa-lock', 'fa-map-marker-alt', 'fa-music', 'fa-paper-plane',
                'fa-play', 'fa-plus', 'fa-question-circle', 'fa-share', 'fa-sign-in-alt',
                'fa-tag', 'fa-thumbs-up', 'fa-trash', 'fa-upload', 'fa-video',
                'fa-building', 'fa-briefcase', 'fa-chart-bar', 'fa-clipboard', 'fa-code'
            ];

            const dashicons = [
                'dashicons-admin-home', 'dashicons-admin-users', 'dashicons-admin-settings',
                'dashicons-admin-post', 'dashicons-admin-media', 'dashicons-admin-page',
                'dashicons-email', 'dashicons-phone', 'dashicons-calendar', 'dashicons-location',
                'dashicons-star-filled', 'dashicons-heart', 'dashicons-cart', 'dashicons-search',
                'dashicons-share', 'dashicons-facebook', 'dashicons-twitter', 'dashicons-instagram'
            ];

            const modal = $(`
                <div class="fsm-modal-overlay">
                    <div class="fsm-modal fsm-icon-picker-modal">
                        <div class="fsm-modal-header">
                            <span class="fsm-modal-title">Select Icon</span>
                            <button class="fsm-modal-close"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="fsm-icon-tabs">
                            <button class="fsm-icon-tab ${currentType === 'fontawesome' ? 'active' : ''}" data-type="fontawesome">
                                <i class="fas fa-font-awesome"></i> Font Awesome
                            </button>
                            <button class="fsm-icon-tab ${currentType === 'dashicons' ? 'active' : ''}" data-type="dashicons">
                                <span class="dashicons dashicons-wordpress"></span> Dashicons
                            </button>
                            <button class="fsm-icon-tab ${currentType === 'image' ? 'active' : ''}" data-type="image">
                                <i class="fas fa-image"></i> Image
                            </button>
                        </div>
                        <div class="fsm-modal-body">
                            <div class="fsm-icon-content ${currentType === 'fontawesome' ? 'active' : ''}" data-content="fontawesome">
                                <input type="text" class="fsm-icon-search" placeholder="Search icons...">
                                <div class="fsm-icon-grid">
                                    ${faIcons.map(icon => `<button class="fsm-icon-option" data-icon="${icon}" data-type="fontawesome"><i class="fas ${icon}"></i></button>`).join('')}
                                </div>
                            </div>
                            <div class="fsm-icon-content ${currentType === 'dashicons' ? 'active' : ''}" data-content="dashicons">
                                <input type="text" class="fsm-icon-search" placeholder="Search icons...">
                                <div class="fsm-icon-grid">
                                    ${dashicons.map(icon => `<button class="fsm-icon-option" data-icon="${icon}" data-type="dashicons"><span class="dashicons ${icon}"></span></button>`).join('')}
                                </div>
                            </div>
                            <div class="fsm-icon-content ${currentType === 'image' ? 'active' : ''}" data-content="image">
                                <div class="fsm-image-upload">
                                    <button class="fsm-media-btn" id="fsm-media-select">
                                        <i class="fas fa-cloud-upload-alt"></i> Select from Media Library
                                    </button>
                                    <div class="fsm-image-preview" id="fsm-image-preview" style="${item && item.icon_url ? '' : 'display:none'}">
                                        <img src="${item && item.icon_url ? item.icon_url : ''}" alt="">
                                        <button class="fsm-remove-image" id="fsm-remove-image"><i class="fas fa-times"></i></button>
                                    </div>
                                    <input type="hidden" id="fsm-image-url" value="${item && item.icon_url ? item.icon_url : ''}">
                                </div>
                            </div>
                        </div>
                        <div class="fsm-modal-footer" id="fsm-image-footer" style="${currentType === 'image' ? '' : 'display:none'}">
                            <button class="fsm-btn fsm-btn-primary" id="fsm-save-image" style="width:100%"><i class="fas fa-check"></i> Use This Image</button>
                        </div>
                    </div>
                </div>
            `);

            $('body').append(modal);

            const closeModal = () => modal.remove();
            modal.find('.fsm-modal-close').on('click', closeModal);
            modal.on('click', function(e) { if (e.target === this) closeModal(); });

            // Tab switching
            modal.find('.fsm-icon-tab').on('click', function() {
                modal.find('.fsm-icon-tab').removeClass('active');
                $(this).addClass('active');
                const type = $(this).data('type');
                modal.find('.fsm-icon-content').removeClass('active');
                modal.find(`.fsm-icon-content[data-content="${type}"]`).addClass('active');
                modal.find('#fsm-image-footer').toggle(type === 'image');
            });

            // Search
            modal.find('.fsm-icon-search').on('input', function() {
                const search = $(this).val().toLowerCase();
                $(this).siblings('.fsm-icon-grid').find('.fsm-icon-option').each(function() {
                    $(this).toggle($(this).data('icon').toLowerCase().includes(search));
                });
            });

            // Icon selection
            modal.find('.fsm-icon-option').on('click', function() {
                if (item) {
                    item.icon_type = $(this).data('type');
                    item.icon = $(this).data('icon');
                    item.icon_url = '';
                    if (callback) callback();
                    self.renderPanel();
                    self.renderPreview();
                }
                closeModal();
            });

            // Media Library
            modal.find('#fsm-media-select').on('click', function() {
                if (typeof wp !== 'undefined' && wp.media) {
                    const frame = wp.media({
                        title: 'Select Icon Image',
                        button: { text: 'Use this image' },
                        multiple: false,
                        library: { type: 'image' }
                    });
                    frame.on('select', function() {
                        const attachment = frame.state().get('selection').first().toJSON();
                        modal.find('#fsm-image-url').val(attachment.url);
                        modal.find('#fsm-image-preview img').attr('src', attachment.url);
                        modal.find('#fsm-image-preview').show();
                    });
                    frame.open();
                } else {
                    alert('WordPress Media Library is not available.');
                }
            });

            // Remove image
            modal.find('#fsm-remove-image').on('click', function(e) {
                e.preventDefault();
                modal.find('#fsm-image-url').val('');
                modal.find('#fsm-image-preview').hide();
            });

            // Save image
            modal.find('#fsm-save-image').on('click', function() {
                const url = modal.find('#fsm-image-url').val();
                if (item && url) {
                    item.icon_type = 'image';
                    item.icon_url = url;
                    item.icon = '';
                    if (callback) callback();
                    self.renderPanel();
                    self.renderPreview();
                }
                closeModal();
            });
        },


        renderPreview: function() {
            const frame = document.getElementById('fsm-preview-frame');
            if (!frame) return;
            
            // Update breakpoint badge
            const badge = document.getElementById('fsm-breakpoint-badge');
            if (badge) {
                const icon = this.getBreakpointIcon(this.currentBreakpoint);
                const label = this.getBreakpointLabel(this.currentBreakpoint);
                badge.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
                badge.className = 'fsm-breakpoint-badge fsm-bp-' + this.currentBreakpoint;
            }
            
            // Use getSettingValue for responsive support
            const s = this.settings;
            const position = {
                side: this.getSettingValue('position.side'),
                vertical: this.getSettingValue('position.vertical'),
                vertical_unit: this.getSettingValue('position.vertical_unit'),
                margin: this.getSettingValue('position.margin')
            };
            const c = {
                background_color: this.getSettingValue('container.background_color'),
                width: this.getSettingValue('container.width'),
                gap: this.getSettingValue('container.gap'),
                padding: {
                    top: this.getSettingValue('container.padding.top'),
                    right: this.getSettingValue('container.padding.right'),
                    bottom: this.getSettingValue('container.padding.bottom'),
                    left: this.getSettingValue('container.padding.left')
                },
                border_radius: {
                    top_left: this.getSettingValue('container.border_radius.top_left'),
                    top_right: this.getSettingValue('container.border_radius.top_right'),
                    bottom_right: this.getSettingValue('container.border_radius.bottom_right'),
                    bottom_left: this.getSettingValue('container.border_radius.bottom_left')
                },
                box_shadow: {
                    x: this.getSettingValue('container.box_shadow.x'),
                    y: this.getSettingValue('container.box_shadow.y'),
                    blur: this.getSettingValue('container.box_shadow.blur'),
                    spread: this.getSettingValue('container.box_shadow.spread'),
                    color: this.getSettingValue('container.box_shadow.color')
                }
            };
            const t = {
                font_family: this.getSettingValue('typography.font_family'),
                font_size: this.getSettingValue('typography.font_size'),
                font_weight: this.getSettingValue('typography.font_weight'),
                line_height: this.getSettingValue('typography.line_height'),
                text_color: this.getSettingValue('typography.text_color'),
                hover_text_color: this.getSettingValue('typography.hover_text_color'),
                active_text_color: this.getSettingValue('typography.active_text_color'),
                text_align: this.getSettingValue('typography.text_align')
            };
            const i = {
                size: this.getSettingValue('icon.size'),
                color: this.getSettingValue('icon.color'),
                hover_color: this.getSettingValue('icon.hover_color'),
                active_color: this.getSettingValue('icon.active_color'),
                spacing: this.getSettingValue('icon.spacing'),
                position: this.getSettingValue('icon.position'),
                align: this.getSettingValue('icon.align')
            };
            const h = s.hover || {};
            const tg = {
                enabled: this.getSettingValue('toggle.enabled'),
                icon_open: this.getSettingValue('toggle.icon_open'),
                icon_closed: this.getSettingValue('toggle.icon_closed'),
                icon_size: this.getSettingValue('toggle.icon_size'),
                icon_rotate: this.getSettingValue('toggle.icon_rotate'),
                background_color: this.getSettingValue('toggle.background_color'),
                icon_color: this.getSettingValue('toggle.icon_color'),
                hover_background: this.getSettingValue('toggle.hover_background'),
                hover_icon_color: this.getSettingValue('toggle.hover_icon_color'),
                size: this.getSettingValue('toggle.size'),
                width: this.getSettingValue('toggle.width'),
                border_radius: this.getSettingValue('toggle.border_radius'),
                align: this.getSettingValue('toggle.align')
            };
            const br = c.border_radius;
            const bs = c.box_shadow;
            const p = c.padding;
            
            // Get font family for preview
            const fonts = fsmData.fonts || {};
            let fontFamily = t.font_family;
            if (fontFamily === 'inherit') {
                // Use Elementor primary font if available
                if (fonts.elementor_primary) {
                    fontFamily = `'${fonts.elementor_primary}', sans-serif`;
                } else {
                    fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
                }
            }

            const item = {
                padding: {
                    top: this.getSettingValue('item.padding.top') || 12,
                    right: this.getSettingValue('item.padding.right') || 12,
                    bottom: this.getSettingValue('item.padding.bottom') || 12,
                    left: this.getSettingValue('item.padding.left') || 12
                },
                border_radius: this.getSettingValue('item.border_radius') || 8,
                first_last_radius: this.getSettingValue('item.first_last_radius') || 'container',
                background_color: this.getSettingValue('item.background_color') || 'transparent',
                hover_background: this.getSettingValue('item.hover_background') || 'rgba(255,255,255,0.1)',
                active_background: this.getSettingValue('item.active_background') || 'rgba(255,255,255,0.15)',
                transition_duration: this.getSettingValue('item.transition_duration') || 200
            };
            const itemPad = item.padding;

            let itemsHtml = this.items.map(menuItem => {
                const iconSize = menuItem.icon_size || i.size;
                let iconHtml = '';
                
                if (menuItem.icon_type === 'image' && menuItem.icon_url) {
                    const isSvg = menuItem.icon_url.toLowerCase().endsWith('.svg') || menuItem.icon_url.includes('image/svg');
                    if (isSvg) {
                        // Use data attribute to load SVG inline later
                        iconHtml = `<span class="fsm-preview-icon-svg-inline" data-svg-url="${menuItem.icon_url}" style="width:${iconSize}px;height:${iconSize}px;"><img src="${menuItem.icon_url}" class="fsm-preview-icon-svg" style="width:${iconSize}px;height:${iconSize}px;object-fit:contain;"></span>`;
                    } else {
                        iconHtml = `<img src="${menuItem.icon_url}" alt="" style="width:${iconSize}px;height:${iconSize}px;object-fit:contain;">`;
                    }
                } else if (menuItem.icon_type === 'dashicons' && menuItem.icon) {
                    iconHtml = `<span class="dashicons ${menuItem.icon}" style="font-size:${iconSize}px;width:${iconSize}px;height:${iconSize}px;"></span>`;
                } else if (menuItem.icon) {
                    iconHtml = `<i class="fas ${menuItem.icon}" style="font-size:${iconSize}px;"></i>`;
                }
                
                return `<a href="#" class="fsm-preview-item">${iconHtml}<span>${this.escapeHtml(menuItem.label)}</span></a>`;
            }).join('');

            const isLeft = position.side === 'left';
            const navRadius = `${br.top_left}px ${br.top_right}px ${br.bottom_right}px ${br.bottom_left}px`;
            const toggleRadius = isLeft ? '0 8px 8px 0' : '8px 0 0 8px';
            const toggleIconOpen = tg.icon_open || 'fa-chevron-left';
            const toggleIconClosed = tg.icon_closed || 'fa-chevron-right';
            const toggleIconColor = tg.icon_color || '#ffffff';
            const hoverTextColor = h.text_color || '#ffffff';

            frame.innerHTML = `
                <style>
                    .fsm-preview-wrap { 
                        position: absolute; 
                        ${position.side}: 0; 
                        top: ${position.vertical}${position.vertical_unit}; 
                        transform: translateY(-50%);
                        display: flex;
                        align-items: ${this.getToggleAlign(tg.align || 'middle')};
                    }
                    .fsm-preview-toggle {
                        background: ${tg.background_color};
                        width: ${tg.width || 28}px;
                        height: ${tg.size || 50}px;
                        border: none;
                        border-radius: ${toggleRadius};
                        color: ${toggleIconColor};
                        cursor: pointer;
                        display: ${tg.enabled ? 'flex' : 'none'};
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        order: ${isLeft ? '2' : '1'};
                        transition: all 0.2s ease;
                    }
                    .fsm-preview-toggle:hover {
                        background: ${tg.hover_background || 'rgba(255,255,255,0.1)'};
                    }
                    .fsm-preview-toggle:hover i {
                        color: ${tg.hover_icon_color || '#ffffff'};
                    }
                    .fsm-preview-toggle i {
                        color: ${toggleIconColor};
                        font-size: ${tg.icon_size || 14}px;
                        transform: rotate(${tg.icon_rotate || 0}deg);
                        transition: transform 0.2s ease;
                    }
                    .fsm-preview-nav { 
                        background: ${c.background_color};
                        border-radius: ${navRadius};
                        padding: ${p.top}px ${p.right}px ${p.bottom}px ${p.left}px;
                        box-shadow: ${bs.x}px ${bs.y}px ${bs.blur}px ${bs.spread}px ${bs.color};
                        width: ${c.width}px;
                        gap: ${c.gap || 0}px;
                        display: flex;
                        flex-direction: column;
                        order: ${isLeft ? '1' : '2'};
                    }
                    .fsm-preview-item {
                        display: flex;
                        flex-direction: ${i.position === 'top' ? 'column' : 'row'};
                        align-items: ${this.getAlignValue(i.align || 'center')};
                        justify-content: ${this.getAlignValue(i.align || 'center')};
                        text-align: ${t.text_align || 'center'};
                        gap: ${i.spacing}px;
                        padding: ${itemPad.top}px ${itemPad.right}px ${itemPad.bottom}px ${itemPad.left}px;
                        background: ${item.background_color || 'transparent'};
                        color: ${t.text_color};
                        text-decoration: none;
                        font-size: ${t.font_size}px;
                        font-weight: ${t.font_weight};
                        font-family: ${fontFamily};
                        transition: all ${item.transition_duration || 200}ms ease;
                        border-radius: ${item.border_radius || 8}px;
                    }
                    ${this.getFirstLastRadiusPreviewCSS(item, br)}
                    .fsm-preview-item span {
                        text-align: ${t.text_align || 'center'};
                        width: 100%;
                        line-height: ${t.line_height || 1.4};
                        white-space: normal;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                    }
                    .fsm-preview-item i, .fsm-preview-item .dashicons { color: ${i.color}; }
                    .fsm-preview-item .fsm-preview-icon-svg { filter: ${hexToFilter(i.color)}; }
                    .fsm-preview-item .fsm-preview-icon-svg-inline { color: ${i.color}; display: flex; align-items: center; justify-content: center; }
                    .fsm-preview-item .fsm-preview-icon-svg-inline svg { width: ${i.size}px; height: ${i.size}px; fill: currentColor; }
                    .fsm-preview-item:hover { 
                        background: ${item.hover_background || 'rgba(255,255,255,0.1)'}; 
                        color: ${t.hover_text_color || hoverTextColor};
                    }
                    .fsm-preview-item:hover span:not(.fsm-preview-icon-svg-inline) {
                        color: ${t.hover_text_color || hoverTextColor};
                    }
                    .fsm-preview-item:hover i,
                    .fsm-preview-item:hover .dashicons { color: ${i.hover_color || '#ffffff'}; }
                    .fsm-preview-item:hover .fsm-preview-icon-svg { filter: ${hexToFilter(i.hover_color || '#ffffff')}; }
                    .fsm-preview-item:hover .fsm-preview-icon-svg-inline { color: ${i.hover_color || '#ffffff'}; }
                    .fsm-preview-item:active {
                        background: ${item.active_background || 'rgba(255,255,255,0.15)'};
                        color: ${t.active_text_color || '#ffffff'};
                    }
                    .fsm-preview-item:active span:not(.fsm-preview-icon-svg-inline) {
                        color: ${t.active_text_color || '#ffffff'};
                    }
                    .fsm-preview-item:active i,
                    .fsm-preview-item:active .dashicons { color: ${i.active_color || '#ffffff'}; }
                    .fsm-preview-item:active .fsm-preview-icon-svg { filter: ${hexToFilter(i.active_color || '#ffffff')}; }
                    .fsm-preview-item:active .fsm-preview-icon-svg-inline { color: ${i.active_color || '#ffffff'}; }
                </style>
                <div class="fsm-preview-wrap">
                    <button class="fsm-preview-toggle" id="fsm-preview-toggle"><i class="fas ${toggleIconOpen}"></i></button>
                    <div class="fsm-preview-nav" id="fsm-preview-nav">${itemsHtml}</div>
                </div>
            `;

            // Toggle functionality with animation - move entire menu
            const toggle = frame.querySelector('#fsm-preview-toggle');
            const nav = frame.querySelector('#fsm-preview-nav');
            const wrap = frame.querySelector('.fsm-preview-wrap');
            const animType = s.animation?.type || 'slide';
            const animDuration = s.animation?.duration || 300;
            const animEasing = s.animation?.easing || 'ease-out';
            let isOpen = true;

            // Set initial transition on wrapper
            if (wrap) {
                wrap.style.transition = `${s.position.side} ${animDuration}ms ${animEasing}`;
            }

            if (toggle) {
                toggle.addEventListener('click', function() {
                    isOpen = !isOpen;
                    
                    if (animType === 'slide') {
                        // Slide: move entire menu by nav width only (toggle stays at edge)
                        const offset = isOpen ? '0' : `-${c.width}px`;
                        wrap.style[s.position.side] = offset;
                    } else if (animType === 'fade') {
                        nav.style.transition = `opacity ${animDuration}ms ${animEasing}`;
                        nav.style.opacity = isOpen ? '1' : '0';
                    } else if (animType === 'scale') {
                        nav.style.transition = `transform ${animDuration}ms ${animEasing}, opacity ${animDuration}ms ${animEasing}`;
                        nav.style.transform = isOpen ? 'scale(1)' : 'scale(0.8)';
                        nav.style.opacity = isOpen ? '1' : '0';
                    }
                    
                    this.querySelector('i').className = `fas ${isOpen ? toggleIconOpen : toggleIconClosed}`;
                });
            }
            
            // Load inline SVGs for accurate color control
            this.loadInlineSvgs(frame);
        },
        
        /**
         * Load SVG files and inline them for color control
         */
        loadInlineSvgs: function(container) {
            const svgContainers = container.querySelectorAll('.fsm-preview-icon-svg-inline[data-svg-url]');
            
            svgContainers.forEach(el => {
                const url = el.dataset.svgUrl;
                if (!url) return;
                
                fetch(url)
                    .then(response => response.text())
                    .then(svgContent => {
                        // Check if it's valid SVG
                        if (svgContent.includes('<svg')) {
                            // Clean up SVG
                            let cleanSvg = svgContent
                                .replace(/<\?xml[^>]*\?>/g, '')
                                .replace(/<!DOCTYPE[^>]*>/g, '')
                                .replace(/<!--.*?-->/gs, '');
                            
                            // Check if outline style (fill="none")
                            const isOutline = cleanSvg.includes('fill="none"');
                            
                            if (isOutline) {
                                // Change stroke to currentColor
                                cleanSvg = cleanSvg.replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"');
                            } else {
                                // Change fill to currentColor
                                cleanSvg = cleanSvg.replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"');
                            }
                            
                            el.innerHTML = cleanSvg;
                            
                            // Apply size to SVG
                            const svg = el.querySelector('svg');
                            if (svg) {
                                svg.style.width = el.style.width;
                                svg.style.height = el.style.height;
                            }
                        }
                    })
                    .catch(() => {
                        // Keep the img fallback
                    });
            });
        },

        updateSetting: function(path, value) {
            const keys = path.split('.');
            let obj = this.settings;
            for (let i = 0; i < keys.length - 1; i++) {
                obj = obj[keys[i]];
            }
            obj[keys[keys.length - 1]] = value;
        },

        updateRadiusPreview: function() {
            const br = this.settings.container.border_radius;
            const preview = document.getElementById('fsm-radius-preview');
            if (preview) {
                preview.style.borderRadius = `${br.top_left}px ${br.top_right}px ${br.bottom_right}px ${br.bottom_left}px`;
            }
        },

        save: function() {
            // Legacy save - now redirects to publish
            this.publish();
        },

        saveDraft: function() {
            const self = this;
            const toast = this.showToast('Saving draft...', 'loading');

            $.ajax({
                url: fsmData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fsm_save',
                    nonce: fsmData.nonce,
                    settings: JSON.stringify(this.settings),
                    items: JSON.stringify(this.items),
                    save_type: 'draft'
                },
                success: function(response) {
                    if (response.success) {
                        self.savedSettings = JSON.parse(JSON.stringify(self.settings));
                        self.savedItems = JSON.parse(JSON.stringify(self.items));
                        self.status = 'draft';
                        // Refresh history
                        self.refreshHistory();
                        self.renderPanel();
                        self.updateToast(toast, 'Draft saved!', 'success');
                    } else {
                        self.updateToast(toast, 'Error saving draft', 'error');
                    }
                },
                error: function() {
                    self.updateToast(toast, 'Error saving draft', 'error');
                }
            });
        },

        publish: function() {
            const self = this;
            const toast = this.showToast('Publishing...', 'loading');

            $.ajax({
                url: fsmData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fsm_save',
                    nonce: fsmData.nonce,
                    settings: JSON.stringify(this.settings),
                    items: JSON.stringify(this.items),
                    save_type: 'publish'
                },
                success: function(response) {
                    if (response.success) {
                        // Update all states
                        self.savedSettings = JSON.parse(JSON.stringify(self.settings));
                        self.savedItems = JSON.parse(JSON.stringify(self.items));
                        self.publishedSettings = JSON.parse(JSON.stringify(self.settings));
                        self.publishedItems = JSON.parse(JSON.stringify(self.items));
                        self.status = 'published';
                        // Refresh history
                        self.refreshHistory();
                        self.renderPanel();
                        self.updateToast(toast, 'Published!', 'success');
                    } else {
                        self.updateToast(toast, 'Error publishing', 'error');
                    }
                },
                error: function() {
                    self.updateToast(toast, 'Error publishing', 'error');
                }
            });
        },

        refreshHistory: function() {
            const self = this;
            $.ajax({
                url: fsmData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fsm_get_history',
                    nonce: fsmData.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.history = response.data.history;
                    }
                }
            });
        },

        discardDraft: function() {
            $.ajax({
                url: fsmData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fsm_discard_draft',
                    nonce: fsmData.nonce
                }
            });
        },

        // History Functions
        showHistoryModal: function() {
            const self = this;
            
            const modal = $(`
                <div class="fsm-modal-overlay" id="fsm-history-modal">
                    <div class="fsm-modal fsm-history-modal">
                        <div class="fsm-modal-header">
                            <span class="fsm-modal-title"><i class="fas fa-history"></i> Version History</span>
                            <button class="fsm-modal-close"><i class="fas fa-times"></i></button>
                        </div>
                        <div class="fsm-history-header">
                            <div class="fsm-history-tabs">
                                <button class="fsm-history-tab ${this.historyFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                                <button class="fsm-history-tab ${this.historyFilter === 'publish' ? 'active' : ''}" data-filter="publish">Published</button>
                                <button class="fsm-history-tab ${this.historyFilter === 'draft' ? 'active' : ''}" data-filter="draft">Drafts</button>
                            </div>
                            <button class="fsm-history-clear" id="fsm-clear-history"><i class="fas fa-trash"></i> Clear All</button>
                        </div>
                        <div class="fsm-modal-body">
                            <div class="fsm-history-list" id="fsm-history-list">
                                ${this.renderHistoryList()}
                            </div>
                        </div>
                    </div>
                </div>
            `);

            $('body').append(modal);

            // Close modal
            modal.find('.fsm-modal-close').on('click', function() {
                modal.remove();
            });

            modal.on('click', function(e) {
                if ($(e.target).hasClass('fsm-modal-overlay')) {
                    modal.remove();
                }
            });

            // Filter tabs
            modal.find('.fsm-history-tab').on('click', function() {
                modal.find('.fsm-history-tab').removeClass('active');
                $(this).addClass('active');
                self.historyFilter = $(this).data('filter');
                modal.find('#fsm-history-list').html(self.renderHistoryList());
            });

            // Clear all history
            modal.find('#fsm-clear-history').on('click', function() {
                if (confirm('ลบประวัติทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
                    self.clearHistory(modal);
                }
            });

            // Restore as publish
            modal.on('click', '.fsm-history-btn-restore', function() {
                const id = $(this).data('id');
                self.rollback(id, false, modal);
            });

            // Restore as draft
            modal.on('click', '.fsm-history-btn-draft', function() {
                const id = $(this).data('id');
                self.rollback(id, true, modal);
            });

            // Delete single entry
            modal.on('click', '.fsm-history-btn-delete', function() {
                const id = $(this).data('id');
                if (confirm('ลบประวัตินี้?')) {
                    self.deleteHistoryEntry(id, modal);
                }
            });
        },

        renderHistoryList: function() {
            let filtered = this.history;
            
            if (this.historyFilter !== 'all') {
                filtered = this.history.filter(h => h.type === this.historyFilter);
            }

            if (filtered.length === 0) {
                return `
                    <div class="fsm-history-empty">
                        <i class="fas fa-inbox"></i>
                        <p>No history found</p>
                    </div>
                `;
            }

            // Find the latest published version (first publish in history)
            const latestPublishId = this.history.find(h => h.type === 'publish')?.id;

            return filtered.map(entry => {
                const date = new Date(entry.timestamp * 1000);
                const timeAgo = this.timeAgo(date);
                const formattedDate = date.toLocaleDateString('th-TH', { 
                    day: 'numeric', 
                    month: 'short', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const isCurrentLive = entry.type === 'publish' && entry.id === latestPublishId;
                const currentBadge = isCurrentLive ? '<span class="fsm-history-badge current"><i class="fas fa-check-circle"></i> Current</span>' : '';
                const itemClass = isCurrentLive ? 'fsm-history-item fsm-history-current' : 'fsm-history-item';

                return `
                    <div class="${itemClass}" data-id="${entry.id}">
                        <div class="fsm-history-icon ${entry.type}">
                            <i class="fas ${entry.type === 'publish' ? 'fa-cloud-upload-alt' : 'fa-file-alt'}"></i>
                        </div>
                        <div class="fsm-history-info">
                            <div class="fsm-history-label">
                                ${this.escapeHtml(entry.label)}
                                <span class="fsm-history-badge ${entry.type}">${entry.type === 'publish' ? 'Published' : 'Draft'}</span>
                                ${currentBadge}
                            </div>
                            <div class="fsm-history-meta">
                                <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                                <span><i class="fas fa-list"></i> ${entry.items_count} items</span>
                                <span title="${formattedDate}"><i class="fas fa-calendar"></i> ${formattedDate}</span>
                            </div>
                        </div>
                        <div class="fsm-history-actions">
                            ${isCurrentLive ? '' : `
                                <button class="fsm-history-btn fsm-history-btn-restore" data-id="${entry.id}" title="Restore & Publish">
                                    <i class="fas fa-redo"></i> Restore
                                </button>
                                <button class="fsm-history-btn fsm-history-btn-draft" data-id="${entry.id}" title="Restore as Draft">
                                    <i class="fas fa-file-alt"></i> As Draft
                                </button>
                            `}
                            <button class="fsm-history-btn fsm-history-btn-delete" data-id="${entry.id}" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        },

        timeAgo: function(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            
            const intervals = {
                year: 31536000,
                month: 2592000,
                week: 604800,
                day: 86400,
                hour: 3600,
                minute: 60
            };

            for (const [unit, secondsInUnit] of Object.entries(intervals)) {
                const interval = Math.floor(seconds / secondsInUnit);
                if (interval >= 1) {
                    return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
                }
            }
            
            return 'Just now';
        },

        rollback: function(historyId, asDraft, modal) {
            const self = this;
            const toast = this.showToast('Restoring...', 'loading');

            $.ajax({
                url: fsmData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fsm_rollback',
                    nonce: fsmData.nonce,
                    history_id: historyId,
                    as_draft: asDraft ? 'true' : 'false'
                },
                success: function(response) {
                    if (response.success) {
                        self.settings = response.data.settings;
                        self.items = response.data.items;
                        self.status = response.data.status;
                        self.history = response.data.history;
                        
                        // Ensure responsive objects after rollback
                        self.ensureResponsiveObjects(self.settings);
                        
                        if (!asDraft) {
                            self.publishedSettings = JSON.parse(JSON.stringify(self.settings));
                            self.publishedItems = JSON.parse(JSON.stringify(response.data.items));
                        }
                        
                        self.savedSettings = JSON.parse(JSON.stringify(self.settings));
                        self.savedItems = JSON.parse(JSON.stringify(self.items));
                        
                        // Reset to desktop view after rollback
                        self.currentBreakpoint = 'desktop';
                        self.renderPanel();
                        self.renderPreview();
                        
                        if (modal) {
                            modal.find('#fsm-history-list').html(self.renderHistoryList());
                        }
                        
                        self.updateToast(toast, response.data.message, 'success');
                    } else {
                        self.updateToast(toast, 'Error restoring', 'error');
                    }
                },
                error: function() {
                    self.updateToast(toast, 'Error restoring', 'error');
                }
            });
        },

        deleteHistoryEntry: function(historyId, modal) {
            const self = this;

            $.ajax({
                url: fsmData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fsm_delete_history',
                    nonce: fsmData.nonce,
                    history_id: historyId
                },
                success: function(response) {
                    if (response.success) {
                        self.history = response.data.history;
                        if (modal) {
                            modal.find('#fsm-history-list').html(self.renderHistoryList());
                        }
                        self.renderPanel();
                        self.showToast('History entry deleted', 'success');
                    }
                }
            });
        },

        clearHistory: function(modal) {
            const self = this;

            $.ajax({
                url: fsmData.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'fsm_clear_history',
                    nonce: fsmData.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.history = [];
                        if (modal) {
                            modal.find('#fsm-history-list').html(self.renderHistoryList());
                        }
                        self.renderPanel();
                        self.showToast('History cleared', 'success');
                    }
                }
            });
        },

        showToast: function(message, type) {
            let container = document.getElementById('fsm-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'fsm-toast-container';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            toast.className = `fsm-toast fsm-toast-${type}`;
            
            let icon = type === 'loading' ? '<i class="fas fa-spinner fa-spin"></i>' :
                       type === 'success' ? '<i class="fas fa-check-circle"></i>' :
                       type === 'warning' ? '<i class="fas fa-exclamation-triangle"></i>' :
                       type === 'info' ? '<i class="fas fa-info-circle"></i>' :
                       '<i class="fas fa-times-circle"></i>';

            toast.innerHTML = `
                <span class="fsm-toast-icon">${icon}</span>
                <span class="fsm-toast-message">${message}</span>
                ${type !== 'loading' ? '<button class="fsm-toast-close"><i class="fas fa-times"></i></button>' : ''}
            `;

            container.appendChild(toast);
            setTimeout(() => toast.classList.add('show'), 10);

            if (type !== 'loading') {
                toast.querySelector('.fsm-toast-close').addEventListener('click', () => this.hideToast(toast));
                setTimeout(() => this.hideToast(toast), type === 'warning' ? 5000 : 3000);
            }

            return toast;
        },

        hideToast: function(toast) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        },

        updateToast: function(toast, message, type) {
            let icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>';
            toast.className = `fsm-toast fsm-toast-${type} show`;
            toast.innerHTML = `
                <span class="fsm-toast-icon">${icon}</span>
                <span class="fsm-toast-message">${message}</span>
                <button class="fsm-toast-close"><i class="fas fa-times"></i></button>
            `;
            toast.querySelector('.fsm-toast-close').addEventListener('click', () => this.hideToast(toast));
            setTimeout(() => this.hideToast(toast), 3000);
        },

        // ==================== Responsive Helper Functions ====================
        
        /**
         * Get setting value with cascade inheritance
         * Desktop → Tablet → Mobile
         * @param {string} path - Setting path like 'container.width', 'toggle.enabled'
         * @param {string} breakpoint - Optional breakpoint, defaults to currentBreakpoint
         */
        getSettingValue: function(path, breakpoint) {
            breakpoint = breakpoint || this.currentBreakpoint;
            const parts = path.split('.');
            
            // Helper to get nested value
            const getNestedValue = (obj, parts) => {
                let value = obj;
                for (const part of parts) {
                    if (value === undefined || value === null) return undefined;
                    value = value[part];
                }
                return value;
            };
            
            // For desktop, just return base value
            if (breakpoint === 'desktop') {
                return getNestedValue(this.settings, parts);
            }
            
            // For tablet, check tablet override first, then desktop
            if (breakpoint === 'tablet') {
                const tabletValue = getNestedValue(this.settings.tablet || {}, parts);
                if (tabletValue !== undefined) return tabletValue;
                return getNestedValue(this.settings, parts);
            }
            
            // For mobile, check mobile → tablet → desktop
            if (breakpoint === 'mobile') {
                const mobileValue = getNestedValue(this.settings.mobile || {}, parts);
                if (mobileValue !== undefined) return mobileValue;
                const tabletValue = getNestedValue(this.settings.tablet || {}, parts);
                if (tabletValue !== undefined) return tabletValue;
                return getNestedValue(this.settings, parts);
            }
            
            return getNestedValue(this.settings, parts);
        },
        
        /**
         * Set setting value for current breakpoint
         * @param {string} path - Setting path
         * @param {*} value - Value to set
         */
        setSettingValue: function(path, value) {
            const parts = path.split('.');
            
            // Helper to set nested value
            const setNestedValue = (obj, parts, value) => {
                let current = obj;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (current[parts[i]] === undefined) {
                        current[parts[i]] = {};
                    }
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
            };
            
            if (this.currentBreakpoint === 'desktop') {
                setNestedValue(this.settings, parts, value);
            } else {
                // For tablet/mobile, store in override object
                if (!this.settings[this.currentBreakpoint]) {
                    this.settings[this.currentBreakpoint] = {};
                }
                setNestedValue(this.settings[this.currentBreakpoint], parts, value);
            }
        },
        
        /**
         * Check if current breakpoint has override for path
         * @param {string} path - Setting path
         */
        hasBreakpointOverride: function(path) {
            if (this.currentBreakpoint === 'desktop') return false;
            
            const parts = path.split('.');
            let value = this.settings[this.currentBreakpoint] || {};
            
            for (const part of parts) {
                if (value === undefined || value === null) return false;
                value = value[part];
            }
            
            return value !== undefined;
        },
        
        /**
         * Remove override for current breakpoint (revert to inherited)
         * @param {string} path - Setting path
         */
        removeBreakpointOverride: function(path) {
            if (this.currentBreakpoint === 'desktop') return;
            
            const parts = path.split('.');
            const override = this.settings[this.currentBreakpoint];
            if (!override) return;
            
            // Navigate to parent and delete the key
            let current = override;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) return;
                current = current[parts[i]];
            }
            delete current[parts[parts.length - 1]];
            
            // Clean up empty objects
            this.cleanupEmptyObjects(this.settings[this.currentBreakpoint], parts.slice(0, -1));
        },
        
        /**
         * Clean up empty nested objects
         */
        cleanupEmptyObjects: function(obj, path) {
            if (!path.length) return;
            
            let current = obj;
            const stack = [];
            
            for (const part of path) {
                if (!current[part]) return;
                stack.push({ obj: current, key: part });
                current = current[part];
            }
            
            // Check from deepest to shallowest
            for (let i = stack.length - 1; i >= 0; i--) {
                const { obj, key } = stack[i];
                if (Object.keys(obj[key]).length === 0) {
                    delete obj[key];
                } else {
                    break;
                }
            }
        },
        
        /**
         * Get inheritance source for a setting
         * @param {string} path - Setting path
         * @returns {string} 'desktop', 'tablet', or null if has own value
         */
        getInheritanceSource: function(path) {
            if (this.currentBreakpoint === 'desktop') return null;
            if (this.hasBreakpointOverride(path)) return null;
            
            if (this.currentBreakpoint === 'mobile') {
                // Check if tablet has override
                const parts = path.split('.');
                let tabletValue = this.settings.tablet || {};
                for (const part of parts) {
                    if (tabletValue === undefined) break;
                    tabletValue = tabletValue[part];
                }
                if (tabletValue !== undefined) return 'tablet';
            }
            
            return 'desktop';
        },
        
        /**
         * Get breakpoint label for display
         */
        getBreakpointLabel: function(bp) {
            const labels = {
                desktop: 'Desktop',
                tablet: 'Tablet',
                mobile: 'Mobile'
            };
            return labels[bp] || bp;
        },
        
        /**
         * Get breakpoint icon
         */
        getBreakpointIcon: function(bp) {
            const icons = {
                desktop: 'fa-desktop',
                tablet: 'fa-tablet-alt',
                mobile: 'fa-mobile-alt'
            };
            return icons[bp] || 'fa-desktop';
        },
        
        /**
         * Convert color to 6-digit hex for color picker input
         * Handles rgba, 8-digit hex (with alpha), and regular hex
         */
        colorToHex: function(color) {
            if (!color) return '#ffffff';
            
            // If it's already a 6-digit hex, return as is
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                return color;
            }
            
            // If it's an 8-digit hex (with alpha), strip the alpha
            if (/^#[0-9A-Fa-f]{8}$/.test(color)) {
                return color.slice(0, 7);
            }
            
            // If it's a 3-digit hex, expand it
            if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
                return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
            }
            
            // If it's rgba, convert to hex
            const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (rgbaMatch) {
                const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
                const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
                const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
                return '#' + r + g + b;
            }
            
            return color;
        },

        escapeHtml: function(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        getAlignValue: function(align) {
            switch (align) {
                case 'left': return 'flex-start';
                case 'right': return 'flex-end';
                default: return 'center';
            }
        },

        getToggleAlign: function(align) {
            switch (align) {
                case 'top': return 'flex-start';
                case 'bottom': return 'flex-end';
                default: return 'center';
            }
        },

        getFirstLastRadiusPreviewCSS: function(item, containerBr) {
            const mode = item.first_last_radius || 'container';
            const itemRadius = item.border_radius || 8;
            
            if (mode === 'none') {
                return `
                    .fsm-preview-item:first-child { border-radius: 0 !important; }
                    .fsm-preview-item:last-child { border-radius: 0 !important; }
                `;
            }
            
            if (mode === 'item') {
                return '';
            }
            
            // Default: container
            const tl = containerBr.top_left || 16;
            const tr = containerBr.top_right || 0;
            const br = containerBr.bottom_right || 0;
            const bl = containerBr.bottom_left || 16;
            
            return `
                .fsm-preview-item:first-child { border-radius: ${tl}px ${tr}px ${itemRadius}px ${itemRadius}px !important; }
                .fsm-preview-item:last-child { border-radius: ${itemRadius}px ${itemRadius}px ${br}px ${bl}px !important; }
                .fsm-preview-item:only-child { border-radius: ${tl}px ${tr}px ${br}px ${bl}px !important; }
            `;
        }
    };

    $(document).ready(function() {
        FSM.init();
    });

})(jQuery);
