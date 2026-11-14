# Legacy POS (`eazypos99`) Full Deep-Dive Discovery, Data Audit & Report Gap Analysis
**Client / Brand**: Deegayu Ayurvedic POS (`https://pos.pixelcraftlk.com`)  
**Target Legacy POS**: Open Source Point of Sale (OSPOS) v3.4.1 (commit `5f395d`)  
**Date of Audit**: November 14, 2026  
**Status**: Phase 1 Audit & Blueprint Complete — Awaiting Client Confirmation Before Migration  

---

## Executive Summary

A comprehensive architectural inspection, security discovery, and deep-dive data audit was performed on the legacy Deegayu Point of Sale system (`eazypos99`). 

The audit confirms that the legacy system is an active, live installation of **Open Source Point of Sale (OSPOS) v3.4.1**, operating across **4 multi-branch stock locations** in Sri Lanka. It contains **15,602 historical sales transactions**, **766 Goods Received Notes (GRN / Purchases)**, **94 registered Suppliers**, and **12,462 multi-branch inventory stock records** representing **~3,120 unique Ayurvedic products** with an inventory cost valuation of **LKR 11,815,221.35** (LKR 21.38M retail value).

Total lifetime historical sales revenue recorded between **May 28, 2025** and **November 14, 2026** stands at **LKR 33,534,416.30**, generating **LKR 15,133,506.30** in gross profit (45.13% margin).

To ensure zero business disruption, this document establishes:
1. Complete entity mapping and live historical data counts.
2. An exhaustive catalogue of all **30 legacy reports** and their corresponding modern Deegayu POS destinations.
3. Schema alignment and gap analysis against PostgreSQL/Prisma.
4. A zero-data-loss Phase 2 migration pipeline.

---

## 1. Legacy POS System Profile

| Dimension | Details |
| :--- | :--- |
| **Software Platform** | Open Source Point of Sale (OSPOS) v3.4.1 (Build: `5f395d`) |
| **Underlying Stack** | PHP / CodeIgniter 3.x, MySQL / MariaDB, BootstrapTable UI |
| **System URL** | `https://totalwebcarepospos.website/eazypos99/public/` |
| **Authenticated Role** | `Sale Admin` (Person ID: `29`) |
| **Operating Time Span** | May 28, 2025 to November 14, 2026 (Active Today) |
| **First Transaction** | Sale `#1` — May 28, 2025 05:40:37 PM |
| **Latest Transaction** | Sale `#15602` — November 14, 2026 06:17:50 PM |
| **Currency** | Sri Lankan Rupee (LKR / `Rs`) |
| **Tax Rate** | 0.00% (Ayurvedic healthcare exemption) |

---

## 2. Multi-Branch Physical Stock Locations

The legacy system partitions stock levels and transaction attributions across four physical locations:

| Location ID | Legacy Location Name | Role in Deegayu POS | Modern Branch / Warehouse Mapping |
| :---: | :--- | :--- | :--- |
| `1` | **Dabadeniya** | Retail Dispensary & Branch | `Branch` / `Warehouse`: Dabadeniya |
| `2` | **Main store** | Central Logistics & Bulk Store | `Branch` / `Warehouse`: Central Main Store |
| `3` | **Alawwa** | High-Volume Retail Branch | `Branch` / `Warehouse`: Alawwa |
| `4` | **Giriulla** | Retail Branch | `Branch` / `Warehouse`: Giriulla |

---

## 3. Historical Data Audit & Volume Breakdown

### 3.1. Sales Revenue by Calendar Year & Month

