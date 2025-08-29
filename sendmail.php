<?php
declare(strict_types=1);

/**
 * sendmail.php — лёгкий HTTP→SMTP шлюз.
 * Зависимости: PHPMailer.
 *
 * Поддерживает:
 *  - Авторизацию по токену (Authorization: Bearer ... или X-Api-Key)
 *  - HTML/Plain текст
 *  - Вложения (attachments)
 *  - Inline-картинки (embedded)
 *  - CC/BCC/Reply-To
 *  - Загрузка конфигурации из config.env (при наличии)
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ---------- ПУТИ К PHPMailer ----------
// Вариант A: Composer
$composerAutoload = __DIR__ . '/vendor/autoload.php';
// Вариант B: Ручная раскладка
$manualPHPMailer = [
    __DIR__ . '/PHPMailer/src/Exception.php',
    __DIR__ . '/PHPMailer/src/PHPMailer.php',
    __DIR__ . '/PHPMailer/src/SMTP.php',
];

// ---------- ВКЛЮЧИТЬ PHPMailer ----------
if (file_exists($composerAutoload)) {
    require $composerAutoload;
} else {
    foreach ($manualPHPMailer as $f) {
        if (!file_exists($f)) {
            http_response_code(500);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'status'  => 'error',
                'message' => 'PHPMailer not found. Install via Composer or put PHPMailer/src/* next to this script.',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        require $f;
    }
}

// ---------- КОНФИГ ----------
header('Content-Type: application/json; charset=UTF-8');

// Пытаемся загрузить config.env (формат INI): ключ=значение
$env = [];
$configPath = __DIR__ . '/config.env';
if (file_exists($configPath)) {
    $env = parse_ini_file($configPath, false, INI_SCANNER_TYPED) ?: [];
}

// Чтение переменных окружения с fallback на config.env и дефолты
function env_get(string $key, ?string $default = null, array $env = []): ?string {
    $v = getenv($key);
    if ($v !== false && $v !== '') return $v;
    if (isset($env[$key]) && $env[$key] !== '') return (string)$env[$key];
    return $default;
}

// Безопасный флаг (bool) из окружения/config.env
function env_flag(string $key, bool $default, array $env = []): bool {
    $v = getenv($key);
    if ($v === false) {
        $v = $env[$key] ?? ($default ? '1' : '0');
    }
    $v = strtolower((string)$v);
    return in_array($v, ['1','true','yes','on'], true);
}

// Основные настройки (правь в config.env)
$API_TOKEN   = env_get('API_TOKEN',   '', $env);
$SMTP_HOST   = env_get('SMTP_HOST',   'mail.hosting.reg.ru', $env);
$SMTP_PORT   = (int)(env_get('SMTP_PORT', '465', $env));
$SMTP_USER   = env_get('SMTP_USER',   'no-reply@gluone.ru', $env);
$SMTP_PASS   = env_get('SMTP_PASS',   '', $env);
$FROM_EMAIL  = env_get('FROM_EMAIL',  'no-reply@gluone.ru', $env);
$FROM_NAME   = env_get('FROM_NAME',   'GluOne App', $env);

// SMTPS (465) или STARTTLS (587)
$USE_SMTPS   = env_flag('USE_SMTPS', true, $env); // true => SMTPS(465), false => STARTTLS(587)

// Разрешить CORS (опционально)
if (env_flag('ENABLE_CORS', false, $env)) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Api-Key');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ---------- АВТОРИЗАЦИЯ ----------
$headers = function_exists('getallheaders') ? getallheaders() : [];
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($headers['Authorization'] ?? $headers['authorization'] ?? null);
if (!$auth && isset($headers['X-Api-Key'])) {
    $auth = 'Bearer ' . $headers['X-Api-Key'];
}

if (!is_string($API_TOKEN) || $API_TOKEN === '') {
    http_response_code(500);
    echo json_encode(['status'=>'error','message'=>'Server token is not configured (API_TOKEN).'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($auth !== "Bearer {$API_TOKEN}") {
    http_response_code(401);
    echo json_encode(['status'=>'error','message'=>'Unauthorized'], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------- ЧТЕНИЕ ТЕЛА ЗАПРОСА ----------
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['status'=>'error','message'=>'Invalid JSON body'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Поля запроса
$to         = $data['to']        ?? null;               // string | обязательное
$subject    = (string)($data['subject'] ?? '(no subject)');
$body       = (string)($data['body']    ?? '');
$isHtml     = isset($data['isHtml']) ? (bool)$data['isHtml'] : true;

// Дополнительно (опционально)
$cc         = $data['cc']        ?? [];                 // string|array
$bcc        = $data['bcc']       ?? [];                 // string|array
$replyTo    = $data['replyTo']   ?? null;               // string
$attachments= $data['attachments'] ?? [];              // array of file paths
$embedded   = $data['embedded']    ?? [];              // array of {path, cid, name, mime}

// Нормализация списков адресов
$toList  = is_array($to)  ? $to  : (is_string($to)  && $to  !== '' ? [$to]  : []);
$ccList  = is_array($cc)  ? $cc  : (is_string($cc)  && $cc  !== '' ? [$cc]  : []);
$bccList = is_array($bcc) ? $bcc : (is_string($bcc) && $bcc !== '' ? [$bcc] : []);

if (empty($toList)) {
    http_response_code(400);
    echo json_encode(['status'=>'error','message'=>"Field 'to' is required"], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------- ОТПРАВКА через PHPMailer ----------
$mail = new PHPMailer(true);

try {
    // Базовые настройки SMTP
    $mail->isSMTP();
    $mail->Host       = $SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = $SMTP_USER;
    $mail->Password   = $SMTP_PASS;

    if ($USE_SMTPS) {
        // SMTPS (порт 465)
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = $SMTP_PORT ?: 465;
    } else {
        // STARTTLS (порт 587)
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = $SMTP_PORT ?: 587;
    }

    // От кого
    $mail->setFrom($FROM_EMAIL, $FROM_NAME);

    // Кому
    foreach ($toList as $addr) {
        $mail->addAddress((string)$addr);
    }
    foreach ($ccList as $addr) {
        $mail->addCC((string)$addr);
    }
    foreach ($bccList as $addr) {
        $mail->addBCC((string)$addr);
    }
    if (is_string($replyTo) && $replyTo !== '') {
        $mail->addReplyTo($replyTo);
    }

    // Вложения
    if (is_array($attachments)) {
        foreach ($attachments as $file) {
            if (is_string($file) && $file !== '' && file_exists($file)) {
                $mail->addAttachment($file);
            }
        }
    }

    // Inline-картинки (embedded)
    // Формат элемента: { "path": "...", "cid": "logoCID", "name": "logo.png", "mime": "image/png" }
    if (is_array($embedded)) {
        foreach ($embedded as $item) {
            $path = $item['path'] ?? null;
            $cid  = $item['cid']  ?? null;
            $name = $item['name'] ?? '';
            $mime = $item['mime'] ?? '';
            if (is_string($path) && $path !== '' && file_exists($path) && is_string($cid) && $cid !== '') {
                $mail->addEmbeddedImage($path, $cid, $name ?: basename($path), PHPMailer::DISPOSITION_INLINE, $mime ?: PHPMailer::mime_types((string)pathinfo($path, PATHINFO_EXTENSION)));
            }
        }
    }

    // Контент
    $mail->isHTML($isHtml);
    $mail->Subject = $subject;
    $mail->Body    = $body;
    if ($isHtml) {
        $mail->AltBody = trim(strip_tags($body));
    }

    // Отправка
    $mail->send();

    echo json_encode(['status'=>'ok'], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    // Не раскрываем лишних подробностей вовне, но даём краткое описание
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Mail send failed',
        'detail'  => $mail->ErrorInfo, // можно убрать на проде
    ], JSON_UNESCAPED_UNICODE);
}
