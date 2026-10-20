<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/config/tax.php';

ini_set('session.use_strict_mode', '1');
session_name('POSDSS_API');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(string $message, int $status = 400): never
{
    respond(['ok' => false, 'error' => $message], $status);
}

function isUniqueViolation(PDOException $exception): bool
{
    return str_contains($exception->getMessage(), 'UNIQUE constraint failed');
}

function requestBody(): array
{
    $body = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($body)) {
        fail('Request body must be valid JSON.');
    }
    return $body;
}

function db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!extension_loaded('pdo_sqlite')) {
        fail('PHP needs the PDO SQLite extension enabled to open the database.', 503);
    }

    $path = getenv('POS_DSS_DB_PATH') ?: dirname(__DIR__) . '/../pos_dss_data/pos_dss.sqlite';
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
        fail('Could not create the SQLite database directory.', 500);
    }

    try {
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
        initializeDatabase($pdo);
    } catch (PDOException $exception) {
        error_log('POS DSS SQLite connection failed: ' . $exception->getMessage());
        fail('Could not initialize the SQLite database. Check the database path and folder permissions.', 500);
    }
    return $pdo;
}

function initializeDatabase(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL COLLATE NOCASE UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin','cashier','owner')),
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL COLLATE NOCASE UNIQUE,
            description TEXT NOT NULL DEFAULT '',
            image_url TEXT NOT NULL DEFAULT '',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES categories(id),
            sku TEXT NOT NULL COLLATE NOCASE UNIQUE,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            price REAL NOT NULL CHECK(price >= 0),
            cost REAL NOT NULL DEFAULT 0 CHECK(cost >= 0),
            stock_quantity REAL NOT NULL DEFAULT 0 CHECK(stock_quantity >= 0),
            min_stock_level REAL NOT NULL DEFAULT 5 CHECK(min_stock_level >= 0),
            unit_type TEXT NOT NULL DEFAULT 'decimal' CHECK(unit_type IN ('unit','decimal')),
            image_url TEXT NOT NULL DEFAULT '',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_number TEXT NOT NULL UNIQUE,
            user_id INTEGER NOT NULL REFERENCES users(id),
            subtotal REAL NOT NULL,
            tax_rate REAL NOT NULL DEFAULT 0,
            tax_amount REAL NOT NULL DEFAULT 0,
            total_amount REAL NOT NULL,
            payment_amount REAL NOT NULL,
            change_amount REAL NOT NULL,
            total_profit REAL,
            status TEXT NOT NULL DEFAULT 'completed',
            transaction_date TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(transaction_date);
        CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity REAL NOT NULL CHECK(quantity > 0),
            unit_price REAL NOT NULL,
            unit_cost REAL,
            line_total REAL NOT NULL,
            line_profit REAL
        );
        CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
        CREATE TABLE IF NOT EXISTS inventory_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL REFERENCES products(id),
            user_id INTEGER REFERENCES users(id),
            action TEXT NOT NULL,
            quantity_changed REAL NOT NULL,
            quantity_before REAL NOT NULL,
            quantity_after REAL NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            logged_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL REFERENCES sales(id),
            voided_by INTEGER NOT NULL REFERENCES users(id),
            timestamp TEXT NOT NULL,
            reason TEXT NOT NULL,
            UNIQUE(transaction_id)
        );"
    );
    $categoryColumns = $pdo->query('PRAGMA table_info(categories)')->fetchAll();
    if (!in_array('is_active', array_column($categoryColumns, 'name'), true)) {
        $pdo->exec('ALTER TABLE categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
    }

    $userCount = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($userCount === 0) {
        $insert = $pdo->prepare(
            'INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
             VALUES (:username, :password, :name, :role, 1, :created)'
        );
        foreach ([
            ['admin', 'admin123', 'System Administrator', 'admin'],
            ['cashier', 'cashier123', 'Front Desk Cashier', 'cashier'],
            ['owner', 'owner123', 'Business Owner', 'owner'],
        ] as [$username, $password, $name, $role]) {
            $insert->execute([
                'username' => $username,
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'name' => $name,
                'role' => $role,
                'created' => date(DATE_ATOM),
            ]);
        }
    }

    $categoryCount = (int) $pdo->query('SELECT COUNT(*) FROM categories')->fetchColumn();
    if ($categoryCount === 0) {
        $categoryInsert = $pdo->prepare(
            'INSERT INTO categories (name, description, created_at) VALUES (:name, :description, :created)'
        );
        $categories = [
            ['Beverages', 'Drinks and bottled water'],
            ['Snacks', 'Chips, biscuits, and packaged snacks'],
            ['Grocery', 'Staples and packaged grocery items'],
            ['Cafe', 'Cafe-prepared items'],
        ];
        foreach ($categories as [$name, $description]) {
            $categoryInsert->execute(['name' => $name, 'description' => $description, 'created' => date(DATE_ATOM)]);
        }
    }

    $productCount = (int) $pdo->query('SELECT COUNT(*) FROM products')->fetchColumn();
    if ($productCount === 0) {
        $categoryIds = $pdo->query('SELECT name, id FROM categories')->fetchAll(PDO::FETCH_KEY_PAIR);
        $insert = $pdo->prepare(
            'INSERT INTO products (category_id, sku, name, price, cost, stock_quantity, min_stock_level, unit_type, created_at)
             VALUES (:category, :sku, :name, :price, :cost, :stock, :minimum, :unit, :created)'
        );
        $logInsert = $pdo->prepare(
            "INSERT INTO inventory_logs (product_id, user_id, action, quantity_changed, quantity_before, quantity_after, notes, logged_at)
             VALUES (:product, 1, 'initial', :changed, 0, :after, 'Seed stock', :date)"
        );
        foreach ([
            ['Beverages', 'BEV-001', 'Bottled Water 500ml', 15, 8, 80, 15],
            ['Beverages', 'BEV-002', 'Cola 330ml', 25, 14, 40, 12],
            ['Snacks', 'SNK-001', 'Potato Chips', 20, 11, 8, 10],
            ['Snacks', 'SNK-002', 'Crackers Pack', 18, 10, 35, 10],
            ['Grocery', 'GRO-001', 'Instant Noodles', 12, 7, 5, 20],
            ['Grocery', 'GRO-002', 'White Rice 1kg', 55, 42, 25, 8],
            ['Cafe', 'CAF-001', 'Brewed Coffee', 45, 20, 50, 10],
            ['Cafe', 'CAF-002', 'Ham & Cheese Sandwich', 75, 40, 6, 8],
        ] as [$category, $sku, $name, $price, $cost, $stock, $minimum]) {
            $insert->execute([
                'category' => $categoryIds[$category],
                'sku' => $sku,
                'name' => $name,
                'price' => $price,
                'cost' => $cost,
                'stock' => $stock,
                'minimum' => $minimum,
                'unit' => 'decimal',
                'created' => date(DATE_ATOM),
            ]);
            $logInsert->execute([
                'product' => (int) $pdo->lastInsertId(),
                'changed' => $stock,
                'after' => $stock,
                'date' => date(DATE_ATOM),
            ]);
        }
    }
}

