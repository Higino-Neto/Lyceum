import { supabase } from "../lib/supabase";
import { translate } from "../i18n";

export default async function getUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error(translate("common:errors.userNotFound"));

  return user;
}
