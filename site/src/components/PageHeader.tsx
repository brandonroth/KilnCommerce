export default function PageHeader({
  tag,
  title,
  subtitle,
  children,
}: {
  tag: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative pt-32 pb-12 text-center bg-[#1A1A18] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_600px_400px_at_50%_80%,rgba(45,74,62,0.3),transparent)]" />
      <div className="relative z-10">
        <p className="tag">{tag}</p>
        <p className="section-title text-cream">{title}</p>
        <p className="text-base text-[rgba(242,237,228,0.55)] max-w-[500px] mx-auto leading-relaxed">
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}
