<?php
/**
 * Plugin Name: Haroboz CORS (temporaire)
 * Plugin URI: https://github.com/remioravec/Haroboz
 * Description: Active CORS sur l'API REST WordPress pour le pusher Haroboz. À DÉSACTIVER et SUPPRIMER après utilisation.
 * Version: 1.0
 * Author: Haroboz
 * License: GPL-2.0-or-later
 *
 * INSTALLATION:
 *   Extensions → Ajouter → Téléverser une extension → haroboz-cors.zip
 *
 * SÉCURITÉ: Désactivez et supprimez ce plugin une fois le push terminé.
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