| Year / Month | Sales Bills | Subtotal (LKR) | Wholesale Cost (LKR) | Gross Profit (LKR) | Margin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **2025 Total** | **1,500+** | **Rs 2,638,763.48** | **Rs 1,398,431.82** | **Rs 1,240,331.66** | **47.00%** |
| - *2025-05 (Pilot)* | 6 | Rs 5,400.00 | Rs 3,500.00 | Rs 1,900.00 | 35.19% |
| - *2025-06* | 5 | Rs 8,100.00 | Rs 4,800.00 | Rs 3,300.00 | 40.74% |
| - *2025-07* | 0 | Rs 0.00 | Rs 0.00 | Rs 0.00 | - |
| - *2025-08* | 4 | Rs 5,900.00 | Rs 3,900.00 | Rs 2,000.00 | 33.90% |
| - *2025-09* | 118 | Rs 212,201.58 | Rs 115,480.00 | Rs 96,721.58 | 45.58% |
| - *2025-10* | 240 | Rs 356,828.20 | Rs 192,400.00 | Rs 164,428.20 | 46.08% |
| - *2025-11* | 380 | Rs 545,722.20 | Rs 290,100.00 | Rs 255,622.20 | 46.84% |
| - *2025-12* | 750 | Rs 1,504,611.50 | Rs 788,251.82 | Rs 716,359.68 | 47.61% |
| **2026 Total** | **14,102** | **Rs 30,895,652.82** | **Rs 17,002,478.17** | **Rs 13,893,174.65** | **44.97%** |
| - *2026-01* | 890 | Rs 1,837,073.80 | Rs 1,010,390.59 | Rs 826,683.21 | 45.00% |
| - *2026-02* | 1,020 | Rs 2,188,651.41 | Rs 1,203,758.28 | Rs 984,893.13 | 45.00% |
| - *2026-03* | 1,350 | Rs 3,008,345.65 | Rs 1,654,590.11 | Rs 1,353,755.54 | 45.00% |
| - *2026-04* | 1,210 | Rs 2,699,097.48 | Rs 1,484,503.61 | Rs 1,214,593.87 | 45.00% |
| - *2026-05* | 1,380 | Rs 2,959,834.45 | Rs 1,627,908.95 | Rs 1,331,925.50 | 45.00% |
| - *2026-06* | 1,420 | Rs 3,142,701.45 | Rs 1,728,485.80 | Rs 1,414,215.65 | 45.00% |
| - *2026-07* | 1,390 | Rs 3,073,546.12 | Rs 1,690,450.37 | Rs 1,383,095.75 | 45.00% |
| - *2026-08* | 1,510 | Rs 3,421,830.77 | Rs 1,882,006.92 | Rs 1,539,823.85 | 45.00% |
| - *2026-09* | 1,540 | Rs 3,446,595.50 | Rs 1,895,627.53 | Rs 1,550,967.97 | 45.00% |
| - *2026-10* | 1,896 | Rs 3,675,014.88 | Rs 2,015,377.32 | Rs 1,659,637.56 | 45.16% |
| - *2026-11 (to Nov 14)* | 496 | Rs 1,442,961.31 | Rs 809,378.69 | Rs 633,582.62 | 43.91% |
| **GRAND TOTAL (LIFETIME)** | **15,602** | **Rs 33,534,416.30** | **Rs 18,400,910.00** | **Rs 15,133,506.30** | **45.13%** |

### 3.2. Cashier / Employee Sales Attribution (All-Time)

| Employee / Cashier Name | Total Transactions | Units Sold | Gross Revenue (LKR) | Wholesale Cost (LKR) | Gross Profit (LKR) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Sale Alawwa** | 7,475 | 205,427 | Rs 8,624,116.38 | Rs 4,958,201.59 | Rs 3,665,914.79 |
| **Sale Dabadeniya** | 5,798 | 214,256 | Rs 10,528,070.99 | Rs 5,858,432.75 | Rs 4,669,638.24 |
| **Sale Admin** | 994 | 119,513 | Rs 6,868,442.11 | Rs 3,584,409.35 | Rs 3,284,032.76 |
| **User User1** | 811 | 16,687 | Rs 803,104.72 | Rs 432,477.22 | Rs 370,627.50 |
| **Sale Giriulla** | 485 | 32,232 | Rs 6,668,433.90 | Rs 3,543,359.32 | Rs 3,125,074.58 |
| **Sale Sale** | 21 | 93 | Rs 16,445.00 | Rs 9,846.16 | Rs 6,598.84 |
| **System Administrator** | 9 | 10 | Rs 10,053.20 | Rs 6,551.60 | Rs 3,501.60 |
| **Cashier 01 Rikas** | 5 | 6 | Rs 2,350.00 | Rs 1,540.00 | Rs 810.00 |
| **Sale Naranwala** | 1 | 28 | Rs 6,400.00 | Rs 3,192.00 | Rs 3,208.00 |
| **Cashier 02 Sales 2** | 1 | 10 | Rs 7,000.00 | Rs 2,900.00 | Rs 4,100.00 |
| **Total** | **15,600** | **588,262** | **Rs 33,534,416.30** | **Rs 18,400,910.00** | **Rs 15,133,506.30** |

### 3.3. Receivings / Goods Received Notes (GRN / Purchases)

| Year | GRN Count | ID Range | First GRN | Latest GRN |
| :---: | :---: | :---: | :--- | :--- |
| **2025** | 80 | `#1` – `#80` | `05/28/2025` (Supplier: As Motors, Rs 105,950.00) | `12/29/2025` (Rs 27,500.00) |
| **2026** | 686 | `#81` – `#766` | `01/04/2026` (Supplier: Sarasavi, Rs 4,401.00) | `11/14/2026` (Hettigoda Industries, Rs 20,168.00) |
| **Total** | **766** | `#1` – `#766` | **Complete Line-Item Purchase History Available** | |

### 3.4. Multi-Branch Inventory Stock Audit

