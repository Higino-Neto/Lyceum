import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { getUserProfile, updateUserProfile } from "../api/database";
import { User, Lock, Save, ArrowLeft, Camera } from "lucide-react";
import Skeleton from "../components/Skeleton";
import toast from "react-hot-toast";

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

  const profile = await getUserProfile();

  console.log(profile);
  return {
    id: user.id,
    email: user.email || "",
    metadata: (user.user_metadata as UserMetadata) || {},
    name: profile?.name || "",
    level: 1,
    avatar_url: profile?.avatar_url || "",
  };
}

async function updateUserMetadata(metadata: UserMetadata, userId: string) {
  const { data, error } = await supabase.auth.updateUser({
    data: metadata,
  });

  if (error) throw error;
  if (!data?.user) throw new Error("Erro ao atualizar usuário");

  await updateUserProfile(metadata.full_name, metadata.avatar_url);

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
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
  });

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const nameMutation = useMutation({
    mutationFn: () =>
      updateUserMetadata(
        { full_name: name, avatar_url: avatarUrl },
        user?.id || ""
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
      toast.success("Nome atualizado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => updatePassword(newPassword),
    onSuccess: () => {
      toast.success("Senha atualizada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    nameMutation.mutate();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    passwordMutation.mutate();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-8 transition"
      >
        <ArrowLeft size={20} />
        Voltar
      </button>

      <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <User size={32} />
        Perfil
      </h1>

      <div className="max-w-2xl space-y-8">
        <div className="bg-zinc-900 rounded-sm p-6 border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">Informações pessoais</h2>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                  {avatarPreview || avatarUrl ? (
                    <img
                      src={avatarPreview || avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={40} className="text-zinc-500" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-zinc-700 p-2 rounded-full hover:bg-zinc-600 transition"
                  disabled={isUploading}
                >
                  <Camera size={16} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-zinc-400 mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-sm px-4 py-2 text-zinc-500"
              />
            </div>
            <button
              type="submit"
              disabled={nameMutation.isPending}
              className="flex items-center gap-2 bg-zinc-100 text-zinc-900 px-6 py-2 rounded-sm font-medium hover:bg-zinc-200 transition disabled:opacity-50"
            >
              <Save size={18} />
              {nameMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </form>
        </div>

        <div className="bg-zinc-900 rounded-sm p-6 border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Lock size={20} />
            Alterar senha
          </h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Nova senha
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Confirmar senha
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-sm px-4 py-2 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <button
              type="submit"
              disabled={passwordMutation.isPending}
              className="flex items-center gap-2 bg-zinc-100 text-zinc-900 px-6 py-2 rounded-sm font-medium hover:bg-zinc-200 transition disabled:opacity-50"
            >
              <Save size={18} />
              {passwordMutation.isPending ? "Alterando..." : "Alterar senha"}
            </button>
          </form>
        </div>

        <div className="bg-zinc-900 rounded-sm p-6 border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">Sair</h2>
          <button
            onClick={handleSignOut}
            className="bg-red-500/10 text-red-500 px-6 py-2 rounded-sm font-medium hover:bg-red-500/20 transition"
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
