import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfig } from "../../common";
import { ValidationRule } from "../types";

interface UseValidationRulesResult {
  rules: ValidationRule[];
  rulesByField: Record<string, ValidationRule[]>;
  isLoading: boolean;
  error: Error | null;
  getRuleForPath: (fieldPath: string) => ValidationRule | undefined;
}

export const useValidationRules = (
  entityName?: string,
): UseValidationRulesResult => {
  const { ikApi } = useConfig();
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!entityName) {
      setRules([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    ikApi
      .getValidationRules(entityName)
      .then((response: ValidationRule[]) => {
        if (!isMounted) return;
        setRules(response);
        setError(null);
      })
      .catch((err: Error) => {
        if (!isMounted) return;
        setError(err);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [entityName, ikApi]);

  const rulesByField = useMemo(
    () =>
      rules.reduce<Record<string, ValidationRule[]>>((acc, rule) => {
        if (!acc[rule.field_path]) {
          acc[rule.field_path] = [];
        }
        acc[rule.field_path].push(rule);
        return acc;
      }, {}),
    [rules],
  );

  const getRuleForPath = useCallback(
    (fieldPath: string) => rulesByField[fieldPath]?.[0],
    [rulesByField],
  );

  return {
    rules,
    rulesByField,
    isLoading,
    error,
    getRuleForPath,
  };
};
