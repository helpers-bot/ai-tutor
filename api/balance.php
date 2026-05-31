<?php
// api/balance.php
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$ch = curl_init('https://api.nowpayments.io/v1/balance');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['x-api-key: ' . NOWPAYMENTS_API_KEY]
]);

echo curl_exec($ch);
curl_close($ch);
