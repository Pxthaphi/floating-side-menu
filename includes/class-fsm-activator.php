<?php
/**
 * Plugin Activator
 */

if (!defined('ABSPATH')) exit;

class FSM_Activator {
    
    public static function activate() {
        // Set default options if not exists
        if (!get_option('fsm_settings')) {
            update_option('fsm_settings', self::get_default_settings());
        }
        if (!get_option('fsm_items')) {
            update_option('fsm_items', self::get_default_items());
        }
    }
    
    private static function get_default_settings() {
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
            'z_index' => 9999
        ];
    }
    
    private static function get_default_items() {
        return [
            ['id' => 1, 'icon_type' => 'fontawesome', 'icon' => 'fa-home', 'icon_size' => null, 'label' => 'Home', 'url' => home_url('/'), 'target' => '_self'],
            ['id' => 2, 'icon_type' => 'fontawesome', 'icon' => 'fa-info-circle', 'icon_size' => null, 'label' => 'About', 'url' => '#', 'target' => '_self'],
            ['id' => 3, 'icon_type' => 'fontawesome', 'icon' => 'fa-envelope', 'icon_size' => null, 'label' => 'Contact', 'url' => '#', 'target' => '_self']
        ];
    }
}
