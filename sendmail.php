<?php
// ============================
// Конфигурация
// ============================
$API_TOKEN = "cc07500932618b6bde6a0df57537be0bd08e5221d14a06324213c7848aa19708";  // задай свой токен
$FROM_EMAIL = "no-reply@gluone.ru"; // адрес отправителя

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

$to      = $data["to"]      ?? null;
$subject = $data["subject"] ?? "(no subject)";
$body    = $data["body"]    ?? "";

if (!$to) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing 'to' field"]);
    exit;
}

// ============================
// Формирование письма
// ============================
$headers  = "From: $FROM_EMAIL\r\n";
$headers .= "Reply-To: $FROM_EMAIL\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// ============================
// Отправка письма
// ============================
if (mail($to, $subject, $body, $headers)) {
    echo json_encode(["status" => "ok"]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Mail send failed"]);
}
