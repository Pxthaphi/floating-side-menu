<?php
/**
 * Public Class - Handles frontend rendering
 */

if (!defined('ABSPATH')) exit;

class FSM_Public {
    
    private $settings;
    
    public function __construct(FSM_Settings $settings) {
        $this->settings = $settings;
    }
    
    public function enqueue_assets() {
        if (!$this->should_display()) return;
        
        // Use saved timestamp for cache busting (updated when settings are saved)
        $version_timestamp = get_option('fsm_version_timestamp', time());
        $version = FSM_VERSION . '.' . $version_timestamp;
        
        wp_enqueue_style('dashicons');
        
        wp_enqueue_style(
            'fsm-fontawesome',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
            [],
            '6.4.0'
        );
        
        wp_enqueue_style(
            'fsm-public',
            FSM_PLUGIN_URL . 'assets/css/public.css',
            ['dashicons', 'fsm-fontawesome'],
            $version
        );
        
        // Add inline styles - regenerated on every page load
        wp_add_inline_style('fsm-public', $this->generate_css());
        
        wp_enqueue_script(
            'fsm-public',
            FSM_PLUGIN_URL . 'assets/js/public.js',
            [],
            $version,
            true
        );
    }
    
    private function should_display() {
        $s = $this->settings->get_settings();
        $v = $s['visibility'] ?? [];
        
        if (($v['mode'] ?? 'all') === 'all') {
            if (is_front_page() && empty($v['show_on_home'])) return false;
            if (is_archive() && empty($v['show_on_archive'])) return false;
            if (is_single() && empty($v['show_on_single'])) return false;
        }
        
        return true;
    }
    
    public function render_menu() {
        if (!$this->should_display()) return;
        
        // Tell LiteSpeed to not cache this block (ESI)
        if (class_exists('\LiteSpeed\Tag')) {
            do_action('litespeed_tag_add', 'fsm_menu');
        }
        
        $s = $this->settings->get_settings();
        $items = $this->settings->get_items();
        $side = $s['position']['side'] ?? 'right';
        $is_left = $side === 'left';
        $toggle_enabled = $s['toggle']['enabled'] ?? true;
        $toggle_icon_open = $s['toggle']['icon_open'] ?? $s['toggle']['icon'] ?? 'fa-chevron-left';
        $toggle_icon_closed = $s['toggle']['icon_closed'] ?? 'fa-chevron-right';
        $icon_position = $s['icon']['position'] ?? 'top';
        
        // Add version comment for cache debugging
        $version_timestamp = get_option('fsm_version_timestamp', 0);
        echo '<!-- FSM v' . FSM_VERSION . ' t:' . $version_timestamp . ' -->';
        ?>
        <div class="fsm-menu fsm-side-<?php echo esc_attr($side); ?>" id="fsm-menu">
            <?php if ($toggle_enabled): ?>
            <button class="fsm-toggle" id="fsm-toggle" aria-label="<?php esc_attr_e('Toggle menu', 'floating-side-menu'); ?>" data-icon-open="<?php echo esc_attr($toggle_icon_open); ?>" data-icon-closed="<?php echo esc_attr($toggle_icon_closed); ?>">
                <i class="fas <?php echo esc_attr($toggle_icon_open); ?>"></i>
            </button>
            <?php endif; ?>
            <nav class="fsm-nav" id="fsm-nav">
                <?php foreach ($items as $item): 
                    $icon_type = $item['icon_type'] ?? 'fontawesome';
                    $icon = $item['icon'] ?? '';
                    $icon_url = $item['icon_url'] ?? '';
                    $icon_size = $item['icon_size'] ?? null;
                    $style = $icon_size ? "style=\"--fsm-icon-size: {$icon_size}px;\"" : '';
                ?>
                <a href="<?php echo esc_url($item['url'] ?? '#'); ?>" 
                   class="fsm-item fsm-icon-<?php echo esc_attr($icon_position); ?>"
                   target="<?php echo esc_attr($item['target'] ?? '_self'); ?>"
                   <?php echo $style; ?>>
                    <span class="fsm-icon">
                        <?php echo $this->render_icon($icon_type, $icon, $icon_url); ?>
                    </span>
                    <span class="fsm-label"><?php echo esc_html($item['label'] ?? ''); ?></span>
                </a>
                <?php endforeach; ?>
            </nav>
        </div>
        <?php
    }
    
    private function render_icon($type, $icon, $url = '') {
        if ($type === 'image' && $url) {
            $is_svg = strpos($url, '.svg') !== false || strpos($url, 'image/svg') !== false;
            
            if ($is_svg) {
                // Try to inline SVG for color control
                $svg_content = $this->get_inline_svg($url);
                if ($svg_content) {
                    return '<span class="fsm-icon-svg-inline">' . $svg_content . '</span>';
                }
            }
            
            // Fallback to img tag
            $class = $is_svg ? 'fsm-icon-img fsm-icon-svg' : 'fsm-icon-img';
            return '<img src="' . esc_url($url) . '" alt="" class="' . $class . '">';
        }
        
        if ($type === 'dashicons' && $icon) {
            return '<span class="dashicons ' . esc_attr($icon) . '"></span>';
        }
        
        // Font Awesome (default)
        if ($icon) {
            $fa_class = strpos($icon, 'fa-') === 0 ? 'fas ' . $icon : $icon;
            return '<i class="' . esc_attr($fa_class) . '"></i>';
        }
        
        return '<i class="fas fa-link"></i>';
    }
    
    /**
     * Get inline SVG content from URL
     */
    private function get_inline_svg($url) {
        // Check if it's a local file
        $upload_dir = wp_upload_dir();
        $is_local = strpos($url, $upload_dir['baseurl']) !== false || strpos($url, home_url()) !== false;
        
        if ($is_local) {
            // Convert URL to file path
            $file_path = str_replace($upload_dir['baseurl'], $upload_dir['basedir'], $url);
            $file_path = str_replace(home_url(), ABSPATH, $file_path);
            
            if (file_exists($file_path)) {
                $svg_content = file_get_contents($file_path);
                return $this->sanitize_svg($svg_content);
            }
        }
        
        // For remote URLs, use transient cache
        $cache_key = 'fsm_svg_' . md5($url);
        $cached = get_transient($cache_key);
        
        if ($cached !== false) {
            return $cached;
        }
        
        // Fetch remote SVG
        $response = wp_remote_get($url, ['timeout' => 5]);
        
        if (is_wp_error($response)) {
            return false;
        }
        
        $svg_content = wp_remote_retrieve_body($response);
        $sanitized = $this->sanitize_svg($svg_content);
        
        if ($sanitized) {
            set_transient($cache_key, $sanitized, DAY_IN_SECONDS);
        }
        
        return $sanitized;
    }
    
