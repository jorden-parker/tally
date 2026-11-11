import { useEffect, useState } from "react";
import type { AssignedStory } from "@/lib/store/assigned-stories";
import type { TallyApi } from "../api";
import { messageOf } from "../dashboard/use-dashboard";

export function useAssignedTickets(api: TallyApi) {
  const [stories, setStories] = useState<AssignedStory[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    api
      .fetchAssignedStories()
      .then((loaded) => current && setStories(loaded))
      .catch((error) => current && setProblem(messageOf(error)));
    return () => {
      current = false;
    };
  }, [api]);

  return { stories, problem };
}
