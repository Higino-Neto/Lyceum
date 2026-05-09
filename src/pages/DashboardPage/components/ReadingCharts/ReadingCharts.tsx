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
import CategoryChart from "./CategoryChart";
import AreaChartComponent from "./AreaChartComponent";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { softFadeUp, springFast } from "../../../../utils/motionPresets";

export default function ReadingCharts() {
  const [activeChart, setActiveChart] = useLocalStorage<ChartType>("chart_type", "daily");
  const { selectedUsers, currentUserId } = useSelectedUsers();
  const reduceMotion = useReducedMotion();

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
          <CategoryChart
            usersData={usersData}
            categories={categories || []}
          />
        );
      case "area":
        return <AreaChartComponent usersData={usersData} />;
      default:
        return null;
    }
  };

  return (
    <div className="">
      <div className="flex border-b-2 border-zinc-800">
        {CHART_OPTIONS.map((option) => (
          <motion.button
            key={option.key}
            onClick={() => setActiveChart(option.key)}
            className={`relative flex-1 cursor-pointer rounded-t-sm py-3.5 text-sm font-medium transition ${
              activeChart === option.key
                ? "text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            {activeChart === option.key && (
              <motion.span
                layoutId="dashboard-chart-active-tab"
                className="absolute inset-0 rounded-t-sm bg-zinc-800"
                transition={springFast}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </motion.button>
        ))}
      </div>
      <div className="min-h-56 p-2 pt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeChart}
            variants={reduceMotion ? undefined : softFadeUp}
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            exit={reduceMotion ? undefined : "exit"}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
          >
            {renderChart()}
          </motion.div>
        </AnimatePresence>
      </div>
      {usersData.length > 1 && (
        <div className="px-2 pb-2 flex gap-3 justify-center">
          {usersData.map((userData, index) => (
            <motion.div
              key={userData.user.userId}
              className="flex items-center gap-1.5 text-xs"
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.04 }}
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
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
