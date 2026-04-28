{
  "design_personality": {
    "keywords": [
      "strict black & white",
      "editorial / publication-grade",
      "Swiss grid discipline",
      "terminal-like precision",
      "data-dense but breathable",
      "zero decorative color",
      "no emojis"
    ],
    "north_star": "Make the interface feel like a premium legal journal + a command console: typographic hierarchy, hard edges, precise spacing, and grayscale-only semantics.",
    "anti_patterns_to_remove_from_current_ui": [
      "Any green accents (#16a34a) in selection, focus, progress, borders",
      "Emoji usage anywhere (including upload icon)",
      "transition: all (currently used in .patent-card/.btn/.select-box etc.)",
      "Colored badges/pills (field-pill, mega-badge currently white text on colored bg)",
      "Dark gradients (not allowed anyway)"
    ]
  },
  "color_system": {
    "rule": "STRICT B&W ONLY: use #000, #fff, and neutral grays. No hue, no saturation.",
    "tokens_css_variables": {
      "note": "Implement as CSS custom properties (and map to Tailwind/shadcn tokens in index.css).",
      "css": {
        "--bw-0": "#000000",
        "--bw-50": "#0b0b0b",
        "--bw-100": "#111111",
        "--bw-200": "#1a1a1a",
        "--bw-300": "#2a2a2a",
        "--bw-400": "#3a3a3a",
        "--bw-500": "#5a5a5a",
        "--bw-600": "#7a7a7a",
        "--bw-700": "#9a9a9a",
        "--bw-800": "#cfcfcf",
        "--bw-850": "#dedede",
        "--bw-900": "#eeeeee",
        "--bw-950": "#f6f6f6",
        "--bw-1000": "#ffffff",
        "--focus-ring": "#000000",
        "--shadow-ink": "rgba(0,0,0,0.12)",
        "--shadow-ink-strong": "rgba(0,0,0,0.22)"
      }
    },
    "shadcn_hsl_mapping_index_css": {
      "note": "Replace existing :root tokens to remove any implied color usage. Keep destructive as grayscale too.",
      "light": {
        "--background": "0 0% 100%",
        "--foreground": "0 0% 4%",
        "--card": "0 0% 100%",
        "--card-foreground": "0 0% 4%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "0 0% 4%",
        "--primary": "0 0% 0%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "0 0% 96%",
        "--secondary-foreground": "0 0% 10%",
        "--muted": "0 0% 96%",
        "--muted-foreground": "0 0% 40%",
        "--accent": "0 0% 94%",
        "--accent-foreground": "0 0% 10%",
        "--destructive": "0 0% 15%",
        "--destructive-foreground": "0 0% 100%",
        "--border": "0 0% 88%",
        "--input": "0 0% 88%",
        "--ring": "0 0% 0%",
        "--radius": "0.5rem"
      },
      "dark_optional": {
        "note": "Only if you later add a dark mode toggle; still grayscale-only.",
        "--background": "0 0% 4%",
        "--foreground": "0 0% 98%",
        "--card": "0 0% 6%",
        "--card-foreground": "0 0% 98%",
        "--popover": "0 0% 6%",
        "--popover-foreground": "0 0% 98%",
        "--primary": "0 0% 98%",
        "--primary-foreground": "0 0% 0%",
        "--secondary": "0 0% 14%",
        "--secondary-foreground": "0 0% 98%",
        "--muted": "0 0% 14%",
        "--muted-foreground": "0 0% 65%",
        "--accent": "0 0% 16%",
        "--accent-foreground": "0 0% 98%",
        "--destructive": "0 0% 30%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "0 0% 18%",
        "--input": "0 0% 18%",
        "--ring": "0 0% 90%"
      }
    },
    "semantic_usage": {
      "backgrounds": {
        "app": "#ffffff",
        "panels": "#ffffff",
        "subtle_section": "#f6f6f6",
        "hover": "#f6f6f6",
        "selected": "#111111 (text #ffffff)",
        "selected_subtle": "#eeeeee"
      },
      "borders_dividers": {
        "hairline": "#eeeeee",
        "standard": "#dedede",
        "strong": "#cfcfcf",
        "ink": "#111111"
      },
      "text": {
        "primary": "#111111",
        "secondary": "#5a5a5a",
        "muted": "#7a7a7a",
        "inverse": "#ffffff",
        "mono": "#111111"
      },
      "status": {
        "success": "Use shape + label only (no green). Example: 'DONE' badge in black outline.",
        "warning": "Use outline + pattern (dashed border) + label.",
        "error": "Use black fill + white text + explicit 'ERROR' label (no red)."
      }
    },
    "map_grayscale_spec": {
      "background": "#ffffff",
      "land_fill": "#eeeeee",
      "borders": "#3a3a3a",
      "state_borders": "#5a5a5a",
      "gridlines_optional": "#dedede",
      "pins": "solid #000 circles (6–8px) with 1px white halo for contrast",
      "heatmap": "density via opacity only (black at 8–18% alpha), never color"
    }
  },
  "typography": {
    "font_pairing": {
      "display_editorial": {
        "name": "Libre Baskerville",
        "usage": "Section titles, modal titles, key editorial headings",
        "fallback": "Georgia, serif"
      },
      "body_ui": {
        "name": "DM Sans",
        "usage": "Body copy, labels, helper text",
        "fallback": "system-ui, sans-serif"
      },
      "mono_terminal": {
        "name": "JetBrains Mono",
        "usage": "Metrics, IDs, journal rows, filters, chips, timestamps, job logs",
        "fallback": "ui-monospace, SFMono-Regular, Menlo, monospace"
      },
      "note": "These fonts are already imported in App.css; keep them but enforce consistent usage via utility classes and component-level styles."
    },
    "type_scale_tailwind": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium tracking-tight",
      "section_label": "text-[11px] font-semibold tracking-[0.18em] uppercase font-mono",
      "body": "text-sm md:text-base leading-6",
      "table": "text-xs md:text-sm font-mono",
      "micro": "text-[11px] leading-4 text-muted-foreground"
    },
    "editorial_rules": [
      "Use uppercase mono labels for navigation + panel headers.",
      "Use serif only for titles (not for dense tables).",
      "Keep line-length 60–80 chars in detail panel narrative sections.",
      "Numbers: tabular-nums for metrics (Tailwind: tabular-nums)."
    ]
  },
  "layout_and_grid": {
    "overall": {
      "pattern": "Three-panel dashboard with fixed top metrics bar; resizable columns on desktop; stacked panels on mobile.",
      "max_width": "No hard max-width on desktop; use full-bleed with internal gutters.",
      "gutters": "px-4 sm:px-6 lg:px-8",
      "vertical_rhythm": "Use 24–32px section spacing; 12–16px within cards."
    },
    "desktop_grid": {
      "columns": "Left (journals) 320px, Center (map) minmax(420px, 1fr), Right (patents) 420px",
      "implementation": "Use CSS grid: grid-cols-[320px_minmax(420px,1fr)_420px] with gap-0 and separators.",
      "separators": "Use <Separator orientation=\"vertical\" /> between panels."
    },
    "mobile_flow": {
      "order": [
        "Top metrics (horizontal scroll)",
        "Job status strip",
        "Map (collapsible)",
        "Patents list",
        "Journals (drawer)"
      ],
      "interaction": "Left journals becomes a Drawer/Sheet triggered by a 'Journals' button in the top bar."
    },
    "panel_headers": {
      "style": "Mono uppercase label + right-aligned actions; 1px bottom border.",
      "class": "flex items-center justify-between px-4 py-3 border-b border-border bg-background"
    }
  },
  "components": {
    "component_path": {
      "shadcn_primary": [
        "/app/frontend/src/components/ui/button.jsx",
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/input.jsx",
        "/app/frontend/src/components/ui/select.jsx",
        "/app/frontend/src/components/ui/table.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/separator.jsx",
        "/app/frontend/src/components/ui/scroll-area.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/drawer.jsx",
        "/app/frontend/src/components/ui/dialog.jsx",
        "/app/frontend/src/components/ui/progress.jsx",
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/command.jsx",
        "/app/frontend/src/components/ui/tooltip.jsx",
        "/app/frontend/src/components/ui/sonner.jsx"
      ],
      "notes": [
        "Do not use raw HTML select/dropdown/toast; use shadcn components above.",
        "All components are .jsx; keep new components in .js/.jsx accordingly."
      ]
    },
    "dashboard_shell": {
      "top_metrics_bar": {
        "use": ["Card", "Separator"],
        "layout": "6 metric blocks in a single row; on mobile use horizontal ScrollArea.",
        "metric_block": {
          "title": "mono uppercase label",
          "value": "large numeric with tabular-nums",
          "delta_optional": "tiny muted text; no arrows with color—use +/− symbols"
        },
        "classes": {
          "wrap": "sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border",
          "grid": "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0",
          "cell": "px-4 py-3"
        },
        "data_testids": {
          "bar": "metrics-bar",
          "total_patents": "metric-total-patents",
          "mega_count": "metric-mega-count",
          "avg_score": "metric-avg-score",
          "cities": "metric-cities",
          "claims": "metric-claims"
        }
      },
      "left_journals_panel": {
        "use": ["ScrollArea", "Button", "Badge", "Progress"],
        "row_style": "Mono 10–11px, tight leading, hairline divider.",
        "selection": "Selected row uses black background with white text (no green).",
        "actions": [
          "Download selected journal",
          "Download all missing",
          "Upload PDF (opens Dialog)"
        ],
        "data_testids": {
          "panel": "journals-panel",
          "download_selected": "journals-download-selected-button",
          "download_all": "journals-download-all-button",
          "upload": "journals-upload-button",
          "row": "journal-row"
        }
      },
      "center_map_panel": {
        "use": ["Tabs", "Tooltip", "Card"],
        "tabs": ["Density", "Cities", "Mega"],
        "map_controls": "Top-right: zoom in/out, reset (icon buttons).",
        "legend": "Grayscale legend using opacity steps (10%, 14%, 18%).",
        "data_testids": {
          "panel": "map-panel",
          "tabs": "map-tabs",
          "zoom_in": "map-zoom-in",
          "zoom_out": "map-zoom-out",
          "reset": "map-reset"
        }
      },
      "right_patents_panel": {
        "use": ["Input", "Select", "Command", "ScrollArea", "Badge"],
        "search": "Use Input with mono placeholder; add Command for quick jump (Ctrl/⌘K).",
        "filters": "Use Select for Tech field, City, Score range (Slider optional).",
        "list_item": {
          "title": "Serif title line (truncate)",
          "meta": "Mono row: app no, date, city",
          "badges": "Outline badges only (no fills)"
        },
        "data_testids": {
          "panel": "patents-panel",
          "search": "patents-search-input",
          "sort": "patents-sort-select",
          "filter_city": "patents-filter-city-select",
          "filter_tech": "patents-filter-tech-select",
          "list": "patents-list",
          "item": "patent-list-item"
        }
      },
      "patent_detail_slideup": {
        "use": ["Drawer"],
        "behavior": "Slide-up from bottom; max-h 70vh; internal ScrollArea; sticky header with close.",
        "sections": [
          "Abstract (serif)",
          "Claims (mono, numbered)",
          "Assignee/Inventors (table)",
          "Mega score breakdown (bar chart in grayscale)"
        ],
        "data_testids": {
          "drawer": "patent-detail-drawer",
          "close": "patent-detail-close-button",
          "title": "patent-detail-title",
          "claims": "patent-detail-claims"
        }
      },
      "job_tracking": {
        "use": ["Progress", "Badge", "Table"],
        "pattern": "A thin job strip under metrics bar + expandable job drawer for full logs.",
        "progress_style": "Use grayscale progress: track #eeeeee, fill #111111.",
        "data_testids": {
          "strip": "job-status-strip",
          "open_drawer": "job-status-open-drawer",
          "progress": "job-progress"
        }
      },
      "welcome_modal": {
        "use": ["Dialog", "Button"],
        "tone": "Editorial onboarding: explain empty DB + how to start downloads.",
        "data_testids": {
          "modal": "welcome-modal",
          "primary": "welcome-start-downloads-button",
          "dismiss": "welcome-dismiss-button"
        }
      },
      "upload_modal": {
        "use": ["Dialog", "Input", "Button"],
        "dropzone": "No emoji icon; use lucide-react Upload icon in black.",
        "data_testids": {
          "modal": "upload-modal",
          "dropzone": "upload-dropzone",
          "file_input": "upload-file-input",
          "submit": "upload-submit-button"
        }
      },
      "made_with_badge": {
        "style": "Bottom-left fixed, tiny mono label with 1px border.",
        "classes": "fixed bottom-4 left-4 z-40 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-mono tracking-[0.14em] uppercase",
        "data_testids": "made-with-emergent-badge"
      }
    },
    "badge_styles": {
      "outline_badge": "Use shadcn Badge variant=outline; keep border #111 and text #111.",
      "mega_patent_badge": "Black fill with white text, no animation pulse (avoid gimmick). Use subtle underline or border emphasis instead."
    },
    "tables": {
      "use": ["Table"],
      "rules": [
        "Sticky header for claims table and job table.",
        "Row hover: bg-[#f6f6f6].",
        "Selected row: bg-[#111] text-white.",
        "Use mono for numeric columns; tabular-nums."
      ]
    }
  },
  "motion_and_microinteractions": {
    "principles": [
      "Motion should feel mechanical and precise (terminal-like), not bouncy.",
      "Use short durations (120–220ms) and cubic-bezier(0.16, 1, 0.3, 1) for panels/drawers.",
      "Never use transition: all; transition only color/background/border/opacity/shadow."
    ],
    "recommended": {
      "hover": "Buttons and rows: background shift to #f6f6f6; border darken to #111.",
      "press": "Active: translate-y-[1px] + shadow reduction.",
      "focus": "2px black ring with 2px offset on interactive elements.",
      "list_entrance": "Use subtle fade+translateY(4px) for new rows; avoid large motion.",
      "map": "Pins fade in; tooltip appears with 120ms opacity transition."
    },
    "framer_motion_optional": {
      "install": "npm i framer-motion",
      "use_cases": [
        "Slide-up patent detail drawer",
        "Job strip expand/collapse",
        "List item mount/unmount"
      ],
      "note": "Optional; shadcn Drawer/Dialog already animate. Only add if needed for map overlays."
    }
  },
  "data_visualization_guidelines": {
    "d3_map": {
      "pin_style": "<circle r=\"4\" fill=\"#000\" stroke=\"#fff\" stroke-width=\"1\" />",
      "heatmap": "Use a single black fill with varying opacity; clamp to 0.08–0.18.",
      "labels": "Use mono 10px, fill #111, with white text halo if over land.",
      "accessibility": "Provide a table fallback summary under the map for screen readers (top cities + counts)."
    },
    "charts_if_needed": {
      "library": "recharts (already common in stack)",
      "style": "All strokes/fills grayscale; gridlines #dedede; axis text #5a5a5a; tooltip white bg black border.",
      "empty_state": "Use skeleton + mono label 'NO DATA — START DOWNLOADS'."
    }
  },
  "accessibility": {
    "requirements": [
      "WCAG AA contrast: black text on white; avoid light gray text below #7a7a7a for body.",
      "Keyboard navigation: visible focus ring on all interactive elements.",
      "Map: provide keyboard-accessible list of pins/cities.",
      "Reduced motion: respect prefers-reduced-motion (disable entrance animations)."
    ],
    "aria": {
      "dialogs": "Use shadcn Dialog/Drawer which handles aria; ensure titles/descriptions are set.",
      "inputs": "All inputs must have <Label> and aria-describedby for helper/error text."
    }
  },
  "refactor_plan_for_app_js": {
    "goal": "Break 670-line App.js into composable panels without changing API contracts.",
    "suggested_structure": {
      "/app/frontend/src/components/dashboard/DashboardShell.js": "Grid + separators + top bars",
      "/app/frontend/src/components/dashboard/MetricsBar.js": "Top metrics",
      "/app/frontend/src/components/dashboard/JournalsPanel.js": "Left panel",
      "/app/frontend/src/components/dashboard/MapPanel.js": "Center panel",
      "/app/frontend/src/components/dashboard/PatentsPanel.js": "Right panel",
      "/app/frontend/src/components/dashboard/PatentDetailDrawer.js": "Slide-up detail",
      "/app/frontend/src/components/dashboard/JobStatusStrip.js": "Progress + status",
      "/app/frontend/src/components/modals/WelcomeDialog.js": "Welcome modal",
      "/app/frontend/src/components/modals/UploadDialog.js": "Upload modal"
    },
    "js_conventions": [
      "Use .js/.jsx only (no .tsx).",
      "Named exports for components; default export for pages.",
      "Add data-testid to every button/input/list item/metric.",
      "Centralize constants for testids in /components/testids.js (optional)."
    ]
  },
  "implementation_notes_for_existing_css": {
    "what_to_change_in_App_css": [
      "Replace any #16a34a usage with grayscale equivalents (typically #111 or #000).",
      "Remove pulse animation from .mega-badge (or keep but make it extremely subtle via opacity only and respect reduced motion).",
      "Replace transition: all with targeted transitions: background-color, border-color, color, opacity, box-shadow.",
      "Update .slide-panel: border-top should be #111 not green; consider using shadcn Drawer instead of custom slide-panel.",
      "Update .search-box focus border from green to black.",
      "Update .btn hover from green to black; primary button should be black fill.",
      "Update .upload-dropzone hover from green to subtle gray; remove green-tinted background."
    ],
    "scrollbars": "Keep subtle gray scrollbar; ensure thumb is #cfcfcf and hover #9a9a9a."
  },
  "image_urls": {
    "rule": "No photography required. Use pure typographic + vector map. If any imagery is needed, use grayscale-only abstract textures.",
    "categories": [
      {
        "category": "noise_texture",
        "description": "Optional subtle paper grain overlay (CSS-based preferred).",
        "urls": []
      }
    ],
    "css_noise_snippet": "/* Optional: subtle paper grain (no images) */\n.bw-grain::before{\n  content:'';\n  position:fixed;\n  inset:0;\n  pointer-events:none;\n  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.08'/%3E%3C/svg%3E\");\n  opacity:0.35;\n  mix-blend-mode:multiply;\n}"
  },
  "instructions_to_main_agent": {
    "must_do": [
      "Remove all green and emoji usage across UI and CSS.",
      "Adopt shadcn components for inputs/selects/dialogs/drawers/toasts.",
      "Enforce grayscale-only tokens in index.css and component styles.",
      "Add data-testid attributes to all interactive + key informational elements.",
      "Refactor App.js into smaller components per plan; keep API calls intact.",
      "Map: enforce grayscale spec; heatmap via opacity only."
    ],
    "should_do": [
      "Add Command palette (shadcn Command) for quick patent search/jump.",
      "Use Resizable panels (shadcn resizable.jsx) on desktop for left/center/right widths.",
      "Add sticky headers in tables/lists for context."
    ],
    "must_not_do": [
      "No colors beyond grayscale (including destructive red/green).",
      "No gradients.",
      "No emoji icons.",
      "No centered app container styling.",
      "No transition: all."
    ]
  },
  "general_ui_ux_design_guidelines": "    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}
