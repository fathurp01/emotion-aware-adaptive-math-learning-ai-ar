import type { ReactNode } from 'react';
import TeacherShell from '@/components/layout/TeacherShell';

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
