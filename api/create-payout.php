<?php
// api/create-payout.php
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'Method not allowed']));
}

$input = json_decode(file_get_contents('php://input'), true);
$address = $input['address'] ?? '';
$amount = $input['amount'] ?? 0;
$currency = $input['currency'] ?? 'usdttrc20';

if (!$address || !$amount) {
    die(json_encode(['error' => 'address and amount required']));
}

// Проверяем минимальную сумму
$ch = curl_init("https://api.nowpayments.io/v1/min-amount?currency_from={$currency}&currency_to={$currency}");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['x-api-key: ' . NOWPAYMENTS_API_KEY]
]);
$minAmount = json_decode(curl_exec($ch), true)['min_amount'] ?? 1;
curl_close($ch);

if ($amount < $minAmount) {
    die(json_encode(['error' => "Minimum payout: {$minAmount}"]));
}

// Создаём выплату
$ch = curl_init('https://api.nowpayments.io/v1/payout');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'x-api-key: ' . NOWPAYMENTS_API_KEY,
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'payouts' => [[
            'address' => $address,
            'currency' => $currency,
            'amount' => $amount,
            'ipn_callback_url' => 'https://vds-game.ink/api/payout-ipn.php'
        ]]
    ])
]);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