    /**
     * Sanitize SVG content and prepare for inline use
     */
    private function sanitize_svg($svg_content) {
        if (empty($svg_content)) {
            return false;
        }
        
        // Check if it's valid SVG
        if (strpos($svg_content, '<svg') === false) {
            return false;
        }
        
        // Remove XML declaration
        $svg_content = preg_replace('/<\?xml[^>]*\?>/', '', $svg_content);
        
        // Remove DOCTYPE
        $svg_content = preg_replace('/<!DOCTYPE[^>]*>/', '', $svg_content);
        
        // Remove comments
        $svg_content = preg_replace('/<!--.*?-->/s', '', $svg_content);
        
        // Remove script tags for security
        $svg_content = preg_replace('/<script[^>]*>.*?<\/script>/is', '', $svg_content);
        
        // Remove on* event handlers
        $svg_content = preg_replace('/\s+on\w+="[^"]*"/i', '', $svg_content);
        
        // Add currentColor to fill/stroke if not set, to allow CSS color control
        // First, check if SVG uses fill="none" (outline style)
        $has_fill_none = strpos($svg_content, 'fill="none"') !== false;
        
        if ($has_fill_none) {
            // For outline SVGs, change stroke to currentColor
            $svg_content = preg_replace('/stroke="(?!none)[^"]*"/', 'stroke="currentColor"', $svg_content);
        } else {
            // For filled SVGs, change fill to currentColor
            $svg_content = preg_replace('/fill="(?!none)[^"]*"/', 'fill="currentColor"', $svg_content);
        }
        
        // Add class for styling
        $svg_content = preg_replace('/<svg/', '<svg class="fsm-svg"', $svg_content, 1);
        
        return trim($svg_content);
    }

    
    private function generate_css() {
        $s = $this->settings->get_settings();
        $c = $s['container'] ?? [];
        $t = $s['typography'] ?? [];
        $i = $s['icon'] ?? [];
        $h = $s['hover'] ?? [];
        $tg = $s['toggle'] ?? [];
        $a = $s['animation'] ?? [];
        $it = $s['item'] ?? [];
        $ip = $it['padding'] ?? ['top' => 12, 'right' => 12, 'bottom' => 12, 'left' => 12];
        $p = $c['padding'] ?? [];
        $br = $c['border_radius'] ?? [];
        $bs = $c['box_shadow'] ?? [];
        $side = $s['position']['side'] ?? 'right';
        $is_left = $side === 'left';
        
        // Font family - use CSS variable for theme default
        $font_family = $t['font_family'] ?? 'inherit';
        if ($font_family === 'inherit') {
            // Try to use Elementor's global font, fallback to body font
            $font_css = "var(--e-global-typography-primary-font-family, var(--wp--preset--font-family--body, inherit))";
        } else {
            $font_css = $font_family;
        }
        
        // Complete reset - DO NOT use "all: unset" as it breaks icon fonts
        $css = "
/* FSM Complete Reset - Override theme styles but preserve icon fonts */
#fsm-menu,
#fsm-menu *,
#fsm-menu *::before,
#fsm-menu *::after {
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    border-width: 0 !important;
    border-style: none !important;
    outline: none !important;
    box-sizing: border-box !important;
    text-decoration: none !important;
    list-style: none !important;
    background: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    text-transform: none !important;
    gap: 0 !important;
    letter-spacing: normal !important;
    word-spacing: normal !important;
    line-height: 1.4 !important;
    vertical-align: baseline !important;
    float: none !important;
    clear: none !important;
    text-indent: 0 !important;
    white-space: normal !important;
    visibility: visible !important;
    opacity: 1 !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-width: none !important;
    max-height: none !important;
    overflow: visible !important;
    clip: auto !important;
    filter: none !important;
    transform: none !important;
    animation: none !important;
    transition: none !important;
    -webkit-text-fill-color: initial !important;
    -webkit-text-stroke: initial !important;
    position: static !important;
    top: auto !important;
    right: auto !important;
    bottom: auto !important;
    left: auto !important;
    z-index: auto !important;
}

/* Restore Font Awesome font-family */
#fsm-menu .fas,
#fsm-menu .far,
#fsm-menu .fab,
#fsm-menu .fa,
#fsm-menu i[class*='fa-'] {
    font-family: 'Font Awesome 6 Free' !important;
    font-style: normal !important;
    font-variant: normal !important;
    text-rendering: auto !important;
    -webkit-font-smoothing: antialiased !important;
    -moz-osx-font-smoothing: grayscale !important;
    display: inline-block !important;
}

#fsm-menu .fas,
#fsm-menu i.fas {
    font-weight: 900 !important;
}

#fsm-menu .far {
    font-weight: 400 !important;
}

#fsm-menu .fab {
    font-family: 'Font Awesome 6 Brands' !important;
    font-weight: 400 !important;
}

/* Restore Dashicons font-family */
#fsm-menu .dashicons,
#fsm-menu [class*='dashicons-'] {
    font-family: dashicons !important;
    font-style: normal !important;
    font-weight: normal !important;
    font-variant: normal !important;
    text-transform: none !important;
    text-rendering: auto !important;
    -webkit-font-smoothing: antialiased !important;
    -moz-osx-font-smoothing: grayscale !important;
    display: inline-block !important;
    speak: never !important;
}

/* Menu Container */
#fsm-menu.fsm-menu {
    position: fixed !important;
    {$side}: " . ($s['position']['margin'] ?? 0) . "px !important;
    top: " . ($s['position']['vertical'] ?? 50) . ($s['position']['vertical_unit'] ?? '%') . " !important;
    transform: translateY(-50%) !important;
    z-index: " . ($s['z_index'] ?? 9999) . " !important;
    display: flex !important;
    align-items: center !important;
    gap: 0 !important;
    font-family: {$font_css} !important;
}

