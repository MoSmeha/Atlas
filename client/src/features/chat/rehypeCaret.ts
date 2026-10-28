/** The few hast fields this plugin reads; react-markdown passes the full tree. */
interface HastNode {
  type: string;
  value?: string;
  children?: HastNode[];
}

interface CaretOptions {
  /** Class of the caret span, styled by the caller. */
  className: string;
}

/**
 * rehype plugin that puts an empty caret span right after the last piece of visible text,
 * so the streaming caret sits at the end of the line being written: inside the last
 * paragraph, list item or table cell rather than below it.
 */
export function rehypeCaret({ className }: CaretOptions) {
  return (tree: HastNode) => {
    const caret: HastNode & Record<string, unknown> = {
      type: 'element',
      tagName: 'span',
      properties: { className: [className], ariaHidden: 'true' },
      children: [],
    };
    const spot = lastText(tree);
    if (spot) spot.parent.children?.splice(spot.index + 1, 0, caret);
    else tree.children?.push(caret);
  };
}

function lastText(node: HastNode): { parent: HastNode; index: number } | null {
  const children = node.children ?? [];
  for (let index = children.length - 1; index >= 0; index--) {
    const child = children[index];
    if (!child) continue;
    if (child.type === 'text' && (child.value ?? '').trim() !== '') return { parent: node, index };
    const inner = lastText(child);
    if (inner) return inner;
  }
  return null;
}
