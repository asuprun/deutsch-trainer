/**
 * PostgREST liefert pro Anfrage höchstens 1000 Zeilen — alles darüber wird
 * STILL abgeschnitten. Für Auswertungen über alle Zeilen (Zähler, Export,
 * Statistik, Leech-Filter) daher seitenweise laden.
 *
 * `build(from, to)` muss eine Abfrage mit STABILER Sortierung (z.B. .order('id'))
 * und `.range(from, to)` liefern, sonst können Zeilen zwischen Seiten verrutschen.
 */
const PAGE = 1000;

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) return { data: out, error };
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: out, error: null };
  }
}
