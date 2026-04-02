import Link from "next/link";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Render a breadcrumb navigation from an ordered list of items.
 *
 * Renders a <nav aria-label="Breadcrumb"> containing an ordered list of breadcrumb entries.
 * Items with an `href` render as links unless they are the last item; the last item or items without
 * an `href` render as plain text and receive `aria-current="page"`. A visual "/" separator is shown
 * between items.
 *
 * @param items - Array of breadcrumb entries, each with a required `label` and optional `href`
 * @returns A <nav> element containing the breadcrumb list
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.href ?? item.label} className="flex items-center gap-1.5">
              {index > 0 && (
                <span aria-hidden="true" className="text-muted-foreground/50">
                  /
                </span>
              )}
              {isLast || !item.href ? (
                <span
                  className="text-foreground font-medium truncate max-w-[200px]"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors truncate max-w-[200px]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
