<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: text/html; charset=utf-8');

$url = $_GET['url'] ?? '';

if (!$url) {
    http_response_code(400);
    echo 'URL is required';
    exit;
}

if (strpos($url, 'tanki.su') === false) {
    http_response_code(403);
    echo 'Only tanki.su URLs are allowed';
    exit;
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
