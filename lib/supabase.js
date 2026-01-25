import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://blrysiekmfqjrlbijpsa.supabase.co";
const supabaseAnonKey = "sb_publishable_sdlMzNLjhUp8FUJVE6juMQ_fQfUpflE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
