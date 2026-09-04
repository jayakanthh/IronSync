/**
 * Layout constants shared across screens.
 */

/**
 * Bottom padding a scrolling screen inside the tab navigator needs.
 *
 * The tab bar is positioned absolutely (see RootNavigator), so it paints over
 * the bottom of every tab screen instead of shrinking it. Content without this
 * padding gets clipped — the last card, or a button pinned to the end of a
 * form, ends up behind the bar.
 *
 * 49pt bar + up to ~34pt of home-indicator inset + breathing room.
 */
export const TAB_BAR_SPACE = 96;
