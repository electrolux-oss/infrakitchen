import { InfrakitchenLogo } from "@electrolux-oss/infrakitchen";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import SettingsSuggestRoundedIcon from "@mui/icons-material/SettingsSuggestRounded";
import ThumbUpAltRoundedIcon from "@mui/icons-material/ThumbUpAltRounded";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const items = [
  {
    icon: <SettingsSuggestRoundedIcon sx={{ color: "text.secondary" }} />,
    title: "Adaptable performance",
    description:
      "Our product effortlessly adjusts to your needs, boosting efficiency and simplifying your tasks.",
  },
  {
    icon: <ConstructionRoundedIcon sx={{ color: "text.secondary" }} />,
    title: "Built to last",
    description:
      "Experience unmatched durability that goes above and beyond with lasting investment.",
  },
  {
    icon: <ThumbUpAltRoundedIcon sx={{ color: "text.secondary" }} />,
    title: "Great user experience",
    description:
      "Integrate our product into your routine with an intuitive and easy-to-use interface.",
  },
  {
    icon: <AutoFixHighRoundedIcon sx={{ color: "text.secondary" }} />,
    title: "Innovative functionality",
    description:
      "Stay ahead with features that set new standards, addressing your evolving needs better than the rest.",
  },
];

export default function Content() {
  return (
    <Stack
      sx={{
        flexDirection: { xs: "column", lg: "row" },
        alignSelf: "center",
        gap: { xs: 4, lg: 6 },
        maxWidth: { xs: 600, sm: 700, md: 800, lg: 900 },
        width: "100%",
        alignItems: { xs: "stretch", lg: "center" },
      }}
    >
      <Box
        sx={{
          display: { xs: "none", lg: "flex" },
          "& svg": { width: 120, height: 120 },
          flexShrink: 0,
        }}
      >
        <InfrakitchenLogo />
      </Box>
      <Stack
        sx={{
          gap: 4,
          flex: { xs: "unset", lg: "0 0 auto" },
          maxWidth: { xs: 520, sm: 560, md: 600, lg: 420 },
          width: "100%",
        }}
      >
        {items.map((item, index) => (
          <Stack key={index} direction="row" sx={{ gap: 2 }}>
            {item.icon}
            <div>
              <Typography gutterBottom sx={{ fontWeight: "medium" }}>
                {item.title}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {item.description}
              </Typography>
            </div>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
