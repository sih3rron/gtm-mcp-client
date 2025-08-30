import { ExternalLink } from "lucide-react";
import { Button } from "./button";

interface SourceLinkProps {
  url: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
}

export function SourceLink({ url, label, icon, variant = 'ghost' }: SourceLinkProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => window.open(url, '_blank')}
      className="flex items-center space-x-2"
    >
      {icon || <ExternalLink className="h-3 w-3" />}
      <span>{label}</span>
    </Button>
  );
}
