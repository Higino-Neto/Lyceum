import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import getUser from "../utils/getUser";

interface SelectedUser {
  user_id: string;
  username: string;
  avatar_url: string;
}

interface SelectedUsersContextType {
  selectedUsers: SelectedUser[];
  currentUserId: string | null;
  toggleUser: (user: SelectedUser) => void;
  isUserSelected: (userId: string) => boolean;
}

const SelectedUsersContext = createContext<SelectedUsersContextType | undefined>(undefined);

export function SelectedUsersProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);

  useEffect(() => {
    getUser()
      .then((user) => {
        setCurrentUserId(user.id);
      })
      .catch(console.error);
  }, []);

  const isUserSelected = (userId: string) => {
    return selectedUsers.some((u) => u.user_id === userId);
  };

  const toggleUser = (user: SelectedUser) => {
    if (user.user_id === currentUserId) return;

    setSelectedUsers((prev) => {
      const isSelected = prev.some((u) => u.user_id === user.user_id);
      
      if (isSelected) {
        return prev.filter((u) => u.user_id !== user.user_id);
      }
      
      if (prev.length >= 2) {
        return [prev[1], user];
      }
      
      return [...prev, user];
    });
  };

  return (
    <SelectedUsersContext.Provider
      value={{ selectedUsers, currentUserId, toggleUser, isUserSelected }}
    >
      {children}
    </SelectedUsersContext.Provider>
  );
}

export function useSelectedUsers() {
  const context = useContext(SelectedUsersContext);
  if (!context) {
    throw new Error("useSelectedUsers must be used within a SelectedUsersProvider");
  }
  return context;
}
