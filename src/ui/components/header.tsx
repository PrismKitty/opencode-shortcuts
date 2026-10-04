import type { Palette } from '#src/host/types.ts';

interface HeaderProps {
  palette: Palette;
  boundCount: number;
  totalCount: number;
}

export const Header = (props: HeaderProps) => (
  <box flexDirection="row" justifyContent="space-between">
    <text fg={props.palette.text}>
      <b>Keyboard shortcuts</b>
    </text>
    <text fg={props.palette.mutedText}>{`${props.boundCount} of ${props.totalCount} commands have keys`}</text>
  </box>
);