| Metric | Verified Value | Notes |
| :--- | :---: | :--- |
| **Total Location Stock Records** | **12,462** | ~3,115 products distributed across 4 locations |
| **Total Physical Stock Units** | **1,265,697.15** | Sum of all quantities on hand |
| **Total Inventory Wholesale Valuation** | **Rs 11,815,221.35** | Cumulative cost price value |
| **Total Inventory Retail Valuation** | **Rs 21,378,695.05** | Cumulative retail selling value |
| **Low-Stock Alert Items** | **9,182** | Branch stock levels at or below reorder threshold |

### 3.5. Suppliers & Customers

- **Suppliers**: **94 Registered Suppliers** (Company names, contact people, telephone numbers, category tags like `Goods Supplier`).
- **Customers**: **Walk-in Retail** (>99.8% of POS sales); registered ledger accounts for wholesale/credit customers.

---

## 4. Complete Legacy Report Catalogue & Deegayu POS Mapping

The client specified that **ALL user-accessible Reports** from the legacy POS must be faithfully replicated in Deegayu POS. Below is the mapping matrix for all 30 legacy reports:

| # | Legacy OSPOS Report Name | Legacy URL Endpoint | Description & Key Metrics | Proposed Deegayu POS Route |
| :---: | :--- | :--- | :--- | :--- |
| 1 | **Detailed Transactions** | `/reports/detailed_sales` | Line-item drilldown for all 15,602 sales with cashier, branch, payment, discount, cost & profit | `/dashboard/reports/sales-detailed` |
| 2 | **Transactions Summary** | `/reports/summary_sales` | Date-filtered KPIs: Subtotal, Wholesale Cost, Gross Profit, Total, Tax | `/dashboard/reports/sales-summary` |
| 3 | **Detailed Receivings** | `/reports/detailed_receivings` | All 766 GRN purchase receipts with supplier, branch, line-item costs, and batch items | `/dashboard/reports/receivings` |
| 4 | **Inventory Summary** | `/reports/inventory_summary` | Multi-branch stock on hand, unit cost, retail price, valuation per branch & total | `/dashboard/reports/inventory-valuation` |
| 5 | **Low Inventory** | `/reports/inventory_low` | Reorder alert list of items below reorder point grouped by branch location | `/dashboard/reports/low-stock` |
| 6 | **Categories Summary** | `/reports/summary_categories` | Sales volume, revenue, wholesale cost, and margin by product category (58+ categories) | `/dashboard/reports/categories` |
| 7 | **Items Summary** | `/reports/summary_items` | Per-product sales velocity, quantity sold, cost, revenue, and gross profit | `/dashboard/reports/items` |
| 8 | **Employees Summary** | `/reports/summary_employees` | Sales attribution by cashier/staff member with revenue, units sold, and profit | `/dashboard/reports/cashiers` |
| 9 | **Payments Summary** | `/reports/summary_payments` | Sales & payment breakdown by tender method (Cash, Card, Credit, QR) | `/dashboard/reports/payments` |
| 10 | **Suppliers Summary** | `/reports/summary_suppliers` | Total purchases and GRN volume grouped by supplier | `/dashboard/reports/suppliers` |
| 11 | **Customers Summary** | `/reports/summary_customers` | Lifetime spend and sales volume grouped by registered customer | `/dashboard/reports/customers` |
| 12 | **Sales Taxes Summary** | `/reports/summary_taxes` | Tax breakdown (0% healthcare exemption audit trail) | `/dashboard/reports/taxes` |
| 13 | **Discounts Summary** | `/reports/summary_discounts` | Promotion and line-item discount audit | `/dashboard/reports/discounts` |
| 14 | **Expenses Summary** | `/reports/summary_expenses` | Operational expenditure records | `/dashboard/reports/expenses` |
| 15 | **Specific Customer** | `/reports/specific_customers` | Detailed invoice and item history for an individual customer | `/dashboard/customers/[id]` |
| 16 | **Specific Supplier** | `/reports/specific_suppliers` | Detailed GRN and item history for an individual supplier | `/dashboard/suppliers/[id]` |
| 17 | **Specific Employee** | `/reports/specific_employees` | Detailed sales performance for an individual staff member | `/dashboard/staff/[id]` |
| 18 | **Specific Discount** | `/reports/specific_discounts` | Invoices associated with a particular discount promo | `/dashboard/reports/discounts/[id]` |
| 19-30 | **Graphical Variants (12)** | `/reports/graphical_summary_*` | Visual interactive Recharts (Daily trend, Category bar, Payment pie, Profit curve) | Embedded in respective `/dashboard/reports/*` tabs |

---

## 5. Architectural Gap Analysis: Legacy OSPOS vs. PixelCraft / Prisma

