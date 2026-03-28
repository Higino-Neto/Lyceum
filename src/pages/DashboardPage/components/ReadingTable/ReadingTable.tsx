import ReadingTableBody from "./ReadingTableBody";
import ReadingTableHeader from "./ReadingTableHeader";

export default function ReadingTable() {
  return (
    <>
      <div className="overflow-hidden rounded-sm border border-zinc-800">
        <table className="w-full text-sm">
            <ReadingTableHeader />
            <ReadingTableBody onlyTable />
        </table>
      </div>
      <ReadingTableBody />
    </>
  );
}
