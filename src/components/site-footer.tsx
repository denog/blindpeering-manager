const links = [
  {
    label: "Code of Conduct",
    href: "https://www.denog.de/de/meetings/denog18/coc.html",
  },
  { label: "Imprint", href: "https://www.denog.de/de/impressum.html" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-4 text-sm text-muted-foreground">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
