<?php
// api/check-payment.php
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$paymentId = $_GET['payment_id'] ?? null;

if (!$paymentId) {
    die(json_encode(['error' => 'payment_id required']));
}

$ch = curl_init('https://api.nowpayments.io/v1/payment/' . $paymentId);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['x-api-key: ' . NOWPAYMENTS_API_KEY]
]);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
