{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  name = "opencode-shortcuts-dev";

  packages = [
    pkgs.nodejs_24
    pkgs.pnpm
    pkgs.tmux
    pkgs.asciinema
    pkgs.asciinema-agg
  ];

  # scripts/record-demo.sh renders from this directory, so the gif looks the same on every machine
  DEMO_FONT_DIR = "${pkgs.dejavu_fonts}/share/fonts/truetype";

  shellHook = ''
    echo "opencode-shortcuts dev shell ready" >&2
  '';
}
