-- POS DSS — Phase 1 database schema
-- MySQL 8+ / MariaDB 10.4+  |  charset utf8mb4
-- Import: mysql -u root -p < schema.sql   (or phpMyAdmin)

CREATE DATABASE IF NOT EXISTS `pos_dss`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pos_dss`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `inventory_logs`;
DROP TABLE IF EXISTS `sale_items`;
DROP TABLE IF EXISTS `sales`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- users
-- Roles: admin (full), cashier (POS only), owner (reports + DSS)
-- ---------------------------------------------------------------------------
CREATE TABLE `users` (
  `id`            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(50)      NOT NULL,
  `password`      VARCHAR(255)     NOT NULL COMMENT 'password_hash() bcrypt/argon',
  `full_name`     VARCHAR(120)     NOT NULL,
  `role`          ENUM('admin','cashier','owner') NOT NULL DEFAULT 'cashier',
  `is_active`     TINYINT(1)       NOT NULL DEFAULT 1,
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE `categories` (
  `id`            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(80)      NOT NULL,
  `description`   VARCHAR(255)     NULL DEFAULT NULL,
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- products
-- stock_quantity + min_stock_level drive low-stock alerts (DSS)
-- ---------------------------------------------------------------------------
CREATE TABLE `products` (
  `id`               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `category_id`      INT UNSIGNED     NOT NULL,
  `sku`              VARCHAR(40)      NOT NULL,
  `name`             VARCHAR(120)     NOT NULL,
  `description`      TEXT             NULL,
  `price`            DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  `stock_quantity`   INT              NOT NULL DEFAULT 0,
  `min_stock_level`  INT              NOT NULL DEFAULT 5,
  `is_active`        TINYINT(1)       NOT NULL DEFAULT 1,
  `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_sku` (`sku`),
  KEY `idx_products_category` (`category_id`),
  KEY `idx_products_name` (`name`),
  KEY `idx_products_active` (`is_active`),
  KEY `idx_products_low_stock` (`stock_quantity`, `min_stock_level`),
  CONSTRAINT `fk_products_category`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `chk_products_price` CHECK (`price` >= 0),
  CONSTRAINT `chk_products_stock` CHECK (`stock_quantity` >= 0),
  CONSTRAINT `chk_products_min_stock` CHECK (`min_stock_level` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- sales  (transaction header)
-- ---------------------------------------------------------------------------
CREATE TABLE `sales` (
  `id`                 INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `invoice_number`     VARCHAR(32)      NOT NULL,
  `user_id`            INT UNSIGNED     NOT NULL COMMENT 'cashier who processed the sale',
  `subtotal`           DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  `total_amount`       DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  `payment_amount`     DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  `change_amount`      DECIMAL(12,2)    NOT NULL DEFAULT 0.00,
  `payment_method`     ENUM('cash')     NOT NULL DEFAULT 'cash',
  `status`             ENUM('completed','voided') NOT NULL DEFAULT 'completed',
  `transaction_date`   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at`         DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sales_invoice` (`invoice_number`),
  KEY `idx_sales_user` (`user_id`),
  KEY `idx_sales_date` (`transaction_date`),
  KEY `idx_sales_status` (`status`),
  CONSTRAINT `fk_sales_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `chk_sales_amounts` CHECK (
    `subtotal` >= 0 AND `total_amount` >= 0 AND `payment_amount` >= 0 AND `change_amount` >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- sale_items  (transaction lines)
-- ---------------------------------------------------------------------------
CREATE TABLE `sale_items` (
  `id`            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `sale_id`       INT UNSIGNED     NOT NULL,
  `product_id`    INT UNSIGNED     NOT NULL,
  `quantity`      INT              NOT NULL,
  `unit_price`    DECIMAL(10,2)    NOT NULL,
  `line_total`    DECIMAL(12,2)    NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sale_items_sale` (`sale_id`),
  KEY `idx_sale_items_product` (`product_id`),
  CONSTRAINT `fk_sale_items_sale`
    FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT `fk_sale_items_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `chk_sale_items_qty` CHECK (`quantity` > 0),
  CONSTRAINT `chk_sale_items_price` CHECK (`unit_price` >= 0 AND `line_total` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- inventory_logs  (stock movement audit)
-- action: sale | restock | adjustment | initial
-- quantity_changed is signed: negative = stock out, positive = stock in
-- ---------------------------------------------------------------------------
CREATE TABLE `inventory_logs` (
  `id`                 INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `product_id`         INT UNSIGNED     NOT NULL,
  `user_id`            INT UNSIGNED     NULL,
  `action`             ENUM('sale','restock','adjustment','initial') NOT NULL,
  `quantity_changed`   INT              NOT NULL,
  `quantity_before`    INT              NOT NULL,
  `quantity_after`     INT              NOT NULL,
  `notes`              VARCHAR(255)     NULL DEFAULT NULL,
  `logged_at`          DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inv_product` (`product_id`),
  KEY `idx_inv_user` (`user_id`),
  KEY `idx_inv_action` (`action`),
  KEY `idx_inv_date` (`logged_at`),
  CONSTRAINT `fk_inv_product`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT `fk_inv_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Seed users  (CHANGE THESE PASSWORDS after first login)
--   admin    / admin123
--   cashier  / cashier123
--   owner    / owner123
-- Hashes generated with bcrypt cost 12 (PHP password_verify compatible).
-- ---------------------------------------------------------------------------
INSERT INTO `users` (`username`, `password`, `full_name`, `role`, `is_active`) VALUES
  ('admin',   '$2y$12$7aZ0CAkcwh6PrU2dtBXtwu9Oq1VzbvFFRV7FjvykaprLMfXCJSBhe', 'System Administrator', 'admin',   1),
  ('cashier', '$2y$12$GoTZAs5RMm28F1/85HNTXuiDnRiTRrhl2D5gE3z1qVVqLY4pKSc/a', 'Front Desk Cashier',   'cashier', 1),
  ('owner',   '$2y$12$ixKexeq/dhUSV.paQow4oe3vOWmLBuazRAgnmpbHOZiM9ZSJCleIq', 'Business Owner',       'owner',   1);

INSERT INTO `categories` (`name`, `description`) VALUES
  ('Beverages',     'Drinks and bottled water'),
  ('Snacks',        'Chips, biscuits, and packaged snacks'),
  ('Grocery',       'Staples and packaged grocery items'),
  ('Cafe',          'Cafe-prepared items');

INSERT INTO `products`
  (`category_id`, `sku`, `name`, `description`, `price`, `stock_quantity`, `min_stock_level`, `is_active`)
VALUES
  (1, 'BEV-001', 'Bottled Water 500ml',  'Still water',           15.00,  80, 15, 1),
  (1, 'BEV-002', 'Cola 330ml',           'Canned soda',           25.00,  40, 12, 1),
  (2, 'SNK-001', 'Potato Chips',         'Salted chips 50g',      20.00,  8,  10, 1),
  (2, 'SNK-002', 'Crackers Pack',        'Plain crackers',        18.00,  35, 10, 1),
  (3, 'GRO-001', 'Instant Noodles',      'Chicken flavor',        12.00,  5,  20, 1),
  (3, 'GRO-002', 'White Rice 1kg',       'Milled rice',           55.00,  25,  8, 1),
  (4, 'CAF-001', 'Brewed Coffee',        'Regular cup',           45.00,  50, 10, 1),
  (4, 'CAF-002', 'Ham & Cheese Sandwich','Cafe sandwich',         75.00,  6,  8, 1);

INSERT INTO `inventory_logs`
  (`product_id`, `user_id`, `action`, `quantity_changed`, `quantity_before`, `quantity_after`, `notes`)
SELECT
  `id`, 1, 'initial', `stock_quantity`, 0, `stock_quantity`, 'Seed stock'
FROM `products`;
