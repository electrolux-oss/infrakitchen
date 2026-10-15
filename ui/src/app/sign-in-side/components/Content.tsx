import { InfrakitchenLogo } from "@/index";
import {
  AutoFixHighRoundedIcon,
  ConstructionRoundedIcon,
  SettingsSuggestRoundedIcon,
  ThumbUpAltRoundedIcon,
} from "@/index";

const items = [
  {
    icon: <SettingsSuggestRoundedIcon className="text-fg-muted" />,
    title: "Adaptable performance",
    description:
      "Our product effortlessly adjusts to your needs, boosting efficiency and simplifying your tasks.",
  },
  {
    icon: <ConstructionRoundedIcon className="text-fg-muted" />,
    title: "Built to last",
    description:
      "Experience unmatched durability that goes above and beyond with lasting investment.",
  },
  {
    icon: <ThumbUpAltRoundedIcon className="text-fg-muted" />,
    title: "Great user experience",
    description:
      "Integrate our product into your routine with an intuitive and easy-to-use interface.",
  },
  {
    icon: <AutoFixHighRoundedIcon className="text-fg-muted" />,
    title: "Innovative functionality",
    description:
      "Stay ahead with features that set new standards, addressing your evolving needs better than the rest.",
  },
];

export default function Content() {
  return (
    <div className="flex w-full max-w-150 flex-col items-stretch gap-8 self-center sm:max-w-175 md:max-w-200 lg:max-w-225 lg:flex-row lg:items-center lg:gap-12">
      <div className="hidden shrink-0 lg:flex [&_svg]:h-30 [&_svg]:w-30">
        <InfrakitchenLogo />
      </div>
      <div className="flex w-full max-w-130 flex-[unset] flex-col gap-8 sm:max-w-140 md:max-w-150 lg:max-w-105 lg:flex-none">
        {items.map((item, index) => (
          <div className="flex flex-row gap-4" key={index}>
            {item.icon}
            <div>
              <p className="m-0 mb-[0.35em] text-body2 font-medium">
                {item.title}
              </p>
              <p className="m-0 text-body2 text-fg-muted">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
