<?php
/**
 * Plugin Name: KSIM PDF Receiver (Confirm PDF)
 * Description: Receives confirm PDFs from the engraving simulator and stores them in the WordPress Media Library.
 * Version: 0.1.0
 */

if (!defined('ABSPATH')) {
  exit;
}

// Set this in wp-config.php:
// define('KSIM_UPLOAD_KEY', 'your-long-random-string');
function ksim_get_upload_key() {
  if (defined('KSIM_UPLOAD_KEY') && is_string(KSIM_UPLOAD_KEY) && KSIM_UPLOAD_KEY !== '') {
    return KSIM_UPLOAD_KEY;
  }
  return null;
}

function ksim_is_ksim_route() {
  if (!isset($_SERVER['REQUEST_URI'])) return false;
  return strpos($_SERVER['REQUEST_URI'], '/wp-json/ksim/v1/') !== false;
}

// Minimal CORS for cross-origin frontends (e.g. GitHub Pages dev/test).
add_filter('rest_pre_serve_request', function ($served, $result, $request, $server) {
  if (!ksim_is_ksim_route()) return $served;

  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: GET,POST,OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, X-KSIM-KEY');
  header('Access-Control-Max-Age: 600');

  if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Short-circuit preflight.
    status_header(204);
    exit;
  }

  return $served;
}, 10, 4);

function ksim_validate_design_id($design_id) {
  if (!is_string($design_id)) return false;
  // Matches current app pattern like: 240101_ABCD2345 (example)
  return preg_match('/^\d{6}_[A-Z2-9]{8}$/', $design_id) === 1;
}

function ksim_require_key(WP_REST_Request $request) {
  $expected = ksim_get_upload_key();
  if (!$expected) {
    return new WP_Error('ksim_missing_server_key', 'Server upload key is not configured (KSIM_UPLOAD_KEY).', array('status' => 500));
  }
  $given = $request->get_header('x-ksim-key');
  if (!is_string($given) || $given === '' || !hash_equals($expected, $given)) {
    return new WP_Error('ksim_unauthorized', 'Unauthorized', array('status' => 401));
  }
  return null;
}

function ksim_upload_design_pdf(WP_REST_Request $request) {
  $auth_error = ksim_require_key($request);
  if ($auth_error) return $auth_error;

  $design_id = $request->get_param('designId');
  $template_key = (string)$request->get_param('templateKey');
  $created_at = (string)$request->get_param('createdAt');

  if (!ksim_validate_design_id($design_id)) {
    return new WP_Error('ksim_bad_design_id', 'Invalid designId', array('status' => 400));
  }

  $files = $request->get_file_params();
  if (!isset($files['pdf'])) {
    return new WP_Error('ksim_missing_pdf', 'Missing pdf file', array('status' => 400));
  }

  $file = $files['pdf'];
  if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
    return new WP_Error('ksim_bad_upload', 'Upload failed', array('status' => 400));
  }

  // Validate mime/extension loosely; WP will also validate on handle.
  $file_type = wp_check_filetype_and_ext($file['tmp_name'], $file['name']);
  if ($file_type['ext'] !== 'pdf') {
    return new WP_Error('ksim_bad_filetype', 'Only PDF is allowed', array('status' => 400));
  }

  require_once(ABSPATH . 'wp-admin/includes/file.php');
  $overrides = array(
    'test_form' => false,
    'mimes' => array('pdf' => 'application/pdf'),
  );

  // Force filename to include designId for easier manual search.
  $file['name'] = $design_id . '-confirm.pdf';
  $uploaded = wp_handle_upload($file, $overrides);

  if (isset($uploaded['error'])) {
    return new WP_Error('ksim_upload_error', $uploaded['error'], array('status' => 500));
  }

  $attachment = array(
    'post_mime_type' => 'application/pdf',
    'post_title' => 'KSIM Confirm PDF ' . $design_id,
    'post_status' => 'inherit',
  );

  $attachment_id = wp_insert_attachment($attachment, $uploaded['file']);
  if (!$attachment_id || is_wp_error($attachment_id)) {
    return new WP_Error('ksim_attachment_error', 'Failed to create attachment', array('status' => 500));
  }

  // Store searchable metadata.
  update_post_meta($attachment_id, '_ksim_design_id', $design_id);
  if ($template_key !== '') update_post_meta($attachment_id, '_ksim_template_key', $template_key);
  if ($created_at !== '') update_post_meta($attachment_id, '_ksim_created_at', $created_at);

  require_once(ABSPATH . 'wp-admin/includes/image.php');
  $metadata = wp_generate_attachment_metadata($attachment_id, $uploaded['file']);
  if ($metadata) {
    wp_update_attachment_metadata($attachment_id, $metadata);
  }

  return array(
    'ok' => true,
    'designId' => $design_id,
    'attachmentId' => (int)$attachment_id,
    'pdfUrl' => wp_get_attachment_url($attachment_id),
    'fileName' => basename($uploaded['file']),
    'sizeBytes' => filesize($uploaded['file']),
  );
}

function ksim_list_design_pdfs(WP_REST_Request $request) {
  $auth_error = ksim_require_key($request);
  if ($auth_error) return $auth_error;

  $args = array(
    'post_type' => 'attachment',
    'post_status' => 'inherit',
    'post_mime_type' => 'application/pdf',
    'posts_per_page' => 200,
    'meta_key' => '_ksim_design_id',
    'orderby' => 'date',
    'order' => 'DESC',
  );

  $query = new WP_Query($args);
  $items = array();
  foreach ($query->posts as $post) {
    $design_id = get_post_meta($post->ID, '_ksim_design_id', true);
    if (!$design_id) continue;
    $items[] = array(
      'designId' => (string)$design_id,
      'templateKey' => (string)get_post_meta($post->ID, '_ksim_template_key', true),
      'createdAt' => (string)get_post_meta($post->ID, '_ksim_created_at', true),
      'uploadedAt' => get_the_date('c', $post),
      'attachmentId' => (int)$post->ID,
      'pdfUrl' => wp_get_attachment_url($post->ID),
    );
  }

  return array('ok' => true, 'items' => $items);
}

add_action('rest_api_init', function () {
  register_rest_route('ksim/v1', '/designs', array(
    array(
      'methods' => WP_REST_Server::CREATABLE,
      'callback' => 'ksim_upload_design_pdf',
      'permission_callback' => '__return_true',
    ),
    array(
      'methods' => WP_REST_Server::READABLE,
      'callback' => 'ksim_list_design_pdfs',
      'permission_callback' => '__return_true',
    ),
  ));
});