function currentUser(PDO $pdo): ?array
{
    $id = (int) ($_SESSION['user_id'] ?? 0);
    if ($id < 1) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id, username, full_name, role FROM users WHERE id = :id AND is_active = 1');
    $stmt->execute(['id' => $id]);
    $user = $stmt->fetch();
    if (!$user) {
        unset($_SESSION['user_id']);
        return null;
    }
    $user['id'] = (int) $user['id'];
    return $user;
}

function requireUser(PDO $pdo, array $roles = []): array
{
    $user = currentUser($pdo);
    if (!$user) {
        fail('Please sign in to continue.', 401);
    }
    if ($roles !== [] && !in_array($user['role'], $roles, true)) {
        fail('Your role cannot perform this action.', 403);
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if (!is_string($token) || !isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
            fail('Your session token expired. Refresh and try again.', 419);
        }
    }
    return $user;
}

function roundMoney(float $value): float
{
    return round($value + 1.0e-10, 2);
}

function allRows(PDO $pdo, string $table): array
{
    $allowed = ['categories', 'products', 'sales', 'sale_items', 'users', 'inventory_logs', 'audit_logs'];
    if (!in_array($table, $allowed, true)) {
        fail('Unknown data collection.');
    }
    $sql = $table === 'users'
        ? 'SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY id'
        : "SELECT * FROM {$table} ORDER BY id";
    $rows = $pdo->query($sql)->fetchAll();
    foreach ($rows as &$row) {
        foreach ($row as $key => $value) {
            if (in_array($key, ['id', 'category_id', 'user_id', 'sale_id', 'product_id', 'transaction_id', 'voided_by', 'is_active'], true) && $value !== null) {
                $row[$key] = (int) $value;
            } elseif (in_array($key, ['price', 'cost', 'stock_quantity', 'min_stock_level', 'quantity', 'unit_price', 'unit_cost', 'line_total', 'line_profit', 'subtotal', 'tax_rate', 'tax_amount', 'total_amount', 'payment_amount', 'change_amount', 'total_profit', 'quantity_changed', 'quantity_before', 'quantity_after'], true) && $value !== null) {
                $row[$key] = (float) $value;
            }
        }
    }
    return $rows;
}

function validateImageUrl(mixed $value): string
{
    $url = trim((string) ($value ?? ''));
    if ($url === '') {
        return '';
    }
    if (strlen($url) > 2048 || !preg_match('~^(https?://|/|\.{1,2}/)~i', $url)) {
        fail('Image URL must be an http(s) or relative URL.');
    }
    return $url;
}

