"use client";
import { trpc } from "@/trpc/client";

export const PageClient = () => {
  const [data] = trpc.hello.useSuspenseQuery({ text: "Namit" });
  return <div>Page Client {data.greeting}</div>;
};
