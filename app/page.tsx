"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Item = { id: string; name: string; category: string; price: number };

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("menu_items")
      .select("id, name, category, price")
      .order("category")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setItems(data ?? []);
      });
  }, []);

  if (error) return <p className="p-8">Error: {error}</p>;

  return (
    <main className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Menu</h1>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            {item.name} ({item.category}) - ₹{item.price}
          </li>
        ))}
      </ul>
    </main>
  );
}