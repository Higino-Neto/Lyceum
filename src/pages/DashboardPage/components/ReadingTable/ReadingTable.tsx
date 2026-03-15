import { useState } from "react";
import ReadingTableBody from "./ReadingTableBody";
import ReadingTableHeader from "./ReadingTableHeader";
import Pagination from "../../../../components/Pagination";

const ITEMS_PER_PAGE = 10;

export default function ReadingTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
          <ReadingTableHeader />
          <ReadingTableBody 
            currentPage={currentPage} 
            limit={ITEMS_PER_PAGE}
            onTotalChange={setTotalItems}
          />        
      </table>
      <div className="py-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
