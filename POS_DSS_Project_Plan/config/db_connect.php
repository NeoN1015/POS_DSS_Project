<?php
/**
 * PDO connection for POS DSS.
 * Include this file wherever a database handle is needed:
 *   require_once __DIR__ . '/../config/db_connect.php';
 *   $pdo = db();
 */

declare(strict_types=1);

const DB_HOST    = '127.0.0.1';
const DB_PORT    = '3306';
const DB_NAME    = 'pos_dss';
const DB_USER    = 'root';
const DB_PASS    = '';          // default XAMPP/WAMP; set a password in production
const DB_CHARSET = 'utf8mb4';

/**
 * Return a shared PDO instance (UTF-8, exceptions, associative fetches).
 */
function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        DB_HOST,
        DB_PORT,
        DB_NAME,
        DB_CHARSET
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        error_log('POS DSS DB connection failed: ' . $e->getMessage());
        http_response_code(500);
        exit('Database connection failed. Check config/db_connect.php credentials.');
    }

    return $pdo;
}
