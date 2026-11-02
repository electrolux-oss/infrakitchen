import type { ComponentProps } from "react";

import {
  HeroArrowsRightLeftIcon,
  HeroBoltIcon,
  HeroCircleStackIcon,
  HeroClipboardDocumentCheckIcon,
  HeroCodeBracketIcon,
  HeroCodeBracketSquareIcon,
  HeroCogIcon,
  HeroCommandLineIcon,
  HeroCpuChipIcon,
  HeroFingerPrintIcon,
  HeroFolderIcon,
  HeroKeyIcon,
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
    auth_provider: <HeroFingerPrintIcon />,
    batch_operation: <HeroBoltIcon />,
    blueprint: <HeroRectangleGroupIcon />,
    executor: <HeroCpuChipIcon />,
    integration: <HeroPuzzlePieceIcon />,
    personal_access_token: <HeroUserIcon />,
    project: <HeroFolderIcon />,
    resource: <HeroCircleStackIcon />,
    secret: <HeroKeyIcon />,
    service: <HeroRectangleStackIcon />,
    source_code: <HeroCodeBracketSquareIcon />,
    source_code_version: <HeroTagIcon />,
    storage: <HeroServerStackIcon />,
    task: <HeroClipboardDocumentCheckIcon />,
    template: <HeroSquare3Stack3DIcon />,
    tool: <HeroCommandLineIcon />,
    user: <HeroUserIcon />,
    worker: <HeroCogIcon />,
    workflow: <HeroArrowsRightLeftIcon />,
    worker_template: <HeroRocketLaunchIcon />,
    workspace: <HeroCodeBracketIcon />,
  };
