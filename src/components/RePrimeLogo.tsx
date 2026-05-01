type Props = {
  width?: number;
  className?: string;
  /**
   * `gold` (default) for dark backgrounds, `navy` for light backgrounds.
   */
  variant?: 'gold' | 'navy';
};

export default function RePrimeLogo({ width = 140, className, variant = 'gold' }: Props) {
  const src = variant === 'navy' ? '/terminal-logo-navy.svg' : '/terminal-logo-gold.svg';
  return (
    <img
      src={src}
      alt="RePrime Terminal"
      width={width}
      height={Math.round((width * 120) / 360)}
      className={className}
      draggable={false}
    />
  );
}
