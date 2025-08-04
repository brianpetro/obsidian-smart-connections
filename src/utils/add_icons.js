import { addIcon } from 'obsidian';
export function add_smart_dice_icon() {
    addIcon("smart-dice", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="1" y="1" width="22" height="22" rx="2" fill="none"/>

  <g transform="translate(12 10) scale(0.18) translate(-50 -50)">
    <path d="M50 20 L80 40 L80 60 L50 100" fill="none" stroke="currentColor" stroke-width="4"/>
    <path d="M30 50 L55 70" fill="none" stroke="currentColor" stroke-width="5"/>
    <circle cx="50" cy="20" r="9" fill="currentColor"/>
    <circle cx="75" cy="40" r="9" fill="currentColor"/>
    <circle cx="75" cy="70" r="9" fill="currentColor"/>
    <circle cx="50" cy="100" r="9" fill="currentColor"/>
    <circle cx="25" cy="50" r="9" fill="currentColor"/>
  </g>
</svg>
`);
}