import { createClient } from "@supabase/supabase-js";

export const handler = async () => {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  await supabase.from("profiles").select("id").limit(1);

  return { statusCode: 200, body: "ok" };
};

export const config = {
  schedule: "0 9 * * 1",
};
