import Svg, { Circle, Path } from "react-native-svg";

export function Mark({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="46" fill="none" stroke="#c9a96a" strokeWidth="1.2" />
      <Circle cx="50" cy="50" r="40" fill="none" stroke="#c9a96a" strokeWidth="0.5" opacity={0.6} />
      <Path d="M29 33 L50 71 L71 33" fill="none" stroke="#ecd8a8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
