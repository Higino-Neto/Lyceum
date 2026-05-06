export interface NavItem {
  id: string;
  label: string;
  href: string;
  subitems?: NavItem[];
}
