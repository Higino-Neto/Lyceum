import { supabase } from "../lib/supabase";
import { createUserProfile } from "../api/database";

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: email.split("@")[0],
      },
    },
  });

  if (error) {
    console.error(error);
    return { error };
  }

  if (data.user) {
    try {
      await createUserProfile(data.user.id, email);
    } catch (profileError) {
      console.error("Error creating profile:", profileError);
    }
  }

  return { error: null };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
}
