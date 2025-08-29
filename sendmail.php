<?php
// ============================
// Конфигурация
// ============================
$API_TOKEN  = "cc07500932618b6bde6a0df57537be0bd08e5221d14a06324213c7848aa19708";  // замените на ваш токен
$FROM_EMAIL = "no-reply@gluone.ru";  // отправитель

// ============================
// Проверка авторизации
// ============================
$headers = getallheaders();
if (!isset($headers['Authorization']) || $headers['Authorization'] !== "Bearer $API_TOKEN") {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Unauthorized"]);
    exit;
}

// ============================
// Чтение входящих данных
// ============================
$data = json_decode(file_get_contents("php://input"), true);

$to       = $data["to"]      ?? null;
$subject  = $data["subject"] ?? "(no subject)";
$body     = $data["body"]    ?? "";
$isHtml   = $data["isHtml"]  ?? false;  // <- можно передавать true/false

if (!$to) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing 'to' field"]);
    exit;
}

// ============================
// Формирование заголовков
// ============================
$headers  = "From: $FROM_EMAIL\r\n";
$headers .= "Reply-To: $FROM_EMAIL\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= $isHtml
    ? "Content-Type: text/html; charset=UTF-8\r\n"
    : "Content-Type: text/plain; charset=UTF-8\r\n";

// ============================
// Отправка письма
// ============================
if (mail($to, $subject, $body, $headers)) {
    echo json_encode(["status" => "ok"]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Mail send failed"]);
}
