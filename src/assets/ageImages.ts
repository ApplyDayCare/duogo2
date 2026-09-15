import age18to29 from "@/assets/images/age_18_29_1788311247506.jpg";
import age30to39 from "@/assets/images/age_30_39_1788311262751.jpg";
import age40to49 from "@/assets/images/age_40_49_1788311277547.jpg";
import age50plus from "@/assets/images/age_50_plus_1788311292361.jpg";

export const AGE_GROUPS = [
  {
    id: "18-29",
    label: "Age 18-29",
    image: age18to29,
    description: "Young adults & 20s",
  },
  {
    id: "30-39",
    label: "Age 30-39",
    image: age30to39,
    description: "30s professionals & friends",
  },
  {
    id: "40-49",
    label: "Age 40-49",
    image: age40to49,
    description: "40s social circle",
  },
  {
    id: "50+",
    label: "Age 50+",
    image: age50plus,
    description: "50+ mature & active",
  },
] as const;
