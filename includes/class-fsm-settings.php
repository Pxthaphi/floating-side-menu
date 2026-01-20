<?php
/**
 * Settings Manager
 */

if (!defined('ABSPATH')) exit;

class FSM_Settings {
    
    private $settings;
    private $items;
    private $max_history = 20; // จำนวน history สูงสุดที่เก็บ
    
    public function __construct() {
        $this->load();
    }
    
    private function load() {
        $defaults = $this->get_defaults();
        $saved_settings = get_option('fsm_settings', []);
        
        // Deep merge saved settings with defaults to ensure new fields are available
        $this->settings = $this->array_merge_recursive_distinct($defaults, $saved_settings);
        $this->items = get_option('fsm_items', []);
    }
    
    /**
     * Merge arrays recursively, with saved values overriding defaults
     */
    private function array_merge_recursive_distinct(array $defaults, array $saved) {
        $merged = $defaults;
        
        foreach ($saved as $key => $value) {
            if (is_array($value) && isset($merged[$key]) && is_array($merged[$key])) {
                $merged[$key] = $this->array_merge_recursive_distinct($merged[$key], $value);
            } else {
                $merged[$key] = $value;
            }
        }
        
        return $merged;
    }
    
    public function get_settings() {
        // Ensure tablet and mobile are objects (not arrays)
        if (isset($this->settings['tablet']) && is_array($this->settings['tablet']) && empty($this->settings['tablet'])) {
            $this->settings['tablet'] = (object)[];
        }
        if (isset($this->settings['mobile']) && is_array($this->settings['mobile']) && empty($this->settings['mobile'])) {
            $this->settings['mobile'] = (object)[];
        }
        return $this->settings;
    }
    
    public function get_items() {
        return $this->items;
    }
    
    /**
     * Get draft settings
     */
    public function get_draft_settings() {
        $draft = get_option('fsm_settings_draft', null);
        if ($draft) {
            // Ensure tablet and mobile are objects (not arrays)
            if (isset($draft['tablet']) && is_array($draft['tablet']) && empty($draft['tablet'])) {
                $draft['tablet'] = (object)[];
            }
            if (isset($draft['mobile']) && is_array($draft['mobile']) && empty($draft['mobile'])) {
                $draft['mobile'] = (object)[];
            }
        }
        return $draft;
    }
    
    /**
     * Get draft items
     */
    public function get_draft_items() {
        return get_option('fsm_items_draft', null);
    }
    
    /**
     * Check if there's a draft
     */
    public function has_draft() {
        return get_option('fsm_has_draft', false);
    }
    
    /**
     * Get publish status
     */
    public function get_status() {
        return get_option('fsm_status', 'published');
    }
    
    /**
     * Get history
     */
    public function get_history() {
        return get_option('fsm_history', []);
    }
    
    /**
     * Add to history
     */
    private function add_to_history($type, $settings, $items, $label = '') {
        $history = $this->get_history();
        
        // สร้าง history entry
        $entry = [
            'id' => uniqid('fsm_'),
            'type' => $type, // 'draft' or 'publish'
            'timestamp' => time(),
            'label' => $label ?: ($type === 'publish' ? 'Published' : 'Draft saved'),
            'settings' => $settings,
            'items' => $items,
            'items_count' => count($items)
        ];
        
        // เพิ่มไว้ด้านบน
        array_unshift($history, $entry);
        
        // จำกัดจำนวน history
        if (count($history) > $this->max_history) {
            $history = array_slice($history, 0, $this->max_history);
        }
        
        update_option('fsm_history', $history);
        
        return $entry['id'];
    }
    
    /**
     * Get history entry by ID
     */
    public function get_history_entry($id) {
        $history = $this->get_history();
        foreach ($history as $entry) {
            if ($entry['id'] === $id) {
                // Ensure tablet and mobile are objects in settings
                if (isset($entry['settings']['tablet']) && is_array($entry['settings']['tablet']) && empty($entry['settings']['tablet'])) {
                    $entry['settings']['tablet'] = (object)[];
                }
                if (isset($entry['settings']['mobile']) && is_array($entry['settings']['mobile']) && empty($entry['settings']['mobile'])) {
                    $entry['settings']['mobile'] = (object)[];
                }
                return $entry;
            }
        }
        return null;
    }
    
    /**
     * Delete history entry
     */
    public function delete_history_entry($id) {
        $history = $this->get_history();
        $history = array_filter($history, function($entry) use ($id) {
            return $entry['id'] !== $id;
        });
        update_option('fsm_history', array_values($history));
        return true;
    }
    
    /**
     * Clear all history
     */
    public function clear_history() {
        update_option('fsm_history', []);
        return true;
    }
    
