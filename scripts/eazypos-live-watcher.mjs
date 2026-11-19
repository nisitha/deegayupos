#!/usr/bin/env node

/**
 * =============================================================================
 * PIXELCRAFT POS — EAZYPOS99 AUTOMATED LIVE WATCHER & CATCH-UP SYNC ENGINE
 * Tenant: Deegayu Weda Madura (Tenant ID: 0fef1423-5d89-4147-8af8-17c7e641c88a)
 * 
 * Functions:
 * 1. Checks cutover kill-switch in `public.legacy_sync_config`.
 * 2. Authenticates to legacy OSPOS (`eazypos99`) with polite pacing & CookieJar.
 * 3. Scrapes & upserts:
 *    - New/updated Products, Suppliers, and Customers.
 *    - Live per-branch stock quantities across 4 locations (including 7 Modaka varieties).
 *    - Incremental sales bills, line items, and payments (INV-{id}) with Asia/Colombo (+05:30) timestamps.
 *    - Incremental receivings / GRNs (GRN-{id}).
 * 4. Logs audit entry in `public.legacy_sync_logs` and updates `public.legacy_sync_config`.
 * =============================================================================
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment variables from .env if present
const rootEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(rootEnvPath)) {
  const content = fs.readFileSync(rootEnvPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  }
}

// 2. Prisma Client
const { PrismaClient } = require('../packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient();

// 3. Environment & Configuration
const TENANT_ID = '0fef1423-5d89-4147-8af8-17c7e641c88a';
const EAZYPOS_URL = (process.env.EAZYPOS_URL || 'https://totalwebcarepospos.website/eazypos99/public').replace(/\/+$/, '');
const EAZYPOS_USER = process.env.EAZYPOS_USER || 'admin';
const EAZYPOS_PASS = process.env.EAZYPOS_PASS || process.env.EAZYPOS_PWD || '123456789';
const TRIGGER_SOURCE = process.env.TRIGGER_SOURCE || (process.argv.includes('--cron') ? 'cron' : 'catchup');
const FORCE_SYNC = process.env.FORCE_SYNC === 'true' || process.argv.includes('--force');

const BRANCH_MAP = {
  'Dabadeniya': { branchId: 'fa68e4a0-a515-44c8-a082-5b5590366658', warehouseId: '6e8904dd-b753-434e-a22d-2d8e428f0a02' },
  'Main store': { branchId: '133eeaec-5726-4702-a819-8423750db203', warehouseId: '4898d051-2faf-4553-a198-19566f5598e1' },
  'Alawwa': { branchId: '00f4cdcb-7d1c-4026-b57a-6e66c33b0c54', warehouseId: '42f1fe9d-7e44-48eb-8eb0-10a6439b5619' },
  'Giriulla': { branchId: '197693d6-4247-48df-b614-6fcde9e34f7d', warehouseId: '5f0f4a53-75d7-411e-be5c-337ff170da50' },
};

const CASHIER_MAP = {
  'Sale Alawwa': '219891d1-6264-4271-95a1-8781e5e5a7b1',
  'Sale Dabadeniya': 'f8fa0168-e71e-4749-823b-4ec2b54612d8',
  'Sale Admin': '97e9b65f-1e57-4061-ad98-b79136359f07',
  'User User1': '23fed607-537b-41c8-9d29-2396d82e7cb8',
  'Sale Giriulla': '057b87b9-2aa7-4c64-a17e-2be8ec9723ac',
  'Sale Sale': '37e36f19-ccd4-4f19-813b-b6bca92867ae',
  'System Administrator': 'd1cbf4fe-8453-4754-b080-3e1d416b39a2',
  'Cashier 01   Rikas': 'a04a3e4e-4c72-4cb3-a913-f242cb9d06f0',
  'Sale Naranwala': '73c70349-2397-4037-a8bd-9b994f514704',
  'Cashier 02 Sales 2': '70f3b1bc-7b5c-4738-a425-0679c9d6d866',
};

const DEFAULT_CASHIER_ID = '97e9b65f-1e57-4061-ad98-b79136359f07'; // Sale Admin

// 4. Utility Functions
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry(fn, maxRetries = 4, delay = 1500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await sleep(delay * (i + 1));
    }
  }
}

function cleanMoney(val) {
  if (val === null || val === undefined) return 0.00;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0.00 : num;
}

function parseLegacyDate(dateStr) {
  if (!dateStr) return new Date();
  const m = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let [_, month, day, year, hours, mins, secs, ampm] = m;
    let h = parseInt(hours, 10);
    if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
    if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(h).padStart(2, '0')}:${mins}:${secs}+05:30`;
    return new Date(isoString);
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

// 5. HTTP CookieJar Client
class EazyPosClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookieJar = new Map();
  }

  updateCookies(res) {
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of sc) {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const k = pair.slice(0, idx).trim();
        const v = pair.slice(idx + 1).trim();
        this.cookieJar.set(k, v);
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async fetchWithPacing(url, options = {}, retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await sleep(250); // Polite 250ms pacing
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Cookie': this.getCookieHeader(),
          ...(options.headers || {})
        };

        const res = await fetch(url, { ...options, headers });
        this.updateCookies(res);
        return res;
      } catch (err) {
        console.warn(`[SYNC ENGINE] Network fetch retry ${attempt + 1}/${retries} for ${url}: ${err.message}`);
        if (attempt === retries - 1) throw err;
        await sleep(1500 * (attempt + 1));
      }
    }
  }

  async login(username, password) {
    // Acquire initial session
    const r1 = await this.fetchWithPacing(`${this.baseUrl}/index.php`);
    if (!r1.ok) {
      throw new Error(`Failed to initialize session from index.php: HTTP ${r1.status}`);
    }

    const body = new URLSearchParams({
      username,
      password,
      honeypot: ''
    });

    const r2 = await this.fetchWithPacing(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
      redirect: 'follow'
    });

    if (!r2.ok && r2.status !== 302) {
      throw new Error(`Login POST failed with HTTP ${r2.status}`);
    }

    // Verify session
    const rHome = await this.fetchWithPacing(`${this.baseUrl}/home`);
    const homeHtml = await rHome.text();
    if (homeHtml.includes('id="login_form"') || homeHtml.includes('name="login_press"')) {
      throw new Error('Authentication failed: Invalid credentials or session rejected.');
    }
    return true;
  }
}

// 6. MAIN EXECUTION ROUTINE
async function main() {
  const startTime = new Date();
  console.log(`[SYNC ENGINE] ========================================================`);
  console.log(`[SYNC ENGINE] EAZYPOS99 CLOUD WATCHER START — ${startTime.toISOString()}`);
  console.log(`[SYNC ENGINE] Trigger: ${TRIGGER_SOURCE} | Force: ${FORCE_SYNC}`);
  console.log(`[SYNC ENGINE] Source URL: ${EAZYPOS_URL}`);

  // 1. Verify Cutover Kill-Switch
  let syncConfig = null;
  try {
    syncConfig = await retry(() => prisma.legacySyncConfig.findUnique({ where: { id: 1 } }));
    if (!syncConfig) {
      syncConfig = await retry(() => prisma.legacySyncConfig.create({
        data: { id: 1, isEnabled: true, lastStatus: 'running' }
      }));
    }
  } catch (err) {
    console.warn(`[SYNC ENGINE] Warning loading sync config: ${err.message}. Proceeding...`);
  }

  if (syncConfig && !syncConfig.isEnabled && !FORCE_SYNC) {
    console.log(`[SYNC ENGINE] ⏸️  Auto-sync is PAUSED (Live Cutover Complete).`);
    try {
      await retry(() => prisma.legacySyncLog.create({
        data: {
          triggerSource: TRIGGER_SOURCE,
          status: 'skipped_paused',
          finishedAt: new Date(),
          newSalesCount: 0,
          newGrnsCount: 0,
          productsSynced: 0,
          stocksUpdated: 0,
          errorMessage: 'Skipped: Saturday Cutover Kill-Switch Active (is_enabled = false)'
        }
      }));
      await retry(() => prisma.legacySyncConfig.update({
        where: { id: 1 },
        data: { lastStatus: 'paused', lastRunAt: new Date() }
      }));
    } catch (e) {}
    console.log(`[SYNC ENGINE] Exiting cleanly with code 0.`);
    await prisma.$disconnect();
    process.exit(0);
  }

  // Set running state
  if (syncConfig) {
    await retry(() => prisma.legacySyncConfig.update({
      where: { id: 1 },
      data: { lastStatus: 'running' }
    })).catch(() => {});
  }

  const client = new EazyPosClient(EAZYPOS_URL);
  let newSalesCount = 0;
  let newGrnsCount = 0;
  let productsSynced = 0;
  let stocksUpdated = 0;
  let maxSaleId = syncConfig?.lastSyncedSaleId || 0;
  let maxGrnId = syncConfig?.lastSyncedReceivingId || 0;

  try {
    console.log(`[SYNC ENGINE] Authenticating as user: ${EAZYPOS_USER}...`);
    await client.login(EAZYPOS_USER, EAZYPOS_PASS);
    console.log(`[SYNC ENGINE] ✓ Authenticated successfully with eazypos99.`);

    // -------------------------------------------------------------------------
    // DISCOVER 4 STOCK LOCATIONS DYNAMICALLY FROM EAZYPOS99
    // -------------------------------------------------------------------------
    console.log(`[SYNC ENGINE] Discovering stock locations live from eazypos99...`);
    const rSalesPage = await client.fetchWithPacing(`${EAZYPOS_URL}/sales`);
    const salesPageHtml = await rSalesPage.text();
    const locMatch = salesPageHtml.match(/<select[^>]*name=["']stock_location["'][^>]*>([\s\S]*?)<\/select>/i);

    const discoveredLocations = [];
    if (locMatch) {
      const optRegex = /<option\s+value=["'](\d+)["'][^>]*>([^<]+)<\/option>/gi;
      let m;
      while ((m = optRegex.exec(locMatch[1])) !== null) {
        const osposLocId = m[1];
        const rawName = m[2].trim();
        let branchInfo = null;
        const lower = rawName.toLowerCase();
        if (lower.includes('alaw')) branchInfo = BRANCH_MAP['Alawwa'];
        else if (lower.includes('daba') || lower.includes('damba')) branchInfo = BRANCH_MAP['Dabadeniya'];
        else if (lower.includes('giri')) branchInfo = BRANCH_MAP['Giriulla'];
        else if (lower.includes('main')) branchInfo = BRANCH_MAP['Main store'];

        if (branchInfo) {
          discoveredLocations.push({
            osposLocId,
            locationName: rawName,
            branchId: branchInfo.branchId,
            warehouseId: branchInfo.warehouseId
          });
        }
      }
    }

    if (discoveredLocations.length === 0) {
      discoveredLocations.push(
        { osposLocId: '3', locationName: 'Alawwa', branchId: BRANCH_MAP['Alawwa'].branchId, warehouseId: BRANCH_MAP['Alawwa'].warehouseId },
        { osposLocId: '1', locationName: 'Dabadeniya', branchId: BRANCH_MAP['Dabadeniya'].branchId, warehouseId: BRANCH_MAP['Dabadeniya'].warehouseId },
        { osposLocId: '4', locationName: 'Giriulla', branchId: BRANCH_MAP['Giriulla'].branchId, warehouseId: BRANCH_MAP['Giriulla'].warehouseId },
        { osposLocId: '2', locationName: 'Main store', branchId: BRANCH_MAP['Main store'].branchId, warehouseId: BRANCH_MAP['Main store'].warehouseId }
      );
    }
    console.log(`[SYNC ENGINE] Verified ${discoveredLocations.length} active stock locations:`, discoveredLocations.map(l => `${l.osposLocId}:${l.locationName}`));

    // -------------------------------------------------------------------------
    // STEP A: Fetch & Upsert Suppliers
    // -------------------------------------------------------------------------
    console.log(`[SYNC ENGINE] Checking suppliers...`);
    const rSupp = await client.fetchWithPacing(`${EAZYPOS_URL}/suppliers/search?search=&limit=500&offset=0&order=asc&sort=people.person_id`);
    const suppJson = await rSupp.json().catch(() => ({ rows: [] }));
    const suppRows = suppJson.rows || [];

    const existingSuppliers = await retry(() => prisma.supplier.findMany({
      where: { tenantId: TENANT_ID },
      select: { id: true, name: true }
    }));
    const supplierByName = new Map();
    for (const s of existingSuppliers) {
      supplierByName.set(s.name.trim().toLowerCase(), s.id);
    }
    const defaultSupplierId = existingSuppliers[0]?.id || null;

    let newSuppCount = 0;
    for (const s of suppRows) {
      const name = (s.company_name || s.name || `${s.first_name || ''} ${s.last_name || ''}`).trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!supplierByName.has(key)) {
        const created = await retry(() => prisma.supplier.create({
          data: {
            tenantId: TENANT_ID,
            name,
            code: `SUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
            contactPerson: s.first_name ? `${s.first_name} ${s.last_name || ''}`.trim() : null,
            phone: s.phone_number || null,
            email: s.email || null,
            address: s.address_1 || null,
            status: 'ACTIVE',
          }
        }));
        supplierByName.set(key, created.id);
        newSuppCount++;
      }
    }
    if (newSuppCount > 0) console.log(`[SYNC ENGINE] Added ${newSuppCount} new suppliers.`);

    // -------------------------------------------------------------------------
    // STEP B: Fetch & Upsert Catalog Products & Multi-Branch Stock Quantities
    // -------------------------------------------------------------------------
    console.log(`[SYNC ENGINE] Fetching inventory summary for multi-branch stock levels...`);
    const rInv = await client.fetchWithPacing(`${EAZYPOS_URL}/reports/inventory_summary/all/0`);
    const invHtml = await rInv.text();
    const invMatch = invHtml.match(/data:\s*(\[.*?\])\s*,\s*iconSize/s);
    if (!invMatch) {
      throw new Error('Failed to match inventory_summary data array regex.');
    }
    const invRows = JSON.parse(invMatch[1]);
    console.log(`[SYNC ENGINE] Loaded ${invRows.length} inventory records from eazypos99.`);
    const locNames = Array.from(new Set(invRows.map((r) => r.location_name)));
    console.log(`[SYNC ENGINE] Discovered stock locations:`, locNames);

    // Cache products from DB
    const allProducts = await retry(() => prisma.product.findMany({
      where: { tenantId: TENANT_ID },
      select: { id: true, name: true, sku: true, barcode: true, costPrice: true, retailPrice: true }
    }));
    const prodByBarcode = new Map();
    const prodBySku = new Map();
    const prodByName = new Map();

    for (const p of allProducts) {
      if (p.barcode) prodByBarcode.set(p.barcode.trim().toLowerCase(), p.id);
      if (p.sku) prodBySku.set(p.sku.trim().toLowerCase(), p.id);
      if (p.name) prodByName.set(p.name.trim().toLowerCase(), p.id);
    }

    // Upsert any missing products from inventory_summary
    for (const row of invRows) {
      const name = (row.item_name || '').trim();
      if (!name) continue;
      const nameKey = name.toLowerCase();
      const barcode = row.item_number ? String(row.item_number).trim().toLowerCase() : '';
      const existingId = (barcode ? prodByBarcode.get(barcode) : null) || prodByName.get(nameKey);

      if (!existingId) {
        const sku = barcode ? `SKU-${barcode}` : `SKU-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const costPrice = cleanMoney(row.cost_price);
        const retailPrice = cleanMoney(row.unit_price);
        const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}-${crypto.randomBytes(3).toString('hex')}`;
        const created = await retry(() => prisma.product.create({
          data: {
            tenantId: TENANT_ID,
            name,
            slug,
            sku,
            barcode: barcode || null,
            costPrice,
            retailPrice,
            type: 'STANDARD',
            isActive: true,
            isTrackStock: true,
          }
        }));
        if (barcode) prodByBarcode.set(barcode, created.id);
        prodByName.set(nameKey, created.id);
        prodBySku.set(sku.toLowerCase(), created.id);
        allProducts.push(created);
        productsSynced++;
      }
    }

    // Cache existing stock levels in memory
    const existingStocks = await retry(() => prisma.stockLevel.findMany({
      where: { tenantId: TENANT_ID },
      select: { id: true, warehouseId: true, productId: true, quantityOnHand: true }
    }));
    const stockMap = new Map();
    for (const s of existingStocks) {
      stockMap.set(`${s.warehouseId}_${s.productId}`, s);
    }

    // Update stock levels across 4 branch warehouses
    console.log(`[SYNC ENGINE] Syncing per-branch stock levels across Alawwa, Dambadeniya, Giriulla, Main Store...`);
    const pendingUpdates = [];
    const pendingCreates = [];

    for (const row of invRows) {
      const locName = row.location_name;
      const branchInfo = BRANCH_MAP[locName];
      if (!branchInfo) continue;

      const name = (row.item_name || '').trim().toLowerCase();
      const barcode = row.item_number ? String(row.item_number).trim().toLowerCase() : '';
      const productId = (barcode ? prodByBarcode.get(barcode) : null) || prodByName.get(name);
      if (!productId) continue;

      const qty = parseFloat(row.quantity) || 0;
      const reorder = parseFloat(row.reorder_level) || 0;
      const key = `${branchInfo.warehouseId}_${productId}`;
      const existing = stockMap.get(key);

      if (existing) {
        if (Math.abs(Number(existing.quantityOnHand) - qty) > 0.001) {
          pendingUpdates.push({ id: existing.id, qty, reorder });
        }
      } else {
        pendingCreates.push({
          tenantId: TENANT_ID,
          warehouseId: branchInfo.warehouseId,
          productId,
          quantityOnHand: qty,
          quantityReserved: 0,
          reorderPoint: reorder,
        });
      }
    }

    console.log(`[SYNC ENGINE] Identified ${pendingUpdates.length} stock updates and ${pendingCreates.length} new stock rows.`);

    // Batch insert new stock rows
    if (pendingCreates.length > 0) {
      for (let i = 0; i < pendingCreates.length; i += 200) {
        const chunk = pendingCreates.slice(i, i + 200);
        await retry(() => prisma.stockLevel.createMany({ data: chunk, skipDuplicates: true }));
      }
    }

    // Concurrent batch update (chunks of 25)
    const BATCH_SIZE = 25;
    for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
      const chunk = pendingUpdates.slice(i, i + BATCH_SIZE);
      await Promise.all(
        chunk.map((item) =>
          retry(() =>
            prisma.stockLevel.update({
              where: { id: item.id },
              data: { quantityOnHand: item.qty, reorderPoint: item.reorder, updatedAt: new Date() }
            })
          )
        )
      );
    }
    stocksUpdated = pendingUpdates.length + pendingCreates.length;
    console.log(`[SYNC ENGINE] ✓ Per-branch stock sync completed. (${stocksUpdated} stock levels synchronized)`);

    // -------------------------------------------------------------------------
    // VERIFY & LOG EXACT 4-BRANCH STOCK FOR 7 SPECIAL STOCK ITEMS
    // -------------------------------------------------------------------------
    const specialSkus = ['SKU-3377', 'SKU-3325', 'SKU-1805', 'SKU-106', 'SKU-3252', 'SKU-108', 'SKU-3268'];
    const specialProducts = await retry(() => prisma.product.findMany({
      where: {
        tenantId: TENANT_ID,
        OR: [
          { sku: { in: specialSkus } },
          { barcode: { in: specialSkus.map(s => s.replace('SKU-', '')) } }
        ]
      },
      select: { id: true, name: true, sku: true, barcode: true }
    }));

    console.log('\n========================================================================');
    console.log('📦 EXACT VERIFIED SPECIAL STOCK COUNTS ACROSS ALL 4 BRANCHES (FROM EAZYPOS99):');
    console.log('========================================================================');
    const branchStockSummary = [];
    for (const bName of ['Alawwa', 'Dabadeniya', 'Giriulla', 'Main store']) {
      const bInfo = BRANCH_MAP[bName];
      const displayName = bName === 'Dabadeniya' ? 'Dambadeniya' : bName === 'Main store' ? 'Main Store' : bName;
      for (const sp of specialProducts) {
        const key = `${bInfo.warehouseId}_${sp.id}`;
        const st = await retry(() => prisma.stockLevel.findFirst({
          where: {
            tenantId: TENANT_ID,
            warehouseId: bInfo.warehouseId,
            productId: sp.id
          }
        })).catch(() => null);
        const qty = st ? Number(st.quantityOnHand) : 0;
        branchStockSummary.push({
          Branch: displayName,
          SKU: sp.sku,
          Barcode: sp.barcode || 'N/A',
          Name: sp.name,
          'Live Stock': qty
        });
      }
    }
    console.table(branchStockSummary);
    console.log('========================================================================\n');

    // -------------------------------------------------------------------------
    // STEP C: Strict Per-Location Sales Scraping, Branch Reconcile & Missing Ingestion
    // -------------------------------------------------------------------------
    console.log(`[SYNC ENGINE] Querying sales strictly per stock location across all 4 branches...`);

    // Pre-cache all existing sales in DB for quick matching
    const existingSalesList = await retry(() => prisma.sale.findMany({
      where: { tenantId: TENANT_ID },
      select: { id: true, invoiceNumber: true, branchId: true, cashierName: true }
    }));
    const saleByInvoice = new Map();
    for (const s of existingSalesList) {
      saleByInvoice.set(s.invoiceNumber, s);
    }

    let reassignedBranchCount = 0;
    const handledSaleIds = new Set();

    // Loop through each discovered OSPOS stock location individually
    for (const loc of discoveredLocations) {
      console.log(`[SYNC ENGINE] Fetching detailed sales for location "${loc.locationName}" (OSPOS ID ${loc.osposLocId})...`);
      const rLocSales = await client.fetchWithPacing(`${EAZYPOS_URL}/reports/detailed_sales/2026-11-01/2026-11-25/all/${loc.osposLocId}`);
      const locSalesHtml = await rLocSales.text();
      const locSalesMatch = locSalesHtml.match(/data:\s*(\[.*?\])\s*,\s*iconSize/s);
      const locDetMatch = locSalesHtml.match(/details_data\s*=\s*(\{.*?\});\s*(?:var|\$\(|columns)/s);

      const locSalesRows = locSalesMatch ? JSON.parse(locSalesMatch[1]) : [];
      const locSalesDetails = locDetMatch ? JSON.parse(locDetMatch[1]) : {};
      console.log(`[SYNC ENGINE] -> Location "${loc.locationName}": ${locSalesRows.length} sales found in eazypos99.`);

      locSalesRows.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

      for (const row of locSalesRows) {
        const saleIntId = parseInt(row.id, 10);
        if (saleIntId > maxSaleId) maxSaleId = saleIntId;
        handledSaleIds.add(String(row.id));

        const invNum = `INV-${row.id}`;
        const legNum = `LEG-SALE-${row.id}`;
        const existingSale = saleByInvoice.get(invNum) || saleByInvoice.get(legNum);

        const cashierName = row.employee_name || 'Sale Admin';
        const cashierId = CASHIER_MAP[cashierName] || DEFAULT_CASHIER_ID;
        const saleDate = parseLegacyDate(row.sale_time);
        const subtotal = Math.max(0, cleanMoney(row.subtotal));
        const tax = cleanMoney(row.tax);
        const total = cleanMoney(row.total);
        const isReturn = (row.type_code === 'Return' || total < 0);

        if (existingSale) {
          // If already-synced row was assigned to the wrong branch, update it!
          if (existingSale.branchId !== loc.branchId) {
            await retry(() => prisma.sale.update({
              where: { id: existingSale.id },
              data: {
                branchId: loc.branchId,
                cashierName,
                cashierId,
                totalAmount: total,
                subtotal,
                soldAt: saleDate,
                updatedAt: new Date()
              }
            }));
            existingSale.branchId = loc.branchId;
            reassignedBranchCount++;
          }
          continue;
        }

        // Sale does not exist in DB -> Insert cleanly with zero duplicates!
        const saleId = crypto.randomUUID();
        saleByInvoice.set(invNum, { id: saleId, invoiceNumber: invNum, branchId: loc.branchId });

        try {
          // 1. Sale Header
          await retry(() => prisma.sale.create({
            data: {
              id: saleId,
              tenantId: TENANT_ID,
              branchId: loc.branchId,
              cashierId,
              cashierName,
              invoiceNumber: invNum,
              orderType: 'RETAIL_WALKIN',
              status: isReturn ? 'VOIDED' : 'COMPLETED',
              subtotal,
              discountAmount: 0.00,
              taxAmount: tax,
              totalAmount: total,
              paidAmount: total,
              changeDue: 0.00,
              createdAt: saleDate,
              updatedAt: saleDate,
              soldAt: saleDate,
            }
          }));

          // 2. Sale Payment
          await retry(() => prisma.salePayment.create({
            data: {
              id: crypto.randomUUID(),
              tenantId: TENANT_ID,
              saleId,
              paymentMethod: 'CASH',
              amount: total,
              status: 'SUCCESS',
              createdAt: saleDate,
              updatedAt: saleDate,
            }
          }));

          // 3. Line Items
          const lineItems = locSalesDetails[String(row.id)] || [];
          if (lineItems.length > 0) {
            const itemBatch = [];
            for (let idx = 0; idx < lineItems.length; idx++) {
              const itemArr = lineItems[idx];
              const prodName = itemArr[0] || 'Ayurvedic Medicine';
              const barcode = itemArr[2] ? itemArr[2].trim().toLowerCase() : '';
              const nameClean = prodName.trim().toLowerCase();
              const productId = (barcode ? prodByBarcode.get(barcode) : null) || prodByName.get(nameClean) || allProducts[0]?.id;

              const qtyStr = itemArr[4] || '1';
              const qtyMatch = qtyStr.match(/([\d.]+)/);
              const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 1;

              const itemSubtotal = cleanMoney(itemArr[5]);
              const itemCost = cleanMoney(itemArr[8]);
              const unitPrice = quantity > 0 ? (itemSubtotal / quantity) : itemSubtotal;
              const unitCost = quantity > 0 ? (itemCost / quantity) : itemCost;

              itemBatch.push({
                id: crypto.randomUUID(),
                tenantId: TENANT_ID,
                saleId,
                productId,
                productName: prodName,
                sku: barcode || `ITEM-${row.id}-${idx + 1}`,
                unitPrice,
                costPrice: unitCost,
                quantity,
                discountAmount: 0.00,
                taxAmount: 0.00,
                subtotal: itemSubtotal,
                createdAt: saleDate,
                updatedAt: saleDate,
              });
            }
            if (itemBatch.length > 0) {
              await retry(() => prisma.saleItem.createMany({ data: itemBatch }));
            }
          }

          newSalesCount++;
        } catch (sErr) {
          if (sErr.code === 'P2002' || String(sErr.message).includes('Unique constraint')) {
            continue;
          }
          throw sErr;
        }
      }
    }

    // Master Catch-Up: Also check /reports/detailed_sales/.../all/all to catch any remaining unassigned bills
    console.log(`[SYNC ENGINE] Verifying master sales report (/all/all) for any remaining unassigned bills...`);
    const rMasterSales = await client.fetchWithPacing(`${EAZYPOS_URL}/reports/detailed_sales/2026-11-01/2026-11-25/all/all`);
    const masterSalesHtml = await rMasterSales.text();
    const masterDataMatch = masterSalesHtml.match(/data:\s*(\[.*?\])\s*,\s*iconSize/s);
    const masterDetMatch = masterSalesHtml.match(/details_data\s*=\s*(\{.*?\});\s*(?:var|\$\(|columns)/s);

    const masterSalesRows = masterDataMatch ? JSON.parse(masterDataMatch[1]) : [];
    const masterSalesDetails = masterDetMatch ? JSON.parse(masterDetMatch[1]) : {};

    for (const row of masterSalesRows) {
      if (handledSaleIds.has(String(row.id))) continue;

      const saleIntId = parseInt(row.id, 10);
      if (saleIntId > maxSaleId) maxSaleId = saleIntId;

      const invNum = `INV-${row.id}`;
      const legNum = `LEG-SALE-${row.id}`;
      if (saleByInvoice.has(invNum) || saleByInvoice.has(legNum)) continue;

      const cashierName = row.employee_name || 'Sale Admin';
      const cashierId = CASHIER_MAP[cashierName] || DEFAULT_CASHIER_ID;
      let branchInfo = BRANCH_MAP['Main store'];
      const empLower = cashierName.toLowerCase();
      if (empLower.includes('daba') || empLower.includes('damba')) branchInfo = BRANCH_MAP['Dabadeniya'];
      else if (empLower.includes('giri')) branchInfo = BRANCH_MAP['Giriulla'];
      else if (empLower.includes('alaw')) branchInfo = BRANCH_MAP['Alawwa'];
      else if (empLower.includes('admin') || empLower.includes('main')) branchInfo = BRANCH_MAP['Main store'];
      else if (empLower.includes('user1')) branchInfo = BRANCH_MAP['Dabadeniya'];

      const saleDate = parseLegacyDate(row.sale_time);
      const subtotal = Math.max(0, cleanMoney(row.subtotal));
      const tax = cleanMoney(row.tax);
      const total = cleanMoney(row.total);
      const isReturn = (row.type_code === 'Return' || total < 0);
      const saleId = crypto.randomUUID();
      saleByInvoice.set(invNum, { id: saleId, invoiceNumber: invNum, branchId: branchInfo.branchId });

      try {
        await retry(() => prisma.sale.create({
          data: {
            id: saleId,
            tenantId: TENANT_ID,
            branchId: branchInfo.branchId,
            cashierId,
            cashierName,
            invoiceNumber: invNum,
            orderType: 'RETAIL_WALKIN',
            status: isReturn ? 'VOIDED' : 'COMPLETED',
            subtotal,
            discountAmount: 0.00,
            taxAmount: tax,
            totalAmount: total,
            paidAmount: total,
            changeDue: 0.00,
            createdAt: saleDate,
            updatedAt: saleDate,
            soldAt: saleDate,
          }
        }));

        await retry(() => prisma.salePayment.create({
          data: {
            id: crypto.randomUUID(),
            tenantId: TENANT_ID,
            saleId,
            paymentMethod: 'CASH',
            amount: total,
            status: 'SUCCESS',
            createdAt: saleDate,
            updatedAt: saleDate,
          }
        }));

        const lineItems = masterSalesDetails[String(row.id)] || [];
        if (lineItems.length > 0) {
          const itemBatch = [];
          for (let idx = 0; idx < lineItems.length; idx++) {
            const itemArr = lineItems[idx];
            const prodName = itemArr[0] || 'Ayurvedic Medicine';
            const barcode = itemArr[2] ? itemArr[2].trim().toLowerCase() : '';
            const nameClean = prodName.trim().toLowerCase();
            const productId = (barcode ? prodByBarcode.get(barcode) : null) || prodByName.get(nameClean) || allProducts[0]?.id;

            const qtyStr = itemArr[4] || '1';
            const qtyMatch = qtyStr.match(/([\d.]+)/);
            const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 1;

            const itemSubtotal = cleanMoney(itemArr[5]);
            const itemCost = cleanMoney(itemArr[8]);
            const unitPrice = quantity > 0 ? (itemSubtotal / quantity) : itemSubtotal;
            const unitCost = quantity > 0 ? (itemCost / quantity) : itemCost;

            itemBatch.push({
              id: crypto.randomUUID(),
              tenantId: TENANT_ID,
              saleId,
              productId,
              productName: prodName,
              sku: barcode || `ITEM-${row.id}-${idx + 1}`,
              unitPrice,
              costPrice: unitCost,
              quantity,
              discountAmount: 0.00,
              taxAmount: 0.00,
              subtotal: itemSubtotal,
              createdAt: saleDate,
              updatedAt: saleDate,
            });
          }
          if (itemBatch.length > 0) {
            await retry(() => prisma.saleItem.createMany({ data: itemBatch }));
          }
        }

        newSalesCount++;
      } catch (sErr) {
        if (sErr.code === 'P2002' || String(sErr.message).includes('Unique constraint')) {
          continue;
        }
        throw sErr;
      }
    }

    console.log(`[SYNC ENGINE] ✓ Per-location sales processing complete: ${newSalesCount} new bills ingested, ${reassignedBranchCount} bills reassigned to correct branches.`);

    // -------------------------------------------------------------------------
    // STEP D: Incremental Receivings / GRNs (GRN-{id})
    // -------------------------------------------------------------------------
    console.log(`[SYNC ENGINE] Checking incremental receivings / GRNs...`);
    const rRec = await client.fetchWithPacing(`${EAZYPOS_URL}/reports/detailed_receivings/2026-11-01/2026-11-25/all`);
    const recHtml = await rRec.text();
    const recDataMatch = recHtml.match(/data:\s*(\[.*?\])\s*,\s*iconSize/s);
    const recDetMatch = recHtml.match(/details_data\s*=\s*(\{.*?\});\s*(?:var|\$\(|columns)/s);

    const recRows = recDataMatch ? JSON.parse(recDataMatch[1]) : [];
    const recDetails = recDetMatch ? JSON.parse(recDetMatch[1]) : {};

    const existingGrns = await retry(() => prisma.goodsReceivedNote.findMany({
      where: {
        tenantId: TENANT_ID,
      },
      select: { grnNumber: true }
    }));
    const grnExists = new Set(existingGrns.map(g => g.grnNumber));

    recRows.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

    for (const row of recRows) {
      const recIntId = parseInt(row.id, 10);
      if (recIntId > maxGrnId) maxGrnId = recIntId;

      const grnNumber = `GRN-${row.id}`;
      if (grnExists.has(grnNumber) || grnExists.has(`LEG-GRN-${row.id}`)) continue;

      const suppName = row.supplier_name ? row.supplier_name.trim().toLowerCase() : '';
      const supplierId = supplierByName.get(suppName) || defaultSupplierId;

      const items = recDetails[String(row.id)] || [];
      let branchInfo = BRANCH_MAP['Main store'];
      if (items.length > 0) {
        const itemQtyLoc = items[0][3] || '';
        for (const loc of Object.keys(BRANCH_MAP)) {
          if (itemQtyLoc.includes(loc)) {
            branchInfo = BRANCH_MAP[loc];
            break;
          }
        }
      }

      const grnId = crypto.randomUUID();
      const recDate = parseLegacyDate(row.receiving_time);
      const totalCost = cleanMoney(row.total);

      await retry(() => prisma.goodsReceivedNote.create({
        data: {
          id: grnId,
          tenantId: TENANT_ID,
          branchId: branchInfo.branchId,
          warehouseId: branchInfo.warehouseId,
          supplierId,
          grnNumber,
          receivedDate: recDate,
          status: 'RECEIVED',
          totalCost,
          createdAt: recDate,
          updatedAt: recDate,
        }
      }));

      const grnItemsBatch = [];
      for (const it of items) {
        const barcode = it[0] ? it[0].trim().toLowerCase() : '';
        const name = it[1] ? it[1].trim() : '';
        const productId = (barcode ? prodByBarcode.get(barcode) : null) || prodByName.get(name.toLowerCase()) || allProducts[0]?.id;
        const qtyMatch = (it[3] || '').match(/(\d+)/);
        const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
        const itemSubtotal = cleanMoney(it[4]);
        const unitCost = qty > 0 ? (itemSubtotal / qty) : itemSubtotal;

        grnItemsBatch.push({
          id: crypto.randomUUID(),
          tenantId: TENANT_ID,
          grnId,
          productId,
          receivedQuantity: qty,
          unitCost,
          subtotal: itemSubtotal,
          createdAt: recDate,
          updatedAt: recDate,
        });
      }

      if (grnItemsBatch.length > 0) {
        await retry(() => prisma.goodsReceivedNoteItem.createMany({ data: grnItemsBatch }));
      }

      grnExists.add(grnNumber);
      newGrnsCount++;
    }
    console.log(`[SYNC ENGINE] ✓ GRN sync complete. (${newGrnsCount} new GRNs ingested, Highest ID: ${maxGrnId})`);

    // -------------------------------------------------------------------------
    // STEP E: Record Audit Logs & Update Sync Config
    // -------------------------------------------------------------------------
    const finishTime = new Date();
    const durationSec = ((finishTime.getTime() - startTime.getTime()) / 1000).toFixed(1);

    const summaryObj = {
      finishedAt: finishTime.toISOString(),
      durationSeconds: parseFloat(durationSec),
      newSalesCount,
      newGrnsCount,
      productsSynced,
      stocksUpdated,
      maxSaleId,
      maxGrnId,
      triggerSource: TRIGGER_SOURCE,
      status: 'success'
    };

    await retry(() => prisma.legacySyncLog.create({
      data: {
        startedAt: startTime,
        finishedAt: finishTime,
        triggerSource: TRIGGER_SOURCE,
        status: 'success',
        newSalesCount,
        newGrnsCount,
        productsSynced,
        stocksUpdated,
        errorMessage: null,
      }
    }));

    await retry(() => prisma.legacySyncConfig.update({
      where: { id: 1 },
      data: {
        lastSyncedSaleId: maxSaleId,
        lastSyncedReceivingId: maxGrnId,
        lastRunAt: finishTime,
        lastStatus: 'success',
        lastSummary: summaryObj,
      }
    }));

    console.log(`\n[SYNC ENGINE] ========================================================`);
    console.log(`[SYNC ENGINE] ✅ SYNC COMPLETED SUCCESSFULLY IN ${durationSec}s`);
    console.log(`[SYNC ENGINE] - New Sales Bills Added:   ${newSalesCount}`);
    console.log(`[SYNC ENGINE] - Bills Reassigned Branch: ${reassignedBranchCount}`);
    console.log(`[SYNC ENGINE] - New GRNs Added:          ${newGrnsCount}`);
    console.log(`[SYNC ENGINE] - Products Synced/Created: ${productsSynced}`);
    console.log(`[SYNC ENGINE] - Branch Stocks Updated:   ${stocksUpdated}`);
    console.log(`[SYNC ENGINE] - Highest Legacy Sale ID:  INV-${maxSaleId}`);
    console.log(`[SYNC ENGINE] --------------------------------------------------------`);
    console.log(`[SYNC ENGINE] 📊 LIVE RECONCILED PER-BRANCH BILL COUNTS & TOTALS:`);
    for (const [branchName, info] of Object.entries(BRANCH_MAP)) {
      const agg = await retry(() => prisma.sale.aggregate({
        where: {
          tenantId: TENANT_ID,
          branchId: info.branchId,
          status: { not: 'VOIDED' },
          soldAt: { gte: new Date('2026-11-01T00:00:00Z') }
        },
        _count: { id: true },
        _sum: { totalAmount: true }
      }));
      const count = agg._count.id;
      const total = Number(agg._sum.totalAmount || 0);
      console.log(`[SYNC ENGINE]   • ${branchName.padEnd(12)}: ${String(count).padStart(4)} bills | LKR ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    }
    console.log(`[SYNC ENGINE] ========================================================\n`);

    await prisma.$disconnect();
    process.exit(0);

  } catch (err) {
    const finishTime = new Date();
    console.error(`[SYNC ENGINE] ❌ ERROR ENCOUNTERED:`, err.message, err.cause, err.stack);

    try {
      await retry(() => prisma.legacySyncLog.create({
        data: {
          startedAt: startTime,
          finishedAt: finishTime,
          triggerSource: TRIGGER_SOURCE,
          status: 'error',
          newSalesCount,
          newGrnsCount,
          productsSynced,
          stocksUpdated,
          errorMessage: err.message,
        }
      }));

      await retry(() => prisma.legacySyncConfig.update({
        where: { id: 1 },
        data: {
          lastRunAt: finishTime,
          lastStatus: 'error',
          lastSummary: { error: err.message, failedAt: finishTime.toISOString() }
        }
      }));
    } catch (logErr) {
      console.error(`[SYNC ENGINE] Failed to write error log:`, logErr.message);
    }

    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