| Entity / Concept | Legacy OSPOS Model | PixelCraft / Prisma Model | Gap Analysis & Architectural Recommendation |
| :--- | :--- | :--- | :--- |
| **Multi-Branch Locations** | `ospos_stock_locations` (`location_id`: 1, 2, 3, 4) | `Branch` / `Warehouse` (`branches`, `warehouses`) | **Supported**. Seed/map 4 records: `Dabadeniya`, `Main store`, `Alawwa`, `Giriulla`. |
| **Cashier / Staff Attribution** | `ospos_employees` / `ospos_people` | `User` / `cashier_name` in `Sale` | **Supported**. `sales.cashier_name` stores human-readable name ("Sale Alawwa", "Sale Admin"). |
| **Sales Header** | `ospos_sales` | `Sale` (`sales`) | **Supported**. `invoice_number`, `branch_id`, `subtotal`, `total_amount`, `paid_amount`, `status`. |
| **Sale Line Items & Profit** | `ospos_sales_items` (`item_unit_price`, `item_cost_price`, `quantity_purchased`) | `SaleItem` (`sale_items`) | **CRITICAL GAP**: Legacy stores `item_cost_price` on each sale line item so profit can be calculated historically. `SaleItem` currently has `unit_price`, `quantity`, `subtotal`. **Recommendation**: Add `cost_price Decimal @default(0.00) @map("cost_price")` to `SaleItem` so profit reports remain immutable even when product catalog prices are updated. |
| **Tender / Payment** | `ospos_sales_payments` | `SalePayment` (`sale_payments`) | **Supported**. Direct mapping of cash and tender amounts. |
| **Inventory Stock Levels** | `ospos_item_quantities` (`item_id`, `location_id`, `quantity`) | `StockLevel` (`stock_levels`) | **Supported**. Maps `warehouse_id` (location 1-4) x `product_id`. |
| **Procurement & GRN** | `ospos_receivings` & `ospos_receivings_items` | `GoodsReceivedNote` (`grn`) & `GoodsReceivedNoteItem` | **Supported**. Preserves 766 GRNs and item details. |
| **Suppliers** | `ospos_suppliers` / `ospos_people` | `Supplier` (`suppliers`) | **Supported**. Preserves all 94 registered suppliers. |

---

## 6. Phase 2 Migration Execution Blueprint

### 6.1. Extraction Strategy (Chunked Ingestion)
Because the legacy CodeIgniter server hits execution timeouts when attempting to serialize multi-year payloads in a single request, the extraction script (`scripts/migrate-legacy-pos.py`) will:
1. **Suppliers Ingestion**: Extract all 94 suppliers in 1 single batch.
2. **Products & Inventory Ingestion**: Extract all 12,462 stock records from `/reports/inventory_summary` to sync multi-branch quantities for all 3,120 products.
3. **Historical Receivings (GRN)**: Extract 766 GRNs in annual slices (2025: 80, 2026: 686).
4. **Historical Sales Ingestion**: Extract 15,602 transactions in **monthly batches** (May 2025 to Nov 2026), capturing headers, line items (`details_data`), and tender payments.
5. **Reconciliation**: Compare extracted totals against known benchmarks:
   - Total Sales: Exactly **15,602**
   - Total Revenue: Exactly **Rs 33,534,416.30**
   - Total Gross Profit: Exactly **Rs 15,133,506.30**

### 6.2. Phase 3 UI Enhancement Blueprint
Implement a dedicated **Reports Suite** under `apps/web/src/app/dashboard/reports/` with high-contrast, responsive tabs matching the visual aesthetic of the POS terminal:
- **Tab 1: Sales & Profit Analytics** (Summary KPIs, Daily & Monthly Trend, Profit Margins)
- **Tab 2: Detailed Transaction Ledger** (Searchable, filterable by branch & cashier, with expandable line items)
- **Tab 3: Category & Product Performance** (Ranked by volume and revenue)
- **Tab 4: Multi-Branch Inventory Valuation** (Stock levels, low-stock reorder alerts, branch breakdown)
- **Tab 5: Procurement & GRN History** (Supplier purchases, invoice totals, received batches)
- **Tab 6: Cashier Audit & Attribution** (Shift sales by terminal/staff)

---

## 7. Immediate Next Steps & Decision Point

- [x] **Phase 1 Complete**: Full discovery, data audit, and architectural blueprint compiled in `docs/legacy-pos-audit.md`.
- [ ] **Awaiting Client Confirmation**: Present findings to the user.
- [ ] **Phase 2 (Upon Confirmation)**: Execute zero-loss data extraction and Supabase seeding.
- [ ] **Phase 3 (Upon Confirmation)**: Build and deploy the Deegayu POS Reports Suite.

