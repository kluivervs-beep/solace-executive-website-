// Shared Supabase client for login.html and dashboard.html.
// The publishable key below is safe to expose in client-side code —
// access to data is controlled entirely by row-level security policies
// in the database, not by keeping this key secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.2?bundle';

const SUPABASE_URL = 'https://weiihajterqholxppgsl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_RpQkAm1CWbmYtswpnye6zA_DBpJ7vTr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
