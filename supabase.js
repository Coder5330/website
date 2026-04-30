// shared supabase client — include this before any other script that needs it
const SUPABASE_URL = 'https://ssdspxaqxszhtnatzwso.supabase.co/rest/v1/';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzZHNweGFxeHN6aHRuYXR6d3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzYzNDIsImV4cCI6MjA5MzExMjM0Mn0.dQLzrWaD94jE9RsMhZM0Ofv_ZpEqbSOiUSKKeumTSxA';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
