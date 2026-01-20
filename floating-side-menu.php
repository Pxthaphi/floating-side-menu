<?php
/**
 * Plugin Name: Floating Side Menu
 * Plugin URI: https://inspirax.dev/floating-side-menu
 * Description: Customizable floating side menu with live preview, Font Awesome & Dashicons support.
 * Version: 2.0.0
 * Author: InspiraX
 * Author URI: https://inspirax.dev
 * License: GPL-2.0+
 * Text Domain: floating-side-menu
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) exit;

define('FSM_VERSION', '2.0.0');
define('FSM_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('FSM_PLUGIN_URL', plugin_dir_url(__FILE__));
define('FSM_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Autoloader
spl_autoload_register(function ($class) {
    $prefix = 'FSM_';
    if (strpos($class, $prefix) !== 0) return;
    
    $class_name = str_replace($prefix, '', $class);
    $class_name = strtolower(str_replace('_', '-', $class_name));
    $file = FSM_PLUGIN_DIR . 'includes/class-fsm-' . $class_name . '.php';
    
    if (file_exists($file)) {
        require_once $file;
    }
});

// Activation
register_activation_hook(__FILE__, function() {
    require_once FSM_PLUGIN_DIR . 'includes/class-fsm-activator.php';
    FSM_Activator::activate();
});

// Deactivation
register_deactivation_hook(__FILE__, function() {
    require_once FSM_PLUGIN_DIR . 'includes/class-fsm-deactivator.php';
    FSM_Deactivator::deactivate();
});

// Initialize
add_action('plugins_loaded', function() {
    $loader = new FSM_Loader();
    $loader->run();
});