/* Navigation */
#fsm-menu .fsm-nav {
    display: flex !important;
    flex-direction: column !important;
    gap: " . ($c['gap'] ?? 0) . "px !important;
    background: " . ($c['background_color'] ?? '#1A1A18') . " !important;
    width: " . ($c['width'] ?? 120) . "px !important;
    padding: " . ($p['top'] ?? 14) . "px " . ($p['right'] ?? 14) . "px " . ($p['bottom'] ?? 14) . "px " . ($p['left'] ?? 14) . "px !important;
    border-radius: " . ($br['top_left'] ?? 16) . "px " . ($br['top_right'] ?? 0) . "px " . ($br['bottom_right'] ?? 0) . "px " . ($br['bottom_left'] ?? 16) . "px !important;
    box-shadow: " . ($bs['x'] ?? -8) . "px " . ($bs['y'] ?? 0) . "px " . ($bs['blur'] ?? 32) . "px " . ($bs['spread'] ?? 0) . "px " . ($bs['color'] ?? 'rgba(0,0,0,0.15)') . " !important;
    order: " . ($is_left ? '1' : '2') . " !important;
}

/* Toggle Button */
#fsm-menu .fsm-toggle,
#fsm-menu button.fsm-toggle {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: " . ($tg['background_color'] ?? '#1A1A18') . " !important;
    color: " . ($tg['icon_color'] ?? '#ffffff') . " !important;
    width: " . ($tg['width'] ?? 28) . "px !important;
    height: " . ($tg['size'] ?? 40) . "px !important;
    border-radius: " . ($is_left ? "0 " . ($tg['border_radius'] ?? 8) . "px " . ($tg['border_radius'] ?? 8) . "px 0" : ($tg['border_radius'] ?? 8) . "px 0 0 " . ($tg['border_radius'] ?? 8) . "px") . " !important;
    cursor: pointer !important;
    order: " . ($is_left ? '2' : '1') . " !important;
    align-self: " . $this->get_toggle_align($tg['align'] ?? 'middle') . " !important;
    transition: all 0.2s ease !important;
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
    margin: 0 !important;
    padding: 0 !important;
}

#fsm-menu .fsm-toggle:hover,
#fsm-menu .fsm-toggle:focus {
    background: " . ($tg['hover_background'] ?? 'rgba(255,255,255,0.1)') . " !important;
    outline: none !important;
    box-shadow: none !important;
}

#fsm-menu .fsm-toggle:focus-visible {
    outline: none !important;
    box-shadow: none !important;
}

#fsm-menu .fsm-toggle:hover i,
#fsm-menu .fsm-toggle:focus i {
    color: " . ($tg['hover_icon_color'] ?? '#ffffff') . " !important;
}

#fsm-menu .fsm-toggle:active {
    background: " . ($tg['active_background'] ?? 'rgba(255,255,255,0.15)') . " !important;
}

#fsm-menu .fsm-toggle:active i {
    color: " . ($tg['active_icon_color'] ?? '#ffffff') . " !important;
}

#fsm-menu .fsm-toggle i {
    color: " . ($tg['icon_color'] ?? '#ffffff') . " !important;
    font-size: " . ($tg['icon_size'] ?? 14) . "px !important;
    transform: rotate(" . ($tg['icon_rotate'] ?? 0) . "deg) !important;
    transition: transform 0.2s ease !important;
}

/* Menu Items */
#fsm-menu .fsm-item,
#fsm-menu a.fsm-item {
    display: flex !important;
    flex-direction: " . (($i['position'] ?? 'top') === 'top' ? 'column' : 'row') . " !important;
    align-items: " . $this->get_align_value($i['align'] ?? 'center') . " !important;
    justify-content: " . $this->get_align_value($i['align'] ?? 'center') . " !important;
    text-align: " . ($t['text_align'] ?? 'center') . " !important;
    gap: " . ($i['spacing'] ?? 8) . "px !important;
    padding: " . ($ip['top'] ?? 12) . "px " . ($ip['right'] ?? 12) . "px " . ($ip['bottom'] ?? 12) . "px " . ($ip['left'] ?? 12) . "px !important;
    background: " . ($it['background_color'] ?? 'transparent') . " !important;
    color: " . ($t['text_color'] ?? 'rgba(255,255,255,0.9)') . " !important;
    font-family: {$font_css} !important;
    font-size: " . ($t['font_size'] ?? 11) . "px !important;
    font-weight: " . ($t['font_weight'] ?? 500) . " !important;
    border-radius: " . ($it['border_radius'] ?? 8) . "px !important;
    transition: all " . ($it['transition_duration'] ?? 200) . "ms ease !important;
    cursor: pointer !important;
}

" . $this->get_first_last_radius_css($it, $br) . "

#fsm-menu .fsm-item:hover,
#fsm-menu a.fsm-item:hover {
    background: " . ($it['hover_background'] ?? 'rgba(255,255,255,0.1)') . " !important;
    color: " . ($t['hover_text_color'] ?? $h['text_color'] ?? '#ffffff') . " !important;
}

#fsm-menu .fsm-item:hover .fsm-icon i,
#fsm-menu .fsm-item:hover .fsm-icon .fas,
#fsm-menu .fsm-item:hover .fsm-icon .far,
#fsm-menu .fsm-item:hover .fsm-icon .fab,
#fsm-menu .fsm-item:hover .fsm-icon .dashicons {
    color: " . ($i['hover_color'] ?? '#ffffff') . " !important;
}

#fsm-menu .fsm-item:hover .fsm-icon-svg {
    filter: " . $this->hex_to_filter($i['hover_color'] ?? '#ffffff') . " !important;
}

#fsm-menu .fsm-item:active,
#fsm-menu a.fsm-item:active,
#fsm-menu .fsm-item.active,
#fsm-menu a.fsm-item.active {
    background: " . ($it['active_background'] ?? 'rgba(255,255,255,0.15)') . " !important;
    color: " . ($t['active_text_color'] ?? '#ffffff') . " !important;
}

#fsm-menu .fsm-item:active .fsm-icon i,
#fsm-menu .fsm-item:active .fsm-icon .fas,
#fsm-menu .fsm-item:active .fsm-icon .far,
#fsm-menu .fsm-item:active .fsm-icon .fab,
#fsm-menu .fsm-item:active .fsm-icon .dashicons,
#fsm-menu .fsm-item.active .fsm-icon i,
#fsm-menu .fsm-item.active .fsm-icon .fas,
#fsm-menu .fsm-item.active .fsm-icon .far,
#fsm-menu .fsm-item.active .fsm-icon .fab,
#fsm-menu .fsm-item.active .fsm-icon .dashicons {
    color: " . ($i['active_color'] ?? '#ffffff') . " !important;
}

#fsm-menu .fsm-item:active .fsm-icon-svg,
#fsm-menu .fsm-item.active .fsm-icon-svg {
    filter: " . $this->hex_to_filter($i['active_color'] ?? '#ffffff') . " !important;
}

