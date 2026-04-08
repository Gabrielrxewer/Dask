import { useCallback, useState } from "react";

type AsyncCallback<Args extends unknown[]> = (...args: Args) => Promise<void>;

interface UseAsyncActionResult<Args extends unknown[]> {
  isSubmitting: boolean;
  run: (...args: Args) => Promise<void>;
}

export function useAsyncAction<Args extends unknown[]>(
  callback: AsyncCallback<Args>
): UseAsyncActionResult<Args> {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = useCallback(
    async (...args: Args): Promise<void> => {
      setIsSubmitting(true);
      try {
        await callback(...args);
      } finally {
        setIsSubmitting(false);
      }
    },
    [callback]
  );

  return {
    isSubmitting,
    run
  };
}
