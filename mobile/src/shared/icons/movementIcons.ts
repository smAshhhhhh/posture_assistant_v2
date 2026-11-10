// 统一正方形画布、圆头笔画和双色动作提示，缩小时保持轮廓清晰。
function movementSvg(content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"
    viewBox="0 0 128 128" fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${content}
  </svg>`;
}

export const movementIcons = {
  shoulder_flexion: movementSvg(`
    <circle cx="33" cy="29" r="14" fill="#2176FF"/>
    <path d="M25 108 C23 96 21 81 23 69 C25 57 33 52 45 50
      L64 46 L105 23" stroke="#2176FF" stroke-width="11"/>
    <path d="M62 91 C80 87 91 74 94 59 M83 65 L95 57 L100 71"
      stroke="#8BBDFF" stroke-width="8"/>
  `),
  elbow_flexion_extension: movementSvg(`
    <circle cx="32" cy="28" r="14" fill="#2176FF"/>
    <path d="M26 109 L21 80 C18 63 23 51 34 51 C42 51 48 59 53 67
      L65 83 Q68 87 73 81 L94 55" stroke="#2176FF" stroke-width="11"/>
    <path d="M90 33 C105 34 114 44 114 60 M105 54 L114 63 L122 53"
      stroke="#8BBDFF" stroke-width="7"/>
  `),
  seated_knee_extension: movementSvg(`
    <path d="M14 71 L18 96 Q19 101 25 101 H53 Q59 101 60 108 L62 119"
      stroke="#2176FF" stroke-width="6"/>
    <circle cx="34" cy="26" r="13" fill="#2176FF"/>
    <path d="M34 48 L38 78 Q39 84 47 84 L71 82 L94 97 L102 87"
      stroke="#2176FF" stroke-width="11"/>
    <path d="M48 79 L66 82" stroke="#2176FF" stroke-width="9"/>
    <path d="M109 95 C119 88 120 79 118 69 M111 76 L118 67 L124 76"
      stroke="#8BBDFF" stroke-width="6"/>
  `),
  march_in_place: movementSvg(`
    <circle cx="55" cy="21" r="13" fill="#2176FF"/>
    <path d="M51 43 L48 74 L59 94 L53 116 M49 75 L82 68 Q86 68 84 76 L75 94
      M50 44 L32 59 L29 73 M54 44 L76 56 L89 40"
      stroke="#2176FF" stroke-width="10"/>
    <path d="M94 101 H108 Q114 101 114 95 V89 M96 112 H112"
      stroke="#8BBDFF" stroke-width="6"/>
  `),
  seated_trunk_lean: movementSvg(`
    <path d="M17 75 L23 100 H57 Q63 100 64 107 L66 118 M23 100 L18 118"
      stroke="#2176FF" stroke-width="6"/>
    <circle cx="73" cy="24" r="13" fill="#2176FF"/>
    <path d="M49 89 H39 C29 89 34 74 43 60 L50 51 Q55 44 61 48
      Q66 51 61 60 L52 76 L74 79 Q81 80 79 91 L75 115"
      stroke="#2176FF" stroke-width="10"/>
    <path d="M94 42 C108 54 111 69 103 82 M98 72 L103 84 L115 77"
      stroke="#8BBDFF" stroke-width="7"/>
  `),
  sit_to_stand: movementSvg(`
    <path d="M16 76 L22 101 H46 Q52 101 52 108 V119 M22 101 L17 119"
      stroke="#2176FF" stroke-width="6"/>
    <circle cx="70" cy="21" r="13" fill="#2176FF"/>
    <path d="M59 80 C46 79 39 74 45 61 L53 47 Q58 39 63 44
      Q69 48 64 56 L56 73 L80 94 L75 114 H84 M44 80 L66 98 L62 116"
      stroke="#2176FF" stroke-width="10"/>
    <path d="M105 77 V43 M96 53 L105 42 L114 53"
      stroke="#8BBDFF" stroke-width="7"/>
  `),
  short_walk: movementSvg(`
    <path d="M14 119 H116 M8 97 H26 M8 108 H20"
      stroke="#8BBDFF" stroke-width="5"/>
    <circle cx="67" cy="21" r="13" fill="#2176FF"/>
    <path d="M65 43 L58 75 L43 94 L32 109 M58 75 L80 94 L91 110
      M63 43 L44 56 L36 71 M66 44 L81 64 Q84 67 91 67 L104 66"
      stroke="#2176FF" stroke-width="10"/>
  `),
} as const;

export type MovementIconName = keyof typeof movementIcons;
