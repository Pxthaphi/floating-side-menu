<?php
/**
 * Plugin Loader - Orchestrates all hooks and components
 */

if (!defined('ABSPATH')) exit;

class FSM_Loader {
    
    private $settings;
    private $admin;
    private $public;
    
    public function __construct() {
        $this->settings = new FSM_Settings();
    }
    
    public function run() {
        // Admin
        if (is_admin()) {
            $this->admin = new FSM_Admin($this->settings);
            add_action('admin_menu', [$this->admin, 'add_menu']);
            add_action('admin_enqueue_scripts', [$this->admin, 'enqueue_assets']);
            add_action('wp_ajax_fsm_save', [$this->admin, 'ajax_save']);
            add_action('wp_ajax_fsm_discard_draft', [$this->admin, 'ajax_discard_draft']);
            add_action('wp_ajax_fsm_get_history', [$this->admin, 'ajax_get_history']);
            add_action('wp_ajax_fsm_rollback', [$this->admin, 'ajax_rollback']);
            add_action('wp_ajax_fsm_delete_history', [$this->admin, 'ajax_delete_history']);
            add_action('wp_ajax_fsm_clear_history', [$this->admin, 'ajax_clear_history']);
        }
        
        // Public
        $this->public = new FSM_Public($this->settings);
        add_action('wp_enqueue_scripts', [$this->public, 'enqueue_assets']);
        add_action('wp_footer', [$this->public, 'render_menu']);
    }
}
