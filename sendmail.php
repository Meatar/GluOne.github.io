<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/PHPMailer/src/Exception.php';
require __DIR__ . '/PHPMailer/src/PHPMailer.php';
require __DIR__ . '/PHPMailer/src/SMTP.php';

// ============================
// Конфигурация
// ============================
$API_TOKEN  = "cc07500932618b6bde6a0df57537be0bd08e5221d14a06324213c7848aa19708";       // твой токен
$SMTP_HOST  = "mail.hosting.reg.ru";
$SMTP_PORT  = 465;
$SMTP_USER  = "no-reply@gluone.ru";
$SMTP_PASS  = "YOUR_SMTP_PASSWORD";       // пароль от почтового ящика
$FROM_EMAIL = "no-reply@gluone.ru";
$FROM_NAME  = "GluOne App";

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
$isHtml   = $data["isHtml"]  ?? true; // по умолчанию HTML
$attachments = $data["attachments"] ?? []; // массив путей к файлам на сервере

if (!$to) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Missing 'to' field"]);
    exit;
}

// ============================
// Отправка письма через SMTP
// ============================
$mail = new PHPMailer(true);

try {
    // Настройка SMTP
    $mail->isSMTP();
    $mail->Host       = $SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = $SMTP_USER;
    $mail->Password   = $SMTP_PASS;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = $SMTP_PORT;

    // От кого / кому
    $mail->setFrom($FROM_EMAIL, $FROM_NAME);
    $mail->addAddress($to);

    // Вложения
    foreach ($attachments as $file) {
        if (file_exists($file)) {
            $mail->addAttachment($file);
        }
    }

    // Контент
    $mail->isHTML($isHtml);
    $mail->Subject = $subject;
    $mail->Body    = $body;
    if ($isHtml) {
        $mail->AltBody = strip_tags($body);
    }

    $mail->send();
    echo json_encode(["status" => "ok"]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $mail->ErrorInfo]);
}
