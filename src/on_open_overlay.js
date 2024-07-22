// Enhanced transition: smooth background color change with ease-in-out effect
export function on_open_overlay(container) {
  container.style.transition = "background-color 0.5s ease-in-out";
  container.style.backgroundColor = "var(--bold-color)";
  setTimeout(() => { container.style.backgroundColor = ""; }, 500);
}