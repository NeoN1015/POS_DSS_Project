<?php
declare(strict_types=1);

if (!isset($pageTitle)) {
    $pageTitle = 'POS DSS';
}
if (!isset($currentPage)) {
    $currentPage = '';
}

$user = current_user();
$flash = flash_get();

$navItems = [
    [
        'section' => 'Overview',
        'items'   => [
            ['key' => 'dashboard', 'label' => 'Dashboard', 'href' => 'dashboard.php', 'show' => true],
        ],
    ],
    [
        'section' => 'Operations',
        'items'   => [
            ['key' => 'pos', 'label' => 'Point of Sale', 'href' => 'pos.php', 'show' => can('pos')],
            ['key' => 'products', 'label' => 'Products & Inventory', 'href' => 'products.php', 'show' => can('products_view')],
        ],
    ],
    [
        'section' => 'Insights',
        'items'   => [
            ['key' => 'reports', 'label' => 'Sales Reports', 'href' => 'reports.php', 'show' => can('reports')],
            ['key' => 'dss', 'label' => 'DSS Dashboard', 'href' => 'dss_dashboard.php', 'show' => can('dss')],
        ],
    ],
    [
        'section' => 'Administration',
        'items'   => [
            ['key' => 'users', 'label' => 'Users', 'href' => 'users.php', 'show' => can('users')],
            ['key' => 'settings', 'label' => 'System Settings', 'href' => 'settings.php', 'show' => can('settings')],
        ],
    ],
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title><?= e($pageTitle) ?> · POS DSS</title>
    <?php require __DIR__ . '/pwa_head.php'; ?>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body class="app-body">
<div class="container-fluid p-0">
    <div class="row g-0">
        <aside class="col-lg-auto d-none d-lg-block">
            <div class="app-sidebar d-flex flex-column p-3 text-white">
                <div class="d-flex align-items-center gap-2 mb-4">
                    <span class="brand-mark">POS</span>
                    <div>
                        <div class="fw-semibold">POS DSS</div>
                        <div class="small text-white-50">SME retail console</div>
                    </div>
                </div>
                <nav class="flex-grow-1">
                    <?php foreach ($navItems as $group): ?>
                        <?php
                        $visible = array_filter($group['items'], static fn(array $item): bool => $item['show']);
                        if ($visible === []) {
                            continue;
                        }
                        ?>
                        <div class="nav-section"><?= e($group['section']) ?></div>
                        <ul class="nav nav-pills flex-column gap-1 mb-2">
                            <?php foreach ($visible as $item): ?>
                                <li class="nav-item">
                                    <a class="nav-link <?= $currentPage === $item['key'] ? 'active' : '' ?>"
                                       href="<?= e($item['href']) ?>">
                                        <?= e($item['label']) ?>
                                    </a>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endforeach; ?>
                </nav>
                <div class="small text-white-50 mt-auto pt-3">
                    Signed in as<br>
                    <strong class="text-white"><?= e($user['full_name'] ?? '') ?></strong>
                </div>
            </div>
        </aside>

        <div class="col app-main">
            <header class="app-topbar px-3 px-lg-4 py-3 d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-outline-secondary d-lg-none" type="button" data-bs-toggle="offcanvas" data-bs-target="#mobileNav">
                        Menu
                    </button>
                    <h1 class="h5 mb-0"><?= e($pageTitle) ?></h1>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge rounded-pill role-pill px-3 py-2"><?= e(role_label($user['role'] ?? '')) ?></span>
                    <a class="btn btn-sm btn-outline-danger" href="logout.php">Log out</a>
                </div>
            </header>

            <div class="offcanvas offcanvas-start text-bg-dark" tabindex="-1" id="mobileNav">
                <div class="offcanvas-header">
                    <h5 class="offcanvas-title">POS DSS</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
                </div>
                <div class="offcanvas-body">
                    <?php foreach ($navItems as $group): ?>
                        <?php
                        $visible = array_filter($group['items'], static fn(array $item): bool => $item['show']);
                        if ($visible === []) {
                            continue;
                        }
                        ?>
                        <div class="text-uppercase small text-white-50 mb-2 mt-3"><?= e($group['section']) ?></div>
                        <?php foreach ($visible as $item): ?>
                            <a class="d-block text-white text-decoration-none py-2 <?= $currentPage === $item['key'] ? 'fw-semibold' : '' ?>"
                               href="<?= e($item['href']) ?>"><?= e($item['label']) ?></a>
                        <?php endforeach; ?>
                    <?php endforeach; ?>
                </div>
            </div>

            <main class="p-3 p-lg-4">
                <?php if ($flash): ?>
                    <div class="alert alert-<?= e($flash['type'] === 'error' ? 'danger' : $flash['type']) ?> alert-dismissible fade show" role="alert">
                        <?= e($flash['message']) ?>
                        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                    </div>
                <?php endif; ?>
