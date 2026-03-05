import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nrafomjuvyscsybtjsxf.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yYWZvbWp1dnlzY3N5YnRqc3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjI4MjAsImV4cCI6MjA4ODI5ODgyMH0.k8se-CXgVsgg_IvhPCLHbc72qGzXuqJvhKlw0htMHpU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