function importLegacy(PDO $pdo, array $body): void
{
    if ($pdo->query("SELECT value FROM app_meta WHERE key = 'legacy_imported_at'")->fetchColumn()) {
        fail('A browser-data import has already been completed.', 409);
    }
    $legacy = $body['data'] ?? null;
    if (!is_array($legacy)) {
        fail('Legacy data was not provided.');
    }
    $pdo->beginTransaction();
    try {
        $userMap = [];
        foreach (($legacy['users'] ?? []) as $old) {
            if (!is_array($old) || empty($old['username'])) {
                continue;
            }
            $stmt = $pdo->prepare('SELECT id FROM users WHERE username = :username COLLATE NOCASE');
            $stmt->execute(['username' => $old['username']]);
            $existing = $stmt->fetchColumn();
            if ($existing) {
                $userMap[(int) ($old['id'] ?? 0)] = (int) $existing;
                continue;
            }
            $role = in_array($old['role'] ?? '', ['admin', 'cashier', 'owner'], true) ? $old['role'] : 'cashier';
            $stmt = $pdo->prepare(
                'INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
                 VALUES (:username, :password, :name, :role, 0, :created)'
            );
            $stmt->execute([
                'username' => (string) $old['username'],
                'password' => password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT),
                'name' => (string) ($old['full_name'] ?? $old['username']),
                'role' => $role,
                'created' => (string) ($old['created_at'] ?? date(DATE_ATOM)),
            ]);
            $userMap[(int) ($old['id'] ?? 0)] = (int) $pdo->lastInsertId();
        }

        $categoryMap = [];
        foreach (($legacy['categories'] ?? []) as $old) {
            if (!is_array($old) || trim((string) ($old['name'] ?? '')) === '') {
                continue;
            }
            $stmt = $pdo->prepare('SELECT id FROM categories WHERE name = :name COLLATE NOCASE');
            $stmt->execute(['name' => trim($old['name'])]);
            $existing = $stmt->fetchColumn();
            if ($existing) {
                $id = (int) $existing;
                $update = $pdo->prepare('UPDATE categories SET description = :description, image_url = :image, is_active = 1 WHERE id = :id');
                $update->execute([
                    'description' => (string) ($old['description'] ?? ''),
                    'image' => validateImageUrl($old['image_url'] ?? ''),
                    'id' => $id,
                ]);
            } else {
                $insert = $pdo->prepare(
                    'INSERT INTO categories (name, description, image_url, created_at) VALUES (:name, :description, :image, :created)'
                );
                $insert->execute([
                    'name' => trim($old['name']),
                    'description' => (string) ($old['description'] ?? ''),
                    'image' => validateImageUrl($old['image_url'] ?? ''),
                    'created' => (string) ($old['created_at'] ?? date(DATE_ATOM)),
                ]);
                $id = (int) $pdo->lastInsertId();
            }
            $categoryMap[(int) ($old['id'] ?? 0)] = $id;
        }

        $productMap = [];
        foreach (($legacy['products'] ?? []) as $old) {
            if (!is_array($old) || empty($old['sku']) || trim((string) ($old['name'] ?? '')) === '') {
                continue;
            }
            $categoryId = $categoryMap[(int) ($old['category_id'] ?? 0)] ?? null;
            if (!$categoryId) {
                continue;
            }
            $stmt = $pdo->prepare('SELECT id FROM products WHERE sku = :sku COLLATE NOCASE');
            $stmt->execute(['sku' => $old['sku']]);
            $existing = $stmt->fetchColumn();
            $params = [
                'category' => $categoryId,
                'sku' => (string) $old['sku'],
                'name' => (string) $old['name'],
                'description' => (string) ($old['description'] ?? ''),
                'price' => max(0, (float) ($old['price'] ?? 0)),
                'cost' => max(0, (float) ($old['cost'] ?? 0)),
                'stock' => max(0, (float) ($old['stock_quantity'] ?? 0)),
                'minimum' => max(0, (float) ($old['min_stock_level'] ?? 5)),
                'unit' => 'decimal',
                'image' => validateImageUrl($old['image_url'] ?? ''),
                'active' => (int) ($old['is_active'] ?? 1) === 1 ? 1 : 0,
            ];
            if ($existing) {
                $id = (int) $existing;
                $params['id'] = $id;
                $stmt = $pdo->prepare(
                    'UPDATE products SET category_id=:category, sku=:sku, name=:name, description=:description, price=:price,
                     cost=:cost, stock_quantity=:stock, min_stock_level=:minimum, unit_type=:unit,
                     image_url=:image, is_active=:active WHERE id=:id'
                );
                $stmt->execute($params);
            } else {
                $params['created'] = (string) ($old['created_at'] ?? date(DATE_ATOM));
                $stmt = $pdo->prepare(
                    'INSERT INTO products (category_id, sku, name, description, price, cost, stock_quantity, min_stock_level, unit_type, image_url, is_active, created_at)
                     VALUES (:category, :sku, :name, :description, :price, :cost, :stock, :minimum, :unit, :image, :active, :created)'
                );
                $stmt->execute($params);
                $id = (int) $pdo->lastInsertId();
            }
            $productMap[(int) ($old['id'] ?? 0)] = $id;
        }

        $saleMap = [];
        $existingSales = [];
        foreach (($legacy['sales'] ?? []) as $old) {
            if (!is_array($old) || empty($old['invoice_number'])) {
                continue;
            }
            $stmt = $pdo->prepare('SELECT id FROM sales WHERE invoice_number = :invoice');
            $stmt->execute(['invoice' => $old['invoice_number']]);
            $existing = $stmt->fetchColumn();
            if ($existing) {
                $saleMap[(int) ($old['id'] ?? 0)] = (int) $existing;
                $existingSales[(int) ($old['id'] ?? 0)] = true;
                continue;
            }
            $userId = $userMap[(int) ($old['user_id'] ?? 0)] ?? 1;
            $stmt = $pdo->prepare(
                'INSERT INTO sales (invoice_number, user_id, subtotal, tax_rate, tax_amount, total_amount, payment_amount, change_amount, total_profit, status, transaction_date)
                 VALUES (:invoice, :user, :subtotal, 0, 0, :total, :payment, :change, NULL, :status, :date)'
            );
            $stmt->execute([
                'invoice' => (string) $old['invoice_number'],
                'user' => $userId,
                'subtotal' => (float) ($old['subtotal'] ?? $old['total_amount'] ?? 0),
                'total' => (float) ($old['total_amount'] ?? 0),
                'payment' => (float) ($old['payment_amount'] ?? 0),
                'change' => (float) ($old['change_amount'] ?? 0),
                'status' => in_array($old['status'] ?? '', ['completed', 'voided'], true) ? $old['status'] : 'completed',
                'date' => (string) ($old['transaction_date'] ?? date(DATE_ATOM)),
            ]);
            $saleMap[(int) ($old['id'] ?? 0)] = (int) $pdo->lastInsertId();
        }

        foreach (($legacy['sale_items'] ?? []) as $old) {
            if (!is_array($old)) {
                continue;
            }
            if (isset($existingSales[(int) ($old['sale_id'] ?? 0)])) {
                continue;
            }
            $saleId = $saleMap[(int) ($old['sale_id'] ?? 0)] ?? null;
            $productId = $productMap[(int) ($old['product_id'] ?? 0)] ?? null;
            if (!$saleId || !$productId) {
                continue;
            }
            $stmt = $pdo->prepare(
                'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, line_total, line_profit)
                 VALUES (:sale, :product, :quantity, :price, NULL, :total, NULL)'
            );
            $quantity = max(0.01, (float) ($old['quantity'] ?? 0));
            $price = (float) ($old['unit_price'] ?? 0);
            $stmt->execute([
                'sale' => $saleId,
                'product' => $productId,
                'quantity' => $quantity,
                'price' => $price,
                'total' => (float) ($old['line_total'] ?? roundMoney($quantity * $price)),
            ]);
        }

        $logInsert = $pdo->prepare(
            'INSERT INTO inventory_logs (product_id, user_id, action, quantity_changed, quantity_before, quantity_after, notes, logged_at)
             VALUES (:product, :user, :action, :changed, :before, :after, :notes, :date)'
        );
        foreach (($legacy['inventory_logs'] ?? []) as $old) {
            if (!is_array($old) || !isset($productMap[(int) ($old['product_id'] ?? 0)])) {
                continue;
            }
            $action = in_array($old['action'] ?? '', ['sale', 'restock', 'adjustment', 'initial'], true) ? $old['action'] : 'adjustment';
            $logInsert->execute([
                'product' => $productMap[(int) $old['product_id']],
                'user' => $userMap[(int) ($old['user_id'] ?? 0)] ?? null,
                'action' => $action,
                'changed' => (float) ($old['quantity_changed'] ?? 0),
                'before' => (float) ($old['quantity_before'] ?? 0),
                'after' => (float) ($old['quantity_after'] ?? 0),
                'notes' => (string) ($old['notes'] ?? ''),
                'date' => (string) ($old['logged_at'] ?? date(DATE_ATOM)),
            ]);
        }

        $stmt = $pdo->prepare("INSERT INTO app_meta (key, value) VALUES ('legacy_imported_at', :value)");
        $stmt->execute(['value' => date(DATE_ATOM)]);
        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = (string) ($_GET['action'] ?? '');

    if ($method === 'POST' && $action === 'login') {
        $body = requestBody();
        $username = trim((string) ($body['username'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $stmt = $pdo->prepare(
            'SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE username = :username COLLATE NOCASE'
        );
        $stmt->execute(['username' => $username]);
        $user = $stmt->fetch();
        if (!$user || (int) $user['is_active'] !== 1 || !password_verify($password, $user['password_hash'])) {
            fail('Invalid username or password.', 401);
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        unset($user['password_hash'], $user['is_active']);
        $user['id'] = (int) $user['id'];
        respond(['ok' => true, 'data' => ['user' => $user, 'csrf' => $_SESSION['csrf']]]);
    }

    if ($method === 'GET' && $action === 'bootstrap') {
        $user = currentUser($pdo);
        $taxRate = getTaxRate();
        if ($taxRate < 0 || !is_finite($taxRate)) {
            fail('Tax configuration must be a non-negative percentage.', 500);
        }
        respond(['ok' => true, 'data' => [
            'user' => $user,
            'csrf' => $user ? ($_SESSION['csrf'] ??= bin2hex(random_bytes(32))) : null,
            'tax_rate' => $taxRate,
            'legacy_imported' => (bool) $pdo->query("SELECT value FROM app_meta WHERE key = 'legacy_imported_at'")->fetchColumn(),
        ]]);
    }

    if ($method === 'POST' && $action === 'logout') {
        requireUser($pdo);
        $_SESSION = [];
        session_destroy();
        respond(['ok' => true, 'data' => null]);
    }

    $tableActions = [
        'categories' => 'categories',
        'products' => 'products',
        'sales' => 'sales',
        'sale_items' => 'sale_items',
        'users' => 'users',
        'inventory_logs' => 'inventory_logs',
    ];
    if ($method === 'GET' && $action === 'sales_history') {
        requireUser($pdo, ['admin', 'owner']);
        respond(['ok' => true, 'data' => [
            'sales' => allRows($pdo, 'sales'),
            'sale_items' => allRows($pdo, 'sale_items'),
            'users' => allRows($pdo, 'users'),
            'audit_logs' => allRows($pdo, 'audit_logs'),
        ]]);
    }

    if ($method === 'GET' && $action === 'category_info') {
        requireUser($pdo, ['admin', 'owner']);
        $id = (int) ($_GET['id'] ?? 0);
        $stmt = $pdo->prepare('SELECT id, name, is_active FROM categories WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $category = $stmt->fetch();
        if (!$category || (int) $category['is_active'] !== 1) {
            fail('Category not found.', 404);
        }
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) AS total_count, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count
             FROM products WHERE category_id = :id'
        );
        $stmt->execute(['id' => $id]);
        $counts = $stmt->fetch();
        respond(['ok' => true, 'data' => [
            'id' => (int) $category['id'],
            'name' => $category['name'],
            'total_products' => (int) $counts['total_count'],
            'active_products' => (int) ($counts['active_count'] ?? 0),
        ]]);
    }

    if ($method === 'GET' && isset($tableActions[$action])) {
        $roles = match ($action) {
            'sales', 'sale_items' => ['admin', 'cashier', 'owner'],
            'users' => ['admin', 'owner'],
            'inventory_logs' => ['admin'],
            default => ['admin', 'cashier', 'owner'],
        };
        requireUser($pdo, $roles);
        respond(['ok' => true, 'data' => allRows($pdo, $tableActions[$action])]);
    }

    if ($method === 'POST' && $action === 'save_category') {
        requireUser($pdo, ['admin']);
        $body = requestBody();
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '' || strlen($name) > 240) {
            fail('Category name is required and must be no more than 80 characters.');
        }
        $id = (int) ($body['id'] ?? 0);
        $params = [
            'name' => $name,
            'description' => trim((string) ($body['description'] ?? '')),
            'image' => validateImageUrl($body['image_url'] ?? ''),
        ];
        try {
            if ($id > 0) {
                $exists = $pdo->prepare('SELECT 1 FROM categories WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) {
                    fail('Category not found.', 404);
                }
                $params['id'] = $id;
                $stmt = $pdo->prepare('UPDATE categories SET name=:name, description=:description, image_url=:image WHERE id=:id');
            } else {
                $stmt = $pdo->prepare('INSERT INTO categories (name, description, image_url, created_at) VALUES (:name, :description, :image, :created)');
                $params['created'] = date(DATE_ATOM);
            }
            $stmt->execute($params);
        } catch (PDOException $exception) {
            if (isUniqueViolation($exception)) {
                fail('A category with that name already exists.', 409);
            }
            throw $exception;
        }
        respond(['ok' => true, 'data' => ['id' => $id ?: (int) $pdo->lastInsertId()]]);
    }

    if ($method === 'POST' && $action === 'upload_product_image') {
        requireUser($pdo, ['admin']);
        $upload = $_FILES['image'] ?? null;
        if (!is_array($upload) || !isset($upload['error'], $upload['tmp_name'], $upload['size'])
            || (!is_int($upload['error']) && !is_string($upload['error']))
            || !is_string($upload['tmp_name']) || !is_numeric($upload['size'])) {
            fail('Choose an image file to upload.');
        }
        if ((int) $upload['error'] !== UPLOAD_ERR_OK) {
            $message = match ((int) $upload['error']) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Image must be 5 MB or smaller.',
                UPLOAD_ERR_NO_FILE => 'Choose an image file to upload.',
                default => 'The image upload did not complete. Try again.',
            };
            fail($message, 422);
        }
        if ((int) $upload['size'] < 1 || (int) $upload['size'] > 5 * 1024 * 1024
            || !is_uploaded_file((string) $upload['tmp_name'])) {
            fail('Image must be a valid upload no larger than 5 MB.', 422);
        }

        $mimeToExtension = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
        ];
        $imageInfo = getimagesize((string) $upload['tmp_name']);
        $mime = is_array($imageInfo) ? ($imageInfo['mime'] ?? '') : '';
        if (!isset($mimeToExtension[$mime]) || $imageInfo === false
            || $imageInfo[0] > 10000 || $imageInfo[1] > 10000
            || $imageInfo[0] * $imageInfo[1] > 40000000) {
            fail('The uploaded file must be a valid JPG, PNG, WebP, or GIF image.', 422);
        }

        $uploadDirectory = dirname(__DIR__) . '/uploads/products';
        if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
            fail('Could not create the product image upload directory.', 500);
        }
        $filename = 'prod_' . date('YmdHis') . '_' . bin2hex(random_bytes(8)) . '.' . $mimeToExtension[$mime];
        if (!move_uploaded_file((string) $upload['tmp_name'], $uploadDirectory . '/' . $filename)) {
            fail('Could not save the uploaded product image. Check folder permissions.', 500);
        }
        respond(['ok' => true, 'data' => ['image_url' => '../uploads/products/' . $filename]]);
    }

    if ($method === 'POST' && $action === 'delete_category') {
        requireUser($pdo, ['admin', 'owner']);
        $body = requestBody();
        $id = (int) ($body['id'] ?? 0);
        $strategy = (string) ($body['strategy'] ?? '');
        if ($id < 1 || !in_array($strategy, ['safe', 'cascade'], true)) {
            fail('Choose a valid category deletion option.');
        }
        $stmt = $pdo->prepare('SELECT id, name, is_active FROM categories WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $category = $stmt->fetch();
        if (!$category || (int) $category['is_active'] !== 1) {
            fail('Category not found or already archived.', 404);
        }
        if (strcasecmp($category['name'], 'Uncategorized') === 0) {
            fail('The Uncategorized fallback category cannot be deleted.', 409);
        }
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) AS total_count, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_count
             FROM products WHERE category_id = :id'
        );
        $stmt->execute(['id' => $id]);
        $counts = $stmt->fetch();
        $total = (int) $counts['total_count'];
        $active = (int) ($counts['active_count'] ?? 0);
        if ($strategy === 'cascade' && !hash_equals((string) $category['name'], trim((string) ($body['confirmation'] ?? '')))) {
            fail('Type the exact category name to confirm archiving this category and its products.', 422);
        }

        $pdo->beginTransaction();
        try {
            if ($strategy === 'safe') {
                if ($total > 0) {
                    $fallbackQuery = $pdo->prepare('SELECT id FROM categories WHERE name = :name COLLATE NOCASE');
                    $fallbackQuery->execute(['name' => 'Uncategorized']);
                    $fallbackId = $fallbackQuery->fetchColumn();
                    if ($fallbackId) {
                        $fallbackId = (int) $fallbackId;
                        $pdo->prepare('UPDATE categories SET is_active = 1 WHERE id = :id')->execute(['id' => $fallbackId]);
                    } else {
                        $insert = $pdo->prepare(
                            'INSERT INTO categories (name, description, image_url, is_active, created_at)
                             VALUES (:name, :description, :image, 1, :created)'
                        );
                        $insert->execute([
                            'name' => 'Uncategorized',
                            'description' => 'Fallback category for safely reassigned products.',
                            'image' => '',
                            'created' => date(DATE_ATOM),
                        ]);
                        $fallbackId = (int) $pdo->lastInsertId();
                    }
                    $pdo->prepare('UPDATE products SET category_id = :fallback WHERE category_id = :category')
                        ->execute(['fallback' => $fallbackId, 'category' => $id]);
                }
                $pdo->prepare('DELETE FROM categories WHERE id = :id')->execute(['id' => $id]);
            } else {
                $pdo->prepare('UPDATE products SET is_active = 0 WHERE category_id = :id')->execute(['id' => $id]);
                $pdo->prepare('UPDATE categories SET is_active = 0 WHERE id = :id')->execute(['id' => $id]);
            }
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
        respond(['ok' => true, 'data' => [
            'strategy' => $strategy,
            'products_affected' => $total,
            'active_products_affected' => $active,
            'fallback_category' => $strategy === 'safe' ? 'Uncategorized' : null,
        ]]);
    }

    if ($method === 'POST' && $action === 'restore_category') {
        requireUser($pdo, ['admin', 'owner']);
        $body = requestBody();
        $id = (int) ($body['id'] ?? 0);
        if ($id < 1) {
            fail('Choose a valid category.');
        }
        $stmt = $pdo->prepare("UPDATE categories SET is_active = 1 WHERE id = :id AND is_active = 0 AND name <> 'Uncategorized'");
        $stmt->execute(['id' => $id]);
        if ($stmt->rowCount() !== 1) {
            fail('Category not found or cannot be restored.', 409);
        }
        respond(['ok' => true, 'data' => ['id' => $id, 'is_active' => 1]]);
    }

    if ($method === 'POST' && $action === 'save_product') {
        requireUser($pdo, ['admin']);
        $body = requestBody();
        $id = (int) ($body['id'] ?? 0);
        $sku = trim((string) ($body['sku'] ?? ''));
        $name = trim((string) ($body['name'] ?? ''));
        $categoryId = (int) ($body['category_id'] ?? 0);
        $price = (float) ($body['price'] ?? -1);
        $cost = (float) ($body['cost'] ?? -1);
        $stock = (float) ($body['stock_quantity'] ?? -1);
        $minimum = (float) ($body['min_stock_level'] ?? -1);
        if ($sku === '' || strlen($sku) > 160 || $name === '' || strlen($name) > 480
            || $categoryId < 1 || !is_finite($price) || !is_finite($cost) || !is_finite($stock) || !is_finite($minimum)
            || $price < 0 || $cost < 0 || $stock < 0 || $minimum < 0
            || abs($stock - round($stock, 2)) > 1.0e-9 || abs($minimum - round($minimum, 2)) > 1.0e-9) {
            fail('Enter a valid SKU, product name, category, price, cost, and non-negative stock quantities with at most two decimal places.');
        }
        $categoryCheck = $pdo->prepare('SELECT 1 FROM categories WHERE id = :id AND is_active = 1');
        $categoryCheck->execute(['id' => $categoryId]);
        if (!$categoryCheck->fetchColumn()) {
            fail('Choose an existing category.');
        }
        $params = [
            'category' => $categoryId,
            'sku' => $sku,
            'name' => $name,
            'description' => trim((string) ($body['description'] ?? '')),
            'price' => roundMoney($price),
            'cost' => roundMoney($cost),
            'stock' => round($stock, 2),
            'minimum' => round($minimum, 2),
            'unit' => 'decimal',
            'image' => validateImageUrl($body['image_url'] ?? ''),
            'active' => !empty($body['is_active']) ? 1 : 0,
        ];
        $oldStock = null;
        if ($id > 0) {
            $stockQuery = $pdo->prepare('SELECT stock_quantity FROM products WHERE id = :id');
            $stockQuery->execute(['id' => $id]);
            $oldValue = $stockQuery->fetchColumn();
            $oldStock = $oldValue === false ? null : (float) $oldValue;
            if ($oldStock === null) {
                fail('Product not found.', 404);
            }
        }
        $pdo->beginTransaction();
        try {
            if ($id > 0) {
                $params['id'] = $id;
                $stmt = $pdo->prepare(
                    'UPDATE products SET category_id=:category, sku=:sku, name=:name, description=:description, price=:price,
                     cost=:cost, stock_quantity=:stock, min_stock_level=:minimum, unit_type=:unit,
                     image_url=:image, is_active=:active WHERE id=:id'
                );
            } else {
                $params['created'] = date(DATE_ATOM);
                $stmt = $pdo->prepare(
                    'INSERT INTO products (category_id, sku, name, description, price, cost, stock_quantity, min_stock_level, unit_type, image_url, is_active, created_at)
                     VALUES (:category, :sku, :name, :description, :price, :cost, :stock, :minimum, :unit, :image, :active, :created)'
                );
            }
            $stmt->execute($params);
            $savedId = $id ?: (int) $pdo->lastInsertId();
            if ($id > 0 && $oldStock !== null && abs($oldStock - round($stock, 2)) > 1.0e-9) {
                $log = $pdo->prepare(
                    "INSERT INTO inventory_logs (product_id, user_id, action, quantity_changed, quantity_before, quantity_after, notes, logged_at)
                     VALUES (:product, :user, 'adjustment', :changed, :before, :after, :notes, :date)"
                );
                $log->execute([
                    'product' => $id,
                    'user' => (int) $_SESSION['user_id'],
                    'changed' => round($stock, 2) - $oldStock,
                    'before' => $oldStock,
                    'after' => round($stock, 2),
                    'notes' => 'Stock updated from product management',
                    'date' => date(DATE_ATOM),
                ]);
            } elseif ($id === 0 && round($stock, 2) > 0) {
                $log = $pdo->prepare(
                    "INSERT INTO inventory_logs (product_id, user_id, action, quantity_changed, quantity_before, quantity_after, notes, logged_at)
                     VALUES (:product, :user, 'initial', :changed, 0, :after, :notes, :date)"
                );
                $log->execute([
                    'product' => $savedId,
                    'user' => (int) $_SESSION['user_id'],
                    'changed' => round($stock, 2),
                    'after' => round($stock, 2),
                    'notes' => 'Initial stock on product creation',
                    'date' => date(DATE_ATOM),
                ]);
            }
            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if (isUniqueViolation($exception)) {
                fail('Could not save product. Check that the SKU is unique.', 409);
            }
            throw $exception;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
        respond(['ok' => true, 'data' => ['id' => $savedId]]);
    }

    if ($method === 'POST' && in_array($action, ['archive_product', 'restore_product'], true)) {
        requireUser($pdo, ['admin', 'owner']);
        $body = requestBody();
        $id = (int) ($body['id'] ?? 0);
        if ($id < 1) {
            fail('Choose a valid product.');
        }
        $active = $action === 'restore_product' ? 1 : 0;
        $expected = $action === 'restore_product' ? 0 : 1;
        if ($active === 1) {
            $categoryQuery = $pdo->prepare(
                'SELECT categories.is_active FROM products JOIN categories ON categories.id = products.category_id WHERE products.id = :id'
            );
            $categoryQuery->execute(['id' => $id]);
            if ((int) $categoryQuery->fetchColumn() !== 1) {
                fail('Restore the product category before restoring this product.', 409);
            }
        }
        $stmt = $pdo->prepare('UPDATE products SET is_active = :active WHERE id = :id AND is_active = :expected');
        $stmt->execute(['active' => $active, 'id' => $id, 'expected' => $expected]);
        if ($stmt->rowCount() !== 1) {
            fail('Product not found or its archive state has changed. Refresh and try again.', 409);
        }
        respond(['ok' => true, 'data' => ['id' => $id, 'is_active' => $active]]);
    }

    if ($method === 'POST' && $action === 'void_sale') {
        $user = requireUser($pdo, ['admin', 'owner']);
        $body = requestBody();
        $saleId = (int) ($body['id'] ?? 0);
        $reason = trim((string) ($body['reason'] ?? ''));
        if ($saleId < 1 || $reason === '' || strlen($reason) > 1000) {
            fail('Select a sale and enter a reason for voiding it (up to 1000 characters).');
        }

        $pdo->beginTransaction();
        try {
            $saleQuery = $pdo->prepare('SELECT id, status FROM sales WHERE id = :id');
            $saleQuery->execute(['id' => $saleId]);
            $sale = $saleQuery->fetch();
            if (!$sale) {
                throw new DomainException('Transaction not found.');
            }
            if ($sale['status'] !== 'completed') {
                throw new DomainException('Only completed transactions can be voided.');
            }
            $itemQuery = $pdo->prepare(
                'SELECT product_id, SUM(quantity) AS quantity FROM sale_items WHERE sale_id = :id GROUP BY product_id'
            );
            $itemQuery->execute(['id' => $saleId]);
            $items = $itemQuery->fetchAll();
            foreach ($items as $item) {
                $productQuery = $pdo->prepare('SELECT stock_quantity FROM products WHERE id = :id');
                $productQuery->execute(['id' => (int) $item['product_id']]);
                $beforeValue = $productQuery->fetchColumn();
                if ($beforeValue === false) {
                    throw new DomainException('Transaction product history is inconsistent; void was not applied.');
                }
                $before = (float) $beforeValue;
                $restore = (float) $item['quantity'];
                $after = round($before + $restore, 2);
                $pdo->prepare('UPDATE products SET stock_quantity = :stock WHERE id = :id')
                    ->execute(['stock' => $after, 'id' => (int) $item['product_id']]);
                $pdo->prepare(
                    "INSERT INTO inventory_logs (product_id, user_id, action, quantity_changed, quantity_before, quantity_after, notes, logged_at)
                     VALUES (:product, :user, 'void', :changed, :before, :after, :notes, :date)"
                )->execute([
                    'product' => (int) $item['product_id'],
                    'user' => $user['id'],
                    'changed' => $restore,
                    'before' => $before,
                    'after' => $after,
                    'notes' => 'Stock restored for voided transaction #' . $saleId,
                    'date' => date(DATE_ATOM),
                ]);
            }
            $update = $pdo->prepare("UPDATE sales SET status = 'voided' WHERE id = :id AND status = 'completed'");
            $update->execute(['id' => $saleId]);
            if ($update->rowCount() !== 1) {
                throw new DomainException('Transaction status changed while voiding. No changes were kept.');
            }
            $pdo->prepare(
                'INSERT INTO audit_logs (transaction_id, voided_by, timestamp, reason)
                 VALUES (:sale, :user, :timestamp, :reason)'
            )->execute([
                'sale' => $saleId,
                'user' => $user['id'],
                'timestamp' => date(DATE_ATOM),
                'reason' => $reason,
            ]);
            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($exception instanceof DomainException) {
                fail($exception->getMessage(), 409);
            }
            throw $exception;
        }
        respond(['ok' => true, 'data' => ['id' => $saleId, 'status' => 'voided', 'restored_lines' => count($items)]]);
    }

    if ($method === 'POST' && $action === 'checkout') {
        $user = requireUser($pdo, ['admin', 'cashier']);
        $body = requestBody();
        $cart = $body['cart'] ?? null;
        $payment = (float) ($body['payment_amount'] ?? -1);
        if (!is_array($cart) || $cart === []) {
            fail('Cart is empty.');
        }
        if ($payment < 0 || !is_finite($payment)) {
            fail('Enter a valid cash payment amount.');
        }
        $payment = roundMoney($payment);
        $rate = getTaxRate();
        if ($rate < 0 || !is_finite($rate)) {
            fail('Tax configuration must be a non-negative percentage.', 500);
        }

        try {
            $pdo->beginTransaction();
            $lines = [];
            $subtotal = 0.0;
            $profit = 0.0;
            $requested = [];
            foreach ($cart as $line) {
                if (!is_array($line)) {
                    fail('The cart contains an invalid line.');
                }
                $productId = (int) ($line['product_id'] ?? 0);
                $rawQuantity = (float) ($line['qty'] ?? 0);
                if ($productId < 1 || $rawQuantity <= 0 || !is_finite($rawQuantity)
                    || abs($rawQuantity - round($rawQuantity, 2)) > 1.0e-9) {
                    fail('Every sale line needs a valid product and a positive quantity with at most two decimal places.', 422);
                }
                $quantity = round($rawQuantity, 2);
                $requested[$productId] = round(($requested[$productId] ?? 0) + $quantity, 2);
            }
            foreach ($requested as $productId => $quantity) {
                $stmt = $pdo->prepare('SELECT * FROM products WHERE id = :id AND is_active = 1');
                $stmt->execute(['id' => $productId]);
                $product = $stmt->fetch();
                if (!$product) {
                    fail('A product in the cart is no longer available.', 409);
                }
                if ((float) $product['stock_quantity'] + 1.0e-9 < $quantity) {
                    fail('Not enough stock for ' . $product['name'] . '.', 409);
                }
                $unitPrice = roundMoney((float) $product['price']);
                $unitCost = roundMoney((float) $product['cost']);
                $lineTotal = roundMoney($quantity * $unitPrice);
                $lineProfit = roundMoney($quantity * ($unitPrice - $unitCost));
                $subtotal += $lineTotal;
                $profit += $lineProfit;
                $lines[] = compact('product', 'productId', 'quantity', 'unitPrice', 'unitCost', 'lineTotal', 'lineProfit');
            }
            $subtotal = roundMoney($subtotal);
            $tax = roundMoney($subtotal * $rate / 100);
            $total = roundMoney($subtotal + $tax);
            if ($payment + 1.0e-9 < $total) {
                fail('Payment is less than the total.');
            }
            $now = date(DATE_ATOM);
            $invoice = 'INV-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
            $stmt = $pdo->prepare(
                'INSERT INTO sales (invoice_number, user_id, subtotal, tax_rate, tax_amount, total_amount, payment_amount, change_amount, total_profit, status, transaction_date)
                 VALUES (:invoice, :user, :subtotal, :rate, :tax, :total, :payment, :change, :profit, :status, :date)'
            );
            $stmt->execute([
                'invoice' => $invoice,
                'user' => $user['id'],
                'subtotal' => $subtotal,
                'rate' => $rate,
                'tax' => $tax,
                'total' => $total,
                'payment' => roundMoney($payment),
                'change' => roundMoney($payment - $total),
                'profit' => roundMoney($profit),
                'status' => 'completed',
                'date' => $now,
            ]);
            $saleId = (int) $pdo->lastInsertId();
            $itemInsert = $pdo->prepare(
                'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, line_total, line_profit)
                 VALUES (:sale, :product, :quantity, :price, :cost, :total, :profit)'
            );
            $stockUpdate = $pdo->prepare('UPDATE products SET stock_quantity = :stock WHERE id = :id');
            $logInsert = $pdo->prepare(
                'INSERT INTO inventory_logs (product_id, user_id, action, quantity_changed, quantity_before, quantity_after, notes, logged_at)
                 VALUES (:product, :user, :action, :changed, :before, :after, :notes, :date)'
            );
            foreach ($lines as $line) {
                $before = (float) $line['product']['stock_quantity'];
                $after = round($before - $line['quantity'], 2);
                $itemInsert->execute([
                    'sale' => $saleId,
                    'product' => $line['productId'],
                    'quantity' => $line['quantity'],
                    'price' => $line['unitPrice'],
                    'cost' => $line['unitCost'],
                    'total' => $line['lineTotal'],
                    'profit' => $line['lineProfit'],
                ]);
                $stockUpdate->execute(['stock' => $after, 'id' => $line['productId']]);
                $logInsert->execute([
                    'product' => $line['productId'],
                    'user' => $user['id'],
                    'action' => 'sale',
                    'changed' => -$line['quantity'],
                    'before' => $before,
                    'after' => $after,
                    'notes' => $invoice,
                    'date' => $now,
                ]);
            }
            $pdo->commit();
            respond(['ok' => true, 'data' => [
                'id' => $saleId,
                'invoice_number' => $invoice,
                'subtotal' => $subtotal,
                'tax_rate' => $rate,
                'tax_amount' => $tax,
                'total_amount' => $total,
                'total_profit' => roundMoney($profit),
                'payment_amount' => roundMoney($payment),
                'change_amount' => roundMoney($payment - $total),
                'transaction_date' => $now,
                'items' => array_map(static fn(array $line): array => [
                    'product_id' => $line['productId'],
                    'name' => $line['product']['name'],
                    'qty' => $line['quantity'],
                    'price' => $line['unitPrice'],
                    'cost' => $line['unitCost'],
                ], $lines),
            ]]);
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }
    }

    if ($method === 'POST' && $action === 'save_user') {
        requireUser($pdo, ['admin']);
        $body = requestBody();
        $username = trim((string) ($body['username'] ?? ''));
        $name = trim((string) ($body['full_name'] ?? ''));
        $password = (string) ($body['password'] ?? '');
        $role = (string) ($body['role'] ?? '');
        if ($username === '' || strlen($username) > 200 || $name === '' || strlen($name) > 480
            || strlen($password) < 8 || !in_array($role, ['admin', 'cashier', 'owner'], true)) {
            fail('Provide a username, full name, password of at least 8 characters, and valid role.');
        }
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO users (username, password_hash, full_name, role, is_active, created_at)
                 VALUES (:username, :password, :name, :role, 1, :created)'
            );
            $stmt->execute([
                'username' => $username,
                'password' => password_hash($password, PASSWORD_DEFAULT),
                'name' => $name,
                'role' => $role,
                'created' => date(DATE_ATOM),
            ]);
        } catch (PDOException $exception) {
            if (isUniqueViolation($exception)) {
                fail('That username is already in use.', 409);
            }
            throw $exception;
        }
        respond(['ok' => true, 'data' => ['id' => (int) $pdo->lastInsertId()]]);
    }

    if ($method === 'POST' && $action === 'reset_user_password') {
        requireUser($pdo, ['admin']);
        $body = requestBody();
        $userId = (int) ($body['id'] ?? 0);
        $password = (string) ($body['password'] ?? '');
        if ($userId < 1 || strlen($password) < 8) {
            fail('Choose an account and enter a password of at least 8 characters.');
        }
        $stmt = $pdo->prepare('UPDATE users SET password_hash = :password, is_active = 1 WHERE id = :id');
        $stmt->execute(['password' => password_hash($password, PASSWORD_DEFAULT), 'id' => $userId]);
        if ($stmt->rowCount() !== 1) {
            fail('Account not found.', 404);
        }
        respond(['ok' => true, 'data' => null]);
    }

    if ($method === 'POST' && $action === 'import_legacy') {
        requireUser($pdo, ['admin']);
        importLegacy($pdo, requestBody());
        respond(['ok' => true, 'data' => null]);
    }

    fail('Unknown API action.', 404);
} catch (Throwable $exception) {
    error_log('POS DSS API error: ' . $exception->getMessage());
    fail('The server could not complete the request. Check the PHP error log for details.', 500);
}
