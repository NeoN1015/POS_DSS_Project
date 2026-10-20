<?php
/**
 * Session bootstrap, login helpers, and role-based access control.
 */

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/db_connect.php';

const ROLE_ADMIN   = 'admin';
const ROLE_CASHIER = 'cashier';
const ROLE_OWNER   = 'owner';

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

    session_name('POSDSSSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

start_app_session();

function e(?string $value): string
{
    return htmlspecialchars($value ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function csrf_token(): string
{
    if (empty($_SESSION['_csrf'])) {
        $_SESSION['_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['_csrf'];
}

function verify_csrf(?string $token): bool
{
    return is_string($token)
        && isset($_SESSION['_csrf'])
        && hash_equals($_SESSION['_csrf'], $token);
}

function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }

    static $cached = false;
    static $user = null;

    if ($cached) {
        return $user;
    }

    $stmt = db()->prepare(
        'SELECT id, username, full_name, role, is_active
         FROM users
         WHERE id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => (int) $_SESSION['user_id']]);
    $row = $stmt->fetch();

    $cached = true;

    if (!$row || (int) $row['is_active'] !== 1) {
        logout_user();
        $user = null;
        return null;
    }

    $user = $row;
    return $user;
}

function is_logged_in(): bool
{
    return current_user() !== null;
}

function login_user(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['user_id']   = (int) $user['id'];
    $_SESSION['user_role'] = (string) $user['role'];
    $_SESSION['_csrf']     = bin2hex(random_bytes(32));
}

function logout_user(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $params['path'],
            'domain'   => $params['domain'],
            'secure'   => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => 'Lax',
        ]);
    }

    session_destroy();
    start_app_session();
}

function require_login(): void
{
    if (!is_logged_in()) {
        header('Location: login.php');
        exit;
    }
}

function has_role(string ...$roles): bool
{
    $user = current_user();
    if ($user === null) {
        return false;
    }
    return in_array($user['role'], $roles, true);
}

function require_role(string ...$roles): void
{
    require_login();
    if (!has_role(...$roles)) {
        http_response_code(403);
        exit('Access denied for your role.');
    }
}

/**
 * Feature flags used by the sidebar and later modules.
 */
function can(string $feature): bool
{
    return match ($feature) {
        'pos'             => has_role(ROLE_ADMIN, ROLE_CASHIER),
        'products_manage' => has_role(ROLE_ADMIN),
        'products_view'   => has_role(ROLE_ADMIN, ROLE_CASHIER, ROLE_OWNER),
        'reports'         => has_role(ROLE_ADMIN, ROLE_OWNER),
        'dss'             => has_role(ROLE_ADMIN, ROLE_OWNER),
        'users'           => has_role(ROLE_ADMIN),
        'settings'        => has_role(ROLE_ADMIN),
        default           => false,
    };
}

function role_label(string $role): string
{
    return match ($role) {
        ROLE_ADMIN   => 'Administrator',
        ROLE_CASHIER => 'Cashier',
        ROLE_OWNER   => 'Business Owner',
        default      => ucfirst($role),
    };
}

function flash_set(string $type, string $message): void
{
    $_SESSION['_flash'] = ['type' => $type, 'message' => $message];
}

function flash_get(): ?array
{
    if (empty($_SESSION['_flash'])) {
        return null;
    }
    $flash = $_SESSION['_flash'];
    unset($_SESSION['_flash']);
    return $flash;
}

function authenticate(string $username, string $password): array
{
    $dummyHash = '$2y$12$7aZ0CAkcwh6PrU2dtBXtwu9Oq1VzbvFFRV7FjvykaprLMfXCJSBhe';

    $stmt = db()->prepare(
        'SELECT id, username, password, full_name, role, is_active
         FROM users
         WHERE username = :username
         LIMIT 1'
    );
    $stmt->execute(['username' => $username]);
    $user = $stmt->fetch();

    $hash = $user['password'] ?? $dummyHash;
    $valid = password_verify($password, $hash);

    if (!$user || !$valid) {
        return ['ok' => false, 'error' => 'Invalid username or password.'];
    }

    if ((int) $user['is_active'] !== 1) {
        return ['ok' => false, 'error' => 'This account is disabled. Contact an administrator.'];
    }

    unset($user['password']);
    return ['ok' => true, 'user' => $user];
}
