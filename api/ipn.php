<?php
// api/ipn.php
require_once 'config.php';

// Логируем все запросы
file_put_contents('ipn_log.txt', date('Y-m-d H:i:s') . " - IPN received\n" . file_get_contents('php://input') . "\n\n", FILE_APPEND);

// Проверяем подпись
$receivedHmac = $_SERVER['HTTP_X_NOWPAYMENTS_SIG'] ?? '';
$body = file_get_contents('php://input');
$calculatedHmac = hash_hmac('sha512', $body, NOWPAYMENTS_IPN_SECRET);

if (!hash_equals($receivedHmac, $calculatedHmac)) {
    http_response_code(403);
    file_put_contents('ipn_log.txt', date('Y-m-d H:i:s') . " - Invalid signature\n\n", FILE_APPEND);
    die('Invalid signature');
}

$data = json_decode($body, true);

if (($data['payment_status'] ?? '') === 'finished') {
    $orderId = $data['order_id'] ?? '';
    preg_match('/vip_(\d+)_/', $orderId, $matches);
    $userId = $matches[1] ?? null;
    
    if ($userId) {
        // Активируем VIP через Supabase
        $ch = curl_init(SUPABASE_URL . '/rest/v1/rpc/purchase_vip');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'apikey: ' . SUPABASE_KEY,
                'Content-Type: application/json'
            ],
            CURLOPT_POSTFIELDS => json_encode(['p_user_id' => (int)$userId])
        ]);
        $result = curl_exec($ch);
        curl_close($ch);
        
        file_put_contents('ipn_log.txt', date('Y-m-d H:i:s') . " - VIP activated for user $userId\n\n", FILE_APPEND);
    }
}

http_response_code(200);
echo 'OK';
