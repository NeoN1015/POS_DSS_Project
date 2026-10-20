# POS DSS

A responsive point-of-sale, inventory, and basic decision-support app for small businesses. The runnable app is a vanilla JavaScript/Bootstrap frontend served by PHP, with user, category, product, sale, and inventory data saved in a SQLite database file.

## Run the app on Windows

### Requirements

- PHP 8.1 or newer with `PDO_SQLite` enabled.
- A current browser. Bootstrap and Chart.js are loaded from CDNs, so an internet connection is needed for their first load.

Check the PHP SQLite extension from PowerShell:

```powershell
php -m | Select-String -Pattern 'PDO|sqlite'
```

The output should include `PDO` and `pdo_sqlite`. If PHP is not installed or `pdo_sqlite` is missing, install/enable PHP and the PDO SQLite extension using your PHP distribution (for example, XAMPP), then reopen the terminal.

### Start the server

1. Open PowerShell in this project folder (the one containing `api`, `web`, and this README).
2. Start PHP's local development server. Binding to all interfaces allows a phone on the same trusted Wi-Fi network to connect:

   ```powershell
   php -S 0.0.0.0:8000
   ```

3. Open <http://127.0.0.1:8000/>. The root page redirects to the browser app.
4. Sign in using one of the demo accounts.

Keep the server running while using the app. Press **Ctrl+C** in PowerShell to stop it.

To open it on a phone connected to the same Wi-Fi, use the computer's local IPv4 address (find it with `ipconfig`) and port `8000`, for example `http://192.168.1.25:8000/`. Allow access only on a trusted private network. The PHP built-in server is for development, not public hosting; do not forward its port to the internet. Installing as a PWA generally requires HTTPS; the app itself can still be opened in the phone's browser over a private LAN.

### Demo accounts

| Role | Username | Password |
|---|---|---|
| Administrator | `admin` | `admin123` |
| Cashier | `cashier` | `cashier123` |
| Business owner | `owner` | `owner123` |

Change demo passwords and create your own administrator account before using the app for real business data.

## Where data is saved

On first use, the PHP API creates and initializes the SQLite database at:

```text
..\pos_dss_data\pos_dss.sqlite
```

This is a `pos_dss_data` folder beside the project folder, outside the PHP document root, so the database file is not directly downloadable from the website. The folder must be writable by the PHP process. You can choose another absolute database path with the `POS_DSS_DB_PATH` environment variable before starting PHP.

For example, to place the database at `D:\POSData\pos_dss.sqlite` for that server session:

```powershell
$env:POS_DSS_DB_PATH = 'D:\POSData\pos_dss.sqlite'
php -S 0.0.0.0:8000
```

The SQLite file is the persistent database used by the app. Back it up regularly. For a simple consistent backup, stop the PHP server first, copy `pos_dss.sqlite` to a safe location, then restart the server. Do not delete the database to clear browser data; that database contains the app's records.

When opening the app on a phone, the phone connects to the PHP server; the SQLite file remains on the computer/server running PHP. The app needs a reachable server for login and data operations. It is not a standalone offline database on the phone.

## Tax configuration

Set the tax percentage in [`config/tax.php`](./config/tax.php), inside `getTaxRate()`. The default is `0.0` (no tax); for example, return `12.0` to apply 12 percent. The POS displays the rate and calculates tax from the sale subtotal. Check applicable local tax rules before using a rate in production.

## Features

- Role-aware administrator, cashier, and business-owner access enforced by the PHP API.
- Category-first POS browsing, image placeholders, product search, decimal quantity adjustments, cash/change calculation, and printable receipts.
- Product/category management, stock tracking, low-stock thresholds, and inventory movement logs.
- Product images can be selected or dragged into the product form; validated files are saved under `uploads/products/` and displayed without cropping in product thumbnails and cards.
- Cost and margin management, sale-time unit-cost snapshots, and daily realized profit.
- Admin/Owner category deletion with safe reassignment or confirmed cascading archive; product archiving preserves historical sales and supports restoration.
- Admin/Owner sales history and transaction voiding with a required reason, atomic stock restoration, and a persistent audit trail.
- Dashboard DSS charts for revenue and profit by period, stock by category, top-selling products, and low-stock items.
- Daily, weekly, and monthly sales reports.
- SQLite-backed records shared by browser sessions that connect to this PHP server.

## Import data from the previous browser demo

If this browser has records from the earlier IndexedDB-only demo, sign in as an administrator and use **Import browser data** on the dashboard. The import is one-time for this SQLite database. Keep the old browser data until you have checked the imported records.

Imported custom user accounts are disabled because their old browser password hashes cannot be used as secure server passwords. An administrator can set a new password from the Users page using **Reset access**. Older sales did not store unit costs, so their profit is shown as unavailable instead of being guessed from current product costs.

## Project map

- `web/index.html` — browser app entry point.
- `web/assets/js/app.js` — UI, POS, inventory, reports, dashboard, and margin views.
- `web/assets/js/db.js` — shared API-backed data access and one-time browser-data import.
- `web/assets/js/auth.js` — API session login and role-based UI access.
- `api/index.php` — PHP JSON API, server-side authentication/permissions, SQLite schema initialization, and transactional checkout.
- `config/tax.php` — `getTaxRate()` percentage configuration.
- `web/assets/css/app.css` — responsive UI styles.
- `schema.sql`, `config/db_connect.php`, and the standalone PHP auth/dashboard pages — earlier MySQL scaffold retained separately; they are not used by the current `/web/` app.
- `POS_DSS_Project_Plan.md` — original objectives and requirements.

## Notes

- The SQLite API requires PHP's `pdo_sqlite` extension and write permission for the database folder.
- Product image uploads use PHP's `getimagesize()` for server-side format validation (Fileinfo is not required) and need write permission for the project's `uploads/products/` folder; image files are limited to 5 MB.
- To accept the full 5 MB image limit, configure PHP with `upload_max_filesize=5M` and `post_max_size=6M` or higher.
- Demo data is seeded into SQLite on initial setup. The current database initialization is non-destructive; it does not drop existing tables.
- Seeded product costs are examples only. Enter your actual unit costs before relying on profit and margin figures.
- This is still a local/small-business prototype. Use HTTPS and proper server hardening before exposing it outside a trusted local network. Do not expose the PHP development server to the public internet.
