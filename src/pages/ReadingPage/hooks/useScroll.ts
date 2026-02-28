import { PluginRegistry, ScrollPlugin } from "@embedpdf/react-pdf-viewer";
import { useEffect, useState } from "react";

export default function useScroll(registry: PluginRegistry) {
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  // useEffect(() => {
  //   if (!registry) return;
  //   const scrollPlugin = registry.getPlugin("scroll")?.provides();
  //   if (!scrollPlugin) return;
  //   const unsubscribe = scrollPlugin.onPageChange(({ pageNumber }) => {
  //     setCurrentPage(pageNumber - 1); // Converte para 0-based
  //   });
  //   return () => unsubscribe?.();
  // }, [registry]);

  useEffect(() => {
    if (!registry) return;
    const cleanups: (() => void)[] = [];

    const scrollCapability = registry
      .getPlugin<ScrollPlugin>("scroll")
      ?.provides();
    if (!scrollCapability) return;

    // setScroll(scrollCapability);

    cleanups.push(
      scrollCapability.onLayoutReady((event) => {
        setCurrentPage(event.pageNumber);
        setTotalPages(event.totalPages);
      }),
    );

    cleanups.push(
      scrollCapability.onPageChange((event) => {
        setCurrentPage(event.pageNumber);
        setTotalPages(event.totalPages);
      }),
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [registry]);

  return { currentPage, totalPages };
}
