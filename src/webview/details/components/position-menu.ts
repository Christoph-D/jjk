const ANCHOR_OFFSET = 2;

export function positionMenu(menu: HTMLElement, pageX: number, pageY: number): void {
  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY || window.pageYOffset;

  let left = pageX + ANCHOR_OFFSET;
  let top = pageY + ANCHOR_OFFSET;

  if (left + menuRect.width > viewportWidth - 10) {
    left = pageX - ANCHOR_OFFSET - menuRect.width;
  }

  if (top + menuRect.height > viewportHeight + scrollY - 10) {
    top = pageY - ANCHOR_OFFSET - menuRect.height;
  }

  if (left < 10) {
    left = 10;
  }

  if (top < scrollY + 10) {
    top = scrollY + 10;
  }

  menu.style.left = left + "px";
  menu.style.top = top + "px";
}
