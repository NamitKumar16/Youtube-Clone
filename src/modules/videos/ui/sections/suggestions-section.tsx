"use client";

import { DEFAULT_LIMIT } from "@/constants";
import { trpc } from "@/trpc/client";
import React from "react";

interface SuggestionsSectionProps {
  videoId: string;
}

const SuggestionsSection = ({ videoId }: SuggestionsSectionProps) => {
  const [data] = trpc.suggestions.getMany.useSuspenseInfiniteQuery(
    {
      videoId,
      limit: DEFAULT_LIMIT,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  return <div>{JSON.stringify(data)}</div>;
};

export default SuggestionsSection;
