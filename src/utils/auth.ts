import { supabase } from "../lib/supabase";
import { createUserProfile } from "../api/database";

export const MIN_PASSWORD_LENGTH = 10;

export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasUpper || !hasLower || !hasNumber) {
    return "A senha deve incluir letras maiúsculas, minúsculas e números";
  }

  return null;
}

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
