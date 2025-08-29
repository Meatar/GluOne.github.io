<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/PHPMailer/src/Exception.php';
require __DIR__ . '/PHPMailer/src/PHPMailer.php';
require __DIR__ . '/PHPMailer/src/SMTP.php';

header('Content-Type: application/json; charset=UTF-8');

// -------------------- Чтение config.env --------------------
$configPath = __DIR__ . '/config.env';
$env = file_exists($configPath)
    ? (parse_ini_file($configPath, false, INI_SCANNER_RAW) ?: [])
    : [];

$API_TOKEN  = $env['API_TOKEN']  ?? '';
$SMTP_HOST  = $env['SMTP_HOST']  ?? 'mail.hosting.reg.ru';
$SMTP_PORT  = (int)($env['SMTP_PORT'] ?? 465);
$SMTP_USER  = $env['SMTP_USER']  ?? '';
$SMTP_PASS  = $env['SMTP_PASS']  ?? '';
$FROM_EMAIL = $env['FROM_EMAIL'] ?? $SMTP_USER;
$FROM_NAME  = $env['FROM_NAME']  ?? 'Mailer';
$USE_SMTPS  = isset($env['USE_SMTPS']) ? filter_var($env['USE_SMTPS'], FILTER_VALIDATE_BOOLEAN) : true;

// -------------------- Авторизация --------------------
$headers = function_exists('getallheaders') ? getallheaders() : [];
$auth = $_SERVER['HTTP_AUTHORIZATION']
    ?? ($headers['Authorization'] ?? $headers['authorization'] ?? null);

// fallback на X-Api-Key
if (!$auth && isset($headers['X-Api-Key'])) {
    $auth = 'Bearer ' . $headers['X-Api-Key'];
}

if ($API_TOKEN === '' || $auth !== "Bearer $API_TOKEN") {
    http_response_code(401);
    echo json_encode(['status'=>'error','message'=>'Unauthorized']);
    exit;
}

// -------------------- Чтение JSON --------------------
$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['status'=>'error','message'=>'Invalid JSON']);
    exit;
}

$to         = $data['to'] ?? null;
$subject    = $data['subject'] ?? '(no subject)';
$body       = $data['body'] ?? '';
$isHtml     = $data['isHtml'] ?? true;
$attachments= $data['attachments'] ?? [];
$embedded   = $data['embedded'] ?? [];

if (!$to) {
    http_response_code(400);
    echo json_encode(['status'=>'error','message'=>"Field 'to' required"]);
    exit;
}

// -------------------- Отправка --------------------
$mail = new PHPMailer(true);

try {
    $mail->isSMTP();
    $mail->Host       = $SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = $SMTP_USER;
    $mail->Password   = $SMTP_PASS;
    $mail->CharSet    = 'UTF-8';
    $mail->Encoding   = 'base64';

    if ($USE_SMTPS) {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = $SMTP_PORT ?: 465;
    } else {
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $SMTP_PORT ?: 587;
    }

    $mail->setFrom($FROM_EMAIL, $FROM_NAME);
    $mail->addAddress($to);

    // Вложения
    foreach ($attachments as $file) {
        if (file_exists($file)) {
            $mail->addAttachment($file);
        }
    }

    // Inline картинки
    foreach ($embedded as $item) {
        if (isset($item['path'], $item['cid']) && file_exists($item['path'])) {
            $mail->addEmbeddedImage(
                $item['path'],
                $item['cid'],
                $item['name'] ?? basename($item['path']),
                'base64',
                $item['mime'] ?? mime_content_type($item['path'])
            );
        }
    }

    $mail->isHTML((bool)$isHtml);
    $mail->Subject = $subject;
    $mail->Body    = $body;
    if ($isHtml) {
        $mail->AltBody = strip_tags($body);
    }

    $mail->send();
    echo json_encode(['status'=>'ok']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status'=>'error','message'=>$mail->ErrorInfo]);
}
