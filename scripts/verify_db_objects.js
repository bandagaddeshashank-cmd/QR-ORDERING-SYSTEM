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
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Target Supabase URL:', supabaseUrl);

if (!supabaseUrl || !serviceKey) {
  console.error('Missing credentials in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const anonClient = createClient(supabaseUrl, anonKey || serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function verify() {
  console.log('\n--- VERIFYING TABLES (Read-only count) ---');
  const tables = [
    'restaurants',
    'tables',
    'menu_items',
    'table_sessions',
    'orders',
    'order_items',
    'waiter_calls',
    'bills'
  ];

  for (const table of tables) {
    try {
      const { count, error } = await adminClient
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ Table [${table}]: ERROR - ${error.message} (code: ${error.code})`);
      } else {
        console.log(`✓ Table [${table}]: EXISTS (count: ${count})`);
      }
    } catch (err) {
      console.log(`❌ Table [${table}]: EXCEPTION - ${err.message}`);
    }
  }

  console.log('\n--- VERIFYING RPC STORED PROCEDURES ---');

  // Test settle_session_bill existence:
  // We pass dummy values. If function exists, it will evaluate authorization or session check (returns e.g. 02000 or 42501).
  // If function does NOT exist, Postgres returns code 42883 (undefined_function: function ... does not exist).
  try {
    const { data, error } = await adminClient.rpc('settle_session_bill', {
      p_session_id: '00000000-0000-0000-0000-000000000000',
      p_restaurant_id: '00000000-0000-0000-0000-000000000000',
      p_discount: 0,
      p_payment_method: 'cash'
    });

    if (error) {
      if (error.code === '42883') {
        console.log(`❌ RPC [settle_session_bill]: DOES NOT EXIST (42883: function not found)`);
      } else {
        console.log(`✓ RPC [settle_session_bill]: EXISTS in DB (Response: ${error.message} [code: ${error.code}])`);
      }
    } else {
      console.log(`✓ RPC [settle_session_bill]: EXISTS in DB (Returned data)`);
    }
  } catch (err) {
    console.log(`RPC [settle_session_bill]: Error testing - ${err.message}`);
  }

  // Test atomic_order_change existence:
  try {
    const { data, error } = await adminClient.rpc('atomic_order_change', {
      p_order_id: '00000000-0000-0000-0000-000000000000',
      p_table_token: 'dummy',
      p_action: 'cancel'
    });

    if (error) {
      if (error.code === '42883') {
        console.log(`❌ RPC [atomic_order_change]: DOES NOT EXIST (42883: function not found)`);
      } else {
        console.log(`✓ RPC [atomic_order_change]: EXISTS in DB (Response: ${error.message} [code: ${error.code}])`);
      }
    } else {
      console.log(`✓ RPC [atomic_order_change]: EXISTS in DB (Returned data)`);
    }
  } catch (err) {
    console.log(`RPC [atomic_order_change]: Error testing - ${err.message}`);
  }

  // Test helper functions:
  const helpers = ['current_staff_restaurant_id', 'current_staff_role', 'is_manager_or_admin', 'is_platform_admin'];
  for (const h of helpers) {
    try {
      const { data, error } = await adminClient.rpc(h);
      if (error && error.code === '42883') {
        console.log(`❌ Helper RPC [${h}]: DOES NOT EXIST (42883)`);
      } else {
        console.log(`✓ Helper RPC [${h}]: EXISTS in DB`);
      }
    } catch (err) {
      console.log(`Helper RPC [${h}]: Error - ${err.message}`);
    }
  }

  console.log('\n--- VERIFYING SCHEMA ENHANCEMENTS (New columns) ---');
  try {
    const { data: restSample, error: restErr } = await adminClient
      .from('restaurants')
      .select('id, logo_url, address, phone, is_open')
      .limit(1);

    if (restErr) {
      console.log(`❌ Columns (logo_url, address, phone, is_open): NOT FOUND (${restErr.message})`);
    } else {
      console.log(`✓ Columns (logo_url, address, phone, is_open): EXIST in restaurants table`);
    }
  } catch (err) {
    console.log(`Schema enhancements check error: ${err.message}`);
  }

  console.log('\n--- VERIFYING RLS POLICY ENFORCEMENT ---');
  // With anonClient, querying tables directly without token should return 0 rows or error if RLS blocks anon:
  try {
    const { data: anonOrders, error: anonErr } = await anonClient
      .from('orders')
      .select('id')
      .limit(5);

    if (anonErr) {
      console.log(`✓ Anon access to [orders]: BLOCKED (${anonErr.message})`);
    } else if (anonOrders && anonOrders.length === 0) {
      console.log(`✓ Anon access to [orders]: RESTRICTED (0 rows visible under RLS)`);
    } else {
      console.log(`⚠️ Anon access to [orders]: ${anonOrders ? anonOrders.length : 0} rows returned (RLS may be open)`);
    }
  } catch (err) {
    console.log(`Anon test error: ${err.message}`);
  }
}

verify();
