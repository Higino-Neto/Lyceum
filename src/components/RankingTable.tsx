const data = [
  { position: 1, name: "Ana", pages: 2140 },
  { position: 2, name: "Carlos", pages: 1980 },
  { position: 3, name: "Marina", pages: 1760 },
  { position: 4, name: "Lucas", pages: 1540 },
];

export default function RankingTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-800 text-zinc-400 uppercase text-xs tracking-wider">
          <tr>
            <th className="text-left px-6 py-4">Posição</th>
            <th className="text-left px-6 py-4">Nome</th>
            <th className="text-right px-6 py-4">Páginas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((user) => (
            <tr
              key={user.position}
              className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
            >
              <td className="px-6 py-4 font-medium">
                #{user.position}
              </td>
              <td className="px-6 py-4">{user.name}</td>
              <td className="px-6 py-4 text-right font-semibold">
                {user.pages}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
