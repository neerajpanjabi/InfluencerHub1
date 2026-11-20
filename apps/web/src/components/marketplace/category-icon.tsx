import { icons, LayoutGrid } from 'lucide-react';

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && (icons as Record<string, React.ComponentType<{ className?: string }>>)[name]) || LayoutGrid;
  return <Icon className={className} aria-hidden />;
}
