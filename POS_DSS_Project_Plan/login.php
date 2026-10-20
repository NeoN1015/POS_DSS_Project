<?php
declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';

if (is_logged_in()) {
    header('Location: dashboard.php');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verify_csrf($_POST['csrf_token'] ?? null)) {
        $error = 'Your session expired. Please try again.';
    } else {
        $username = trim((string) ($_POST['username'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');

        if ($username === '' || $password === '') {
            $error = 'Enter both username and password.';
        } else {
            $result = authenticate($username, $password);
            if ($result['ok']) {
                login_user($result['user']);
                header('Location: dashboard.php');
                exit;
            }
            $error = $result['error'];
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>Sign in · POS DSS</title>
    <?php require __DIR__ . '/includes/pwa_head.php'; ?>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/app.css">
</head>
<body class="auth-body d-flex align-items-center justify-content-center p-3">
    <div class="card auth-card shadow-lg w-100">
        <div class="card-body p-4 p-md-5">
            <div class="d-flex align-items-center gap-2 mb-3">
                <span class="brand-mark">POS</span>
                <div>
                    <h1 class="h4 mb-0">POS DSS</h1>
                    <div class="text-secondary small">Sign in to continue</div>
                </div>
            </div>

            <?php if ($error !== ''): ?>
                <div class="alert alert-danger py-2"><?= e($error) ?></div>
            <?php endif; ?>

            <form method="post" action="login.php" autocomplete="off" novalidate>
                <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
                <div class="mb-3">
                    <label class="form-label" for="username">Username</label>
                    <input class="form-control" type="text" id="username" name="username" required maxlength="50"
                           value="<?= e((string) ($_POST['username'] ?? '')) ?>">
                </div>
                <div class="mb-4">
                    <label class="form-label" for="password">Password</label>
                    <input class="form-control" type="password" id="password" name="password" required>
                </div>
                <button class="btn w-100 text-white" type="submit" style="background:#2a9d8f;">Sign in</button>
            </form>

            <p class="small text-secondary mt-4 mb-2">
                Demo accounts: <code>admin</code> / <code>admin123</code>,
                <code>cashier</code> / <code>cashier123</code>,
                <code>owner</code> / <code>owner123</code>
            </p>
            <p class="small text-secondary mb-0">
                On a phone, open this site in the browser, then use
                <strong>Add to Home Screen</strong> / <strong>Install app</strong>.
            </p>
        </div>
    </div>
    <script src="assets/js/pwa.js"></script>
</body>
</html>
