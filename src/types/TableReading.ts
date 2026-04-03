export default interface TableReading {
  id: string;
  source_name: string;
  pages: number;
  reading_date: string;
  reading_time: number;
  created_at?: string;
  category_id?: string;
  book_id?: string;
}
