Project Specification & AI Development Prompt
Project Title: Generic Point of Sale System for SMEs with Decision Support System (DSS)
1. Project Overview
The goal is to develop a web-based Point of Sale (POS) system integrated with a basic Decision Support System (DSS) tailored for Small and Medium Enterprises (SMEs) such as retail stores, mini groceries, cafes, and school supply stores. The system aims to replace manual, error-prone processes with automated sales, inventory tracking, and basic business analytics.

2. General & Specific Objectives
General Objective:
To design and develop a web-based POS system that automates sales transactions, inventory management, report generation, and provides basic business analytics.

Specific Objectives:

Design: Create a system capable of processing sales, managing inventory, generating reports, and providing basic DSS functionalities.

Develop: Build the system using PHP, MySQL, Bootstrap, and JavaScript.

Test: Ensure functionality and reliability through Alpha and Beta testing.

Evaluate: Meet the ISO/IEC 25010:2023 Software Quality Model standards (Functional Suitability, Performance, Compatibility, Usability, Reliability, Security, Maintainability, Portability).

Implement: Deploy the system for actual operational use in selected SMEs.

3. Core System Features & Modules (What the AI Must Build)
The system is divided into five primary functional modules:

A. User Management Module
Login and Authentication: Secure login system.

Role-Based Access Control (RBAC):

Administrator: Full access (Manage users, products, inventory, sales, reports, settings).

Business Owner: View sales, inventory, reports, and DSS dashboard.

Cashier: Process sales, generate receipts, view product availability.

B. Product and Inventory Management Module
Product Management: Add, edit, delete, and view products (Name, Price, Category, Stock Quantity).

Inventory Monitoring: Track stock levels in real-time.

Low-Stock Notifications: Automatically alert the Admin/Owner when an item reaches its minimum stock level.

C. Sales Transaction Module
Sales Processing: Select products, auto-compute total amount, apply payments.

Change Calculation: Automatically calculate change based on customer payment.

Receipt Generation: Generate digital or printable receipts.

Inventory Auto-Update: Automatically deduct sold items from the inventory upon successful transaction.

D. Reports Module
Sales Reports: Generate Daily, Weekly, and Monthly sales reports.

Inventory Reports: Summarize product availability and stock movement.

Export/View: Display reports on-screen in a structured table format.

E. Basic Decision Support System (DSS) Module
Top-Selling Products: Identify and display the most sold items based on recorded data.

Sales Summaries: Provide a high-level view of total revenue and transaction counts.

Graphical Dashboards: Display simple charts (bar charts, pie charts) for sales and inventory.

Low-Stock Items Display: A dedicated view for items needing immediate reordering.

4. Technical Stack & Architecture (Strict Requirements for AI)
The AI must strictly adhere to the following technology stack and architecture:

Frontend: HTML, CSS, Bootstrap (for responsive UI), JavaScript (for interactivity and charts).

Backend: PHP (Core or lightweight framework like CodeIgniter/Laravel if preferred, but vanilla PHP is acceptable).

Database: MySQL (Relational Database Management System).

IDE: Visual Studio Code (AI should generate code compatible with this environment).

Architecture: Web-based Client-Server Architecture. The user interacts via a browser; the server handles business logic; the database stores records.

Database Schema Requirements (Minimum Tables)
users (id, username, password, role)

products (id, name, category_id, price, stock_quantity, min_stock_level)

categories (id, name)

sales (id, user_id, total_amount, payment_amount, change_amount, transaction_date)

sales_items (id, sale_id, product_id, quantity, price)

inventory_logs (id, product_id, action, quantity_changed, date) optional but recommended for tracking

5. Constraints & Limitations (What the AI MUST NOT Do)
To ensure the project stays within the scope of the study, the AI must NOT include:

Advanced Analytics, Artificial Intelligence (AI), Machine Learning, or Predictive Forecasting.

Online banking, mobile wallets (GCash, Maya, etc.), or e-commerce integrations.

Multi-branch synchronization or cloud-based sync.

Mobile application development (The system is strictly browser-based).

Complex accounting or enterprise-level ERP features.

6. AI Execution Guidelines (How the AI Should Behave)
When generating code or answering prompts based on this document, the AI must follow these rules:

Modular Development: Break down the code into logical files (e.g., index.php, login.php, dashboard.php, process_sale.php, inventory.php, reports.php).

Security First: Always use Prepared Statements (PDO or MySQLi) to prevent SQL Injection. Hash passwords using password_hash() and verify with password_verify(). Implement session management for RBAC.

Code Readability: Write clean, well-commented code. Separate database connection logic into a dedicated db_connect.php file.

UI/UX: Utilize Bootstrap 5 for all UI elements. Ensure the dashboard is clean, user-friendly, and mobile-responsive (even though it's desktop-first).

RAD Methodology: Follow the Rapid Application Development approach. Provide code in iterative chunks (e.g., "Here is the database schema," then "Here is the login system," then "Here is the POS interface").

DSS Implementation: For the graphical dashboard, utilize a lightweight JS library like Chart.js or Google Charts to render top-selling products and sales trends
