<?php
/**
 * Admin Class - Handles admin page and AJAX
 */

if (!defined('ABSPATH')) exit;

class FSM_Admin {
    
    private $settings;
    
    public function __construct(FSM_Settings $settings) {
        $this->settings = $settings;
    }
    
    public function add_menu() {
        add_menu_page(
            __('Floating Menu', 'floating-side-menu'),
            __('Floating Menu', 'floating-side-menu'),
            'manage_options',
            'floating-side-menu',
            [$this, 'render_page'],
            'dashicons-menu',
            30
        );
    }
    
    public function enqueue_assets($hook) {
        if ($hook !== 'toplevel_page_floating-side-menu') return;
        
        wp_enqueue_media();
        wp_enqueue_style('dashicons');
        
        wp_enqueue_style(
            'fsm-fontawesome',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
            [],
            '6.4.0'
        );
        
        // Load Elementor fonts if available
        if (class_exists('\Elementor\Plugin')) {
            $this->enqueue_elementor_fonts();
        }
        
        // Load theme's frontend styles for fonts
        $this->enqueue_theme_fonts();
        
        // Use timestamp for cache busting in development
        $version = FSM_VERSION . '.' . filemtime(FSM_PLUGIN_DIR . 'assets/css/admin.css');
        $js_version = FSM_VERSION . '.' . filemtime(FSM_PLUGIN_DIR . 'assets/js/admin.js');
        
        wp_enqueue_style(
            'fsm-admin',
            FSM_PLUGIN_URL . 'assets/css/admin.css',
            ['dashicons', 'fsm-fontawesome'],
            $version
        );
        
        wp_enqueue_script(
            'fsm-admin',
            FSM_PLUGIN_URL . 'assets/js/admin.js',
            ['jquery'],
            $js_version,
            true
        );
        
        wp_localize_script('fsm-admin', 'fsmData', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('fsm_nonce'),
            'settings' => $this->settings->get_settings(),
            'items' => $this->settings->get_items(),
            'defaults' => $this->settings->get_defaults(),
            'logoUrl' => FSM_PLUGIN_URL . 'assets/images/logo.webp',
            'fonts' => $this->get_available_fonts(),
            'siteUrl' => home_url(),
            'draftSettings' => $this->settings->get_draft_settings(),
            'draftItems' => $this->settings->get_draft_items(),
            'hasDraft' => $this->settings->has_draft(),
            'status' => $this->settings->get_status(),
            'history' => $this->settings->get_history()
        ]);
    }
    
    /**
     * Enqueue Elementor fonts for admin preview
     */
    private function enqueue_elementor_fonts() {
        // Get Elementor's kit settings for fonts
        $kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
        if ($kit) {
            $kit_settings = $kit->get_settings();
            
            // Get primary font family
            $primary_font = '';
            if (!empty($kit_settings['system_typography'])) {
                foreach ($kit_settings['system_typography'] as $typography) {
                    if (!empty($typography['typography_font_family'])) {
                        $primary_font = $typography['typography_font_family'];
                        break;
                    }
                }
            }
            
            // Enqueue Google Font if it's a Google font
            if ($primary_font && !$this->is_system_font($primary_font)) {
                $font_url = 'https://fonts.googleapis.com/css2?family=' . urlencode(str_replace(' ', '+', $primary_font)) . ':wght@400;500;600;700&display=swap';
                wp_enqueue_style('fsm-google-font', $font_url, [], null);
            }
            
            // Add inline CSS with Elementor CSS variables
            $inline_css = ':root { --e-global-typography-primary-font-family: "' . esc_attr($primary_font) . '"; }';
            wp_add_inline_style('fsm-admin', $inline_css);
        }
    }
    
    /**
     * Enqueue theme fonts
     */
    private function enqueue_theme_fonts() {
        // Try to get fonts from customizer or theme settings
        $custom_fonts = apply_filters('fsm_custom_fonts', []);
        
        foreach ($custom_fonts as $font_url) {
            wp_enqueue_style('fsm-theme-font-' . md5($font_url), $font_url, [], null);
        }
    }
    
    /**
     * Check if font is a system font
     */
    private function is_system_font($font) {
        $system_fonts = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'system-ui', '-apple-system'];
        return in_array($font, $system_fonts);
    }
    
    /**
     * Get available fonts from Elementor and system
     */
    private function get_available_fonts() {
        $fonts = [
            'system' => [
                ['value' => 'inherit', 'label' => 'Theme Default'],
                ['value' => '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 'label' => 'System UI'],
                ['value' => 'Arial, sans-serif', 'label' => 'Arial'],
                ['value' => 'Georgia, serif', 'label' => 'Georgia'],
                ['value' => '"Times New Roman", serif', 'label' => 'Times New Roman'],
            ],
            'google' => [],
            'elementor' => [],
            'elementor_primary' => ''
        ];
        
        // Get Elementor fonts if available
        if (class_exists('\Elementor\Plugin')) {
            $fonts['elementor'] = $this->get_elementor_fonts();
            $fonts['elementor_primary'] = $this->get_elementor_primary_font();
        }
        
        return $fonts;
    }
    
    /**
     * Get fonts from Elementor Global Settings
     */
    private function get_elementor_fonts() {
        $elementor_fonts = [];
        
        if (!class_exists('\Elementor\Plugin')) {
            return $elementor_fonts;
        }
        
        try {
            $kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
            if (!$kit) return $elementor_fonts;
            
            $kit_settings = $kit->get_settings();
            
            // Get system typography fonts
            if (!empty($kit_settings['system_typography'])) {
                foreach ($kit_settings['system_typography'] as $typography) {
                    if (!empty($typography['typography_font_family'])) {
                        $font = $typography['typography_font_family'];
                        $label = $typography['_id'] ?? $font;
                        
                        // Format label
                        $label = ucwords(str_replace(['_', '-'], ' ', $label));
                        
                        $elementor_fonts[] = [
                            'value' => "'{$font}', sans-serif",
                            'label' => "{$font} (Elementor: {$label})",
                            'font_family' => $font
                        ];
                    }
                }
            }
            
            // Get custom typography fonts
            if (!empty($kit_settings['custom_typography'])) {
                foreach ($kit_settings['custom_typography'] as $typography) {
                    if (!empty($typography['typography_font_family'])) {
                        $font = $typography['typography_font_family'];
                        $label = $typography['title'] ?? $font;
                        
                        $elementor_fonts[] = [
                            'value' => "'{$font}', sans-serif",
                            'label' => "{$font} (Elementor: {$label})",
                            'font_family' => $font
                        ];
                    }
                }
            }
            
            // Remove duplicates
            $seen = [];
            $unique_fonts = [];
            foreach ($elementor_fonts as $font) {
                if (!in_array($font['font_family'], $seen)) {
                    $seen[] = $font['font_family'];
                    $unique_fonts[] = $font;
                }
            }
            
            return $unique_fonts;
            
        } catch (\Exception $e) {
            return $elementor_fonts;
        }
    }
    
    /**
     * Get Elementor primary font
     */
    private function get_elementor_primary_font() {
        if (!class_exists('\Elementor\Plugin')) {
            return '';
        }
        
        try {
            $kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
            if (!$kit) return '';
            
            $kit_settings = $kit->get_settings();
            
            // Get primary font from system typography
            if (!empty($kit_settings['system_typography'])) {
                foreach ($kit_settings['system_typography'] as $typography) {
                    if (!empty($typography['typography_font_family'])) {
                        return $typography['typography_font_family'];
                    }
                }
            }
            
            return '';
        } catch (\Exception $e) {
            return '';
        }
    }
    
    public function render_page() {
        $status = $this->settings->get_status();
        $has_draft = $this->settings->has_draft();
        ?>
        <div class="fsm-admin-wrap">
            <div class="fsm-admin-container">
                <div class="fsm-header">
                    <div class="fsm-logo-section">
                        <img src="<?php echo esc_url(FSM_PLUGIN_URL . 'assets/images/logo.webp'); ?>" alt="Logo" class="fsm-logo">
                        <div class="fsm-title-section">
                            <span class="fsm-title">Floating Side Menu</span>
                            <span class="fsm-subtitle">by InspiraX</span>
                        </div>
                    </div>
                    <div class="fsm-tabs-row">
                        <button class="fsm-tab active" data-tab="settings"><i class="fas fa-sliders-h"></i> Settings</button>
                        <button class="fsm-tab" data-tab="items"><i class="fas fa-list"></i> Menu Items</button>
                        <button class="fsm-tab" data-tab="visibility"><i class="fas fa-eye"></i> Visibility</button>
                        <button class="fsm-tab" data-tab="export"><i class="fas fa-file-export"></i> Import/Export</button>
                    </div>
                    <div class="fsm-header-actions">
                        <span class="fsm-version">v<?php echo esc_html(FSM_VERSION); ?></span>
                    </div>
                </div>
                <div class="fsm-content">
                    <div class="fsm-settings-panel" id="fsm-settings-panel"></div>
                    <div class="fsm-preview-panel">
                        <div class="fsm-preview-header">
                            <div class="fsm-preview-left">
                                <span class="fsm-preview-title"><i class="fas fa-eye"></i> Tab Preview</span>
                                <span class="fsm-breakpoint-badge" id="fsm-breakpoint-badge"><i class="fas fa-desktop"></i> Desktop</span>
                                <span class="fsm-live-badge" id="fsm-live-badge" style="display: none;"><i class="fas fa-circle"></i> Live</span>
                            </div>
                            <button class="fsm-open-preview-btn" id="fsm-open-preview">
                                <i class="fas fa-external-link-alt"></i> Open Preview
                            </button>
                        </div>
                        <div class="fsm-preview-body">
                            <div class="fsm-preview-frame" id="fsm-preview-frame"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div id="fsm-toast-container"></div>
        <?php
    }
    
    public function ajax_save() {
        check_ajax_referer('fsm_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Permission denied', 'floating-side-menu'));
        }
        
        $settings = isset($_POST['settings']) ? json_decode(stripslashes($_POST['settings']), true) : null;
        $items = isset($_POST['items']) ? json_decode(stripslashes($_POST['items']), true) : null;
        $save_type = isset($_POST['save_type']) ? sanitize_text_field($_POST['save_type']) : 'publish';
        
        if ($save_type === 'draft') {
            // Save as draft
            if ($settings && $items) {
                $this->settings->save_draft($settings, $items);
            }
            wp_send_json_success([
                'message' => __('Draft saved', 'floating-side-menu'),
                'status' => 'draft'
            ]);
        } else {
            // Publish
            if ($settings && $items) {
                $this->settings->publish($settings, $items);
            }
            
            // Purge cache from popular caching plugins
            $this->purge_all_cache();
            
            wp_send_json_success([
                'message' => __('Settings published', 'floating-side-menu'),
                'status' => 'published'
            ]);
        }
    }
    
    /**
     * AJAX handler for discarding draft
     */
    public function ajax_discard_draft() {
        check_ajax_referer('fsm_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Permission denied', 'floating-side-menu'));
        }
        
        $this->settings->discard_draft();
        
        wp_send_json_success([
            'message' => __('Draft discarded', 'floating-side-menu'),
            'settings' => $this->settings->get_settings(),
            'items' => $this->settings->get_items(),
            'status' => 'published'
        ]);
    }
    
    /**
     * AJAX handler for getting history
     */
    public function ajax_get_history() {
        check_ajax_referer('fsm_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Permission denied', 'floating-side-menu'));
        }
        
        wp_send_json_success([
            'history' => $this->settings->get_history()
        ]);
    }
    
    /**
     * AJAX handler for rollback
     */
    public function ajax_rollback() {
        check_ajax_referer('fsm_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Permission denied', 'floating-side-menu'));
        }
        
        $history_id = isset($_POST['history_id']) ? sanitize_text_field($_POST['history_id']) : '';
        $as_draft = isset($_POST['as_draft']) && $_POST['as_draft'] === 'true';
        
        if (empty($history_id)) {
            wp_send_json_error(__('Invalid history ID', 'floating-side-menu'));
        }
        
        $result = $this->settings->rollback($history_id, $as_draft);
        
        if ($result) {
            // Purge cache if published
            if (!$as_draft) {
                $this->purge_all_cache();
            }
            
            wp_send_json_success([
                'message' => $as_draft ? __('Restored as draft', 'floating-side-menu') : __('Restored and published', 'floating-side-menu'),
                'settings' => $as_draft ? $this->settings->get_draft_settings() : $this->settings->get_settings(),
                'items' => $as_draft ? $this->settings->get_draft_items() : $this->settings->get_items(),
                'status' => $as_draft ? 'draft' : 'published',
                'history' => $this->settings->get_history()
            ]);
        } else {
            wp_send_json_error(__('Failed to restore', 'floating-side-menu'));
        }
    }
    
    /**
     * AJAX handler for deleting history entry
     */
    public function ajax_delete_history() {
        check_ajax_referer('fsm_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Permission denied', 'floating-side-menu'));
        }
        
        $history_id = isset($_POST['history_id']) ? sanitize_text_field($_POST['history_id']) : '';
        
        if (empty($history_id)) {
            wp_send_json_error(__('Invalid history ID', 'floating-side-menu'));
        }
        
        $this->settings->delete_history_entry($history_id);
        
        wp_send_json_success([
            'message' => __('History entry deleted', 'floating-side-menu'),
            'history' => $this->settings->get_history()
        ]);
    }
    
    /**
     * AJAX handler for clearing all history
     */
    public function ajax_clear_history() {
        check_ajax_referer('fsm_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error(__('Permission denied', 'floating-side-menu'));
        }
        
        $this->settings->clear_history();
        
        wp_send_json_success([
            'message' => __('History cleared', 'floating-side-menu'),
            'history' => []
        ]);
    }
    
    /**
     * Purge cache from all popular caching plugins
     */
    private function purge_all_cache() {
        // LiteSpeed Cache - try multiple methods
        if (class_exists('LiteSpeed_Cache_API')) {
            LiteSpeed_Cache_API::purge_all();
        }
        if (class_exists('\LiteSpeed\Purge')) {
            \LiteSpeed\Purge::purge_all();
        }
        // LiteSpeed via action hook (works for most versions)
        do_action('litespeed_purge_all');
        
        // Also purge specific tag
        do_action('litespeed_purge', 'fsm_menu');
        
        // WP Super Cache
        if (function_exists('wp_cache_clear_cache')) {
            wp_cache_clear_cache();
        }
        
        // W3 Total Cache
        if (function_exists('w3tc_flush_all')) {
            w3tc_flush_all();
        }
        
        // WP Fastest Cache
        if (function_exists('wpfc_clear_all_cache')) {
            wpfc_clear_all_cache();
        }
        if (class_exists('WpFastestCache')) {
            $wpfc = new WpFastestCache();
            $wpfc->deleteCache(true);
        }
        
        // WP Rocket
        if (function_exists('rocket_clean_domain')) {
            rocket_clean_domain();
        }
        
        // Autoptimize
        if (class_exists('autoptimizeCache')) {
            autoptimizeCache::clearall();
        }
        
        // Cache Enabler
        if (class_exists('Cache_Enabler')) {
            Cache_Enabler::clear_total_cache();
        }
        
        // Comet Cache
        if (class_exists('comet_cache')) {
            comet_cache::clear();
        }
        
        // Hummingbird
        if (class_exists('WP_Hummingbird')) {
            do_action('wphb_clear_page_cache');
        }
        
        // SG Optimizer (SiteGround)
        if (function_exists('sg_cachepress_purge_cache')) {
            sg_cachepress_purge_cache();
        }
        
        // Breeze (Cloudways)
        if (class_exists('Breeze_PurgeCache')) {
            Breeze_PurgeCache::breeze_cache_flush();
        }
        
        // Cloudflare (via plugin)
        if (class_exists('CF\WordPress\Hooks')) {
            do_action('cloudflare_purge_everything');
        }
        
        // Nginx Helper
        if (class_exists('Nginx_Helper')) {
            do_action('rt_nginx_helper_purge_all');
        }
        
        // Kinsta Cache
        if (class_exists('Kinsta\Cache')) {
            wp_remote_get(home_url('/?kinsta-clear-cache-all'), ['blocking' => false]);
        }
        
        // WP Engine
        if (class_exists('WpeCommon')) {
            if (method_exists('WpeCommon', 'purge_memcached')) {
                WpeCommon::purge_memcached();
            }
            if (method_exists('WpeCommon', 'purge_varnish_cache')) {
                WpeCommon::purge_varnish_cache();
            }
        }
        
        // Pantheon
        if (function_exists('pantheon_wp_clear_edge_all')) {
            pantheon_wp_clear_edge_all();
        }
        
        // Generic WordPress cache
        if (function_exists('wp_cache_flush')) {
            wp_cache_flush();
        }
    }
}
