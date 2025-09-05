<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/PHPMailer/src/Exception.php';
require __DIR__ . '/PHPMailer/src/PHPMailer.php';
require __DIR__ . '/PHPMailer/src/SMTP.php';

// Always return JSON
header('Content-Type: application/json; charset=UTF-8');

// -----------------------------------------------------------------------------
// Load configuration from a .env‑style file. Missing keys fall back to defaults.
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Authorization: expect an Authorization header in the form "Bearer <token>"
// Also accept an X-Api-Key header for compatibility. Use a constant‑time
// comparison to avoid timing attacks.
// -----------------------------------------------------------------------------
$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $_SERVER['HTTP_AUTHORIZATION']
    ?? ($headers['Authorization'] ?? $headers['authorization'] ?? null);

if (!$authHeader && isset($headers['X-Api-Key'])) {
    $authHeader = 'Bearer ' . $headers['X-Api-Key'];
}

$providedToken = '';
if ($authHeader && preg_match('/Bearer\s+(.+)/', (string)$authHeader, $m)) {
    $providedToken = trim($m[1]);
}

if ($API_TOKEN === '' || !hash_equals($API_TOKEN, (string)$providedToken)) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
    exit;
}

// -----------------------------------------------------------------------------
// Parse request body (JSON) and extract fields. Invalid JSON results in 400.
// -----------------------------------------------------------------------------
$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON']);
    exit;
}

$to          = $data['to']         ?? null;
$subject     = $data['subject']    ?? '(no subject)';
$body        = $data['body']       ?? '';
$isHtml      = isset($data['isHtml']) ? filter_var($data['isHtml'], FILTER_VALIDATE_BOOLEAN) : true;
$attachments = is_array($data['attachments'] ?? null) ? $data['attachments'] : [];
$embedded    = is_array($data['embedded']    ?? null) ? $data['embedded']    : [];

// -----------------------------------------------------------------------------
// Validate recipient address. Reject if missing or invalid. Avoid sending to
// arbitrary strings to reduce spam/abuse risk.
// -----------------------------------------------------------------------------
if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => "Field 'to' must be a valid email"]);
    exit;
}

// Restrict attachments/embeds to a specific uploads directory. If the directory
// does not exist, attachments will be ignored. This prevents path traversal
// attacks (e.g. sending /etc/passwd). If you wish to allow arbitrary files,
// remove this check but understand the risk.
$allowedDir = realpath(__DIR__ . '/uploads');

// Helper to check if a path is within the allowed directory
function allowed_path(?string $path, ?string $root): bool {
    if (!$root || !$path) return false;
    return strncmp($path, $root, strlen($root)) === 0;
}

// -----------------------------------------------------------------------------
// Configure and send the email. Catch exceptions and hide sensitive details.
// -----------------------------------------------------------------------------
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

    // Attach files if they exist within the allowed directory
    foreach ($attachments as $file) {
        $full = realpath($file);
        if (allowed_path($full, $allowedDir) && file_exists($full)) {
            $mail->addAttachment($full);
        }
    }

    // Embed images inline; require both path and cid and ensure allowed path
    foreach ($embedded as $item) {
        if (isset($item['path'], $item['cid'])) {
            $full = realpath($item['path']);
            if (allowed_path($full, $allowedDir) && file_exists($full)) {
                $mail->addEmbeddedImage(
                    $full,
                    $item['cid'],
                    $item['name'] ?? basename($full),
                    'base64',
                    $item['mime'] ?? mime_content_type($full)
                );
            }
        }
    }

    $mail->isHTML($isHtml);
    $mail->Subject = $subject;
    $mail->Body    = $body;
    if ($isHtml) {
        $mail->AltBody = strip_tags($body);
    }

    $mail->send();
    echo json_encode(['status' => 'ok']);
} catch (Exception $e) {
    http_response_code(500);
    // Avoid exposing internal error details to the client
    echo json_encode(['status' => 'error', 'message' => 'Could not send email']);
}