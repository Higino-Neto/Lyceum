import { supabase } from "../lib/supabase";

export default async function getUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) return null;

  return user;
}
