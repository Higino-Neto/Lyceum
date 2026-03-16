import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { User, Lock, Save, ArrowLeft, Camera } from "lucide-react";
import Skeleton from "../components/Skeleton";

interface UserMetadata {
  full_name?: string;
  avatar_url?: string;
}

async function fetchCurrentUser(): Promise<{
  id: string;
  email: string;
  metadata: UserMetadata;
  name?: string;
  level?: number;
  avatar_url?: string;
}> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Usuário não autenticado");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) throw profileError;

  console.log(profileData);
  return {
    id: user.id,
    email: user.email || "",
    metadata: (user.user_metadata as UserMetadata) || {},
    name: profileData?.name || "",
    level: profileData?.level || 1,
    avatar_url: profileData?.avatar_url || "",
  };
}

async function updateUserMetadata(metadata: UserMetadata, userId: string) {
  const { data, error } = await supabase.auth.updateUser({
    data: metadata,
  });

  if (error) throw error;
  if (!data?.user) throw new Error("Erro ao atualizar usuário");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .update({
      name: metadata.full_name,
      avatar_url: metadata.avatar_url,
    })
    .eq("id", userId);

  if (profileError) throw profileError;

  return data.user;
}
async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || user.metadata.full_name || "");
      setAvatarUrl(user.avatar_url || user.metadata.avatar_url || "");
    }
  }, [user]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user?.id) {
      setError("Usuário não autenticado");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      // const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      await updateUserMetadata(
        { full_name: name, avatar_url: publicUrl },
        user.id,
      );
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
      setMessage("Foto atualizada com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const nameMutation = useMutation({
    mutationFn: () =>
      updateUserMetadata(
        { full_name: name, avatar_url: avatarUrl },
        user?.id || "",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
      setMessage("Nome atualizado com sucesso!");
      setError("");
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage("");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => updatePassword(newPassword),
    onSuccess: () => {
      setMessage("Senha atualizada com sucesso!");
      setError("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage("");
    },
  });

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    nameMutation.mutate();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    passwordMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <main className="flex-1 p-4 overflow-auto">
          <div className="mx-auto max-w-2xl space-y-6">
            <header className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-sm" />
              <Skeleton className="h-8 w-24" />
            </header>
            <section className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 shadow-xl">
              <Skeleton className="h-6 w-48 mb-6" />
              <Skeleton className="h-10 w-full mb-4" />
              <Skeleton className="h-10 w-32" />
            </section>
            <section className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 shadow-xl">
              <Skeleton className="h-6 w-40 mb-6" />
              <Skeleton className="h-10 w-full mb-4" />
              <Skeleton className="h-10 w-full mb-4" />
              <Skeleton className="h-10 w-40" />
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="flex-1 p-4 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-6">
          <header className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-zinc-800 rounded-sm transition"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-semibold">Perfil</h1>
          </header>

          {message && (
            <div className="bg-green-900/30 border border-green-600 text-green-400 px-4 py-3 rounded-sm">
              {message}
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-600 text-red-400 px-4 py-3 rounded-sm">
              {error}
            </div>
          )}

          <section className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <User className="text-green-500" size={24} />
              <h2 className="text-lg font-semibold">Informações do Perfil</h2>
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={40} className="text-zinc-500" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 bg-green-600 p-2 rounded-full hover:bg-green-500 transition disabled:opacity-50"
                >
                  <Camera size={14} className="text-black" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Email</p>
                <p className="text-zinc-200">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 outline-none focus:border-green-500"
                />
              </div>
              <button
                type="submit"
                disabled={nameMutation.isPending}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 transition px-4 py-2 rounded-sm font-medium text-black"
              >
                <Save size={18} />
                {nameMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
            </form>
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="text-green-500" size={24} />
              <h2 className="text-lg font-semibold">Alterar Senha</h2>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Confirmar nova senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 outline-none focus:border-green-500"
                />
              </div>
              <button
                type="submit"
                disabled={passwordMutation.isPending}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 transition px-4 py-2 rounded-sm font-medium text-black"
              >
                <Save size={18} />
                {passwordMutation.isPending
                  ? "Atualizando..."
                  : "Atualizar Senha"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
