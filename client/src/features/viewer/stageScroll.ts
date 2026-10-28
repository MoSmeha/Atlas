/**
 * How far below the top of `container`'s content `element` starts. It adds up layout offsets,
 * not screen boxes, so it is right even while the modal is still scaling in. `container` must
 * be positioned (an offset parent) and an ancestor of `element`; otherwise null.
 */
export function offsetTopWithin(container: HTMLElement, element: HTMLElement): number | null {
  let top = 0;
  let node: HTMLElement | null = element;
  while (node && node !== container) {
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return node === container ? top : null;
}

/** Scrolls `container` so `element` sits in the middle of what shows below `topInset` (a sticky header). */
export function scrollToMiddle(container: HTMLElement, element: HTMLElement, topInset = 0): void {
  const top = offsetTopWithin(container, element);
  if (top === null) return;
  const visible = container.clientHeight - topInset;
  container.scrollTop = Math.max(0, top - topInset - (visible - element.offsetHeight) / 2);
}
