<?php
require_once 'config.php';
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$input = json_decode(file_get_contents('php://input'), true);
$userId = $input['user_id'] ?? null;
$cryptoType = $input['crypto_type'] ?? 'usdttrc20';

if (!$userId) {
    die(json_encode(['error' => 'user_id required']));
}

$ch = curl_init('https://api.nowpayments.io/v1/payment');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'x-api-key: ' . NOWPAYMENTS_API_KEY,
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'price_amount' => 10,
        'price_currency' => 'usd',
        'pay_currency' => $cryptoType,
        'ipn_callback_url' => 'https://vds-game.ink/api/ipn.php',
        'order_id' => 'vip_' . $userId . '_' . time(),
        'order_description' => 'VIP Пирамикс'
    ])
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($httpCode >= 400) {
    http_response_code(500);
    die($response);
}

echo $response;
