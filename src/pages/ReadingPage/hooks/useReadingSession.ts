import { useState } from "react";
import {
  EMPTY_SESSION,
  ReadingSession,
  SessionPdfData,
  SessionTimerData,
} from "../../../types/ReadingTypes";
import saveReadingEntries from "../../../utils/saveReadingEntries";

export default function useReadingSession() {
  const [session, setSession] = useState<ReadingSession>(EMPTY_SESSION);
  const [sessionStart, setSessionStart] = useState(false);
  const [sessionFinish, setSessionFinish] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleSessionStart = () => setSessionStart(true);

  const handleSessionData = (data: SessionTimerData) => {
    setSession((prev) => ({
      ...prev,
      ...data,
      spentTimeMinutes: prev.spentTimeMinutes + data.spentTimeMinutes,
    }));
  };

  const handleTimerDone = () => {
    setSessionStart(false);
    setSessionFinish(true);
    setTimerDone(true);
  };

  const handleReadingInfo = (data: SessionPdfData) => {
    setSession((prev) => ({
      ...prev,
      totalWords: prev.totalWords + data.totalWords,
      initialPage: prev.initialPage === 0 ? data.initialPage : prev.initialPage,
      finalPage: data.finalPage,
    }));

    if (timerDone) {
      setTimerDone(false);
      setShowModal(true);
    }

    setSessionFinish(false);
  };

  const handleSubmit = async () => {
    await saveReadingEntries([
      {
        id: crypto.randomUUID(),
        bookTitle: session.sourceName,
        numPages: String(session.finalPage - session.initialPage + 1),
        category: session.category,
        readingTime: String(session.spentTimeMinutes),
        date: new Date().toISOString().split("T")[0],
      },
    ]);

    setSession(EMPTY_SESSION);
    setShowModal(false);
  };

  const handleReset = () => {
    setSession(EMPTY_SESSION);
    setSessionStart(false);
    setSessionFinish(false);
    setTimerDone(false);
    setShowModal(false);
  };

  return {
    session,
    sessionStart,
    sessionFinish,
    showModal,
    setShowModal,
    handleSessionStart,
    handleSessionData,
    handleTimerDone,
    handleReadingInfo,
    handleSubmit,
    handleReset,
  };
}
