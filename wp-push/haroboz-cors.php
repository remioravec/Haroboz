<?php
/**
 * Plugin Name: Haroboz CORS
 * Description: Active CORS pour l'API REST WordPress (nécessaire pour le pusher Haroboz)
 * Version: 1.0
 *
 * INSTALLATION:
 * 1. Uploader ce fichier dans wp-content/mu-plugins/haroboz-cors.php
 *    (créer le dossier mu-plugins s'il n'existe pas)
 * 2. C'est tout — les mu-plugins sont activés automatiquement
 *
 * SÉCURITÉ: Supprimez ce fichier une fois le push terminé.
 */

add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
        header('Access-Control-Allow-Credentials: true');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            status_header(200);
            exit();
        }

        return $value;
    });
}, 15);
