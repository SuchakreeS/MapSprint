// Line icons copied from design/source (KitTabBar, ScrWelcome, ScrSignIn, ScrProfileSetup, ScrAddCar).
// 24x24 viewBox, round caps/joins, stroke = the colour passed in.
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps {
  color: ColorValue;
  size?: number;
  strokeWidth?: number;
}

function Line({ color, size = 24, strokeWidth = 2, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export const FeedIcon = (p: IconProps) => (
  <Line {...p}>
    <Rect x="3" y="4" width="18" height="16" rx="3" />
    <Path d="M7 9h10" />
    <Path d="M7 13h10" />
    <Path d="M7 17h6" />
  </Line>
);

export const MapIcon = (p: IconProps) => (
  <Line {...p}>
    <Path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
    <Path d="M9 3v15" />
    <Path d="M15 6v15" />
  </Line>
);

/** Steering wheel in the raised Record button (26 px, stroke 2.2 in the design). */
export const RecordIcon = (p: IconProps) => (
  <Line size={26} strokeWidth={2.2} {...p}>
    <Circle cx="12" cy="12" r="9" />
    <Circle cx="12" cy="12" r="2.5" />
    <Path d="M3.5 10.5h6" />
    <Path d="M14.5 10.5h6" />
    <Path d="M12 14.5V21" />
  </Line>
);

export const RanksIcon = (p: IconProps) => (
  <Line {...p}>
    <Path d="M8 21h8" />
    <Path d="M12 17v4" />
    <Path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <Path d="M17 6h3v1a4 4 0 0 1-3 4" />
    <Path d="M7 6H4v1a4 4 0 0 0 3 4" />
  </Line>
);

export const ProfileIcon = (p: IconProps) => (
  <Line {...p}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </Line>
);

export const BackIcon = (p: IconProps) => (
  <Line {...p}>
    <Path d="M15 5l-7 7 7 7" />
  </Line>
);

export const MailIcon = (p: IconProps) => (
  <Line size={20} {...p}>
    <Rect x="3" y="5" width="18" height="14" rx="2" />
    <Path d="M3 7l9 6 9-6" />
  </Line>
);

export const EyeIcon = (p: IconProps) => (
  <Line size={22} {...p}>
    <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <Circle cx="12" cy="12" r="3" />
  </Line>
);

export const CameraIcon = (p: IconProps) => (
  <Line size={20} {...p}>
    <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <Circle cx="12" cy="13" r="3.5" />
  </Line>
);

export const CheckIcon = (p: IconProps) => (
  <Line size={16} strokeWidth={2.5} {...p}>
    <Path d="M5 12l5 5 9-10" />
  </Line>
);

/** Top-down car (design 05): body in the car's colour, windows in the background colour. */
export function CarTopIcon({ body, outline, glass }: { body: string; outline: string; glass: string }) {
  return (
    <Svg width={64} height={88} viewBox="0 0 64 88">
      <Rect x="10" y="4" width="44" height="80" rx="18" fill={body} stroke={outline} strokeWidth={1.5} />
      <Rect x="16" y="20" width="32" height="16" rx="6" fill={glass} fillOpacity={0.75} />
      <Rect x="16" y="58" width="32" height="12" rx="5" fill={glass} fillOpacity={0.75} />
    </Svg>
  );
}
