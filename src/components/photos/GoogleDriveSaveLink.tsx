import { ExternalLink } from 'lucide-react';
import { GOOGLE_DRIVE_FOLDER_URL } from '../../lib/photoStorage';

interface Props {
  className?: string;
}

export default function GoogleDriveSaveLink({ className = '' }: Props) {
  return (
    <a
      href={GOOGLE_DRIVE_FOLDER_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-indigo-600 hover:text-indigo-800 active:text-indigo-900 min-h-[44px] sm:min-h-0 ${className}`}
    >
      <ExternalLink size={13} className="shrink-0" />
      Googleドライブへの保存はこちら
    </a>
  );
}
