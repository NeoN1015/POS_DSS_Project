<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_login();

$user = current_user();
$pageTitle = 'Dashboard';
$currentPage = 'dashboard';

require __DIR__ . '/includes/header.php';
?>

<p class="text-secondary mb-4">
    Welcome, <strong><?= e($user['full_name']) ?></strong>.
    You are signed in as <?= e(role_label($user['role'])) ?>.
    Remaining modules (products, POS, reports, DSS) will be wired in later phases.
</p>

<div class="row g-3">
    <div class="col-md-4">
        <div class="placeholder-tile p-4 h-100">
            <h2 class="h6 text-uppercase text-secondary">Sales today</h2>
            <p class="display-6 mb-1">—</p>
            <p class="small text-secondary mb-0">Placeholder until reports (Phase 5).</p>
        </div>
    </div>
    <div class="col-md-4">
        <div class="placeholder-tile p-4 h-100">
            <h2 class="h6 text-uppercase text-secondary">Low stock</h2>
            <p class="display-6 mb-1">—</p>
            <p class="small text-secondary mb-0">Placeholder until inventory (Phase 3).</p>
        </div>
    </div>
    <div class="col-md-4">
        <div class="placeholder-tile p-4 h-100">
            <h2 class="h6 text-uppercase text-secondary">Your access</h2>
            <ul class="small mb-0 ps-3">
                <?php if (can('pos')): ?><li>Point of Sale</li><?php endif; ?>
                <?php if (can('products_view')): ?><li>Product availability</li><?php endif; ?>
                <?php if (can('products_manage')): ?><li>Manage products &amp; users</li><?php endif; ?>
                <?php if (can('reports')): ?><li>Sales reports</li><?php endif; ?>
                <?php if (can('dss')): ?><li>DSS dashboard</li><?php endif; ?>
                <?php if (can('settings')): ?><li>System settings</li><?php endif; ?>
            </ul>
        </div>
    </div>
</div>

<?php
require __DIR__ . '/includes/footer.php';
