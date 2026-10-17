// Open modal overlays (Dialog, Popover, Menu), innermost last. Only the top
// one reacts to Escape, and the page stays scroll-locked until the last one
// closes.
const stack: string[] = [];
let savedOverflow = "";

export function pushOverlay(id: string) {
  if (stack.length === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  stack.push(id);
}

export function popOverlay(id: string) {
  const index = stack.indexOf(id);
  if (index !== -1) stack.splice(index, 1);
  if (stack.length === 0) document.body.style.overflow = savedOverflow;
}

export function isTopOverlay(id: string) {
  return stack[stack.length - 1] === id;
}
