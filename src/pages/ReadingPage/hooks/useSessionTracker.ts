import { useEffect, useRef, useState } from "react";

interface SessionPageInfo {
  initialPage: number;
  finalPage: number;
}
export default function useSessionTracker(
  sessionStart: boolean,
  sessionFinished: boolean,
  currentPage: number,
  onSessionFinished: (info: SessionPageInfo) => void,
) {
  // const [initialPage, setInitialPage] = useState<number | null>(null);
  // const [finalPage, setFinalPage] = useState<number | null>(null);
  const initialPageRef = useRef<number | null>(null);

  useEffect(() => {
    if (sessionStart && initialPageRef.current === null) {
      initialPageRef.current = currentPage;
    }
  }, [sessionStart, currentPage]);

  useEffect(() => {
    if (!sessionFinished) return;
    if (initialPageRef.current === null) return;

    onSessionFinished({
      initialPage: initialPageRef.current,
      finalPage: currentPage,
    });
  }, [sessionFinished, currentPage, onSessionFinished]);
}
