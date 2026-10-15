import { ReactNode, RefObject } from "react";

import {
  Controller,
  Control,
  FieldErrors,
  FieldPath,
  FieldValues,
  RegisterOptions,
} from "react-hook-form";

import { PropertyCard } from "../cards/PropertyCard";
import TagInput from "../inputs/TagInput";

export interface DependencyEntry {
  name: string;
  value: string;
  inherited_by_children: boolean;
}

interface DependencyConfigurationFieldsProps<
  TFieldValues extends FieldValues,
  TDependencyTagsName extends FieldPath<TFieldValues>,
  TDependencyConfigName extends FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  dependencyTagsName: TDependencyTagsName;
  dependencyConfigName: TDependencyConfigName;
  dependencyTagsRules?: RegisterOptions<TFieldValues, TDependencyTagsName>;
  dependencyConfigRules?: RegisterOptions<TFieldValues, TDependencyConfigName>;
  dependencyTagsSectionRef?: RefObject<HTMLDivElement | null>;
  dependencyConfigSectionRef?: RefObject<HTMLDivElement | null>;
  dependencyConfigFooter?: ReactNode;
}

export const DependencyConfigurationFields = <
  TFieldValues extends FieldValues,
  TDependencyTagsName extends FieldPath<TFieldValues>,
  TDependencyConfigName extends FieldPath<TFieldValues>,
>({
  control,
  errors,
  dependencyTagsName,
  dependencyConfigName,
  dependencyTagsRules,
  dependencyConfigRules,
  dependencyTagsSectionRef,
  dependencyConfigSectionRef,
  dependencyConfigFooter,
}: DependencyConfigurationFieldsProps<
  TFieldValues,
  TDependencyTagsName,
  TDependencyConfigName
>) => {
  return (
    <PropertyCard title="Dependency Configuration">
      <div>
        <div ref={dependencyTagsSectionRef}>
          <Controller
            name={dependencyTagsName}
            control={control}
            rules={dependencyTagsRules}
            render={({ field, formState }) => (
              <TagInput
                {...field}
                label="Dependency Tags"
                errors={errors}
                showErrors={formState.isSubmitted}
              />
            )}
          />
        </div>
        <div ref={dependencyConfigSectionRef}>
          <Controller
            name={dependencyConfigName}
            control={control}
            rules={dependencyConfigRules}
            render={({ field, formState }) => (
              <>
                <TagInput
                  {...field}
                  label="Dependency Configs"
                  errors={errors}
                  showErrors={formState.isSubmitted}
                />
                {dependencyConfigFooter}
              </>
            )}
          />
        </div>
      </div>
    </PropertyCard>
  );
};
