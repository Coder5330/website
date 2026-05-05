// shared supabase client — include this before any other script that needs it
const SUPABASE_URL = 'https://kfwdknxtwimlqypitwwf.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmd2Rrbnh0d2ltbHF5cGl0d3dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzMzNTIsImV4cCI6MjA5MzU0OTM1Mn0.sjliRGHAmcU2K-T7xovZjxVCEvRDFc6IAapKaaQqDXY';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
