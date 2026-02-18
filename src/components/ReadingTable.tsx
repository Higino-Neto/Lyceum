import ReadingTableBody from "./ReadingTableBody";
import ReadingTableHeader from "./ReadingTableHeader";

export default function ReadingTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
          <ReadingTableHeader />
          <ReadingTableBody />        
      </table>
    </div>
  );
}
