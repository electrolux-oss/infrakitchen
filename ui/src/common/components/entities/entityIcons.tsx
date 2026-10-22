import type { ComponentProps } from "react";

import {
  HeroCircleStackIcon,
  HeroCodeBracketIcon,
  HeroCodeBracketSquareIcon,
  HeroCpuChipIcon,
  HeroFolderIcon,
  HeroPuzzlePieceIcon,
  HeroRectangleGroupIcon,
  HeroRectangleStackIcon,
  HeroRocketLaunchIcon,
  HeroServerStackIcon,
  HeroSquare3Stack3DIcon,
  HeroTagIcon,
  HeroUserIcon,
} from "../../../icons";
import type { Label } from "../../../ui/Label";

// Icon per entity type.
export const entityIcons: Record<string, ComponentProps<typeof Label>["icon"]> =
  {
    blueprint: <HeroRectangleGroupIcon />,
    executor: <HeroCpuChipIcon />,
    integration: <HeroPuzzlePieceIcon />,
    personal_access_token: <HeroUserIcon />,
    project: <HeroFolderIcon />,
    resource: <HeroCircleStackIcon />,
    service: <HeroRectangleStackIcon />,
    source_code: <HeroCodeBracketSquareIcon />,
    source_code_version: <HeroTagIcon />,
    storage: <HeroServerStackIcon />,
    template: <HeroSquare3Stack3DIcon />,
    user: <HeroUserIcon />,
    worker_template: <HeroRocketLaunchIcon />,
    workspace: <HeroCodeBracketIcon />,
  };
