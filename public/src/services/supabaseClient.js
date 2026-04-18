import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://qdboyxfxvtobeoszlfce.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkYm95eGZ4dnRvYmVvc3psZmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTkxMTksImV4cCI6MjA5MTU5NTExOX0.cX9qNvluT9_uc4T6JCm61hqo4ZyUqwzqOUm5midVefA';

export const supabase = createClient(supabaseUrl, supabaseKey);
