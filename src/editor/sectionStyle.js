export function sectionStyle(section, device) {
  const style = { ...section.style, ...(section.responsive?.[device] || {}) };
  return { '--cyb-heading-size': `${style.fontSize || 48}px`, fontFamily: style.fontFamily || 'inherit', color: style.color, backgroundColor: style.backgroundColor, textAlign: style.textAlign, paddingBlock: style.paddingY != null ? `${style.paddingY}px` : undefined, '--cyb-letter-spacing': `${style.letterSpacing || 0}em`, '--cyb-line-height': style.lineHeight || 1.05, maxWidth: style.maxWidth ? `${style.maxWidth}px` : undefined, marginInline: 'auto', minHeight: style.minHeight ? `${style.minHeight}px` : undefined, display: style.hidden ? 'none' : undefined };
}
