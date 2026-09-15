const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://hdbobqzqsmmsnzbjtzbn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYm9icXpxc21tc256Ymp0emJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTY3NDQsImV4cCI6MjA4NzY5Mjc0NH0.U_lS4-1zpd36SR4xxGDdXSBfM3408wv4pRbfDGUbQ4k";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data: profile, error: profError } = await supabase
    .from('profiles')
    .select('id, email, first_name')
    .eq('email', 'getwiserwithsajan@gmail.com')
    .maybeSingle();

  if (profError || !profile) {
    console.error("Profile error:", profError || "Not found");
    return;
  }

  console.log("Current User Profile ID:", profile.id, "Name:", profile.first_name);

  const { data: matches, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .or(`user_a_id.eq.${profile.id},user_b_id.eq.${profile.id}`);

  if (matchError) {
    console.error("Match error:", matchError);
    return;
  }

  console.log("Matches count:", matches.length);
  matches.forEach(m => {
    console.log(`Match ID: ${m.id}, User A: ${m.user_a_id}, User B: ${m.user_b_id}, Status: ${m.status}, A action: ${m.user_a_action}, B action: ${m.user_b_action}`);
  });
}

run();
