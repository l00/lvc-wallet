export const COLOR_THEMES = [
  {
    id: "green",
    label: "Green",
    vars: {
      "--accent": "#21a700",
      "--accent-hover": "#21a700",
      "--accent-bright": "#21a700",
      "--accent-ring": "rgba(81, 255, 0, 0.3)",
      "--on-accent": "#ffffff",
      "--accent-gradient": "#21a700",
    },
  },
  {
    id: "orange",
    label: "Orange",
    vars: {
      "--accent": "#ff6c3c",
      "--accent-hover": "#fa6800",
      "--accent-bright": "#ff8c5a",
      "--accent-ring": "rgba(250, 104, 0, 0.3)",
      "--on-accent": "#ffffff",
      "--accent-gradient": "#ff6c3c",
    },
  },
  {
    id: "blue",
    label: "Blue",
    vars: {
      "--accent": "#2f81f7",
      "--accent-hover": "#1f6feb",
      "--accent-bright": "#58a6ff",
      "--accent-ring": "rgba(47, 129, 247, 0.3)",
      "--on-accent": "#ffffff",
      "--accent-gradient": "linear-gradient(135deg, #1f6feb 0%, #34d0ff 100%)",
    },
  },
  {
    id: "purple",
    label: "Amethyst",
    vars: {
      "--accent": "#a371f7",
      "--accent-hover": "#8957e5",
      "--accent-bright": "#bc8cff",
      "--accent-ring": "rgba(163, 113, 247, 0.3)",
      "--on-accent": "#ffffff",
      "--accent-gradient": "linear-gradient(135deg, #8957e5 0%, #d08cff 100%)",
    },
  },
  {
    id: "pink",
    label: "Pink",
    vars: {
      "--accent": "#f778ba",
      "--accent-hover": "#db61a2",
      "--accent-bright": "#ff9bcf",
      "--accent-ring": "rgba(247, 120, 186, 0.3)",
      "--on-accent": "#ffffff",
      "--accent-gradient": "linear-gradient(135deg, #db61a2 0%, #a371f7 100%)",
    },
  },
];

export const DEFAULT_COLOR_THEME = "green";

export function getColorTheme(id) {
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}
