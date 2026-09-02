/** A person's avatar colour, derived from their name so it's stable everywhere. */
export const getAvatarBg = (name: string) => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 60%, 40%)`;
};

/**
 * A community's avatar colour. Communities use a fixed palette rather than the
 * hue hash above — same function everywhere so a community doesn't change
 * colour between the list and its own page.
 */
const COMMUNITY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const getCommunityBg = (name: string) => {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return COMMUNITY_COLORS[sum % COMMUNITY_COLORS.length];
};
