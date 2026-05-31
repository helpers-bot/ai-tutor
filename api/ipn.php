<?php
require_once 'config.php';
file_put_contents('ipn_log.txt', date('Y-m-d H:i:s') . " IPN\n" . file_get_contents('php://input') . "\n\n", FILE_APPEND);

$receivedHmac = $_SERVER['HTTP_X_NOWPAYMENTS_SIG'] ?? '';
$body = file_get_contents('php://input');
$calculatedHmac = hash_hmac('sha512', $body, NOWPAYMENTS_IPN_SECRET);

if (!hash_equals($receivedHmac, $calculatedHmac)) {
    http_response_code(403);
    die('Invalid signature');
}

$data = json_decode($body, true);

if (($data['payment_status'] ?? '') === 'finished') {
    preg_match('/vip_(\d+)_/', $data['order_id'] ?? '', $matches);
    $userId = $matches[1] ?? null;
    
    if ($userId) {
        $ch = curl_init(SUPABASE_URL . '/rest/v1/rpc/purchase_vip_crypto');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['apikey: ' . SUPABASE_KEY, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode(['p_user_id' => (int)$userId])
        ]);
        curl_exec($ch);
        curl_close($ch);
    }
}
http_response_code(200);
