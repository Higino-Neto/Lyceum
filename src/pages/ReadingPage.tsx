export default function ReadingPage() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    const numPages = formData.get("numPages");
    const category = formData.get("category");
  };
  return (
    <div>
      <form onSubmit={handleSubmit}></form>
    </div>
  );
}
