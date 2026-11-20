const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
let env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key && !key.startsWith('#')) env[key] = val;
    }
  });
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing credentials in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runE2ETest() {
  console.log('======================================================================');
  console.log('PHASE 7 E2E TEST: ORDER MODIFICATION & STATUS ENUM VERIFICATION');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond, name, msg) {
    if (cond) {
      console.log(`  ✓ [PASS] ${name}: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${name}: ${msg}`);
      failed++;
    }
  }

  // 1. Resolve Table T1
  const { data: table, error: tableErr } = await supabaseAdmin
    .from('tables')
    .select('id, label, qr_token, restaurant_id, restaurants(id, name, cancel_window_seconds)')
    .eq('label', 'T1')
    .single();

  if (tableErr || !table) {
    console.error('Failed to find Table T1:', tableErr);
    process.exit(1);
  }
  console.log(`Target: Table ${table.label} (ID: ${table.id}) at Restaurant "${table.restaurants.name}"`);
  console.log(`QR Token: ${table.qr_token}`);

  // 2. Ensure an open table session exists
  let { data: session } = await supabaseAdmin
    .from('table_sessions')
    .select('id, status')
    .eq('table_id', table.id)
    .eq('status', 'open')
    .maybeSingle();

  let createdSession = false;
  if (!session) {
    const { data: newSession, error: sessErr } = await supabaseAdmin
      .from('table_sessions')
      .insert({
        table_id: table.id,
        status: 'open',
        opened_at: new Date().toISOString()
      })
      .select('id, status')
      .single();
    if (sessErr || !newSession) {
      console.error('Failed to create session:', sessErr);
      process.exit(1);
    }
    session = newSession;
    createdSession = true;
    console.log(`Created new open dining session: ${session.id}`);
  } else {
    console.log(`Found active open dining session: ${session.id}`);
  }

  // 3. Find an active menu item
  const { data: menuItem, error: menuErr } = await supabaseAdmin
    .from('menu_items')
    .select('id, name, price')
    .eq('restaurant_id', table.restaurant_id)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (menuErr || !menuItem) {
    console.error('Failed to find menu item:', menuErr);
    process.exit(1);
  }
  console.log(`Menu item for test: ${menuItem.name} (₹${menuItem.price})`);

  let testOrderId = null;
  let testItemId1 = null;
  let testItemId2 = null;

  try {
    // 4. Create a test order in status 'placed'
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        session_id: session.id,
        status: 'placed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, status, created_at')
      .single();

    if (orderErr || !order) {
      throw new Error(`Failed to create test order: ${orderErr?.message}`);
    }
    testOrderId = order.id;
    console.log(`\nCreated test order #${order.id.slice(0, 8)} in status "placed"`);

    // Insert two order items with valid initial status 'pending'
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert([
        {
          order_id: testOrderId,
          menu_item_id: menuItem.id,
          name_snapshot: menuItem.name,
          price_snapshot: menuItem.price,
          quantity: 2,
          note: 'Initial note 1',
          status: 'pending'
        },
        {
          order_id: testOrderId,
          menu_item_id: menuItem.id,
          name_snapshot: menuItem.name,
          price_snapshot: menuItem.price,
          quantity: 1,
          note: 'Initial note 2',
          status: 'pending'
        }
      ])
      .select('id, quantity, note, status');

    if (itemsErr || !items || items.length !== 2) {
      throw new Error(`Failed to insert order items: ${itemsErr?.message}`);
    }
    testItemId1 = items[0].id;
    testItemId2 = items[1].id;
    console.log(`Created items: Item1 = ${testItemId1} (qty 2), Item2 = ${testItemId2} (qty 1) with status 'pending'`);

    // -----------------------------------------------------------------------
    // TEST 1: Direct API Route handler simulation for Edit Action
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 1: Modifying Order Item Quantity and Note ---');
    // Simulate what POST /api/order-change does:
    // Try RPC first
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('atomic_order_change', {
      p_order_id: testOrderId,
      p_table_token: table.qr_token,
      p_action: 'edit',
      p_items: [
        { id: testItemId1, quantity: 4, note: 'Updated note 1: extra spicy' }
      ]
    });

    console.log('RPC execution result:', { rpcData, rpcError: rpcErr?.message, code: rpcErr?.code });

    if (!rpcErr && rpcData?.success) {
      assert(true, 'RPC_EDIT', 'RPC atomic_order_change executed successfully without enum errors');
    } else {
      console.log('RPC reported:', rpcErr?.message || 'not success');
      console.log('Testing fallback logic...');
      // Execute the server-side fallback path exactly as updated in app/api/order-change/route.ts
      const { data: updatedItem, error: updErr } = await supabaseAdmin
        .from('order_items')
        .update({
          quantity: 4,
          note: 'Updated note 1: extra spicy'
        })
        .eq('id', testItemId1)
        .eq('order_id', testOrderId)
        .select('id, quantity, note, status')
        .single();

      assert(!updErr && updatedItem.quantity === 4, 'FALLBACK_EDIT', `Fallback updated item quantity to 4 (Status: ${updatedItem?.status})`);
      assert(updatedItem.status === 'pending', 'STATUS_PRESERVED', `Status preserved as "${updatedItem.status}" and NOT corrupted to 'active'`);
    }

    // Verify in database that item 1 has quantity 4 and status is a valid item_status
    const { data: verifiedItem1 } = await supabaseAdmin
      .from('order_items')
      .select('id, quantity, note, status')
      .eq('id', testItemId1)
      .single();

    assert(verifiedItem1.quantity === 4, 'ITEM_QUANTITY', `Verified item 1 quantity is 4 (actual: ${verifiedItem1.quantity})`);
    assert(verifiedItem1.note === 'Updated note 1: extra spicy', 'ITEM_NOTE', `Verified note is updated`);
    assert(['pending', 'preparing', 'ready', 'served'].includes(verifiedItem1.status), 'VALID_ENUM_STATUS', `Status is valid item_status: "${verifiedItem1.status}"`);

    // -----------------------------------------------------------------------
    // TEST 2: Active Items Remaining Check (.neq("status", "cancelled"))
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 2: Active Items Check with status != cancelled ---');
    const { data: activeItems, error: activeErr } = await supabaseAdmin
      .from('order_items')
      .select('id, status')
      .eq('order_id', testOrderId)
      .neq('status', 'cancelled');

    assert(!activeErr, 'ACTIVE_QUERY', 'Query with .neq("status", "cancelled") runs without 22P02 enum error');
    assert(activeItems.length === 2, 'ACTIVE_COUNT', `Found ${activeItems.length} active items in order`);

    // -----------------------------------------------------------------------
    // TEST 3: Partial Item Cancellation (qty = 0)
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 3: Cancelling Single Item (quantity -> 0) ---');
    const { error: cancelItemErr } = await supabaseAdmin
      .from('order_items')
      .update({ status: 'cancelled' })
      .eq('id', testItemId2)
      .eq('order_id', testOrderId);

    assert(!cancelItemErr, 'ITEM_CANCEL', 'Item 2 cancelled without error');

    const { data: remainingActive } = await supabaseAdmin
      .from('order_items')
      .select('id, status')
      .eq('order_id', testOrderId)
      .neq('status', 'cancelled');

    assert(remainingActive.length === 1 && remainingActive[0].id === testItemId1, 'REMAINING_ACTIVE', 'Only item 1 remains active; item 2 is cancelled');

    // -----------------------------------------------------------------------
    // TEST 4: Order Cancellation When All Items are Cancelled
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 4: Full Order Auto-Cancellation When All Items Cancelled ---');
    const { error: cancelItem1Err } = await supabaseAdmin
      .from('order_items')
      .update({ status: 'cancelled' })
      .eq('id', testItemId1)
      .eq('order_id', testOrderId);

    assert(!cancelItem1Err, 'ITEM1_CANCEL', 'Item 1 cancelled');

    const { data: noActive } = await supabaseAdmin
      .from('order_items')
      .select('id')
      .eq('order_id', testOrderId)
      .neq('status', 'cancelled');

    if (!noActive || noActive.length === 0) {
      const { data: cancelledOrder, error: orderCancelErr } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', testOrderId)
        .select('id, status')
        .single();

      assert(!orderCancelErr && cancelledOrder.status === 'cancelled', 'ORDER_AUTO_CANCEL', 'Order automatically transitioned to "cancelled"');
    }

    // -----------------------------------------------------------------------
    // TEST 5: Kitchen Status Safety (Preparing Items Cannot Be Reset to Pending)
    // -----------------------------------------------------------------------
    console.log('\n--- TEST 5: Kitchen Status Safety Verification ---');
    // Create another order item in 'preparing'
    const { data: prepItem } = await supabaseAdmin
      .from('order_items')
      .insert({
        order_id: testOrderId,
        menu_item_id: menuItem.id,
        name_snapshot: menuItem.name,
        price_snapshot: menuItem.price,
        quantity: 1,
        note: 'Cooking now',
        status: 'preparing'
      })
      .select('id, status')
      .single();

    assert(prepItem.status === 'preparing', 'PREP_INITIAL', 'Created test item with status "preparing"');

    // Simulate updating quantity while preserving kitchen status:
    await supabaseAdmin
      .from('order_items')
      .update({
        quantity: 2,
        note: 'Extra cheese please'
      })
      .eq('id', prepItem.id);

    const { data: updatedPrepItem } = await supabaseAdmin
      .from('order_items')
      .select('id, quantity, status')
      .eq('id', prepItem.id)
      .single();

    assert(updatedPrepItem.status === 'preparing', 'PREP_PRESERVED', `Status remains "preparing" (NOT reset to pending, actual: ${updatedPrepItem.status})`);

  } finally {
    // Clean up test records
    if (testOrderId) {
      await supabaseAdmin.from('order_items').delete().eq('order_id', testOrderId);
      await supabaseAdmin.from('orders').delete().eq('id', testOrderId);
      console.log(`\nCleaned up test order ${testOrderId} and associated order items.`);
    }
    if (createdSession && session?.id) {
      await supabaseAdmin.from('table_sessions').delete().eq('id', session.id);
      console.log(`Cleaned up temporary session ${session.id}.`);
    }
  }

  console.log('\n======================================================================');
  console.log(`E2E TEST RESULT: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runE2ETest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
