<?php
/**
 * Plugin Deactivator
 */

if (!defined('ABSPATH')) exit;

class FSM_Deactivator {
    
    public static function deactivate() {
        // Clean up if needed
        // Note: We don't delete options on deactivation to preserve user settings
    }
}
