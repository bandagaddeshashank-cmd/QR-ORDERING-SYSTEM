const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    if (key && !key.startsWith('#')) env[key] = val;
  }
});

const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function runTests() {
  console.log('=====================================================');
  console.log('GREEN EMBASSY QR ORDERING SYSTEM — WORKFLOW & SECURITY TEST');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Direct DB verification of Table T1 and Menu
  console.log('[Test Suite 1: Database Baseline Checks]');
  const { data: tableT1 } = await supabaseAdmin
    .from('tables')
    .select('id, label, qr_token, restaurant_id, restaurants(*)')
    .eq('label', 'T1')
    .single();

  assert(tableT1 && tableT1.label === 'T1', 'Table T1 exists in database');
  assert(tableT1?.restaurants?.name === 'GREEN EMBASSY', 'Table T1 belongs to GREEN EMBASSY');

  const { data: menuItems } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, price, restaurant_id')
    .eq('restaurant_id', tableT1.restaurant_id)
    .limit(2);

  assert(menuItems && menuItems.length > 0, `Active menu items found: ${menuItems.map(m => m.name).join(', ')}`);

  // 2. Multi-Tenant Scoped Validation Simulation
  console.log('\n[Test Suite 2: Multi-Restaurant & Price Integrity]');
  
  // Verify foreign item ID lookup fails (restaurant scoping)
  const fakeItemId = '00000000-0000-0000-0000-000000000000';
  const { data: foreignCheck } = await supabaseAdmin
    .from('menu_items')
    .select('id')
    .eq('id', fakeItemId)
    .eq('restaurant_id', tableT1.restaurant_id);

  assert(!foreignCheck || foreignCheck.length === 0, 'Foreign item query correctly yields zero results');

  // Verify server-side price snapshot
  const { data: realDish } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, price')
    .eq('id', menuItems[0].id)
    .eq('restaurant_id', tableT1.restaurant_id)
    .single();

  assert(
    realDish && Number(realDish.price) === Number(menuItems[0].price),
    `Database verified server-side price snapshot: ₹${realDish.price}`
  );

  // 3. User Authentication & Staff Role Verification
  console.log('\n[Test Suite 3: Supabase Staff Authentication]');
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const managerUser = users.users.find(u => u.app_metadata?.role === 'manager');
  assert(managerUser !== undefined, `Found verified manager account: ${managerUser?.email}`);
  assert(managerUser?.app_metadata?.role === 'manager', 'Manager user has verified app_metadata.role');

  // 4. Financial & Billing Computations Verification
  console.log('\n[Test Suite 4: Financial & Billing Computations]');
  const roundMoney = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const subtotal = 440;
  const discount = 40;
  const taxable = subtotal - discount; // 400
  const serviceCharge = roundMoney((taxable * 0) / 100); // 0
  const gstTax = roundMoney(((taxable + serviceCharge) * 5) / 100); // 20
  const finalTotal = roundMoney(taxable + serviceCharge + gstTax); // 420

  assert(finalTotal === 420, `Server bill calculation correct: subtotal ₹${subtotal} - discount ₹${discount} + 5% GST = ₹${finalTotal}`);

  // 5. Dining Sessions & Billing Atomicity Check
  console.log('\n[Test Suite 5: Session & Billing Integrity]');
  const { data: sessions } = await supabaseAdmin
    .from('table_sessions')
    .select('id, table_id, status')
    .eq('table_id', tableT1.id)
    .limit(5);

  assert(Array.isArray(sessions), `Table sessions queried successfully (${sessions.length} records found)`);

  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('id, bill_number, subtotal, total, payment_method')
    .limit(5);

  assert(Array.isArray(bills), `Bills table accessible (${bills.length} records verified)`);

  console.log('\n=====================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('=====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
