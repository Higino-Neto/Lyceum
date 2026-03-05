import { supabase } from "../lib/supabase";

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: email.split('@')[0],
      },
    },
  });

  if (error) {
    console.error(error);
    return { error };
  }

  if (data.user) {
    const username = email.split('@')[0];
    await supabase.from("profiles").insert({
      id: data.user.id,
      name: username,
    });
  }

  return { error: null };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
}