/* Icon Container */
#fsm-menu .fsm-icon {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    line-height: 1 !important;
}

#fsm-menu .fsm-icon i,
#fsm-menu .fsm-icon .fas,
#fsm-menu .fsm-icon .far,
#fsm-menu .fsm-icon .fab {
    font-size: " . ($i['size'] ?? 22) . "px !important;
    color: " . ($i['color'] ?? 'rgba(255,255,255,0.85)') . " !important;
    width: auto !important;
    height: auto !important;
}

#fsm-menu .fsm-icon .dashicons {
    font-size: " . ($i['size'] ?? 22) . "px !important;
    color: " . ($i['color'] ?? 'rgba(255,255,255,0.85)') . " !important;
    width: " . ($i['size'] ?? 22) . "px !important;
    height: " . ($i['size'] ?? 22) . "px !important;
}

#fsm-menu .fsm-icon-img {
    width: " . ($i['size'] ?? 22) . "px !important;
    height: " . ($i['size'] ?? 22) . "px !important;
    object-fit: contain !important;
    border-radius: 4px !important;
}

#fsm-menu .fsm-icon-svg {
    filter: " . $this->hex_to_filter($i['color'] ?? '#ffffffd9') . " !important;
}

/* Inline SVG - uses color instead of filter for accuracy */
#fsm-menu .fsm-icon-svg-inline {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: " . ($i['color'] ?? '#ffffffd9') . " !important;
}

#fsm-menu .fsm-icon-svg-inline svg,
#fsm-menu .fsm-icon-svg-inline .fsm-svg {
    width: " . ($i['size'] ?? 22) . "px !important;
    height: " . ($i['size'] ?? 22) . "px !important;
    fill: currentColor !important;
    stroke: currentColor !important;
}

#fsm-menu .fsm-item:hover .fsm-icon-svg-inline {
    color: " . ($i['hover_color'] ?? '#ffffff') . " !important;
}

#fsm-menu .fsm-item:active .fsm-icon-svg-inline,
#fsm-menu .fsm-item.active .fsm-icon-svg-inline {
    color: " . ($i['active_color'] ?? '#ffffff') . " !important;
}

/* Label */
#fsm-menu .fsm-label {
    color: " . ($t['text_color'] ?? 'rgba(255,255,255,0.9)') . " !important;
    font-family: {$font_css} !important;
    font-size: " . ($t['font_size'] ?? 11) . "px !important;
    font-weight: " . ($t['font_weight'] ?? 500) . " !important;
    line-height: " . ($t['line_height'] ?? 1.4) . " !important;
    text-align: " . ($t['text_align'] ?? 'center') . " !important;
    white-space: normal !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
    width: 100% !important;
}

/* Hover state for label */
#fsm-menu .fsm-item:hover .fsm-label,
#fsm-menu a.fsm-item:hover .fsm-label {
    color: " . ($t['hover_text_color'] ?? $h['text_color'] ?? '#ffffff') . " !important;
}

/* Active state */
#fsm-menu .fsm-item:active .fsm-label,
#fsm-menu a.fsm-item:active .fsm-label,
#fsm-menu .fsm-item.active .fsm-label,
#fsm-menu a.fsm-item.active .fsm-label {
    color: " . ($t['active_text_color'] ?? '#ffffff') . " !important;
}

/* Animation - Menu Container */
#fsm-menu.fsm-menu {
    transition: " . $this->get_menu_transition($a, $side) . " !important;
}

/* Collapsed State - Move entire menu */
#fsm-menu.fsm-collapsed {
    " . $this->get_menu_collapsed($a, $is_left, $c['width'] ?? 120) . "
}

