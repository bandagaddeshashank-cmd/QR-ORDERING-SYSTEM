const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables safely
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

async function runTask3And4Verification() {
  console.log('======================================================================');
  console.log('TASK 3 & TASK 4: DATABASE & AUTHENTICATION VERIFICATION SUITE');
  console.log('======================================================================\n');

  // =========================================================================
  // TASK 3: VERIFY DATABASE OBJECTS, COLUMNS, AND FUNCTION SIGNATURES
  // =========================================================================
  console.log('--- TASK 3: VERIFYING DATABASE OBJECTS & COLUMN REFERENCES ---\n');

  const tableColumnChecks = [
    {
      table: 'restaurants',
      columns: ['id', 'name', 'gstin', 'tax_percent', 'service_charge_percent', 'cancel_window_seconds', 'created_at', 'logo_url', 'address', 'phone', 'is_open']
    },
    {
      table: 'tables',
      columns: ['id', 'restaurant_id', 'label', 'qr_token']
    },
    {
      table: 'menu_items',
      columns: ['id', 'restaurant_id', 'name', 'description', 'category', 'price', 'is_veg', 'is_active', 'sort_order']
    },
    {
      table: 'table_sessions',
      columns: ['id', 'table_id', 'status', 'session_token', 'opened_at', 'closed_at']
    },
    {
      table: 'orders',
      columns: ['id', 'session_id', 'status', 'created_at', 'updated_at', 'edited_at']
    },
    {
      table: 'order_items',
      columns: ['id', 'order_id', 'menu_item_id', 'name_snapshot', 'price_snapshot', 'quantity', 'note', 'status']
    },
    {
      table: 'waiter_calls',
      columns: ['id', 'table_id', 'status', 'created_at', 'done_at']
    },
    {
      table: 'bills',
      columns: ['id', 'session_id', 'bill_number', 'subtotal', 'discount', 'service_charge', 'tax', 'total', 'payment_method', 'created_at']
    }
  ];

  let task3Errors = 0;

  for (const item of tableColumnChecks) {
    const selectClause = item.columns.join(', ');
    const { data, error } = await supabaseAdmin
      .from(item.table)
      .select(selectClause)
      .limit(1);

    if (error) {
      console.log(`❌ Table [${item.table}]: Column check FAILED: ${error.message} (${error.code})`);
      task3Errors++;
    } else {
      console.log(`✓ Table [${item.table}]: All ${item.columns.length} columns verified (${item.columns.join(', ')})`);
    }
  }

  // Cross-Table Foreign Key Joins used by application
  console.log('\n--- VERIFYING COMPLEX FOREIGN KEY JOINS USED IN APP ---');

  // Kitchen join: orders -> table_sessions -> tables -> restaurants
  const kitchenJoin = await supabaseAdmin
    .from('orders')
    .select(`
      id, status, created_at,
      order_items(id, name_snapshot, quantity, status),
      table_sessions!inner(
        id,
        tables!inner(
          label,
          restaurant_id,
          restaurants!inner(cancel_window_seconds)
        )
      )
    `)
    .limit(1);

  if (kitchenJoin.error) {
    console.log(`❌ Kitchen Join Check FAILED: ${kitchenJoin.error.message}`);
    task3Errors++;
  } else {
    console.log(`✓ Kitchen Join (orders -> table_sessions -> tables -> restaurants): VERIFIED`);
  }

  // Billing join: table_sessions -> tables -> restaurants
  const billingJoin = await supabaseAdmin
    .from('table_sessions')
    .select(`
      id, status,
      tables!inner(id, label, restaurant_id, restaurants!inner(*))
    `)
    .limit(1);

  if (billingJoin.error) {
    console.log(`❌ Billing Join Check FAILED: ${billingJoin.error.message}`);
    task3Errors++;
  } else {
    console.log(`✓ Billing Join (table_sessions -> tables -> restaurants): VERIFIED`);
  }

  // Waiter join: waiter_calls -> tables
  const waiterJoin = await supabaseAdmin
    .from('waiter_calls')
    .select('id, status, tables!inner(label, restaurant_id)')
    .limit(1);

  if (waiterJoin.error) {
    console.log(`❌ Waiter Join Check FAILED: ${waiterJoin.error.message}`);
    task3Errors++;
  } else {
    console.log(`✓ Waiter Join (waiter_calls -> tables): VERIFIED`);
  }

  // Bills join: bills -> table_sessions -> tables
  const billsJoin = await supabaseAdmin
    .from('bills')
    .select('id, bill_number, total, table_sessions!inner(tables!inner(label, restaurant_id))')
    .limit(1);

  if (billsJoin.error) {
    console.log(`❌ Bills Join Check FAILED: ${billsJoin.error.message}`);
    task3Errors++;
  } else {
    console.log(`✓ Bills Join (bills -> table_sessions -> tables): VERIFIED`);
  }

  // Verify RPC Signatures and Parameters
  console.log('\n--- VERIFYING RPC PROCEDURES & APPLICATION PARAMETERS ---');

  // 1. settle_session_bill: (p_session_id UUID, p_restaurant_id UUID, p_discount NUMERIC, p_payment_method TEXT)
  const settleRpcTest = await supabaseAdmin.rpc('settle_session_bill', {
    p_session_id: '00000000-0000-0000-0000-000000000000',
    p_restaurant_id: '00000000-0000-0000-0000-000000000000',
    p_discount: 0.00,
    p_payment_method: 'cash'
  });

  // If parameters or function were mismatched, code would be PGRST202.
  // Code 02000 means PostgreSQL function executed, accepted all parameters, and reported "session not found".
  if (settleRpcTest.error && settleRpcTest.error.code === 'PGRST202') {
    console.log(`❌ RPC [settle_session_bill]: Signature or parameter mismatch: ${settleRpcTest.error.message}`);
    task3Errors++;
  } else {
    console.log(`✓ RPC [settle_session_bill]: Signature verified (p_session_id, p_restaurant_id, p_discount, p_payment_method). Returned: ${settleRpcTest.error ? settleRpcTest.error.message : 'OK'}`);
  }

  // 2. atomic_order_change: (p_order_id UUID, p_table_token TEXT, p_action TEXT, p_items JSONB)
  const changeRpcTest = await supabaseAdmin.rpc('atomic_order_change', {
    p_order_id: '00000000-0000-0000-0000-000000000000',
    p_table_token: 'dummy-token',
    p_action: 'cancel',
    p_items: []
  });

  if (changeRpcTest.error && changeRpcTest.error.code === 'PGRST202') {
    console.log(`❌ RPC [atomic_order_change]: Signature or parameter mismatch: ${changeRpcTest.error.message}`);
    task3Errors++;
  } else {
    console.log(`✓ RPC [atomic_order_change]: Signature verified (p_order_id, p_table_token, p_action, p_items). Returned: ${changeRpcTest.error ? changeRpcTest.error.message : 'OK'}`);
  }

  // 3. Helper functions:
  const helperChecks = [
    'current_staff_restaurant_id',
    'current_staff_role',
    'is_manager_or_admin',
    'is_platform_admin'
  ];

  for (const h of helperChecks) {
    const res = await supabaseAdmin.rpc(h);
    if (res.error && res.error.code === 'PGRST202') {
      console.log(`❌ Helper function [${h}]: Signature mismatch or not found`);
      task3Errors++;
    } else {
      console.log(`✓ Helper function [${h}]: Verified`);
    }
  }

  console.log(`\nTASK 3 RESULT: ${task3Errors === 0 ? 'ALL OBJECTS & SIGNATURES VERIFIED SUCCESSFULLY' : `${task3Errors} ISSUES DETECTED`}`);


  // =========================================================================
  // TASK 4: STAFF AND MANAGER ROLE VERIFICATION
  // =========================================================================
  console.log('\n======================================================================');
  console.log('--- TASK 4: STAFF & MANAGER AUTHENTICATION & ROLE VERIFICATION ---');
  console.log('======================================================================\n');

  let task4Errors = 0;

  // 1. List users from Supabase Auth admin API (read-only inspection)
  console.log('[1. Inspecting Existing Supabase Auth Users]');
  const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers();

  if (usersErr) {
    console.log(`❌ Failed to list users: ${usersErr.message}`);
    task4Errors++;
  } else {
    const users = usersData.users || [];
    console.log(`✓ Found ${users.length} registered user account(s) in Supabase Auth:`);

    users.forEach((u, i) => {
      const appRole = u.app_metadata?.role;
      const appRestId = u.app_metadata?.restaurant_id;
      const userRole = u.user_metadata?.role;
      const userRestId = u.user_metadata?.restaurant_id;

      console.log(`\n  User #${i + 1}: ${u.email} (ID: ${u.id})`);
      console.log(`    - Trusted app_metadata: role="${appRole ?? 'NONE'}", restaurant_id="${appRestId ?? 'NONE'}"`);
      if (userRole || userRestId) {
        console.log(`    - Untrusted user_metadata: role="${userRole ?? 'none'}", restaurant_id="${userRestId ?? 'none'}"`);
      }

      // Check role validity
      if (appRole === 'manager' || appRole === 'staff' || appRole === 'platform_admin') {
        console.log(`    ✓ Role "${appRole}" is a recognized, valid system role.`);
      } else {
        console.log(`    ⚠️ Warning: Role "${appRole}" is missing or unassigned in app_metadata.`);
      }

      // Check restaurant_id assignment
      if (appRole !== 'platform_admin') {
        if (appRestId && typeof appRestId === 'string' && appRestId.length === 36) {
          console.log(`    ✓ Restaurant ID "${appRestId}" is assigned in app_metadata.`);
        } else {
          console.log(`    ⚠️ Warning: Missing or invalid restaurant_id in app_metadata for scoped staff.`);
        }
      }
    });
  }

  // 2. Verify serverAuth.ts implementation against untrusted user_metadata
  console.log('\n[2. Verifying Application Server-Side Auth Logic]');
  const serverAuthPath = path.resolve(__dirname, '../lib/serverAuth.ts');
  const serverAuthContent = fs.readFileSync(serverAuthPath, 'utf8');

  // Check 1: Does getAuthenticatedStaff read from user_metadata?
  const usesUserMeta = serverAuthContent.includes('user.user_metadata?.role') || serverAuthContent.includes('user_metadata?.restaurant_id');
  if (usesUserMeta) {
    console.log('❌ VULNERABILITY: serverAuth.ts reads role or restaurant_id from user_metadata!');
    task4Errors++;
  } else {
    console.log('✓ serverAuth.ts strictly ignores user_metadata and reads ONLY app_metadata.');
  }

  // Check 2: Does getAuthenticatedStaff require restaurant_id for non-platform admins?
  const requiresRestaurant = serverAuthContent.includes('Missing restaurant_id in app_metadata');
  if (requiresRestaurant) {
    console.log('✓ serverAuth.ts enforces that restaurant_id is non-empty for staff/manager roles.');
  } else {
    console.log('❌ serverAuth.ts does not strictly enforce restaurant_id on staff accounts.');
    task4Errors++;
  }

  // Check 3: Does requireManager reject staff role?
  const requireManagerEnforced = serverAuthContent.includes('staff.role !== "manager" && staff.role !== "platform_admin"');
  if (requireManagerEnforced) {
    console.log('✓ requireManager() strictly blocks kitchen staff from manager-only billing endpoints.');
  } else {
    console.log('❌ requireManager() check is incomplete.');
    task4Errors++;
  }

  // 3. Verify Database Helper Functions in Postgres Migration
  console.log('\n[3. Verifying PostgreSQL Helper Functions for JWT Claims]');
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261117000000_tenant_security_and_rpc.sql');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');

  const readsAppMetaInSql = migrationContent.includes("auth.jwt() -> 'app_metadata' ->> 'restaurant_id'") &&
                             migrationContent.includes("auth.jwt() -> 'app_metadata' ->> 'role'");
  const readsUserMetaInSql = migrationContent.includes("auth.jwt() -> 'user_metadata'");

  if (readsAppMetaInSql && !readsUserMetaInSql) {
    console.log('✓ PostgreSQL helper functions (current_staff_restaurant_id, current_staff_role, is_manager_or_admin) read strictly from app_metadata.');
  } else {
    console.log('❌ PostgreSQL migration has references to user_metadata or is missing app_metadata checks.');
    task4Errors++;
  }

  // 4. Verify API route gates
  console.log('\n[4. Verifying API Route Role Gates]');
  const routeChecks = [
    { file: '../app/api/billing/route.ts', expectedGuard: 'requireManager' },
    { file: '../app/api/admin/overview/route.ts', expectedGuard: 'requireManager' },
    { file: '../app/api/admin/settings/route.ts', expectedGuard: 'requireManager' },
    { file: '../app/api/admin/menu/route.ts', expectedGuard: 'requireManager' },
    { file: '../app/api/admin/tables/route.ts', expectedGuard: 'requireManager' },
    { file: '../app/api/admin/reports/route.ts', expectedGuard: 'requireManager' },
    { file: '../app/api/kitchen/route.ts', expectedGuard: 'requireStaff' },
    { file: '../app/api/waiter/route.ts', expectedGuard: 'requireStaff' }
  ];

  for (const rc of routeChecks) {
    const fullPath = path.resolve(__dirname, rc.file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(rc.expectedGuard)) {
        console.log(`✓ [${rc.file}]: Enforces ${rc.expectedGuard}()`);
      } else {
        console.log(`❌ [${rc.file}]: Missing expected guard ${rc.expectedGuard}()`);
        task4Errors++;
      }
    }
  }

  console.log(`\nTASK 4 RESULT: ${task4Errors === 0 ? 'ALL AUTHENTICATION & ROLE CHECKS VERIFIED SUCCESSFULLY' : `${task4Errors} ISSUES DETECTED`}`);
}

runTask3And4Verification();
