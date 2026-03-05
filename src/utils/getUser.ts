import { supabase } from "../lib/supabase";

export default async function getUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("User not found");

  return user;
}