/* Nav always visible, animation handled by parent */
#fsm-menu .fsm-nav {
    " . $this->get_animation_open($a) . "
}";

        // Responsive
        $r = $s['responsive'] ?? [];
        if (!empty($r['hide_on_mobile'])) {
            $bp = $r['breakpoint'] ?? 768;
            $css .= "\n@media (max-width: {$bp}px) { #fsm-menu.fsm-menu { display: none !important; } }";
        }
        
        // Generate responsive overrides for tablet and mobile
        $css .= $this->generate_responsive_css($s, $font_css);
        
        return $css;
    }
    
    /**
     * Generate responsive CSS with media queries for tablet and mobile
     */
    private function generate_responsive_css($s, $font_css) {
        $css = '';
        $breakpoints = $s['breakpoints'] ?? ['tablet' => 1024, 'mobile' => 768];
        
        // Convert objects to arrays and handle empty values
        $tablet = $s['tablet'] ?? [];
        if (is_object($tablet)) {
            $tablet = (array)$tablet;
        }
        
        $mobile = $s['mobile'] ?? [];
        if (is_object($mobile)) {
            $mobile = (array)$mobile;
        }
        
        // Generate tablet CSS
        if (!empty($tablet) && $this->has_responsive_overrides($tablet)) {
            $tablet_bp = $breakpoints['tablet'] ?? 1024;
            $tablet_css = $this->generate_breakpoint_css($tablet, $s, $font_css);
            if (!empty($tablet_css)) {
                $css .= "\n\n/* Tablet Responsive (max-width: {$tablet_bp}px) */\n@media (max-width: {$tablet_bp}px) {\n{$tablet_css}\n}";
            }
        }
        
        // Generate mobile CSS
        if (!empty($mobile) && $this->has_responsive_overrides($mobile)) {
            $mobile_bp = $breakpoints['mobile'] ?? 768;
            // Mobile inherits from tablet, so merge tablet + mobile overrides
            $mobile_merged = $this->merge_settings($tablet, $mobile);
            $mobile_css = $this->generate_breakpoint_css($mobile_merged, $s, $font_css);
            if (!empty($mobile_css)) {
                $css .= "\n\n/* Mobile Responsive (max-width: {$mobile_bp}px) */\n@media (max-width: {$mobile_bp}px) {\n{$mobile_css}\n}";
            }
        }
        
        return $css;
    }
    
    /**
     * Check if responsive settings have any actual overrides
     */
    private function has_responsive_overrides($settings) {
        if (empty($settings)) {
            return false;
        }
        
        // Convert object to array if needed
        if (is_object($settings)) {
            $settings = (array)$settings;
        }
        
        // Check if any nested values exist
        foreach ($settings as $key => $value) {
            if (is_array($value) || is_object($value)) {
                $arr = is_object($value) ? (array)$value : $value;
                if (!empty($arr)) {
                    return true;
                }
            } elseif ($value !== null && $value !== '') {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Merge settings arrays recursively (handles both arrays and objects)
     */
    private function merge_settings($base, $override) {
        // Convert objects to arrays
        if (is_object($base)) {
            $base = (array)$base;
        }
        if (is_object($override)) {
            $override = (array)$override;
        }
        
        $merged = $base;
        foreach ($override as $key => $value) {
            // Convert nested objects to arrays
            if (is_object($value)) {
                $value = (array)$value;
            }
            
            if (is_array($value) && isset($merged[$key])) {
                $merged_val = is_object($merged[$key]) ? (array)$merged[$key] : $merged[$key];
                if (is_array($merged_val)) {
                    $merged[$key] = $this->merge_settings($merged_val, $value);
                } else {
                    $merged[$key] = $value;
                }
            } else {
                $merged[$key] = $value;
            }
        }
        return $merged;
    }
    
    /**
     * Generate CSS for a specific breakpoint override
     * Uses high specificity selectors to override base styles
     */
    private function generate_breakpoint_css($overrides, $base_settings, $font_css) {
        $css = '';
        $side = $base_settings['position']['side'] ?? 'right';
        $is_left = $side === 'left';
        
        // Convert overrides to array if it's an object
        if (is_object($overrides)) {
            $overrides = (array)$overrides;
        }
        
        // Convert nested objects to arrays
        foreach ($overrides as $key => $value) {
            if (is_object($value)) {
                $overrides[$key] = (array)$value;
                // Also convert nested nested objects (like padding, border_radius)
                foreach ($overrides[$key] as $k2 => $v2) {
                    if (is_object($v2)) {
                        $overrides[$key][$k2] = (array)$v2;
                    }
                }
            }
        }
        
        // Container overrides - use higher specificity
        if (isset($overrides['container']) && !empty($overrides['container'])) {
            $c = $overrides['container'];
            $nav_css = '';
            
            if (isset($c['width'])) {
                $nav_css .= "        width: {$c['width']}px !important;\n";
            }
            if (isset($c['background_color'])) {
                $nav_css .= "        background: {$c['background_color']} !important;\n";
            }
            if (isset($c['gap'])) {
                $nav_css .= "        gap: {$c['gap']}px !important;\n";
            }
            if (isset($c['padding'])) {
                $p = $c['padding'];
                $top = $p['top'] ?? $base_settings['container']['padding']['top'] ?? 14;
                $right = $p['right'] ?? $base_settings['container']['padding']['right'] ?? 14;
                $bottom = $p['bottom'] ?? $base_settings['container']['padding']['bottom'] ?? 14;
                $left = $p['left'] ?? $base_settings['container']['padding']['left'] ?? 14;
                $nav_css .= "        padding: {$top}px {$right}px {$bottom}px {$left}px !important;\n";
            }
            if (isset($c['border_radius'])) {
                $br = $c['border_radius'];
                $tl = $br['top_left'] ?? $base_settings['container']['border_radius']['top_left'] ?? 16;
                $tr = $br['top_right'] ?? $base_settings['container']['border_radius']['top_right'] ?? 0;
                $brr = $br['bottom_right'] ?? $base_settings['container']['border_radius']['bottom_right'] ?? 0;
                $bl = $br['bottom_left'] ?? $base_settings['container']['border_radius']['bottom_left'] ?? 16;
                $nav_css .= "        border-radius: {$tl}px {$tr}px {$brr}px {$bl}px !important;\n";
            }
            if (isset($c['box_shadow'])) {
                $bs = $c['box_shadow'];
                $x = $bs['x'] ?? -8;
                $y = $bs['y'] ?? 0;
                $blur = $bs['blur'] ?? 32;
                $spread = $bs['spread'] ?? 0;
                $color = $bs['color'] ?? 'rgba(0,0,0,0.15)';
                $nav_css .= "        box-shadow: {$x}px {$y}px {$blur}px {$spread}px {$color} !important;\n";
            }
            
            if (!empty($nav_css)) {
                $css .= "    #fsm-menu.fsm-menu .fsm-nav,\n    #fsm-menu .fsm-nav {\n{$nav_css}    }\n";
            }
        }
        
        // Typography overrides - use higher specificity
        if (isset($overrides['typography'])) {
            $t = $overrides['typography'];
            $item_css = '';
            $label_css = '';
            
            if (isset($t['font_size'])) {
                $item_css .= "        font-size: {$t['font_size']}px !important;\n";
                $label_css .= "        font-size: {$t['font_size']}px !important;\n";
            }
            if (isset($t['font_weight'])) {
                $item_css .= "        font-weight: {$t['font_weight']} !important;\n";
                $label_css .= "        font-weight: {$t['font_weight']} !important;\n";
            }
            if (isset($t['text_color'])) {
                $item_css .= "        color: {$t['text_color']} !important;\n";
                $label_css .= "        color: {$t['text_color']} !important;\n";
            }
            if (isset($t['line_height'])) {
                $label_css .= "        line-height: {$t['line_height']} !important;\n";
            }
            if (isset($t['text_align'])) {
                $item_css .= "        text-align: {$t['text_align']} !important;\n";
                $label_css .= "        text-align: {$t['text_align']} !important;\n";
            }
            
            if (!empty($item_css)) {
                $css .= "    #fsm-menu.fsm-menu .fsm-item,\n    #fsm-menu.fsm-menu a.fsm-item,\n    #fsm-menu .fsm-item,\n    #fsm-menu a.fsm-item {\n{$item_css}    }\n";
            }
            if (!empty($label_css)) {
                $css .= "    #fsm-menu.fsm-menu .fsm-label,\n    #fsm-menu .fsm-label {\n{$label_css}    }\n";
            }
            
            // Hover text color
            if (isset($t['hover_text_color'])) {
                $css .= "    #fsm-menu.fsm-menu .fsm-item:hover,\n    #fsm-menu.fsm-menu a.fsm-item:hover,\n    #fsm-menu .fsm-item:hover,\n    #fsm-menu a.fsm-item:hover {\n        color: {$t['hover_text_color']} !important;\n    }\n";
                $css .= "    #fsm-menu.fsm-menu .fsm-item:hover .fsm-label,\n    #fsm-menu .fsm-item:hover .fsm-label {\n        color: {$t['hover_text_color']} !important;\n    }\n";
            }
        }
        
        // Icon overrides - use higher specificity
        if (isset($overrides['icon'])) {
            $i = $overrides['icon'];
            
            if (isset($i['size'])) {
                $css .= "    #fsm-menu.fsm-menu .fsm-icon i,\n    #fsm-menu.fsm-menu .fsm-icon .fas,\n    #fsm-menu.fsm-menu .fsm-icon .far,\n    #fsm-menu.fsm-menu .fsm-icon .fab,\n    #fsm-menu .fsm-icon i,\n    #fsm-menu .fsm-icon .fas,\n    #fsm-menu .fsm-icon .far,\n    #fsm-menu .fsm-icon .fab {\n        font-size: {$i['size']}px !important;\n    }\n";
                $css .= "    #fsm-menu.fsm-menu .fsm-icon .dashicons,\n    #fsm-menu .fsm-icon .dashicons {\n        font-size: {$i['size']}px !important;\n        width: {$i['size']}px !important;\n        height: {$i['size']}px !important;\n    }\n";
                $css .= "    #fsm-menu.fsm-menu .fsm-icon-img,\n    #fsm-menu .fsm-icon-img {\n        width: {$i['size']}px !important;\n        height: {$i['size']}px !important;\n    }\n";
                $css .= "    #fsm-menu.fsm-menu .fsm-icon-svg-inline svg,\n    #fsm-menu .fsm-icon-svg-inline svg {\n        width: {$i['size']}px !important;\n        height: {$i['size']}px !important;\n    }\n";
            }
            if (isset($i['color'])) {
                $css .= "    #fsm-menu.fsm-menu .fsm-icon i,\n    #fsm-menu.fsm-menu .fsm-icon .fas,\n    #fsm-menu.fsm-menu .fsm-icon .far,\n    #fsm-menu.fsm-menu .fsm-icon .fab,\n    #fsm-menu.fsm-menu .fsm-icon .dashicons,\n    #fsm-menu .fsm-icon i,\n    #fsm-menu .fsm-icon .fas,\n    #fsm-menu .fsm-icon .far,\n    #fsm-menu .fsm-icon .fab,\n    #fsm-menu .fsm-icon .dashicons {\n        color: {$i['color']} !important;\n    }\n";
                $css .= "    #fsm-menu.fsm-menu .fsm-icon-svg-inline,\n    #fsm-menu .fsm-icon-svg-inline {\n        color: {$i['color']} !important;\n    }\n";
            }
            if (isset($i['hover_color'])) {
                $css .= "    #fsm-menu.fsm-menu .fsm-item:hover .fsm-icon i,\n    #fsm-menu.fsm-menu .fsm-item:hover .fsm-icon .fas,\n    #fsm-menu.fsm-menu .fsm-item:hover .fsm-icon .far,\n    #fsm-menu.fsm-menu .fsm-item:hover .fsm-icon .fab,\n    #fsm-menu.fsm-menu .fsm-item:hover .fsm-icon .dashicons,\n    #fsm-menu .fsm-item:hover .fsm-icon i,\n    #fsm-menu .fsm-item:hover .fsm-icon .dashicons {\n        color: {$i['hover_color']} !important;\n    }\n";
                $css .= "    #fsm-menu.fsm-menu .fsm-item:hover .fsm-icon-svg-inline,\n    #fsm-menu .fsm-item:hover .fsm-icon-svg-inline {\n        color: {$i['hover_color']} !important;\n    }\n";
            }
            if (isset($i['spacing'])) {
                $css .= "    #fsm-menu.fsm-menu .fsm-item,\n    #fsm-menu.fsm-menu a.fsm-item,\n    #fsm-menu .fsm-item,\n    #fsm-menu a.fsm-item {\n        gap: {$i['spacing']}px !important;\n    }\n";
            }
            if (isset($i['position'])) {
                $direction = $i['position'] === 'top' ? 'column' : 'row';
                $css .= "    #fsm-menu.fsm-menu .fsm-item,\n    #fsm-menu.fsm-menu a.fsm-item,\n    #fsm-menu .fsm-item,\n    #fsm-menu a.fsm-item {\n        flex-direction: {$direction} !important;\n    }\n";
            }
            if (isset($i['align'])) {
                $align_value = $this->get_align_value($i['align']);
                $css .= "    #fsm-menu.fsm-menu .fsm-item,\n    #fsm-menu.fsm-menu a.fsm-item,\n    #fsm-menu .fsm-item,\n    #fsm-menu a.fsm-item {\n        align-items: {$align_value} !important;\n        justify-content: {$align_value} !important;\n    }\n";
            }
        }
        
        // Toggle overrides - use higher specificity
        if (isset($overrides['toggle'])) {
            $tg = $overrides['toggle'];
            
            if (isset($tg['enabled']) && !$tg['enabled']) {
                $css .= "    #fsm-menu.fsm-menu .fsm-toggle,\n    #fsm-menu.fsm-menu button.fsm-toggle,\n    #fsm-menu .fsm-toggle,\n    #fsm-menu button.fsm-toggle {\n        display: none !important;\n    }\n";
            } else {
                $toggle_css = '';
                if (isset($tg['width'])) {
                    $toggle_css .= "        width: {$tg['width']}px !important;\n";
                }
                if (isset($tg['size'])) {
                    $toggle_css .= "        height: {$tg['size']}px !important;\n";
                }
                if (isset($tg['background_color'])) {
                    $toggle_css .= "        background: {$tg['background_color']} !important;\n";
                }
                if (isset($tg['icon_color'])) {
                    $toggle_css .= "        color: {$tg['icon_color']} !important;\n";
                }
                if (isset($tg['border_radius'])) {
                    $br_val = $tg['border_radius'];
                    $br_css = $is_left ? "0 {$br_val}px {$br_val}px 0" : "{$br_val}px 0 0 {$br_val}px";
                    $toggle_css .= "        border-radius: {$br_css} !important;\n";
                }
                
                if (!empty($toggle_css)) {
                    $css .= "    #fsm-menu.fsm-menu .fsm-toggle,\n    #fsm-menu.fsm-menu button.fsm-toggle,\n    #fsm-menu .fsm-toggle,\n    #fsm-menu button.fsm-toggle {\n{$toggle_css}    }\n";
                }
                
                if (isset($tg['icon_size'])) {
                    $css .= "    #fsm-menu.fsm-menu .fsm-toggle i,\n    #fsm-menu .fsm-toggle i {\n        font-size: {$tg['icon_size']}px !important;\n    }\n";
                }
            }
        }
        
        // Item overrides - use higher specificity
        if (isset($overrides['item'])) {
            $it = $overrides['item'];
            $item_css = '';
            
            if (isset($it['padding'])) {
                $ip = $it['padding'];
                $top = $ip['top'] ?? 12;
                $right = $ip['right'] ?? 12;
                $bottom = $ip['bottom'] ?? 12;
                $left = $ip['left'] ?? 12;
                $item_css .= "        padding: {$top}px {$right}px {$bottom}px {$left}px !important;\n";
            }
            if (isset($it['border_radius'])) {
                $item_css .= "        border-radius: {$it['border_radius']}px !important;\n";
            }
            if (isset($it['background_color'])) {
                $item_css .= "        background: {$it['background_color']} !important;\n";
            }
            if (isset($it['hover_background'])) {
                $css .= "    #fsm-menu.fsm-menu .fsm-item:hover,\n    #fsm-menu.fsm-menu a.fsm-item:hover,\n    #fsm-menu .fsm-item:hover,\n    #fsm-menu a.fsm-item:hover {\n        background: {$it['hover_background']} !important;\n    }\n";
            }
            if (isset($it['active_background'])) {
                $css .= "    #fsm-menu.fsm-menu .fsm-item:active,\n    #fsm-menu.fsm-menu a.fsm-item:active,\n    #fsm-menu .fsm-item:active,\n    #fsm-menu a.fsm-item:active {\n        background: {$it['active_background']} !important;\n    }\n";
            }
            
            if (!empty($item_css)) {
                $css .= "    #fsm-menu.fsm-menu .fsm-item,\n    #fsm-menu.fsm-menu a.fsm-item,\n    #fsm-menu .fsm-item,\n    #fsm-menu a.fsm-item {\n{$item_css}    }\n";
            }
        }
        
        // Position overrides - use higher specificity
        if (isset($overrides['position'])) {
            $pos = $overrides['position'];
            $menu_css = '';
            
            if (isset($pos['vertical'])) {
                $unit = $pos['vertical_unit'] ?? $base_settings['position']['vertical_unit'] ?? '%';
                $menu_css .= "        top: {$pos['vertical']}{$unit} !important;\n";
            }
            if (isset($pos['margin'])) {
                $menu_css .= "        {$side}: {$pos['margin']}px !important;\n";
            }
            if (isset($pos['side'])) {
                // Side change requires more complex handling
                $new_side = $pos['side'];
                $old_side = $side;
                if ($new_side !== $old_side) {
                    $menu_css .= "        {$old_side}: auto !important;\n";
                    $margin = $pos['margin'] ?? $base_settings['position']['margin'] ?? 0;
                    $menu_css .= "        {$new_side}: {$margin}px !important;\n";
                }
            }
            
            if (!empty($menu_css)) {
                $css .= "    #fsm-menu.fsm-menu {\n{$menu_css}    }\n";
            }
        }
        
        // Z-index override
        if (isset($overrides['z_index'])) {
            $css .= "    #fsm-menu.fsm-menu {\n        z-index: {$overrides['z_index']} !important;\n    }\n";
        }
        
        // Visibility/hide override
        if (isset($overrides['hide']) && $overrides['hide']) {
            $css .= "    #fsm-menu.fsm-menu {\n        display: none !important;\n    }\n";
        }
        
        return $css;
    }
    
    /**
     * Convert color to CSS filter for SVG images
     */
    private function hex_to_filter($color) {
        // Parse color to RGB
        $r = $g = $b = 255;
        
        if (strpos($color, '#') === 0) {
            $hex = ltrim($color, '#');
            // Support 8-digit hex (with alpha)
            if (strlen($hex) === 8) {
                $hex = substr($hex, 0, 6);
            }
            if (strlen($hex) === 3) {
                $r = hexdec($hex[0] . $hex[0]);
                $g = hexdec($hex[1] . $hex[1]);
                $b = hexdec($hex[2] . $hex[2]);
            } elseif (strlen($hex) >= 6) {
                $r = hexdec(substr($hex, 0, 2));
                $g = hexdec(substr($hex, 2, 2));
                $b = hexdec(substr($hex, 4, 2));
            }
        } elseif (preg_match('/rgba?\((\d+),\s*(\d+),\s*(\d+)/', $color, $matches)) {
            $r = (int)$matches[1];
            $g = (int)$matches[2];
            $b = (int)$matches[3];
        } else {
            return 'brightness(0) saturate(100%) invert(1)';
        }
        
        // Use pre-calculated filters for common colors for accuracy
        // For other colors, use improved algorithm
        
        // Check for white/near-white
        if ($r > 250 && $g > 250 && $b > 250) {
            return 'brightness(0) saturate(100%) invert(1)';
        }
        
        // Check for black/near-black
        if ($r < 10 && $g < 10 && $b < 10) {
            return 'brightness(0) saturate(100%)';
        }
        
        // Convert RGB to HSL
        $r_norm = $r / 255;
        $g_norm = $g / 255;
        $b_norm = $b / 255;
        
        $max = max($r_norm, $g_norm, $b_norm);
        $min = min($r_norm, $g_norm, $b_norm);
        $l = ($max + $min) / 2;
        
        $h = $s = 0;
        
        if ($max !== $min) {
            $d = $max - $min;
            $s = $l > 0.5 ? $d / (2 - $max - $min) : $d / ($max + $min);
            
            if ($max === $r_norm) {
                $h = (($g_norm - $b_norm) / $d + ($g_norm < $b_norm ? 6 : 0)) / 6;
            } elseif ($max === $g_norm) {
                $h = (($b_norm - $r_norm) / $d + 2) / 6;
            } else {
                $h = (($r_norm - $g_norm) / $d + 4) / 6;
            }
        }
        
        $h_deg = round($h * 360);
        $s_pct = round($s * 100);
        $l_pct = round($l * 100);
        
        // Improved filter calculation
        // Start with black, then apply transformations
        $invert = $l_pct > 50 ? 1 : 0;
        $invert_pct = $invert ? round((1 - ($l_pct / 100)) * 100) : round($l_pct);
        
        // Sepia creates a brownish base for hue-rotate
        $sepia = $s_pct > 0 ? 100 : 0;
        
        // Saturate amplifies the color
        $saturate = $s_pct > 0 ? round($s_pct * 20) : 0;
        $saturate = min($saturate, 2000); // Cap at 2000%
        
        // Hue-rotate shifts the color
        // Sepia base is around 30-40 degrees, so we need to offset
        $hue_offset = $s_pct > 0 ? ($h_deg - 30 + 360) % 360 : 0;
        
        // Brightness adjustment
        $brightness = 1;
        if ($l_pct > 50) {
            $brightness = 0.5 + ($l_pct / 200);
        } else {
            $brightness = $l_pct / 50;
        }
        $brightness = max(0.5, min(2, $brightness));
        
        if ($s_pct === 0) {
            // Grayscale - just use invert and brightness
            $gray_brightness = $l_pct / 100;
            return "brightness(0) saturate(100%) invert({$l_pct}%) brightness({$gray_brightness})";
        }
        
        return "brightness(0) saturate(100%) invert({$invert_pct}%) sepia({$sepia}%) saturate({$saturate}%) hue-rotate({$hue_offset}deg) brightness({$brightness})";
    }
    
    /**
     * Convert alignment value to CSS
     */
    private function get_align_value($align) {
        switch ($align) {
            case 'left': return 'flex-start';
            case 'right': return 'flex-end';
            default: return 'center';
        }
    }
    
    /**
     * Get first/last item border radius CSS
     */
    private function get_first_last_radius_css($item, $container_br) {
        $mode = $item['first_last_radius'] ?? 'container';
        $item_radius = $item['border_radius'] ?? 8;
        
        if ($mode === 'none') {
            // No special radius for first/last
            return "
/* First item - no special radius */
#fsm-menu .fsm-item:first-child,
#fsm-menu a.fsm-item:first-child {
    border-radius: 0 !important;
}

/* Last item - no special radius */
#fsm-menu .fsm-item:last-child,
#fsm-menu a.fsm-item:last-child {
    border-radius: 0 !important;
}";
        }
        
        if ($mode === 'item') {
            // Use item border radius for all
            return "";
        }
        
        // Default: container - use container border radius for first/last
        $top_left = $container_br['top_left'] ?? 16;
        $top_right = $container_br['top_right'] ?? 0;
        $bottom_right = $container_br['bottom_right'] ?? 0;
        $bottom_left = $container_br['bottom_left'] ?? 16;
        
        return "
/* First item - match container top corners */
#fsm-menu .fsm-item:first-child,
#fsm-menu a.fsm-item:first-child {
    border-radius: {$top_left}px {$top_right}px {$item_radius}px {$item_radius}px !important;
}

/* Last item - match container bottom corners */
#fsm-menu .fsm-item:last-child,
#fsm-menu a.fsm-item:last-child {
    border-radius: {$item_radius}px {$item_radius}px {$bottom_right}px {$bottom_left}px !important;
}