    /**
     * Rollback to history entry
     */
    public function rollback($id, $as_draft = false) {
        $entry = $this->get_history_entry($id);
        if (!$entry) {
            return false;
        }
        
        if ($as_draft) {
            return $this->save_draft($entry['settings'], $entry['items']);
        } else {
            return $this->publish($entry['settings'], $entry['items'], 'Rollback from ' . date('M j, H:i', $entry['timestamp']));
        }
    }
    
    /**
     * Save as draft
     */
    public function save_draft($settings, $items) {
        update_option('fsm_settings_draft', $settings);
        update_option('fsm_items_draft', $items);
        update_option('fsm_has_draft', true);
        update_option('fsm_status', 'draft');
        update_option('fsm_draft_timestamp', time());
        
        // Add to history
        $this->add_to_history('draft', $settings, $items);
        
        return true;
    }
    
    /**
     * Publish settings (save to live)
     */
    public function publish($settings, $items, $label = '') {
        $this->settings = $settings;
        $this->items = $items;
        update_option('fsm_settings', $settings);
        update_option('fsm_items', $items);
        update_option('fsm_has_draft', false);
        update_option('fsm_status', 'published');
        update_option('fsm_version_timestamp', time());
        
        // Clear draft
        delete_option('fsm_settings_draft');
        delete_option('fsm_items_draft');
        
        // Add to history
        $this->add_to_history('publish', $settings, $items, $label ?: 'Published');
        
        return true;
    }
    
    /**
     * Discard draft
     */
    public function discard_draft() {
        delete_option('fsm_settings_draft');
        delete_option('fsm_items_draft');
        update_option('fsm_has_draft', false);
        update_option('fsm_status', 'published');
        return true;
    }
    
    public function save_settings($settings) {
        $this->settings = $settings;
        return update_option('fsm_settings', $settings);
    }
    
    public function save_items($items) {
        $this->items = $items;
        return update_option('fsm_items', $items);
    }
    
    public function get_defaults() {
        return [
            'position' => ['side' => 'right', 'vertical' => 50, 'vertical_unit' => '%', 'margin' => 0],
            'container' => [
                'background_color' => '#1A1A18',
                'width' => 120,
                'gap' => 0,
                'padding' => ['top' => 14, 'right' => 14, 'bottom' => 14, 'left' => 14],
                'border_radius' => ['top_left' => 16, 'top_right' => 0, 'bottom_right' => 0, 'bottom_left' => 16],
                'box_shadow' => ['x' => -8, 'y' => 0, 'blur' => 32, 'spread' => 0, 'color' => '#00000026']
            ],
            'typography' => [
                'font_family' => 'inherit',
                'font_size' => 11,
                'font_weight' => 500,
                'line_height' => 1.4,
                'text_color' => '#ffffffe6',
                'hover_text_color' => '#ffffff',
                'active_text_color' => '#ffffff',
                'text_align' => 'center'
            ],
            'icon' => ['size' => 22, 'color' => '#ffffffd9', 'hover_color' => '#ffffff', 'active_color' => '#ffffff', 'spacing' => 8, 'position' => 'top', 'align' => 'center'],
            'item' => [
                'padding' => ['top' => 12, 'right' => 12, 'bottom' => 12, 'left' => 12],
                'border_radius' => 8,
                'first_last_radius' => 'container',
                'background_color' => 'transparent',
                'hover_background' => '#ffffff1a',
                'active_background' => '#ffffff26',
                'transition_duration' => 200
            ],
            'toggle' => [
                'enabled' => true,
                'icon_open' => 'fa-chevron-left',
                'icon_closed' => 'fa-chevron-right',
                'icon_size' => 14,
                'icon_rotate' => 0,
                'background_color' => '#1A1A18',
                'icon_color' => '#ffffff',
                'hover_background' => '#ffffff1a',
                'hover_icon_color' => '#ffffff',
                'active_background' => '#ffffff26',
                'active_icon_color' => '#ffffff',
                'size' => 40,
                'width' => 28,
                'border_radius' => 8,
                'align' => 'middle'
            ],
            'animation' => ['duration' => 300, 'easing' => 'ease-out', 'type' => 'slide'],
            'hover' => [
                'background_color' => '#ffffff1a',
                'text_color' => '#ffffff',
                'scale' => 1.0,
                'transition_duration' => 200
            ],
            'responsive' => ['hide_on_mobile' => false, 'breakpoint' => 768, 'auto_collapse_mobile' => true],
            'visibility' => ['mode' => 'all', 'show_on_home' => true, 'show_on_archive' => true, 'show_on_single' => true],
            'z_index' => 9999,
            // Breakpoint configurations
            'breakpoints' => [
                'tablet' => 1024,
                'mobile' => 768
            ],
            // Tablet overrides (only store values that differ from desktop)
            'tablet' => (object)[],
            // Mobile overrides (only store values that differ from tablet/desktop)
            'mobile' => (object)[]
        ];
    }
}
