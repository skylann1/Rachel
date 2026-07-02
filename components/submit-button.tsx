'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pendingText?: string;
}

export function SubmitButton({ children, pendingText = 'Loading...', ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button {...props} disabled={pending || props.disabled} aria-disabled={pending}>
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
