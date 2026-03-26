import { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCategories } from "../../../../api/database";
import getReadings from "../../../../utils/getReadings";
import getUserReadings from "../../../../utils/getUserReadings";
import { useSelectedUsers } from "../../../../contexts/SelectedUsersContext";
import { useLocalStorage } from "../../../../hooks/useLocalStorage";
import { CategoryData, CHART_COLORS, CHART_OPTIONS, ChartType, ReadingData, UserReadingData } from "../../../../types/ChartTypes";
import DailyPagesChart from "./DailyPagesChart";
import WeekdayChart from "./WeekdayChart";
import WeeklyPagesChart from "./WeeklyPagesChart";
import CategoryDonutChart from "./CategoryDonutChart";

export default function ReadingCharts() {
  const [activeChart, setActiveChart] = useLocalStorage<ChartType>("chart_type", "daily");
  const { selectedUsers, currentUserId } = useSelectedUsers();

  const { data: currentUserData, isLoading: isLoadingCurrentUser } = useQuery<
    ReadingData[]
  >({
    queryKey: ["readings"],
    queryFn: getReadings,
    staleTime: 0,
  });

  const { data: categories } = useQuery<CategoryData[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      return await getCategories();
    },
  });

  const selectedUserIds = selectedUsers.map((u) => u.user_id).join(",");
  const selectedUsersInfo = selectedUsers.map((u) => ({
    userId: u.user_id,
    username: u.username,
  }));

  const {
    data: selectedUsersReadings,
    isLoading: isLoadingSelectedUsers,
    refetch: refetchSelected,
    error: selectedUsersError,
  } = useQuery<UserReadingData[]>({
    queryKey: ["selectedUsersReadings", selectedUserIds],
    queryFn: async () => {
      if (selectedUsersInfo.length === 0) return [];
      const results = await Promise.all(
        selectedUsersInfo.map(async (user) => {
          const readings = await getUserReadings(user.userId);
          return {
            user: {
              userId: user.userId,
              username: user.username,
              isCurrentUser: false,
            },
            readings,
          };
        }),
      );
      return results;
    },
    enabled: selectedUsers.length > 0,
    staleTime: 0,
  });

  useEffect(() => {
    if (selectedUsers.length > 0) {
      refetchSelected();
    }
  }, [selectedUsers, refetchSelected]);

  useEffect(() => {
    if (selectedUsersError) {
      console.error(
        "Error fetching selected users readings:",
        selectedUsersError,
      );
    }
  }, [selectedUsersError]);

  const usersData = useMemo(() => {
    const users: UserReadingData[] = [];

    if (currentUserId) {
      users.push({
        user: {
          userId: currentUserId,
          username: "Você",
          isCurrentUser: true,
        },
        readings: currentUserData || [],
      });
    }

    if (selectedUsersReadings) {
      users.push(...selectedUsersReadings);
    }

    return users;
  }, [currentUserId, currentUserData, selectedUsersReadings]);

  const isLoading = isLoadingCurrentUser || isLoadingSelectedUsers;

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-48 flex items-center justify-center">
          <div className="w-5 h-5 border border-zinc-700 border-t-green-600 rounded-full animate-spin" />
        </div>
      );
    }

    switch (activeChart) {
      case "daily":
        return <DailyPagesChart usersData={usersData} />;
      case "weekday":
        return <WeekdayChart usersData={usersData} />;
      case "weekly":
        return <WeeklyPagesChart usersData={usersData} />;
      case "category":
        return (
          <CategoryDonutChart
            usersData={usersData}
            categories={categories || []}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="">
      <div className="flex border-b-2 border-zinc-800">
        {CHART_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => setActiveChart(option.key)}
            className={`flex-1 py-3.5 cursor-pointer rounded-t-sm text-sm font-medium transition ${
              activeChart === option.key
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="p-2 pt-4 min-h-56" key={activeChart}>
        {renderChart()}
      </div>
      {usersData.length > 1 && (
        <div className="px-2 pb-2 flex gap-3 justify-center">
          {usersData.map((userData, index) => (
            <div
              key={userData.user.userId}
              className="flex items-center gap-1.5 text-xs"
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span
                className={
                  userData.user.isCurrentUser
                    ? "text-zinc-200 font-medium"
                    : "text-zinc-500"
                }
              >
                {userData.user.username}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