/* Only one item - match all container corners */
#fsm-menu .fsm-item:only-child,
#fsm-menu a.fsm-item:only-child {
    border-radius: {$top_left}px {$top_right}px {$bottom_right}px {$bottom_left}px !important;
}";
    }
    
    /**
     * Get toggle alignment CSS value
     */
    private function get_toggle_align($align) {
        switch ($align) {
            case 'top': return 'flex-start';
            case 'bottom': return 'flex-end';
            default: return 'center';
        }
    }
    
    /**
     * Get opposite icon for toggle animation
     */
    private function get_opposite_icon($icon) {
        $opposites = [
            'fa-chevron-left' => 'fa-chevron-right',
            'fa-chevron-right' => 'fa-chevron-left',
            'fa-angle-left' => 'fa-angle-right',
            'fa-angle-right' => 'fa-angle-left',
            'fa-arrow-left' => 'fa-arrow-right',
            'fa-arrow-right' => 'fa-arrow-left',
            'fa-caret-left' => 'fa-caret-right',
            'fa-caret-right' => 'fa-caret-left',
            'fa-bars' => 'fa-times',
            'fa-times' => 'fa-bars',
            'fa-plus' => 'fa-minus',
            'fa-minus' => 'fa-plus'
        ];
        return $opposites[$icon] ?? $icon;
    }
    
    /**
     * Get animation transition CSS
     */
    private function get_animation_transition($a) {
        $duration = ($a['duration'] ?? 300) . 'ms';
        $easing = $a['easing'] ?? 'ease-out';
        $type = $a['type'] ?? 'slide';
        
        switch ($type) {
            case 'fade':
                return "opacity {$duration} {$easing}, visibility {$duration} {$easing}";
            case 'scale':
                return "transform {$duration} {$easing}, opacity {$duration} {$easing}, visibility {$duration} {$easing}";
            case 'slide':
            default:
                return "transform {$duration} {$easing}, opacity {$duration} {$easing}, visibility {$duration} {$easing}";
        }
    }
    
    /**
     * Get menu container transition CSS
     */
    private function get_menu_transition($a, $side) {
        $duration = ($a['duration'] ?? 300) . 'ms';
        $easing = $a['easing'] ?? 'ease-out';
        $type = $a['type'] ?? 'slide';
        
        switch ($type) {
            case 'fade':
                return "opacity {$duration} {$easing}";
            case 'scale':
                return "transform {$duration} {$easing}";
            case 'slide':
            default:
                // For slide, we move the entire menu horizontally
                return "{$side} {$duration} {$easing}";
        }
    }
    
    /**
     * Get menu collapsed state CSS (moves entire menu including toggle)
     */
    private function get_menu_collapsed($a, $is_left, $width) {
        $type = $a['type'] ?? 'slide';
        
        switch ($type) {
            case 'fade':
                // Fade: just fade the nav, keep toggle visible
                return "";
            case 'scale':
                // Scale: scale from toggle position
                return "";
            case 'slide':
            default:
                // Slide: move entire menu by nav width only (toggle stays at edge)
                return $is_left ? "left: -{$width}px !important;" : "right: -{$width}px !important;";
        }
    }
    
    /**
     * Get animation open state CSS
     */
    private function get_animation_open($a) {
        $type = $a['type'] ?? 'slide';
        
        switch ($type) {
            case 'fade':
                return "opacity: 1 !important; visibility: visible !important;";
            case 'scale':
                return "transform: scale(1) !important; opacity: 1 !important; visibility: visible !important;";
            case 'slide':
            default:
                return "transform: translateX(0) !important; opacity: 1 !important; visibility: visible !important;";
        }
    }
    
    /**
     * Get animation collapsed state CSS
     */
    private function get_animation_collapsed($a, $is_left) {
        $type = $a['type'] ?? 'slide';
        
        switch ($type) {
            case 'fade':
                return "opacity: 0 !important; visibility: hidden !important;";
            case 'scale':
                return "transform: scale(0.8) !important; opacity: 0 !important; visibility: hidden !important;";
            case 'slide':
            default:
                $direction = $is_left ? 'translateX(-100%)' : 'translateX(100%)';
                return "transform: {$direction} !important; opacity: 0 !important; visibility: hidden !important;";
        }
    }
}
