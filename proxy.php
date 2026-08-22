<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/html; charset=utf-8');

$url = $_GET['url'] ?? '';

if (!$url) {
    http_response_code(400);
    echo 'URL is required';
    exit;
}

// Проверяем, что URL ведёт на tanki.su
if (strpos($url, 'tanki.su') === false) {
    http_response_code(403);
    echo 'Only tanki.su URLs are allowed';
    exit;
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language: ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    echo $response;
} else {
    http_response_code($httpCode);
    echo 'Error: ' . $httpCode;
}
?>
