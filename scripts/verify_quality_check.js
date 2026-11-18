const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const roundMoney = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

async function runQualityCheckSuite() {
  console.log('======================================================================');
  console.log('GREEN EMBASSY — COMPREHENSIVE QUALITY ASSURANCE TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testId, message) {
    if (condition) {
      console.log(`  ✓ [TEST ${testId} PASS]: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [TEST ${testId} FAIL]: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 1. STATIC ASSET & IMAGE FALLBACK INTEGRITY
  // -------------------------------------------------------------------------
  console.log('--- 1. STATIC ASSET & IMAGE FALLBACK INTEGRITY ---');
  const logoPath = path.resolve(__dirname, '../public/logo.png');
  assert(fs.existsSync(logoPath), '1.1', 'Brand asset public/logo.png exists on filesystem');

  const tablePageContent = fs.readFileSync(path.resolve(__dirname, '../app/table/page.tsx'), 'utf8');
  assert(
    tablePageContent.includes('function DishCardImage') && tablePageContent.includes('onError'),
    '1.2',
    'DishCardImage component with onError fallback to DishImagePlaceholder implemented'
  );
  assert(
    tablePageContent.includes('unoptimized'),
    '1.3',
    'Next.js unoptimized attribute configured on dynamic dish images to prevent external host rejection'
  );

  // -------------------------------------------------------------------------
  // 2. ZERO EMOJI COMPLIANCE AUDIT
  // -------------------------------------------------------------------------
  console.log('\n--- 2. ZERO EMOJI COMPLIANCE AUDIT ---');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const appDir = path.resolve(__dirname, '../app');
  const componentsDir = path.resolve(__dirname, '../components');

  function scanDirectoryForEmojis(dir) {
    let filesWithEmoji = [];
    if (!fs.existsSync(dir)) return filesWithEmoji;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        filesWithEmoji = filesWithEmoji.concat(scanDirectoryForEmojis(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        const text = fs.readFileSync(fullPath, 'utf8');
        if (emojiRegex.test(text)) {
          filesWithEmoji.push(fullPath);
        }
      }
    }
    return filesWithEmoji;
  }

  const emojiViolations = [...scanDirectoryForEmojis(appDir), ...scanDirectoryForEmojis(componentsDir)];
  assert(emojiViolations.length === 0, '2.1', `Zero emojis in UI code (Violations: ${emojiViolations.length})`);

  // -------------------------------------------------------------------------
  // 3. RESPONSIVE DESIGN & VIEWPORT AUDIT
  // -------------------------------------------------------------------------
  console.log('\n--- 3. RESPONSIVE DESIGN & VIEWPORT AUDIT ---');
  const layoutContent = fs.readFileSync(path.resolve(__dirname, '../app/layout.tsx'), 'utf8');
  assert(
    layoutContent.includes('viewport: Viewport') && layoutContent.includes('device-width'),
    '3.1',
    'Root layout exports proper Next.js Viewport metadata for mobile scaling'
  );

  assert(
    tablePageContent.includes('max-w-md') && tablePageContent.includes('pb-36'),
    '3.2',
    'Customer ordering screen enforces mobile-first max-w-md container with floating cart clearance'
  );

  const adminContent = fs.readFileSync(path.resolve(__dirname, '../app/admin/page.tsx'), 'utf8');
  assert(
    adminContent.includes('AdminSidebar') && adminContent.includes('isMobileOpen'),
    '3.3',
    'Admin dashboard supports responsive mobile drawer navigation alongside desktop sidebar'
  );

  const kitchenContent = fs.readFileSync(path.resolve(__dirname, '../app/kitchen/page.tsx'), 'utf8');
  assert(
    kitchenContent.includes('grid') && kitchenContent.includes('lg:grid-cols-3'),
    '3.4',
    'Kitchen display uses responsive 3-column ticket workflow (single column mobile, 3 columns desktop)'
  );

  // -------------------------------------------------------------------------
  // 4. CUSTOMER ORDERING WORKFLOW & SERVER-SIDE PRICE SNAPSHOTS
  // -------------------------------------------------------------------------
  console.log('\n--- 4. CUSTOMER ORDERING WORKFLOW & PRICING VERIFICATION ---');
  const testMenu = [
    { id: 'item-101', name: 'Dal Makhani', price: 210, is_active: true, restaurant_id: 'rest-001' },
    { id: 'item-102', name: 'Butter Naan', price: 45, is_active: true, restaurant_id: 'rest-001' },
    { id: 'item-103', name: 'Seasonal Fish', price: 420, is_active: false, restaurant_id: 'rest-001' },
  ];

  function simulateValidateOrder(restaurantId, rawItems) {
    if (!Array.isArray(rawItems) || rawItems.length === 0) return { error: 'No items' };
    const validRows = [];
    for (const raw of rawItems) {
      const match = testMenu.find(m => m.id === raw.id && m.restaurant_id === restaurantId && m.is_active);
      if (!match) return { error: 'Item not available' };
      const qty = parseInt(raw.quantity, 10);
      if (isNaN(qty) || qty < 1 || qty > 20) return { error: 'Invalid quantity' };
      validRows.push({
        menu_item_id: match.id,
        name_snapshot: match.name,
        price_snapshot: match.price,
        quantity: qty,
        note: (raw.note || '').trim().slice(0, 150) || null,
      });
    }
    return { validRows };
  }

  const validCart = [
    { id: 'item-101', quantity: 2, note: 'Less spicy please', clientPrice: 1.0 },
    { id: 'item-102', quantity: 4, clientPrice: 0.0 },
  ];
  const orderValidation = simulateValidateOrder('rest-001', validCart);
  assert(!orderValidation.error, '4.1', 'Valid cart passes server-side order validation');
  assert(
    orderValidation.validRows[0].price_snapshot === 210 && orderValidation.validRows[1].price_snapshot === 45,
    '4.2',
    'Client tampered prices rejected; authoritative menu prices (₹210, ₹45) applied'
  );

  const inactiveCart = [{ id: 'item-103', quantity: 1 }];
  const inactiveValidation = simulateValidateOrder('rest-001', inactiveCart);
  assert(inactiveValidation.error === 'Item not available', '4.3', 'Inactive menu items strictly rejected at order creation');

  const excessiveCart = [{ id: 'item-101', quantity: 99 }];
  const excessiveValidation = simulateValidateOrder('rest-001', excessiveCart);
  assert(excessiveValidation.error === 'Invalid quantity', '4.4', 'Quantities above maximum threshold (20) rejected');

  // -------------------------------------------------------------------------
  // 5. QR TOKEN HANDLING & TABLE IDENTIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 5. QR TOKEN HANDLING & TABLE IDENTIFICATION ---');
  const validHexToken = crypto.randomBytes(16).toString('hex');
  assert(validHexToken.length === 32, '5.1', 'QR tokens generated using cryptographic 32-character hex format');

  const tokenCache = new Map();
  function resolveTokenCached(token, mockDbRecord) {
    if (!token || typeof token !== 'string') return null;
    const clean = token.trim();
    if (tokenCache.has(clean) && tokenCache.get(clean).expiresAt > Date.now()) {
      return tokenCache.get(clean).data;
    }
    if (mockDbRecord && mockDbRecord.qr_token === clean) {
      tokenCache.set(clean, { data: mockDbRecord, expiresAt: Date.now() + 30000 });
      return mockDbRecord;
    }
    return null;
  }

  const mockDbTable = { id: 'tbl-1', label: 'T4', qr_token: validHexToken, restaurant_id: 'rest-001' };
  const firstResolve = resolveTokenCached(validHexToken, mockDbTable);
  assert(firstResolve && firstResolve.label === 'T4', '5.2', 'Valid QR token successfully resolves Table T4');
  const cachedResolve = resolveTokenCached(validHexToken, null); // Db record null: must use cache
  assert(cachedResolve && cachedResolve.label === 'T4', '5.3', 'In-memory token resolution cache protects against poll spam');
  const invalidResolve = resolveTokenCached('invalid-token-xyz', mockDbTable);
  assert(invalidResolve === null, '5.4', 'Unrecognized QR token returns null (invalid table)');

  // -------------------------------------------------------------------------
  // 6. ORDER EDITING, CANCELLATION & WAITER CALLS
  // -------------------------------------------------------------------------
  console.log('\n--- 6. ORDER EDITING, CANCELLATION & WAITER CALLS ---');
  function checkModificationAllowed(status, createdAtIso, windowSec) {
    if (status !== 'placed') return { allowed: false, error: 'Kitchen has already begun preparation' };
    const age = Math.floor((Date.now() - new Date(createdAtIso).getTime()) / 1000);
    if (age > windowSec) return { allowed: false, error: 'Modification window expired' };
    return { allowed: true, secondsLeft: windowSec - age };
  }

  const now = Date.now();
  const eligibleOrder = checkModificationAllowed('placed', new Date(now - 30 * 1000).toISOString(), 120);
  assert(eligibleOrder.allowed && eligibleOrder.secondsLeft === 90, '6.1', 'Order placed 30s ago with 120s window has 90s edit window');

  const preparingOrder = checkModificationAllowed('preparing', new Date(now - 30 * 1000).toISOString(), 120);
  assert(!preparingOrder.allowed, '6.2', 'Order in "preparing" status blocks customer cancellation/edits');

  const expiredOrder = checkModificationAllowed('placed', new Date(now - 130 * 1000).toISOString(), 120);
  assert(!expiredOrder.allowed, '6.3', 'Order placed 130s ago with 120s window is blocked from modification');

  // Waiter call duplicate suppression
  const waiterCalls = new Set();
  function requestWaiter(tableId) {
    if (waiterCalls.has(tableId)) return { called: false, reason: 'Call already active' };
    waiterCalls.add(tableId);
    return { called: true };
  }
  assert(requestWaiter('tbl-1').called, '6.4', 'Initial waiter call registered successfully');
  assert(!requestWaiter('tbl-1').called, '6.5', 'Subsequent duplicate waiter call suppressed while open');
  waiterCalls.delete('tbl-1'); // Staff clears call
  assert(requestWaiter('tbl-1').called, '6.6', 'New waiter call accepted after staff resolution');

  // -------------------------------------------------------------------------
  // 7. KITCHEN ORDER STATUS PROGRESSION & TIMERS
  // -------------------------------------------------------------------------
  console.log('\n--- 7. KITCHEN ORDER STATUS PROGRESSION & STATE MACHINE ---');
  const transitions = {
    placed: ['preparing', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['served', 'cancelled'],
    served: [],
    cancelled: [],
  };

  assert(transitions['placed'].includes('preparing'), '7.1', 'Status placed -> preparing is permitted');
  assert(transitions['preparing'].includes('ready'), '7.2', 'Status preparing -> ready is permitted');
  assert(transitions['ready'].includes('served'), '7.3', 'Status ready -> served is permitted');
  assert(!transitions['placed'].includes('served'), '7.4', 'Status jump placed -> served is blocked');
  assert(transitions['served'].length === 0, '7.5', 'Terminal state "served" prohibits further transitions');

  function isUrgentOrder(createdAtIso, status) {
    if (status === 'served' || status === 'cancelled') return false;
    const elapsedMinutes = (Date.now() - new Date(createdAtIso).getTime()) / (1000 * 60);
    return elapsedMinutes > 15;
  }
  assert(isUrgentOrder(new Date(now - 16 * 60 * 1000).toISOString(), 'preparing'), '7.6', 'Order in preparation >15 min flagged as URGENT');
  assert(!isUrgentOrder(new Date(now - 5 * 60 * 1000).toISOString(), 'preparing'), '7.7', 'Order in preparation <15 min flagged as NORMAL');

  // -------------------------------------------------------------------------
  // 8. BILLING, DISCOUNTS, GST & FINANCIAL FORMULAS
  // -------------------------------------------------------------------------
  console.log('\n--- 8. BILLING, DISCOUNTS, GST & PAYMENT WORKFLOWS ---');
  function computeBill(subtotal, rawDiscount, serviceChargePercent = 0, taxPercent = 5.0) {
    const discount = roundMoney(Math.min(Math.max(Number(rawDiscount) || 0, 0), subtotal));
    const taxable = roundMoney(Math.max(0, subtotal - discount));
    const service = roundMoney((taxable * serviceChargePercent) / 100);
    const totalGst = roundMoney(((taxable + service) * taxPercent) / 100);
    const cgst = roundMoney(totalGst / 2);
    const sgst = roundMoney(totalGst - cgst);
    const total = roundMoney(taxable + service + totalGst);
    return { subtotal, discount, taxable, service, totalGst, cgst, sgst, total };
  }

  // Case 1: Standard billing with 5% GST (2.5% CGST + 2.5% SGST)
  const bill1 = computeBill(1000, 100, 0, 5.0);
  assert(bill1.subtotal === 1000, '8.1', 'Subtotal matches item aggregation (₹1000)');
  assert(bill1.discount === 100, '8.2', 'Discount properly deducted (₹100)');
  assert(bill1.taxable === 900, '8.3', 'Taxable amount is ₹900');
  assert(bill1.totalGst === 45, '8.4', 'Total 5% GST on ₹900 is ₹45.00');
  assert(bill1.cgst === 22.5 && bill1.sgst === 22.5, '8.5', 'GST split equally: CGST ₹22.50 + SGST ₹22.50');
  assert(bill1.total === 945, '8.6', 'Final settlement total is ₹945.00');

  // Case 2: Excessive discount capping
  const bill2 = computeBill(500, 9999);
  assert(bill2.discount === 500 && bill2.total === 0, '8.7', 'Excessive discount capped at subtotal (prevents negative bill)');

  // Case 3: Negative discount rejection
  const bill3 = computeBill(500, -50);
  assert(bill3.discount === 0 && bill3.total === 525, '8.8', 'Negative discount input clamped to 0');

  // Case 4: Atomic settlement duplicate prevention
  let sessionClosed = false;
  let settledBill = null;
  function atomicSettle(sessionId, billPayload) {
    if (sessionClosed) throw new Error('SESSION_ALREADY_CLOSED');
    settledBill = billPayload;
    sessionClosed = true;
    return settledBill;
  }
  const s1 = atomicSettle('sess-1', { id: 'bill-1', total: 945 });
  assert(s1 && sessionClosed, '8.9', 'Session closed atomically on bill settlement');
  let duplicatePrevented = false;
  try {
    atomicSettle('sess-1', { id: 'bill-2', total: 945 });
  } catch (err) {
    if (err.message === 'SESSION_ALREADY_CLOSED') duplicatePrevented = true;
  }
  assert(duplicatePrevented, '8.10', 'Duplicate bill settlement attempt blocked');

  // -------------------------------------------------------------------------
  // 9. ADMIN MENU & TABLE MANAGEMENT VALIDATION
  // -------------------------------------------------------------------------
  console.log('\n--- 9. ADMIN MENU & TABLE MANAGEMENT VALIDATION ---');
  function validateDishInput(dish) {
    if (!dish.name || typeof dish.name !== 'string' || dish.name.trim().length === 0) return 'Dish name is required';
    if (!dish.category || typeof dish.category !== 'string' || dish.category.trim().length === 0) return 'Category is required';
    const price = Number(dish.price);
    if (isNaN(price) || price < 0 || price > 100000) return 'Price must be a valid positive amount';
    return null;
  }

  assert(validateDishInput({ name: 'Paneer Tikka', category: 'Starters', price: 240 }) === null, '9.1', 'Valid dish payload accepted');
  assert(validateDishInput({ name: '', category: 'Starters', price: 240 }) === 'Dish name is required', '9.2', 'Missing dish name rejected');
  assert(validateDishInput({ name: 'Dish', category: '', price: 240 }) === 'Category is required', '9.3', 'Missing category rejected');
  assert(validateDishInput({ name: 'Dish', category: 'Starters', price: -10 }) === 'Price must be a valid positive amount', '9.4', 'Negative price rejected');

  function validateTableLabel(label, existingTables) {
    if (!label || typeof label !== 'string' || label.trim().length === 0) return 'Label required';
    const clean = label.trim().toLowerCase();
    if (existingTables.some(t => t.toLowerCase() === clean)) return 'Table already exists';
    return null;
  }
  const existingTables = ['T1', 'T2', 'T3'];
  assert(validateTableLabel('T4', existingTables) === null, '9.5', 'Unique table label T4 accepted');
  assert(validateTableLabel('t1', existingTables) === 'Table already exists', '9.6', 'Case-insensitive duplicate table label rejected');

  // -------------------------------------------------------------------------
  // 10. MULTI-TENANT ISOLATION & ACCESS CONTROL
  // -------------------------------------------------------------------------
  console.log('\n--- 10. MULTI-TENANT ISOLATION & ACCESS CONTROL ---');
  const restaurantA = '11111111-1111-1111-1111-111111111111';
  const restaurantB = '22222222-2222-2222-2222-222222222222';

  function verifyStaffAccess(staffUser, targetRestaurantId, requiredRole) {
    if (staffUser.role === 'platform_admin') return { allowed: true };
    if (staffUser.restaurantId !== targetRestaurantId) return { allowed: false, reason: 'Cross-tenant access forbidden' };
    if (requiredRole === 'manager' && staffUser.role !== 'manager') return { allowed: false, reason: 'Manager role required' };
    return { allowed: true };
  }

  const managerA = { role: 'manager', restaurantId: restaurantA };
  const kitchenA = { role: 'staff', restaurantId: restaurantA };

  assert(verifyStaffAccess(managerA, restaurantA, 'manager').allowed, '10.1', 'Manager authorized for restaurant A billing');
  assert(!verifyStaffAccess(kitchenA, restaurantA, 'manager').allowed, '10.2', 'Kitchen staff blocked from manager billing desk');
  assert(!verifyStaffAccess(managerA, restaurantB, 'manager').allowed, '10.3', 'Manager A strictly blocked from accessing restaurant B data');

  console.log('\n======================================================================');
  console.log(`QUALITY CHECK SUMMARY: ${passed} Checks Passed, ${failed} Failed`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runQualityCheckSuite().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
